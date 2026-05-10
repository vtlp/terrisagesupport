
## Goal

Periodically fetch channel-partner project requests from Terrisage's
`GET /api/integrations/project-requests` and surface each one under the
matching account's **Project Requests** tab, with full project details
(name, location, requester, timestamps, etc.).

This complements the existing inbound webhook (which we keep), and
guarantees nothing is lost if a webhook delivery is missed.

## What we'll build

### 1. Schema extension (`project_requests`)

Add nullable columns so Terrisage fields are queryable, not buried in `payload`:

- `requested_by_tenant_id text` (CP tenant UUID from Terrisage)
- `requested_by_agent_id text`
- `requested_by_agent_name text`
- `requested_by_agent_phone text`
- `requested_by_agent_email text`
- `approved_by_agent_id text`
- `approved_by_agent_name text`
- `approved_at timestamptz`
- `terrisage_status text` (raw `PENDING` / `APPROVED` / `REJECTED` from Terrisage,
  separate from our internal lifecycle status)
- `last_synced_at timestamptz`

Unique index on `(account_id, external_request_id)` already exists; we'll rely
on it for upserts.

### 2. New edge function: `terrisage-project-requests-pull`

Public function (no JWT). Behaviour:

1. Read `TERRISAGE_BASE_URL` and `SEAT_SUPPORT_INTEGRATION_API_KEY`.
2. Call `GET {base}/api/integrations/project-requests` with `X-API-Key`.
   No filters — fetch all, newest first.
3. For each item:
   - Look up `accounts.tenant_id = item.requestedByTenant.id`.
     If no match → skip (per "Always require match"), log a single warning
     row in `activity_log` with entity_type=`SYSTEM`.
   - Upsert into `project_requests` keyed on
     `(account_id, external_request_id)` with mapped fields:
     - `project_name` ← `project.name`
     - `location` ← `project.location`
     - `city` ← `project.city`
     - `notes` ← `project.notes`
     - `representative_*` ← `requestedByAgent.*` (kept for back-compat)
     - new columns from §1 populated from `requestedByAgent` /
       `approvedByAgent` / Terrisage timestamps
     - `terrisage_status` ← item.status
     - `payload` ← full raw item (for forensics)
     - `last_synced_at` ← now()
   - Internal `status` mapping (only on insert; never overwrite a row already
     past `PENDING_REVIEW`):
     - `PENDING` → `PENDING_REVIEW`
     - `APPROVED` → `APPROVED`
     - `REJECTED` → `REJECTED` (also write `rejection_reason` if present)
4. Return `{ ok, fetched, upserted, skipped_no_match }` and write one
   `activity_log` summary entry.

### 3. Schedule (pg_cron + pg_net)

Run every 15 minutes via `cron.schedule` calling the new function over HTTPS
with anon key + `Content-Type: application/json`. Inserted via the
`supabase--insert` tool (not migration) since it embeds project-specific URL.

### 4. Manual trigger from the UI

On `ProjectRequestsTab`, add a small **"Sync from Terrisage"** button next
to the search/filter row. It calls
`supabase.functions.invoke('terrisage-project-requests-pull')` and refreshes
the list. This gives staff a way to force a sync without waiting 15 min.

### 5. Show Terrisage-specific fields in the row

Extend `RequestRow` in `ProjectRequestsTab.tsx` to display:

- The CP tenant id (short) and `requested_by_agent_name` (already partially
  shown as `representative_name`)
- A small badge for `terrisage_status` when it differs from internal status
- Tooltip on "CRM ref" showing full `external_request_id`

Project name, location, requester phone/email, and requested-at are already
rendered correctly.

## What we deliberately do NOT change

- The existing inbound `project-request` webhook stays as-is. The pull is
  reconciliation, not a replacement.
- `project-request-status-callback` (outbound) keeps notifying Terrisage when
  staff approve / reject / start import / go live.
- Internal status lifecycle (`PENDING_REVIEW → APPROVED → IMPORT_IN_PROGRESS →
  LIVE / REJECTED / CANCELLED`) is unchanged. We only auto-set it on first
  insert; subsequent pulls never regress an in-progress request.

## Open assumptions (calling out for confirmation, not blocking)

- Terrisage's response shape for `project` is `{ name, location, city?,
  notes? }` and `requestedByAgent` is `{ id, name, phone, email }`. If actual
  field names differ, we adjust the mapper in one place.
- 15-minute cadence is acceptable. Easy to change later.

## Answer to your question

Yes — with the schema extension above, every project name plus the requester's
details, tenant, timestamps, and approval info will land in the Project
Requests tab on the matching account, both via the live webhook and as a
safety net via the scheduled pull.
