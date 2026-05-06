## Goal

Let agencies (and builders) request projects to be onboarded **after going live**, via the CRM. Support Console receives these requests, tracks them through review and import, and pushes status changes (Pending → Approved → Live) back to the CRM so the agency sees the project's lifecycle in their app.

## Concept

Today, projects come in only at onboarding (captured in `accounts.payload.projects`) and via manual `import_jobs`. We add a **third channel**: an inbound CRM webhook that creates a `project_request` row on the account. A staff member triages it, then converts the approved request into a regular `import_jobs` row (kind = `PROJECT`) which already drives extraction → review → import → CRM. When the import lands as a `crm_projects` record, we mark the request **Live** and notify the CRM.

```text
   Agency CRM                Support Console                  Agency CRM
─────────────────       ──────────────────────────       ──────────────────
 Submit project    ───►  POST /project-request    ───►   status: PENDING
 (name, location,        (creates project_requests)
  rep contact)
                          Staff triages on
                          Account ► Project Requests tab
                                │
                          Approve  ──►  status: APPROVED  ───►  CRM updated
                                │
                          "Start import" creates
                          import_jobs row (kind=PROJECT)
                          and links request → job
                                │
                          Existing extraction →
                          review → import flow runs
                                │
                          On import success
                          (crm_projects created)  ───►   status: LIVE
                                                         (CRM updated, project visible)
```

## Scope

### 1. Data model (one new table + small additions)

New table `project_requests`:
- `id`, `account_id`, `external_request_id` (CRM's id, unique per account for idempotency)
- `project_name`, `location`, `city`, `representative_name`, `representative_phone`, `representative_email`
- `notes`, `payload jsonb` (anything else CRM sends)
- `status` enum: `PENDING_REVIEW | APPROVED | REJECTED | IMPORT_IN_PROGRESS | LIVE | CANCELLED`
- `rejection_reason text`
- `import_job_id` (nullable FK to `import_jobs.id`) — set when staff starts an import
- `crm_project_id` (nullable FK to `crm_projects.id`) — set on go-live
- `requested_at`, `reviewed_at`, `reviewed_by`, `live_at`
- `cancelled_at`, `cancelled_by`
- `created_at`, `updated_at`
- RLS: `is_staff(auth.uid())` (matches existing pattern).
- Activity captured in `activity_log` with a new `event_type` value `PROJECT_REQUEST` so it shows in the account's Activity Timeline.
- Trigger: when an `import_jobs` row reaches status `IMPORTED` and was created from a request (`source = 'PROJECT_REQUEST'`, ref in `summary`), bump the linked `project_requests.status` to `LIVE` and capture `crm_project_id`.

### 2. Inbound webhook (Edge Function)

New Edge Function `project-request` (mirrors the `seat-request` pattern):
- Public endpoint, auth via `X-API-Key: SEAT_SUPPORT_INTEGRATION_API_KEY` (same shared secret already used by Terrisage; no new secret to provision).
- `X-Idempotency-Key` honored; matched against `external_request_id`.
- Resolves account by `accounts.tenant_id`.
- Validates required fields (project name, location, representative name + phone OR email).
- Inserts a `project_requests` row with status `PENDING_REVIEW`. Returns `{ ok, requestId, status }`.
- Logs to `activity_log` so it appears in the account timeline.

### 3. Outbound status callback (Edge Function)

New Edge Function `project-request-status-callback` invoked internally whenever the request status changes (Approved / Rejected / Live / Cancelled):
- POSTs to `${TERRISAGE_BASE_URL}/api/integrations/projects/request-status` with `{ tenantId, externalRequestId, status, projectName, liveProjectId?, rejectionReason? }`.
- Auth header: `X-API-Key` (same shared secret).
- Best-effort with one retry; failures recorded in `activity_log` and surfaced as a "CRM sync failed — retry" button in the UI.

### 4. UI — new tab on Account Detail: **Project Requests**

Added to `src/pages/AccountDetail.tsx` between Projects and Imports tabs.

`src/components/account/ProjectRequestsTab.tsx`:
- List view: table grouped by status (Pending Review at top), columns: Project name, Location, Representative, Requested at, Status badge, Actions.
- Filters: status, search by name/rep.
- Status badges follow existing `STATUS_TONE` style (amber for pending, primary for approved, success for live, destructive for rejected, muted for cancelled).
- Row actions per status:
  - **Pending Review** → `Approve`, `Reject` (asks for reason in dialog).
  - **Approved** → `Start import` (creates an `import_jobs` row with `kind=PROJECT`, prefills `label` with project name, stores `source: 'PROJECT_REQUEST'` and `project_request_id` in `summary`, links back, sets request status to `IMPORT_IN_PROGRESS`, then routes to the existing Project Import workspace).
  - **Import in progress** → `Open import` (jumps to the linked job in the Imports tab).
  - **Live** → `Open project` (jumps to `crm_projects`).
  - **Any non-final** → `Cancel` (with confirm).
- Detail drawer: full payload, representative contact (with WhatsApp/Call quick actions), brochures the CRM may have pre-attached, audit timeline of status changes (read from `activity_log`).
- Pending count surfaced as a badge on the tab trigger.

### 5. Imports tab integration

- `ImportsTab` already renders `import_jobs`. We add a small "Source" column / badge that shows **Project request** when `summary.source === 'PROJECT_REQUEST'`, with a link back to the originating request.
- On import completion (existing flow), the trigger from §1 flips the request to **Live** and the outbound callback fires automatically. No new manual step required.

### 6. Notifications & dashboard

- Global notification (existing `notifications` mechanism in `AppHeader`) on each new request: "New project request from {Account} — {Project name}".
- Dashboard "Attention" widget: add **Pending project requests** counter that links to a filtered Accounts view.

### 7. Docs

New `docs/terrisage-project-request-webhook.md` documenting the inbound webhook (endpoint, auth, payload, idempotency, status callback contract, sample curl). Pattern mirrors the existing seat-request doc.

## Out of scope

- No new auth/tenant model — reuses `accounts.tenant_id` and the existing `SEAT_SUPPORT_INTEGRATION_API_KEY`.
- No change to extraction worker — approved requests funnel into the **existing** Project Import workspace untouched.
- No bulk-request UI for now (CRM sends one request per project; bulk handled by repeated calls).

## Technical notes

- Migration adds: enum `project_request_status`, table `project_requests` with indices on `(account_id, status)` and unique `(account_id, external_request_id)`, RLS policy `Staff full access project_requests`, and the import-completion trigger.
- New Edge Functions: `project-request` (inbound), `project-request-status-callback` (outbound). Both use the existing shared API key; no `add_secret` step needed.
- Status changes from the UI go through a small wrapper in `src/lib/projectRequestsApi.ts` that updates the row, writes an `activity_log` entry, and invokes the outbound callback.
- The Project Requests tab uses Supabase realtime on `project_requests` filtered by `account_id` so multiple staff see updates instantly.
- Tab visibility: shown for both `AGENCY_BROKERAGE_CONSULTANCY` and `BUILDER_DEVELOPER` accounts (builders may also request additional projects post go-live).