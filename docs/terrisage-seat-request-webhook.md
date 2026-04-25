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

## 9. Open questions for Terrisage

- Confirm the exact shape of `tenantId` Terrisage will send — must be
  byte-identical to what was provisioned on Support.
- Confirm whether Terrisage wants a callback / webhook on **rejection** as
  well as on fulfilment.
- Confirm the source IP range Terrisage will call from, in case Support
  needs to allow-list later.
