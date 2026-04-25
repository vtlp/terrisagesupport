# Terrisage → Support: Additional Seat Request Webhook

This document describes the **inbound webhook** Terrisage CRM must call on the
Support backend whenever an end-user (inside the Terrisage app) raises a request
for **additional seats**. Support will create a `seat_requests` row, notify the
account owner internally, and (once an admin clicks **Fulfil**) push the new
seat allocation back to Terrisage via the existing
`POST /api/integrations/seats/seat-allocation` endpoint.

---

## 1. Endpoint

```
POST  https://phkzxeajzglbmaymvtmt.functions.supabase.co/seat-request
```

- TLS 1.2+ required.
- Content-Type: `application/json; charset=utf-8`.
- This function is **public** (no Supabase JWT). Authentication is via API key
  header — see §3.

---

## 2. When to call

Call this endpoint **once** for every additional-seat request created in
Terrisage by a tenant admin. Do **not** call it for:

- Initial seat provisioning (handled at account creation).
- Seat removals / deletions (handled inside the renewal cycle on Support).
- Cycle / billing window updates (Support pushes these to Terrisage, not the
  other way round).

This webhook is **best-effort** and non-blocking for the Terrisage app user
flow. Support handles it idempotently — see §6.

Retries: see §6.

---

## 3. Authentication

Headers sent by Terrisage:

```
Content-Type: application/json
X-API-Key: b7f3e9a14c8d265f0a91e7b3c6d4582a91ef03b7d8c526a9418f0e3b2d7a64c1
X-Idempotency-Key: seat-request-<seatRequestId>
```

- `X-API-Key` value is the shared secret issued by Support
  (stored on the Support backend as `SEAT_SUPPORT_INTEGRATION_API_KEY`).
  Current value: `b7f3e9a14c8d265f0a91e7b3c6d4582a91ef03b7d8c526a9418f0e3b2d7a64c1`.
  Treat as a secret — store in Terrisage's secret manager, do not commit to git.
- Requests without the header, or with a wrong key, will get `401 Unauthorized`.
- `X-Idempotency-Key` header **must** match `idempotencyKey` in the body.

---

## 4. Request body

```json
{
  "seatRequestId": "cm....",
  "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
  "requestedAdditionalSeats": 3,
  "createdByAgentId": "a2....",
  "note": "Need seats for new hiring batch",
  "idempotencyKey": "seat-request-cm....",
  "requestedAt": "2026-04-24T11:35:12.000Z"
}
```

| Field                      | Type             | Required | Notes |
|----------------------------|------------------|----------|-------|
| `seatRequestId`            | string           | yes      | App-side (Terrisage) request primary identifier. |
| `tenantId`                 | string (UUID v4) | yes      | Must match `accounts.tenant_id` on Support. Lowercase canonical UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). |
| `requestedAdditionalSeats` | integer ≥ 1      | yes      | Number of **additional** seats (delta, not new total). |
| `createdByAgentId`         | string           | no       | Terrisage agent / user id that raised the request. |
| `note`                     | string (≤ 500)   | no       | Optional free text shown to the support agent. |
| `idempotencyKey`           | string (≤ 128)   | yes      | Stable per logical request — see §6. Must equal `X-Idempotency-Key` header. |
| `requestedAt`              | string (ISO 8601, UTC) | no | Defaults to server time if omitted. |

---

## 5. Responses

### 5.1 Success — request accepted

`HTTP 200 OK`

```json
{
  "ok": true,
  "seatRequestId": "8b1f...-uuid",
  "status": "PENDING",
  "duplicate": false
}
```

### 5.2 Success — duplicate (same idempotencyKey already seen)

`HTTP 200 OK`

```json
{
  "ok": true,
  "seatRequestId": "8b1f...-uuid",
  "status": "PENDING",
  "duplicate": true
}
```

The same `seatRequestId` is returned. No second row is created.

> Note: `seatRequestId` in the response is the **Support-side** UUID for the
> created `seat_requests` row. The Terrisage-side `seatRequestId` from the
> request body is preserved internally for traceability.

### 5.3 Errors

| HTTP | `error` code               | Meaning |
|------|----------------------------|---------|
| 400  | `INVALID_BODY`             | Missing/malformed fields. Body lists which fields. |
| 401  | `UNAUTHORIZED`             | Missing or wrong `X-API-Key`. |
| 404  | `TENANT_NOT_FOUND`         | No `accounts` row matches `tenantId`. |
| 409  | `ACCOUNT_NOT_ACTIVE`       | Account is `CANCELLED` / `STALLED_ONBOARDING`. |
| 409  | `IDEMPOTENCY_MISMATCH`     | Same `idempotencyKey` reused with a different `requestedAdditionalSeats` or `tenantId`. |
| 422  | `INVALID_SEAT_COUNT`       | `requestedAdditionalSeats` < 1 or > 1000. |
| 500  | `INTERNAL_ERROR`           | Server-side failure. Safe to retry. |

Error body shape:

```json
{ "ok": false, "error": "INVALID_BODY", "detail": "requestedAdditionalSeats must be >= 1" }
```

---

## 6. Idempotency & retries

- Support stores `idempotencyKey` against the `seat_requests` row.
- On retry with the **same** `idempotencyKey` (and same `tenantId` +
  `requestedAdditionalSeats`) → returns the original `seatRequestId` with
  `"duplicate": true`. No state change.
- Reusing the same `idempotencyKey` with a **different** `tenantId` or
  `requestedAdditionalSeats` → `409 IDEMPOTENCY_MISMATCH`.
- Use **exactly one** `idempotencyKey` per logical request from Terrisage
  (e.g. `seat-request-<seatRequestId>`).
- Recommended retry policy on `5xx` / network error: 3 attempts with
  exponential backoff (2 s, 10 s, 60 s).
- Do **not** retry on `4xx` (other than `429` if we ever return it).

---

## 7. What happens after the call

1. Support inserts a row into `seat_requests` with `status = 'PENDING'`.
2. An internal notification is raised to the account owner / support agent.
3. When a Support admin clicks **Fulfil**:
   - `seats_purchased` on the account is incremented by `requestedAdditionalSeats`.
   - Support calls **back** to Terrisage:
     - `POST /api/integrations/seats/seat-allocation` with the new absolute
       `newAllocatedTotal` and an idempotency key derived from the request id.
4. If Support rejects the request, no callback is made; the request row is
   marked `REJECTED`.

There is currently **no** outbound notification to Terrisage on rejection.
Let us know if you need one.

---

## 8. Test checklist for Terrisage dev

1. POST with a valid body and a fresh `idempotencyKey` → expect `200`,
   `duplicate: false`, a UUID `seatRequestId`.
2. POST the **same** body again → expect `200`, `duplicate: true`, same
   `seatRequestId`.
3. POST with `tenantId` that does not exist on Support → expect `404`
   `TENANT_NOT_FOUND`.
4. POST with `requestedAdditionalSeats: 0` → expect `422` `INVALID_SEAT_COUNT`.
5. POST without `X-API-Key` → expect `401` `UNAUTHORIZED`.
6. After a successful POST, ask Support to **Fulfil** the request and
   confirm Terrisage receives the matching `seat-allocation` callback with
   the same tenant.

---

## 9. Open questions for Terrisage CRM

- Confirm the exact shape of `tenantId` Terrisage CRM will send — must be
  byte-identical to what was provisioned on Terrisage Support.
  (`tenant_id` is set on the Terrisage Support account when the first logins
  are created on Terrisage CRM.)
- Confirm whether Terrisage CRM wants a callback / webhook on **rejection**
  as well as on fulfilment.
- Confirm the source IP range Terrisage CRM will call from, in case Terrisage
  Support needs to allow-list later.

---

## 10. Outbound endpoints — Terrisage Support to Terrisage CRM

These three endpoints live on **Terrisage CRM** and are called by **Terrisage
Support**. Endpoints 10.1 and 10.2 are **already built on Terrisage CRM** and
in active use. Endpoint 10.3 (live capacity pull) is planned for a later
phase.

**Common to all three**

```
Base URL : {TERRISAGE_BASE_URL}                 (env var on Terrisage Support)
Auth     : X-API-Key: <shared secret>           (same key as the inbound webhook)
Content  : application/json; charset=utf-8
```

Terrisage Support treats every call as best-effort: a non-2xx response is
logged and surfaced as a warning toast in the UI but never blocks the user.

---

### 10.1 `POST /api/integrations/seats/seat-cycle` — billing cycle push ✅ built

**When Terrisage Support calls it:** every time a Support admin saves the
billing cycle dates on the Account → Billing tab (cycle start, cycle end,
or billing frequency change).

**Request body**

```json
{
  "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
  "seatBillingCycleStartAt": "2026-04-01T12:00:00.000Z",
  "seatBillingCycleEndAt":   "2027-04-01T12:00:00.000Z",
  "seatBillingFrequency":    "YEARLY"
}
```

| Field                     | Type                       | Notes |
|---------------------------|----------------------------|-------|
| `tenantId`                | string (UUID)              | Must match the tenant provisioned on Terrisage CRM. |
| `seatBillingCycleStartAt` | ISO 8601 timestamp (UTC)   | Inclusive start of current billing window. |
| `seatBillingCycleEndAt`   | ISO 8601 timestamp (UTC)   | Exclusive end; always strictly greater than start. |
| `seatBillingFrequency`    | enum                       | `"SIX_MONTH"` or `"YEARLY"`. (Monthly / quarterly cycles are not pushed.) |

**Validation (Terrisage CRM side):**
- `seatBillingCycleStartAt < seatBillingCycleEndAt`
- `seatBillingFrequency` must be `"SIX_MONTH"` or `"YEARLY"`

**Expected response (200):**

```json
{ "ok": true }
```

Non-2xx is treated as a soft failure on Terrisage Support (logged + warning toast, never blocks the user).

---

### 10.2 `POST /api/integrations/seats/seat-allocation` — apply seat allocation (absolute) ✅ built

**Purpose:** set the tenant's `allocatedSeats` on Terrisage CRM to an absolute target via `newAllocatedTotal`.

**When Terrisage Support calls it:** immediately after a Support admin clicks
**Fulfil** on a seat request (the request that originally arrived via the
inbound webhook in §1–§7).

**Request body**

```json
{
  "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
  "newAllocatedTotal": 15,
  "invoiceRef": "INV-2026-1001",
  "idempotencyKey": "alloc-<tenantId>-<invoiceRef>"
}
```

| Field               | Type           | Notes |
|---------------------|----------------|-------|
| `tenantId`          | string (UUID)  | Same tenant as the original request. |
| `newAllocatedTotal` | integer ≥ 0    | The **new absolute** seat total on the account, not a delta. |
| `invoiceRef`        | string         | Payment reference for the upsell payment that unlocked the fulfilment (sourced from `seat_upsell_links.payment_reference`, falling back to `link_id`). Always sent in normal flow — fulfilment only runs after the upsell payment is recorded. |
| `idempotencyKey`    | string ≤ 128   | Stable per fulfilment. Pattern: `alloc-<tenantId>-<invoiceRef>`. |

**Expected response (200):**

```json
{ "ok": true, "beforeAllocated": 10, "afterAllocated": 15 }
```

**Rules / errors (Terrisage CRM side):**
- Reject if `newAllocatedTotal < 0`.
- Reject if `newAllocatedTotal < consumedSeats` → error code `ALLOCATION_BELOW_CONSUMED`.
- Idempotency:
  - Same `idempotencyKey` + same `tenantId` + same `newAllocatedTotal` → replay success (no-op `200`).
  - Same `idempotencyKey` + different `tenantId` or `newAllocatedTotal` → conflict error.

---

### 10.3 `GET /api/integrations/seats/seat-snapshot?tenantId=<uuid>` — live tenant seat snapshot ✅ wired

**Purpose:** allow Terrisage Support to fetch the current seat counters for a
specific tenant using the integration API key. Used to populate the live
"Seat capacity" block on the Account → Seats tab.

**When Terrisage Support calls it:** automatically every time a Support agent
opens an Account detail page that has a `tenant_id` linked. The returned
counters are upserted into Support's `seat_usage_snapshots` table so other
views (dashboards, reports) can read the cached values. On failure, Support
shows a warning toast and continues to display the last known snapshot.

**Request**

```
GET {TERRISAGE_BASE_URL}/api/integrations/seats/seat-snapshot?tenantId=<uuid>
Headers:
  X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
```

**Expected response (200)**

```json
{
  "ok": true,
  "tenantId": "c39aa7cf-b452-4235-bdcb-0fc3a62fbf18",
  "allocatedSeats": 10,
  "consumedSeats": 8,
  "reservedSeats": 0,
  "availableSeats": 2,
  "invitableAvailableSeats": 2,
  "requestedSeats": 0,
  "seatBillingCycleStartAt": null,
  "seatBillingCycleEndAt": null,
  "seatBillingFrequency": null
}
```

| Field                     | Type                            | Notes |
|---------------------------|---------------------------------|-------|
| `tenantId`                | string (UUID)                   | Echoed from the request. |
| `allocatedSeats`          | integer ≥ 0                     | Current cap on Terrisage CRM (should match the last 10.2 `newAllocatedTotal`). |
| `consumedSeats`           | integer ≥ 0                     | Seats currently active / in use by the tenant. |
| `reservedSeats`           | integer ≥ 0                     | Seats held by pending invites. |
| `availableSeats`          | integer ≥ 0                     | `allocated − consumed − reserved`. |
| `invitableAvailableSeats` | integer ≥ 0                     | Subset of `availableSeats` that can actually be invited right now. |
| `requestedSeats`          | integer ≥ 0                     | Open additional-seat requests on the tenant. |
| `seatBillingCycleStartAt` | ISO 8601 timestamp (UTC) \| null | Mirrors the value last pushed via 10.1. |
| `seatBillingCycleEndAt`   | ISO 8601 timestamp (UTC) \| null | Mirrors the value last pushed via 10.1. |
| `seatBillingFrequency`    | `"SIX_MONTH"` \| `"YEARLY"` \| null | Mirrors the value last pushed via 10.1. |

**Validation / errors (Terrisage CRM side):**
- `tenantId` query param is required and must be a valid UUID → `400 INVALID_REQUEST`.
- Missing or wrong `X-API-Key` → `403 FORBIDDEN`.
- Unknown tenant → `404 NOT_FOUND`.

Terrisage Support treats non-2xx as a soft failure: a warning toast is shown
and the previously cached snapshot stays on screen until the next successful
call.

