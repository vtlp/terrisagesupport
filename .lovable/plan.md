

# Razorpay Plan — Refined to Match Existing Console

## Gaps found vs. my earlier plan

| # | Earlier assumption | Actual state in code | Fix |
|---|---|---|---|
| 1 | New nested `payload.billing` object | Enquiry already uses `payload.payment` (link_id, short_url, breakdown, status, paid_at) and `EnquiryDetail.tsx` reads it everywhere | **Reuse `payload.payment`**; extend it with the new keys instead of creating a parallel `billing` namespace |
| 2 | Add new card "between qualification and Send onboarding" | A `PAYMENT_LINK_SENT` **stage** already exists in the stepper, with its own outcome panel (`setPaymentStatus` PAID/PENDING/FAILED) and an auto-opening `PaymentLinkDialog` | Don't add a parallel card. **Augment the existing PAYMENT_LINK_SENT stage panel** with mode toggle, status chip, regenerate, draft-email, cancel, refresh |
| 3 | Block conversion to account when unpaid | Already enforced in two places: `validateStageGate('PAYMENT_LINK_SENT')` and the "Send onboarding form" guard (`paymentPaid` check) | Keep guards; only add a clearer "outdated link" amber state when seats/amount drift |
| 4 | New `account_renewal_cycles` table | `account_invoices` already supports `kind = 'RENEWAL'`, `BillingTab.tsx` already shows renewal action card + `renew_subscription` RPC, and the webhook already auto-creates a PAID invoice for the matched account | **Skip the new table.** Add renewal-link metadata as columns on `account_billing_settings` (current cycle only) + reuse `account_invoices` for history |
| 5 | Pre-account billing fields owner/email/phone duplicated | Enquiry already holds `full_name`, `email`, `phone`; `PaymentLinkDialog` already pre-fills from these | Treat enquiry contact as the source; only add `account_owner_*` overrides if user explicitly edits them |
| 6 | Trial-first flow | Not present anywhere | Genuinely new — add `payment.mode = 'TRIAL_FIRST'` + trial dates + `PAYMENT_PENDING` status; allow conversion without paid status when mode is TRIAL_FIRST |
| 7 | Webhook only updates enquiry | Webhook **already** mirrors PAID into `account_invoices` for converted accounts | Extend so renewal-link payments stamp `current_period_end` forward and clear "renewal due" amber chip |
| 8 | New endpoints `cancel-payment-link`, `link-status` | Don't exist | Still required |
| 9 | Email composer | Doesn't exist; Console has no SMTP | Build composer that **drafts only** (mailto: + copy-to-clipboard) — matches existing "no auto-send" pattern |
| 10 | Outdated-link detection | None today | Compute `payment.outdated = true` whenever current seats/amount ≠ `payment.breakdown.seats/total` |

## Refined implementation plan

### 1. Data model (smaller than before)

**Extend `payload.payment` on enquiries** (no migration):
```
payment: {
  ...existing (link_id, short_url, amount, currency, status, paid_at, breakdown, created_at),
  mode: 'PAY_BEFORE_ACCOUNT' | 'TRIAL_FIRST',     // default PAY_BEFORE_ACCOUNT
  expires_at,
  outdated: bool,
  trial: { start, end },
  email: { last_drafted_at, last_sent_at, subject, body },
  notes,
}
```
Status enum widens to: `CREATED | PAID | CANCELLED | FAILED | PENDING | EXPIRED | EMAIL_DRAFTED | EMAIL_SENT | PAYMENT_PENDING`.

**Extend `account_billing_settings`** (one migration, additive):
- `renewal_link_id`, `renewal_link_short_url`, `renewal_link_amount`, `renewal_link_seats`, `renewal_link_status` (same enum), `renewal_link_created_at`, `renewal_link_expires_at`, `renewal_link_outdated bool`, `renewal_email_last_drafted_at`, `renewal_email_last_sent_at`, `renewal_due_date`, `renewal_notes`.

Renewal **history** continues to live in `account_invoices` (kind=RENEWAL).

### 2. Edge functions

- **Extend** `razorpay-create-payment-link`: accept `purpose: 'INITIAL'|'RENEWAL'` and optional `account_id`. For RENEWAL, write metadata onto `account_billing_settings` instead of `enquiries.payload`. Pass `notes.purpose` to Razorpay.
- **Extend** `razorpay-webhook`: branch on `notes.purpose`. RENEWAL path → mark settings PAID, advance `current_period_start/end` via existing `renew_subscription` RPC, then create the PAID invoice (existing logic).
- **New** `razorpay-cancel-payment-link` (staff-only): call Razorpay cancel API, update source row, log activity.
- **New** `razorpay-link-status` (staff-only): poll a single link, mirror status. Used by manual "Refresh" and a 15-min cron over `CREATED` links older than 24h.

### 3. UI — Enquiry (extends existing PAYMENT_LINK_SENT stage)

In `EnquiryDetail.tsx`'s payment stage panel, replace the current 3-button outcome row with a richer block:

- Row 1: Mode toggle (Pay-first / Trial) · Status chip · Plan · Seats (mirror of `team_size_estimate`) · Amount · Outdated badge (amber)
- Row 2: Link state · Created · Expires · Trial start/end (when mode=Trial) · Last email action
- Kebab menu: Generate / Regenerate / View / Copy / **Draft email** / Mark sent / Cancel link / **Refresh status**

**Trial-mode rule wired into existing guards:**
- Conversion to account allowed when `payment.mode === 'TRIAL_FIRST'` AND trial dates valid, even without PAID. Account is created with `payment.status = 'PAYMENT_PENDING'` carried into `account_billing_settings.status = 'ACTIVE'` and a new `account_checklist_items` entry "Collect trial conversion payment".
- Pay-first rule unchanged.

**Outdated detection:** compare `payment.breakdown.seats` to current `team_size_estimate` and `payment.breakdown.total` to recomputed `calcBilling`; flag amber and disable "Mark email sent" until regenerated.

### 4. UI — Account › Billing (extends existing tab)

Add a **"Renewal payment link"** sub-section inside the existing renewal action card (the one that appears within 30 days of `current_period_end`). Shows current settings: seats from `seats_purchased`, amount from `calcBilling`, link state, due date.

Action menu: Generate / Regenerate / View / Copy / Draft email / Mark sent / Cancel / Refresh / Update due date.

Outdated detection mirrors enquiry rule: any change to `seats_purchased` or pricing flips `renewal_link_outdated = true`.

On webhook PAID for renewal: existing `renew_subscription` is invoked → `current_period_*` advances → invoice row created → renewal-link fields cleared. No duplicate ledger.

### 5. Email composer

Shared `<PaymentEmailComposer>` modal used by both surfaces. Drafts British-English subject + body from the templates supplied, opens editable, **does not send**. Two actions: "Copy to clipboard" and "Open in mail client" (`mailto:` with prefilled subject/body). Records `email_last_drafted_at` / `email_last_sent_at`.

### 6. Activity timeline

Reuse `activity_log` (no new types). All edge functions write `event_type='FIELD_EDIT'` with `details.module: 'billing' | 'renewal'` so the existing `ActivityTimeline` component picks them up unchanged.

### 7. Seat-sync rule

- **Pre-account:** `payload.payment.breakdown.seats` is authoritative for the link; `team_size_estimate` is the live source. Mismatch → outdated flag.
- **Post-account:** `account_billing_settings.seats_purchased` (already kept in sync via `apply_seat_delta` from CRM heartbeats) drives every renewal link.

### 8. Files touched (lighter than before)

**New**
- `src/components/billing/PaymentEmailComposer.tsx`
- `supabase/functions/razorpay-cancel-payment-link/index.ts`
- `supabase/functions/razorpay-link-status/index.ts`
- One migration: additive columns on `account_billing_settings`.

**Edited**
- `src/pages/EnquiryDetail.tsx` (extend PAYMENT_LINK_SENT panel; wire trial mode to conversion guard)
- `src/components/shared/PaymentLinkDialog.tsx` (mode + trial fields + purpose param)
- `src/components/account/BillingTab.tsx` (renewal-link sub-section in renewal card)
- `supabase/functions/razorpay-create-payment-link/index.ts` (purpose flag, renewal write path)
- `supabase/functions/razorpay-webhook/index.ts` (renewal branch → renew_subscription)
- `supabase/config.toml` (`verify_jwt = false` for the two new functions)

---

## What we need from Razorpay (after the build)

You need to obtain these from your Razorpay dashboard and paste into Lovable Cloud secrets — that's it. No code or asset is sent to Razorpay.

1. **`RAZORPAY_KEY_ID`** — Settings → API Keys → "Generate Test/Live Key". Use Test key for staging, Live key after KYC is approved.
2. **`RAZORPAY_KEY_SECRET`** — shown once when the key is generated; copy immediately.
3. **`RAZORPAY_WEBHOOK_SECRET`** — Settings → Webhooks → Add Webhook → set a strong secret string. Use the same string here.
4. **Webhook URL to register in Razorpay** (we provide this to you, you paste it into Razorpay):
   `https://phkzxeajzglbmaymvtmt.supabase.co/functions/v1/razorpay-webhook`
5. **Webhook events to subscribe to** in the Razorpay dashboard:
   - `payment_link.paid` (already handled)
   - `payment_link.cancelled` (new)
   - `payment_link.expired` (new)
6. **KYC / business verification** completed on Razorpay so Live keys activate — Lovable cannot do this for you. Test keys work end-to-end without KYC.
7. (Optional) **Brand assets in Razorpay dashboard** — logo + brand colour shown on the hosted payment page. Purely cosmetic.

## What we do NOT need to provide to Razorpay

You're correct — nothing has to be configured in Razorpay beyond the webhook URL + event subscriptions above. No callback redirect URL is needed (we use webhooks, not browser redirects). No IP whitelisting. No CSV uploads. No customer pre-registration. The Console drives everything via Razorpay's REST API using the key pair.

## Out of scope (unchanged)

Invoices/taxation/refunds/ledger; auto-send email; multi-currency; partial payments; CRM-side payment UI; auto-collection. The existing `CRM_Integration_Handover_v1.md` does **not** need any change — Razorpay is internal-only and the CRM already learns about renewal seat changes through the `RENEWAL` event on `/seat-events`.

