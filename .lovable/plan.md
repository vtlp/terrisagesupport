## Goal

Wire the **Confirm and import** action on Lead and Secondary-property imports to also push the file to UpYard's `/api/support/onboarding` ingestion API, then poll the resulting job until terminal and surface the outcome in the UI / activity log.

## What changes

### 1. Secret

Add a new runtime secret **`SUPPORT_ONBOARDING_INGESTION_API_KEY`** (separate from `SEAT_SUPPORT_INTEGRATION_API_KEY`). Used by the new edge function only.

### 2. New edge function: `terrisage-onboarding-ingest`

Public function (verify_jwt = false), service-role client. Two actions in one function:

**POST body**
```json
{ "action": "import", "accountId": "...", "jobId": "...", "entityType": "leads" | "properties" }
```

Behaviour:
1. Look up `accounts.tenant_id`. Missing → `{ ok:false, error:'NO_TENANT' }`.
2. Look up `import_jobs` row + its latest `import_files` (CSV category) row.
3. Download file bytes from `import-files` storage bucket.
4. If file is `.csv`, convert to `.xlsx` server-side (use `xlsx` npm via esm.sh) so the upstream accepts it. If already `.xlsx`/`.xls`, pass through.
5. Build `multipart/form-data` with field `file`.
6. `POST {TERRISAGE_BASE_URL}/api/support/onboarding/tenants/{tenantId}/{entityType}/import`
   - `X-API-Key: SUPPORT_ONBOARDING_INGESTION_API_KEY`
   - `X-Idempotency-Key: {entityType}:{jobId}` (stable per local job)
7. Persist `upstreamJobId`, `upstreamStatus='PENDING'`, `idempotencyKey` into `import_jobs.summary` (jsonb merge). Write `import_activity` event `upstream_submitted`.
8. Return `{ ok:true, upstreamJobId, replayed }`.

**Poll action**
```json
{ "action": "poll", "accountId": "...", "jobId": "..." }
```
- Reads `summary.upstreamJobId` from `import_jobs`, calls `GET /tenants/{tenantId}/import-jobs/{upstreamJobId}` with the same `X-API-Key`, mirrors `status / inserted / totalRows / errorDetails` into `summary` and writes a final `upstream_succeeded` or `upstream_failed` activity row when terminal.

Errors:
- 403 from upstream → log + return `{ok:false,error:'FORBIDDEN'}` (key wrong).
- 409 → log `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` (re-uploaded file with same key) and bubble up.
- 4xx/5xx → store body preview into `summary.upstreamError`.

### 3. UI wiring

`LeadImportWorkspace.tsx` and `SecondaryImportWorkspace.tsx`, in `runImport()`:

After the existing local `crm_leads` / `crm_secondary_properties` insert succeeds:

1. Toast "Local rows saved. Pushing to UpYard…".
2. `supabase.functions.invoke('terrisage-onboarding-ingest', { body: { action:'import', accountId, jobId: job.id, entityType: 'leads' | 'properties' } })`.
3. Start a setInterval (every 5s, max ~2 min) that calls the same function with `action:'poll'` until `summary.upstreamStatus` is `SUCCEEDED` or `FAILED`.
4. Toast on terminal: success → `Pushed N rows to UpYard`; failure → show `summary.upstreamError` and a "Retry push" button on the workspace header.
5. Activity log entries (already rendered by `ActivityLog`) will show `upstream_submitted` → `upstream_succeeded`/`upstream_failed`.

If the function call returns `error:'NO_TENANT'`, surface "Account is not yet linked to an UpYard tenant — local rows saved, push skipped."

### 4. No DB migration needed

We reuse `import_jobs.summary jsonb` and `import_activity` for everything. (Adding dedicated columns can come later if you want them queryable.)

## Open questions to confirm before I build

1. **TERRISAGE_BASE_URL** — same env var already used by `terrisage-project-push` etc. (resolves to `https://upyard-backend.onrender.com` per current logs). The new path is `/api/support/onboarding/...` on the same host. Confirm same host is correct?
2. **Push only after local insert succeeds**, not before — correct? (i.e. local copy is source of truth, UpYard is mirrored.)
3. **Properties** — for now, do we wire it on the existing **Secondary properties** workspace and send to `/properties/import`? (Plot/villa rules from your spec apply on the upstream side; we just forward the file.)
4. **Projects import** stays out of scope for this round (it has different prerequisites — `businessType=LARGE`)?

If answers are: (1) yes (2) yes (3) yes (4) yes — I'll proceed straight to adding the secret and building the function + UI changes.