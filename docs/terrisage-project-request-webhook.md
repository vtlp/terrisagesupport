# Client CRM → Support: Project Request Webhook

When an end user inside the client CRM (e.g. Terrisage) requests a new project
to be onboarded onto the platform **after going live**, the CRM must call this
inbound webhook on the Support backend. Support creates a `project_requests`
row, surfaces it on the Account ► **Project Requests** tab, and pushes status
changes (Approved / Rejected / Live / Cancelled) back to the CRM.

---

## 1. Endpoint

```
POST https://phkzxeajzglbmaymvtmt.functions.supabase.co/project-request
```

- TLS 1.2+ required.
- `Content-Type: application/json; charset=utf-8`.
- Public function (no Supabase JWT). Auth is via shared API key — see §3.

## 2. When to call

Call this **once** for every project an agency or builder requests to add to
their account. Do NOT call this for the projects collected during the initial
onboarding form — those flow through the onboarding submission, not this
endpoint.

## 3. Authentication

```
X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
X-Idempotency-Key: <stable-id-for-this-request>
```

The API key is the same shared secret already used for `seat-request` and the
usage push endpoint. Wrong/missing key → `401`.

The idempotency key MUST equal `externalRequestId` in the body (Support
de-duplicates on `(account_id, external_request_id)`).

## 4. Request body

```json
{
  "externalRequestId": "req_8af31...",
  "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
  "projectName": "Skyline Heights Phase 2",
  "location": "Madhapur, Hyderabad",
  "city": "Hyderabad",
  "representativeName": "Asha Rao",
  "representativePhone": "+91 98765 43210",
  "representativeEmail": "asha@agencycorp.in",
  "notes": "Builder wants the project listed before Diwali.",
  "payload": { "anyExtraFieldsFromTheCrm": true },
  "requestedAt": "2026-05-06T10:22:00.000Z"
}
```

Required: `tenantId`, `projectName`, `location`. Everything else is optional but
strongly recommended (especially `representativePhone` so Support can call back).

## 5. Responses

| Status | Body |
|---|---|
| 200 | `{ "ok": true, "requestId": "...", "status": "PENDING_REVIEW" }` |
| 200 | `{ "ok": true, "requestId": "...", "status": "...", "deduped": true }` (idempotent replay) |
| 400 | `{ "ok": false, "error": "MISSING_FIELDS" \| "INVALID_BODY" }` |
| 401 | `{ "ok": false, "error": "UNAUTHORIZED" }` |
| 404 | `{ "ok": false, "error": "TENANT_NOT_FOUND" }` |
| 500 | `{ "ok": false, "error": "DB_ERROR" \| "INTEGRATION_NOT_CONFIGURED" }` |

## 6. Status lifecycle on Support

| Status | Meaning |
|---|---|
| `PENDING_REVIEW` | Waiting for Support staff to triage. |
| `APPROVED` | Staff accepted the request; awaiting brochure / data import. |
| `REJECTED` | Staff declined; `rejectionReason` is sent back. |
| `IMPORT_IN_PROGRESS` | Staff started the project-import workflow (extraction → review → import). |
| `LIVE` | Import finished; the project now exists in `crm_projects`. |
| `CANCELLED` | Withdrawn by Support staff. |

## 7. Status callback to the CRM

Whenever a request changes status, Support POSTs to:

```
POST {TERRISAGE_BASE_URL}/api/integrations/projects/request-status
X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
Content-Type: application/json
```

```json
{
  "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
  "externalRequestId": "req_8af31...",
  "requestId": "0a92...",
  "projectName": "Skyline Heights Phase 2",
  "status": "LIVE",
  "liveProjectId": "0c11...",
  "rejectionReason": null,
  "at": "2026-05-08T08:14:11.000Z"
}
```

The CRM should reflect this on the requesting user's project request screen
(Pending → Approved → Live, or Rejected with reason). Support retries once on
failure and logs the result to the account activity timeline.

## 8. Sample curl

```bash
curl -X POST https://phkzxeajzglbmaymvtmt.functions.supabase.co/project-request \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $SEAT_SUPPORT_INTEGRATION_API_KEY" \
  -H "X-Idempotency-Key: req_8af31..." \
  -d '{
    "externalRequestId": "req_8af31...",
    "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
    "projectName": "Skyline Heights Phase 2",
    "location": "Madhapur, Hyderabad",
    "representativeName": "Asha Rao",
    "representativePhone": "+91 98765 43210"
  }'
```
