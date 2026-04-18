

## Plan — Seat capacity API for the CRM app

The Support Console (this app) already manages seat counts and billing settings per account. We need to expose a **read-only seat capacity endpoint** plus an optional **seat-request workflow** that the external CRM app can call. The CRM never writes seats directly — it only reads availability and posts requests; staff fulfil requests here, which keeps billing/subscription as the source of truth.

---

### 1. Capacity model (no schema change needed for the basics)

Capacity per account is derived:
- `seats_purchased` = new column on `account_billing_settings` (integer, default 0). Drives the cap.
- `seats_used` = `count(account_seats where is_active = true)`
- `seats_available` = `seats_purchased - seats_used`

Add one column + a SQL view for fast reads.

```text
account_billing_settings
  + seats_purchased INT NOT NULL DEFAULT 0

account_seat_capacity (VIEW)
  account_id, seats_purchased, seats_used, seats_available, plan_name, status
```

### 2. Seat-request table (CRM → Support Console workflow)

```text
seat_requests
  id, account_id, requested_by_email, requested_seats INT,
  status ENUM('PENDING','APPROVED','REJECTED','FULFILLED'),
  reason TEXT, decided_by, decided_at, created_at
RLS: staff full access; anon INSERT allowed via edge function only.
```

When staff approve & fulfil → bump `seats_purchased` and (optionally) generate an invoice line. Activity log entry written automatically.

### 3. Edge functions (the CRM's integration surface)

Three functions, all secured by a per-account API key the CRM stores:

- `GET  seat-capacity`      → `{ purchased, used, available, plan, status }`
- `POST seat-request`        → body `{ account_id, requested_seats, requested_by_email, reason }`
- `GET  seat-request/:id`    → status polling

Auth: `x-account-api-key` header validated against a new `account_api_keys` table (hashed). Rate-limit: 60 req/min per key.

### 4. Support Console UI additions

- **BillingTab**: add "Seats purchased" input next to base/seat rate; show live `Used X / Purchased Y · Available Z` chip; warn when used > purchased.
- **New tab "Seat requests"** on AccountDetail: list pending requests with Approve / Reject / Fulfil buttons; fulfilling auto-increments `seats_purchased` by the requested amount.
- **Notifications**: pending seat requests appear in the global attention badge.

### 5. What the CRM dev needs (deliverables doc)

A short integration doc generated at `/mnt/documents/seat-integration.md` covering:
- Endpoints, payloads, error codes
- How to render `2 / 3 seats used` from `GET seat-capacity`
- Invite gate: if `available <= 0` → block + show "No available seats remaining"
- Request flow: POST → poll → on `FULFILLED` re-fetch capacity
- Refresh triggers: after invite, revoke, deactivation, or webhook receipt
- Optional webhook: we POST `seat.capacity.changed` to a CRM URL when `seats_purchased` or active seat count changes

### 6. Files

- **Migration**: add `seats_purchased`, create `seat_requests`, `account_api_keys`, view `account_seat_capacity`, RLS, triggers (activity log + capacity-change notify).
- **Edge functions**: `supabase/functions/seat-capacity/index.ts`, `seat-request/index.ts`.
- **Edited**: `src/components/account/BillingTab.tsx` (purchased seats field + capacity chip), `src/pages/AccountDetail.tsx` (new "Seat requests" tab).
- **New**: `src/components/account/SeatRequestsTab.tsx`, `src/components/account/ApiKeysCard.tsx` (generate/rotate key for the CRM).
- **Doc**: `/mnt/documents/seat-integration.md`.

### Out of scope (will skip unless asked)
- Auto-charging the customer when seats are increased (manual invoice for now).
- Per-seat metadata sync (CRM keeps member details; Console only tracks counts + optional name).

