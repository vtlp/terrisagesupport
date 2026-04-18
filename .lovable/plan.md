

## Razorpay Payment Link Flow + Paid-Gated Onboarding

### Trigger
When an enquiry stage moves to `PAYMENT_LINK_SENT`, open a **Generate Payment Link** dialog (mirrors Account Billing inputs). On success, store the link + amounts on the enquiry payload and copy the link for sharing.

### Dialog inputs (mirroring `BillingTab`)
- Plan name (default "Standard")
- Billing cycle (Monthly / Annual)
- Team size (seats) — prefilled from enquiry payload if present
- Base fee (₹)
- Per-seat rate (₹)
- GST % (default 18)
- Auto-calculated: subtotal, GST amount, **total**
- Customer name / email / phone — prefilled from enquiry
- Notes (optional)

### Payment generation
- New edge function `razorpay-create-payment-link` (verify_jwt = true, staff-only).
  - Calls Razorpay `POST /v1/payment_links` with amount (in paise), customer, notify (email/sms), `reference_id = enquiry_id`, and a callback URL.
  - Returns `{ short_url, payment_link_id, status }`.
- Secrets required: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — request via add_secret before deploy.
- Persist on `enquiries.payload.payment`:
  ```
  { link_id, short_url, amount, currency: 'INR', status: 'CREATED'|'PAID'|'CANCELLED', breakdown: {...}, created_at }
  ```
- Append an enquiry note: `[Payment] Link sent ₹<total> – <short_url>`.

### Outcome on Payment stage (NEW gating rule)
- New outcome enum value on the Contacted/stage outcome panel for `PAYMENT_LINK_SENT`: **PAID**, **PENDING**, **FAILED**.
- Persist outcome on `enquiries.payload.payment.status`.
- **Onboarding gate:**
  - The "Send onboarding pack" action (and the auto-advance to `ONBOARDING_PACK_SENT`) is **disabled** until `payment.status === 'PAID'`.
  - Tooltip on disabled button: "Mark payment as Paid to unlock onboarding."
  - Once Paid: button enabled, optional toast nudges the user to send the onboarding link.

### Webhook (optional but recommended)
- Edge function `razorpay-webhook` (verify_jwt = false, signature verified with `RAZORPAY_WEBHOOK_SECRET`).
- On `payment_link.paid`: update `enquiries.payload.payment.status = 'PAID'`, log activity `[Payment] Marked Paid via webhook`. Staff can also flip Paid manually from the outcome.

### UI changes
- `EnquiryDetail.tsx`
  - Hook stage change → if new stage is `PAYMENT_LINK_SENT`, open `PaymentLinkDialog`.
  - Show a **Payment summary card** when payment exists: amount, status badge, copy-link button, "Resend" / "Cancel link".
  - Gate the "Send onboarding" action on `payment.status === 'PAID'`.
- `src/components/shared/PaymentLinkDialog.tsx` *(new)* — form + live total calculation + submit → edge function.
- Reuse calculation logic from `BillingTab` (extract `calcBilling(seats, base, rate, gst)` into `src/lib/billing.ts`).

### Files to add / edit
- New: `src/components/shared/PaymentLinkDialog.tsx`
- New: `src/lib/billing.ts` (shared calc)
- New: `supabase/functions/razorpay-create-payment-link/index.ts`
- New: `supabase/functions/razorpay-webhook/index.ts`
- Edit: `src/pages/EnquiryDetail.tsx` (dialog trigger, payment card, onboarding gate, outcome handling)
- Edit: `src/components/account/BillingTab.tsx` (use shared calc — no behavior change)

### Secrets to request
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET` (for webhook)

### QA
- Move enquiry to Payment Link Sent → dialog opens prefilled → submit → Razorpay link generated, summary card shows, note logged.
- Send onboarding button is **disabled** with tooltip until outcome/status flips to Paid.
- Mark outcome Paid (manual) OR trigger webhook → button enables, onboarding can be sent.
- Totals match BillingTab math (base + seats×rate + GST).
- Backward stage move from Payment Link Sent still allowed (rule: lock starts at Onboarding Pack Sent).

