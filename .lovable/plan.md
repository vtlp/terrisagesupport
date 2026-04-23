
# Refactor the Payment stage — actionable, not passive

## What's wrong today

1. The stage is named **"Payment Link Sent"** (and "Payment Sent" in lists). It reads as a *status* — but staff arrive here before any link exists. There is no clear way to say "I'll collect payment later, let me proceed to onboarding now."
2. The action choices (**Generate link / Pay now / Pay later**) are buried inside the outcome panel and only appear after the stage is forced into `PAYMENT_LINK_SENT`. From the list view there is nothing to act on at all.
3. Onboarding form is hard-blocked unless `payment.status === 'PAID'`. There is no supported "skip and reconcile later" path, even though the rest of the system (Account → Billing → Invoices) can absorb it.
4. The Mark-as dropdown (Paid / Pending / Failed) is hidden next to the Generate-link button and is easy to miss.
5. Stage gating message reads *"Please capture the payment outcome…"* — unhelpful when the user just wants to defer.

## Proposed flow

Rename the stage internally `PAYMENT_LINK_SENT` → display label **"Payment"** everywhere (list, pipeline, detail header, filters). The stage is now a **decision point** with three first-class actions surfaced as buttons in the active-stage panel:

```text
┌─────────────────────────── Payment ───────────────────────────┐
│  How will the customer pay?                                    │
│                                                                │
│  [ Generate payment link ]  [ Mark as paid offline ]           │
│  [ Defer · collect later ]                                     │
│                                                                │
│  Once chosen, the panel shows the link / receipt / deferral    │
│  reason, and unlocks "Send onboarding form".                   │
└────────────────────────────────────────────────────────────────┘
```

### The three paths

1. **Generate payment link** — opens existing `PaymentLinkDialog`. On success, panel shows link + status chip + Mark-as dropdown (PAID / PENDING / FAILED). Onboarding unlocks when PAID.
2. **Mark as paid offline** — small dialog: amount (prefilled from team size × rate), reference no., paid date, optional note. Writes `payload.payment = { status: 'PAID', method: 'OFFLINE', reference, amount, paid_at }` and a categorised note `[Payment] Marked PAID offline – ref ABC123`. Onboarding unlocks immediately.
3. **Defer · collect later** — confirm dialog explaining: "The customer will receive the onboarding form now; payment will be reconciled inside the Account once converted." Writes `payload.payment = { status: 'DEFERRED', deferred_at, deferred_by, reason }` and a note. Onboarding unlocks; a **DEFERRED** chip persists in the timeline and on the Account header until reconciled.

### Onboarding gate (revised)

`handleSendOnboarding` allows send when **any** of:
- `payment.status === 'PAID'`
- `payment.status === 'DEFERRED'`
- `enquiry.onboarding_pack_sent` already true (resend / regenerate)

Removes the misleading `'Please capture the payment outcome…'` blocker. Stage-gate validation for moving past Payment becomes: *"Generate a link, mark as paid offline, or defer collection before moving on."*

### Account-side reconciliation (handles the Defer path cleanly)

When `convert_enquiry_to_account` runs and `payload.payment.status === 'DEFERRED'`:
- The Account is created with `account_billing_settings.status = 'PENDING_PAYMENT'` (new value of existing `subscription_status` enum) instead of `ACTIVE`.
- `subscription_started_at` is **not** set yet — it starts when payment is recorded.
- Billing tab shows a prominent **"Payment outstanding"** strip with [Generate link] / [Mark paid offline] actions. Recording payment flips status to `ACTIVE` and sets `subscription_started_at = now()` plus `current_period_start/end`.

This matches the user's earlier note: *"the subscription would start right from the request has been received, and we have allocated the seats"* — for paid/marked-paid flows the start is the payment moment; for deferred flows it's when reconciliation happens. Both are explicit and audit-logged.

## Label & list changes

| Place | Old | New |
|---|---|---|
| `EnquiryDetail` `stageLabels.PAYMENT_LINK_SENT` | "Payment Link Sent" | **"Payment"** |
| `Enquiries` list | "Payment Sent" | **"Payment"** |
| `EnquiryPipelineDashboard` | "Payment Sent" | **"Payment"** |
| Past-stage summary chip | "No link generated" | Shows: link sent / paid offline / deferred / outstanding |

The DB enum value `PAYMENT_LINK_SENT` stays the same (no migration needed) — only the display labels change.

## Files to edit

- `src/pages/EnquiryDetail.tsx`
  - `stageLabels` rename.
  - `ActiveStagePanel` (PAYMENT_LINK_SENT branch): replace single "Generate" button + dropdown with three primary action buttons + state-aware detail block.
  - New tiny dialogs (inline): `MarkPaidOfflineDialog`, `DeferPaymentDialog`.
  - `validateStageGate` for `PAYMENT_LINK_SENT`: accept `PAID`, `DEFERRED`, or any link with explicit status.
  - `handleSendOnboarding`: allow `DEFERRED` as unlock.
  - `setPaymentStatus` extended to accept `DEFERRED` and to write `method` / `reference`.
  - `PastStageSummary` for Payment shows the chosen path.
- `src/pages/Enquiries.tsx`, `src/pages/EnquiryPipelineDashboard.tsx` — relabel to "Payment".
- `src/components/account/BillingTab.tsx` — add "Payment outstanding" strip when billing status is `PENDING_PAYMENT`; reuse existing dialogs.
- `supabase/migrations/<new>.sql`:
  - `ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';`
  - Update `convert_enquiry_to_account` to read `payload.payment.status` and seed `PENDING_PAYMENT` + null `subscription_started_at` when deferred; otherwise current behaviour.
  - New RPC `record_offline_payment(_account_id, _amount, _reference, _paid_at, _notes)` to flip the account from `PENDING_PAYMENT` → `ACTIVE`, set `subscription_started_at`, log to `seat_change_events` (reason `ONBOARDING`) and `activity_log`.

## Edge cases handled

- **Defer then change mind** → "Generate link" / "Mark paid offline" remain available on the Payment stage and on the Account billing strip.
- **Link sent, customer pays via UPI offline** → Mark-as dropdown still works; offline reference field appears when status set to PAID without a link.
- **Regenerate link** → marks the old link `CANCELLED` in payload history (`payload.payment_history[]`), keeps audit trail.
- **Deferred → Account → forgot to reconcile** → cron `scan_pending_payment_accounts` (added to existing 15-min job) raises a notification after 7 days.
- **Convert blocked** stays as today (submission must be APPROVED), so a deferred-payment account still requires a valid onboarding form.

## Out of scope (explicit)

- Razorpay refund / partial-payment automation.
- Multi-currency.
- Per-seat invoice line splits at conversion (already covered by existing seat-change events).

## Phased delivery

1. **UI rename + three-action panel + Defer/Offline dialogs** (no DB change). Onboarding unlock relaxed.
2. **Migration: `PENDING_PAYMENT` enum + updated `convert_enquiry_to_account` + `record_offline_payment` RPC.**
3. **Billing tab "Payment outstanding" strip + cron scanner for stale deferred accounts.**

Each phase is shippable on its own.
