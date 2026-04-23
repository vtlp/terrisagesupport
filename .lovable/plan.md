
## Seats, Billing & CRM Sync — revised plan (edge cases included)

### Confirmation: data flow you asked about
- Both **Agency** and **Builder** onboarding forms already use the **same prefill mechanism** (`readOnboardingPrefill`) and submit a payload with identical keys: `owner_name / owner_phone / owner_email / company_name / city / team.seats_required / team_members[] / projects[]`.
- The CRM-generated onboarding link carries `name`, `phone`, `email`, `team_size` query params; when present they are pre-filled and **locked** on the form. Customer can still add user details for any number of seats up to that count.
- `convert_enquiry_to_account` reads that same payload to create the **Account**, **account_seats**, **account_billing_settings** (with `seats_purchased = team_size`) and the first **invoice** if Razorpay paid it.
- So no schema work is needed on the form side. Locked fields, seat count source, and invoice tie-up are already correct.

---

### What we are building (no DB schema changes — everything below already exists)

The DB foundation is in place: `account_billing_settings` (with subscription period, auto_renew, country, cancellation), `seat_change_events`, `account_renewal_decisions`, `seat_usage_snapshots`, `crm_seat_state`, `apply_seat_delta`, `renew_subscription`, `compute_proration`, `scan_crm_sync_stale`. We will wire the **UI + edge functions + cron** on top of the existing tables and RPCs.

---

### 1. Edge functions (CRM ↔ Console contract)

| Endpoint | Method | Purpose |
|---|---|---|
| `/seat-capacity` (extend) | GET | Returns `purchased`, `in_use` (from latest snapshot), `available`, `plan`, `cycle`, `period_start/end`, `country`, `owner_name`, `auto_renew`. |
| `/seat-request` (existing) | POST/GET | Unchanged. |
| `/seat-usage` (new) | POST | CRM upserts `{ allocated, consumed, reserved, available, members[] }` into `seat_usage_snapshots` (one row per account). |
| `/account-profile` (new) | GET | Subscription metadata for CRM boot: plan, cycle, start, current period, renewal, owner, country, allocated. |
| `/seat-events` (new) | GET `?since=` | Returns recent `seat_change_events` so CRM can react (unlock invite slots after admin adds seats). |

All authenticate via existing `x-account-api-key` header → `validate_account_api_key`.

### 2. Seats & Requests tab (`SeatsAndRequestsTab.tsx`)

Replace the four-tile grid with a capacity panel:
```text
┌────────────────────────────────────────────────────────────┐
│ Allocated │ In use (CRM) │ Available │ Pending requests   │
│    30     │      18      │    12     │   +5 (PENDING)     │
└────────────────────────────────────────────────────────────┘
Last CRM sync: 2 min ago · source: CRM
```
- **Adjust seats** dialog (admin): mode add/remove, effective immediate (prorated) or next renewal, live preview from `compute_proration`, calls `apply_seat_delta`.
- **Provision in CRM** action group on FULFILLED requests: "Auto-create logins" (loop `/admin-create-user`) or "Send dev instructions" (copy JSON+curl). Marks each `account_seats` row as provisioned.
- **Pending logins** strip listing seats from onboarding without a created auth user yet, with one-click "Create login".
- Realtime subscription on `seat_usage_snapshots` keeps the panel live.

### 3. Billing tab (`BillingTab.tsx`)

- New subscription card row: **Subscription started**, **Current period** (start → end), **Auto-renew toggle**, **Country**.
- **Renewal strip** within 30 days of `current_period_end`: `[Renew as-is] [Renew + change seats] [Cancel renewal]` → calls `renew_subscription`.
- Invoice list shows `kind` chip (`CYCLE | PRORATION | RENEWAL`) — already in DB.
- Manual override: admin can edit `seats_purchased` only via the Adjust-seats dialog (single source of truth).

### 4. Account header

Small **CRM sync** chip next to the status badge: green if `reported_at < 1h`, amber 1–24h, red >24h or never. Tooltip shows last payload + endpoint.

### 5. Admin → Integrations: CRM Sync Contract

Read-only doc card listing the 5 endpoints, headers, sample request/response, plus the existing `ApiKeysCard` for key rotation. Pure documentation, no logic.

### 6. Cron additions (uses existing pg_cron)

Add `scan_crm_sync_stale()` and `scan_renewals_due()` to the existing every-15-minutes job so `RENEWAL_DUE` and `CRM_SYNC_STALE` notifications fire without manual triggering.

### 7. Onboarding form — no functional change
- Agency + Builder forms keep current behaviour. We will only **tighten the lock**: when `prefill.teamSize` is present, the seats field is read-only with a small "Set by your account manager" hint (already partially in place; we will make the visual treatment consistent across both forms).
- All other fields stay editable as today.

---

### Edge cases covered

1. **Customer requests 10 seats but only fills 2 user details** → `seats_purchased=10`, only 2 `account_seats` rows. Seats panel shows "8 seats unallocated · Provision later" CTA. CRM `/seat-capacity` reports `purchased=10, allocated=2`.
2. **Mid-cycle seat increase** → `apply_seat_delta` writes a `PRORATION` invoice (DRAFT) using `compute_proration` (days remaining ÷ cycle days). UI shows preview before confirm.
3. **Seat decrease mid-cycle** → no refund, just decrements `seats_purchased`. We block decrease below `in_use` from CRM snapshot.
4. **Seat decrease at renewal** → handled by `renew_subscription(_decision='RENEW_DECREASE', _new_seats=N)` with notes captured.
5. **Seats marked DELETED in CRM** mid-cycle → kept until renewal, then `renew_subscription` purges them (`crm_seat_state='DELETED'` rows are deleted, freed count reported).
6. **Race on seat-request fulfilment** → `fulfil_seat_request` already does `FOR UPDATE`; we keep that path and refactor it to call `apply_seat_delta(..., 'REQUEST_FULFILLED')` so a single audit trail exists.
7. **Cancellation requested mid-cycle** → `auto_renew=false`, `cancellation_effective_at = current_period_end`. Subscription stays ACTIVE until then; CRM continues to read normal capacity.
8. **CRM key compromised** → admin revokes via `ApiKeysCard`; all 5 endpoints reject immediately (no caching).
9. **CRM offline / no usage report for 24h** → `scan_crm_sync_stale` raises `CRM_SYNC_STALE` notification (deduped per day per account).
10. **Duplicate onboarding link click** → already guarded by `check_submission_lock` + DB unique index. No change.
11. **Onboarding without team_size param** → seats field is editable, customer types it. Conversion sets `seats_purchased = max(team_size, member_count)` (already implemented).
12. **Provisioning idempotency** → "Auto-create logins" skips seats whose `email` already maps to an existing auth user (prevents duplicate `admin-create-user` calls); shows per-row status (Created / Skipped / Failed).
13. **Removing a seat that already has a CRM login** → blocked with a clear toast: "This seat is in use in the CRM. Wait for it to be released or remove it at next renewal."
14. **Renewal on a CANCELLED subscription** → renew button disabled; only "Reactivate" surfaces, which calls `renew_subscription('RENEW')` and clears `cancellation_*`.
15. **Plan/cycle change at renewal** → out of scope for this round; we only allow seat count change at renewal. Plan changes remain a manual edit on the billing settings row.

---

### Phased delivery

1. **Edge functions + cron**: extend `/seat-capacity`, add `/seat-usage`, `/account-profile`, `/seat-events`; schedule the two new scanners.
2. **Seats & Requests tab**: capacity panel, Adjust-seats dialog, Provision actions, realtime sync, decrease-block guard.
3. **Billing tab**: subscription card extras, renewal strip, invoice kind chips, cancellation flow.
4. **Header CRM-sync chip + Admin Integrations doc card**.

No DB migration is needed — all required tables, columns, enums and RPCs are already live.
