

## Rename "Payment Link Sent" → "Payment" + fix downstream trial gates

### Why
- "Payment Link Sent" reads as a status. It's actually a **stage** where staff decide: collect now (Pay-Before) or start a trial (Trial-First). "Payment" is the honest label.
- The Actions card currently gates "Send onboarding form" on `paymentPaid` only. In Trial-First there is no payment status (by design), so the button stays disabled and staff can't progress — even though `handleSendOnboarding` itself already accepts a valid trial. The button enable logic and the helper text need to match the handler.

### Changes

**1. Stage label rename (display only — DB enum stays `PAYMENT_LINK_SENT`)**

Files: `src/pages/EnquiryDetail.tsx`, `src/pages/Enquiries.tsx`, `src/pages/EnquiryPipelineDashboard.tsx`, `src/components/shared/CreateEnquiryDialog.tsx` (if it lists this stage).

```
PAYMENT_LINK_SENT: 'Payment Link Sent' / 'Payment Sent'  →  'Payment'
```

No migration needed — enum value unchanged, only the human label.

**2. Onboarding button gate — accept valid trial as well as Paid**

`src/pages/EnquiryDetail.tsx` (around line 854-860 in the Actions card):

```ts
const p = draft.payload.payment;
const paymentPaid = p?.status === 'PAID';
const trialMode = p?.mode === 'TRIAL_FIRST';
const trialValid = trialMode && !!p?.trial?.start && !!p?.trial?.end
                   && new Date(p.trial.end) >= new Date(p.trial.start);
const onboardingSent = enquiry.onboarding_pack_sent || draft.onboarding_pack_sent;
const onboardEnabled = onboardingSent || paymentPaid || trialValid;
const blockedReason = onboardEnabled ? null
  : trialMode
    ? 'Set valid trial start and end dates to unlock onboarding.'
    : 'Mark payment as Paid, or switch to Trial-First with valid dates, to unlock onboarding.';
```

This makes the Trial-First flow self-consistent: pick mode → set trial dates → "Send onboarding form" lights up → submit form → "Convert to account" (already trial-aware) → account opens in `TRIAL` status with `TrialConversionCard` taking over.

**3. Verify nothing else silently expects `payment.status` in trial mode**

Quick audit pass on `EnquiryDetail.tsx`:
- `validateStageGate` at line 396 — already trial-aware. ✓
- `convertToAccount` block — already trial-aware (per previous changes). ✓
- Activity timeline / notes — purely descriptive, no gating. ✓

**4. Keep the existing trial explainer copy in the Payment card aligned**

Where the enquiry-side card currently says "A trial conversion link will be available on the account once it's created", make sure it now also notes: "You can send the onboarding form straight away once trial dates are set." (one-line tweak).

### Out of scope
- DB enum rename (unnecessary; would force a heavy migration and break activity-log history).
- Any change to Account-side `TrialConversionCard` / `RenewalsCard` — they're already correct after the previous round.
- Stage colour tokens stay as-is (warning amber suits "Payment" too).

### Files touched
- `src/pages/EnquiryDetail.tsx` — label + button gate + explainer tweak
- `src/pages/Enquiries.tsx` — label
- `src/pages/EnquiryPipelineDashboard.tsx` — label
- `src/components/shared/CreateEnquiryDialog.tsx` — label (if present)

