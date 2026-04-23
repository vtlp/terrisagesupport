

# Seats / Billing / CRM-Sync — Implementation Plan (with gap remedies)

End-to-end build to reconcile **CRM user states** (Invited / Active / Temp-deactivated / Deletion-requested / Deleted) with **Support Console billing & seat allocation**, including renewals, mid-cycle proration, and superuser-transfer governance.

## 1. Scope confirmation

- Mid-cycle seat increases → **prorated invoice** auto-generated (days remaining ÷ cycle days × seat-rate × delta + GST). Confirmed in `apply_seat_delta`.
- **G5 (Superuser transfer)** remedy: when a superuser-transfer is initiated, notify **all support users** (broadcast notification) AND create a **calendar event for next day** on every support user's calendar to follow up.
- **G8 (open-work reassignment signal)** → excluded as requested.

## 2. Database migration

**Extend `account_billing_settings`**
- `subscription_started_at`, `current_period_start`, `current_period_end`, `auto_renew bool default true`, `cancellation_requested_at`, `cancellation_effective_at`, `country text default 'IN'`.

**New tables**
- `seat_usage_snapshots` (account_id PK, allocated, reserved, consumed, available, members_jsonb, reported_at, source).
- `seat_change_events` (account_id, delta, reason `ONBOARDING|REQUEST_FULFILLED|RENEWAL_INCREASE|RENEWAL_DECREASE|MANUAL|SUPERUSER_TRANSFER`, effective_at, prorated_amount, invoice_id, created_by).
- `account_renewal_decisions` (account_id, period_end, decision `RENEW|RENEW_INCREASE|RENEW_DECREASE|CANCEL`, new_seats, notes, decided_by).
- `superuser_transfers` (account_id, from_seat_id, to_seat_id, status `INITIATED|COMPLETED|CANCELLED`, initiated_by, initiated_at, completed_at, follow_up_event_id).

**Extend `account_seats`**: `crm_state` (INVITED/ACTIVE/TEMP_DEACTIVATED/DELETION_REQUESTED/DELETED), `invitation_expires_at`, `last_active_at`, `is_superuser bool`.

**Extend `account_invoices`**: `kind` enum (`CYCLE|PRORATION|RENEWAL`).

**RPCs**
- `apply_seat_delta(_account_id, _delta, _reason)` → updates `seats_purchased`, computes proration, drafts a `PRORATION` invoice if mid-cycle, writes `seat_change_events`.
- `compute_proration(_account_id, _delta)` → returns days_remaining + amount + GST preview.
- `renew_subscription(_account_id, _decision, _new_seats, _notes)` → closes current cycle, generates `RENEWAL` invoice, advances period, releases DELETED seats.
- `initiate_superuser_transfer(_account_id, _from_seat_id, _to_seat_id)` → writes transfer row, broadcasts notification to all support users, creates calendar event for tomorrow per support user.

**Cron additions** (15-min job already exists):
- `scan_renewals_due()` → notifications at T-14 / T-7 / T-1 days.
- `scan_crm_sync_stale()` → notify if no snapshot in 24h on LIVE accounts.

## 3. Edge functions

**Extend** `/seat-capacity` → return `allocated, reserved, consumed, available, requested, plan, cycle, current_period_start/end, country, owner_name, auto_renew`.

**New**
- `POST /seat-usage` (CRM → Console heartbeat with full member roster + per-member state).
- `GET /account-profile` (Console → CRM reads subscription metadata).
- `GET /seat-events?since=<ts>` (CRM polls allocation deltas to unlock invite slots).

All authenticated via existing `x-account-api-key`.

## 4. Gap → remedy map

| # | Gap | Remedy in this build |
|---|---|---|
| G1 | No "Reserved" concept | `seat_usage_snapshots.reserved` + UI tile |
| G2 | No CRM usage push | `POST /seat-usage` endpoint |
| G3 | No invite TTL enforcement | CRM owns TTL; Console reads `invitation_expires_at` and excludes expired from Reserved |
| G4 | No cycle-end seat release | `renew_subscription` releases `DELETED` seats at period rollover |
| G5 | No superuser-transfer flow | New `superuser_transfers` table + `initiate_superuser_transfer` RPC. Notifies **all support users** and auto-creates a follow-up **calendar event for next day** on each support user's calendar |
| G6 | No CRM role visibility | `/seat-usage` payload carries `role` + `permissions[]` per member |
| G7 | Single seat counter, no audit | `seat_change_events` audit log |
| G9 | No cycle window stored | `current_period_start/end` columns + auto-set trigger |
| G10 | Reserved/Consumed split missing in UI | New 5-tile capacity panel |

## 5. UI changes (Support Console)

**Account → Seats tab** (`SeatsAndRequestsTab.tsx`): replace 4-tile block with **5 tiles** — Allocated · Reserved · Consumed · Available · Requested. Add member roster mirroring CRM with state badges. New actions: **Adjust seats** (with live proration preview), **Provision logins**, **Initiate superuser transfer**.

**Account → Billing tab** (`BillingTab.tsx`): add subscription start, current period, auto-renew toggle, country. Within 30 days of period-end show renewal action card (Renew / Renew + adjust / Cancel). Invoice list gets `KIND` chip.

**Account header** (`AppHeader.tsx`/account detail): CRM-sync chip — green <1h, amber <24h, red ≥24h.

**Admin → Integrations**: new "CRM Sync Contract" doc page with endpoints, payloads, sample curl.

## 6. Phased delivery (this build executes all phases)

1. DB migration + RPCs + edge functions.
2. Seats tab redesign + proration dialog + provisioning + superuser transfer.
3. Billing tab subscription/renewal management.
4. Header sync chip + Integrations contract page + cron schedules for `scan_renewals_due` and `scan_crm_sync_stale`.

## 7. Out of scope

- Auto-collection via Razorpay for proration/renewal invoices (stay DRAFT, finalised manually using existing flow).
- CRM-side UI changes (only the API contract is defined).
- G8 (open-work reassignment) — excluded per your instruction.

