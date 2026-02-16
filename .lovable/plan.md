

# Fix: Make Company Name and Account Name Editable

## Problem

Two fields are currently rendered as static, non-editable text:

1. **Enquiry Detail** (line 402): `company_name` is displayed as a static `<CardTitle>` -- every other field on the page (contact name, phone, email, city, tenancy type) is an editable `<Input>`, but the company name is not.
2. **Account Detail** (line 573): `account_name` is displayed as a static `<h1>` -- even when the "Edit" toggle on the Account Summary card is active, the account name remains read-only.

This also matters because the company name from the enquiry becomes the account name upon conversion. If the agent types it wrong during enquiry creation, there is currently no way to fix it.

---

## Fix 1: Enquiry Detail -- Editable Company Name

**File: `src/pages/EnquiryDetail.tsx`**

Replace the static `<CardTitle>{enquiry.company_name}</CardTitle>` at line 402 with an editable `<Input>` that:
- Is bound to `enquiry.company_name` via the existing `update()` helper
- Is disabled when the enquiry is converted (same `isConverted` rule as all other fields)
- Is styled to look like a heading (larger text, no visible border when not focused) so the visual hierarchy is maintained

---

## Fix 2: Account Detail -- Editable Account Name

**File: `src/pages/AccountDetail.tsx`**

Two changes:

**A. Add `accountName` state** (around line 226, alongside the existing `ownerName`, `ownerPhone`, etc.):
- `const [accountName, setAccountName] = useState(account?.account_name ?? '')`

**B. Make the header editable** (line 573):
- When `editingOverview` is true: replace the static `<h1>` with an `<Input>` bound to `accountName`, styled as a heading-sized input
- When `editingOverview` is false: keep the current static `<h1>` display

This way, the account name is editable alongside all other overview fields when the agent clicks "Edit" on the Account Summary card.

---

## Files Summary

| File | Change |
|------|--------|
| `src/pages/EnquiryDetail.tsx` | Replace static `<CardTitle>` with editable `<Input>` for company name, disabled when converted |
| `src/pages/AccountDetail.tsx` | Add `accountName` state; toggle header between `<h1>` and `<Input>` based on edit mode |

