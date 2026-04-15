

# Plan: Onboarding Pack as Web Form Link + Form Review Before Conversion

## Summary

Change the onboarding flow so that "Send Onboarding Pack" generates a web form link (from the Terrisage Agency Onboard project) instead of copying clipboard content. When the customer submits that form, a submission record appears in the enquiry for the support agent to review. The "Convert to Account" action is gated behind a reviewed/approved submission -- the submitted form data flows into the Account (not from the enquiry fields).

## Current Flow vs New Flow

```text
CURRENT:
  Enquiry → Send Pack (clipboard copy) → Convert to Account (uses enquiry fields)

NEW:
  Enquiry → Send Onboarding Form Link (Agency/Builder URL)
       → Customer fills & submits form
       → Submission appears on Enquiry as "Pending Review"
       → Agent reviews submitted data
       → Agent approves → "Convert to Account" unlocked
       → Account created using FORM SUBMISSION data (not enquiry fields)
```

## Changes

### 1. Add onboarding form submission type (`src/types/core.ts`)

Add an `OnboardingFormSubmission` interface capturing the payload shape from the external form (business info, team members, projects, files). Add a `submission_status` enum: `PENDING_REVIEW`, `APPROVED`, `REJECTED`. Add `onboarding_submission` field to the `Enquiry` interface (nullable).

### 2. Update "Send Onboarding Pack" dialog (`src/pages/EnquiryDetail.tsx`)

Replace the current clipboard-copy behavior with:
- Show the onboarding form URL based on tenancy type:
  - Agency: `https://terrisage-agency-onboard.lovable.app/onboarding/agency?enquiry_id={id}`
  - Builder: `https://terrisage-agency-onboard.lovable.app/onboarding/builder?enquiry_id={id}`
- Provide a "Copy Link" button that copies the URL to clipboard
- Mark `onboarding_pack_sent` as true and log a timeline note with the link sent

### 3. Add "Onboarding Submission" review card on EnquiryDetail

Below the Actions card (right sidebar), add a new card:
- **If no submission**: Show "Awaiting submission" status with the form link
- **If submission exists (PENDING_REVIEW)**: Show a collapsible review panel displaying all submitted data (business info, team members, projects, files) in read-only ReviewSummaryCard-style layout, with "Approve" and "Reject" buttons
- **If APPROVED**: Show green approved badge
- **If REJECTED**: Show rejected badge with option to re-send form link

### 4. Add seed submission data (`src/data/seedData.ts`)

Add 1-2 sample `OnboardingFormSubmission` objects attached to existing enquiries at `DEMO_COMPLETED` stage so the review UI is testable.

### 5. Gate "Convert to Account" on approved submission

Update `canConvert()` in EnquiryDetail:
- Current checks: demo completed + pack sent
- Add: `onboarding_submission?.status === 'APPROVED'` required
- Error message: "Onboarding form must be submitted and approved"

### 6. Use submission data for account creation

Update `handleConvertToAccount` to pull account fields from the approved submission payload (company name, city, owner details, team members as seats) instead of from enquiry fields.

### 7. Copy shared components from Terrisage Agency Onboard

Copy `ReviewSummaryCard` component for rendering the submission review, since it matches the form's own review layout. Files to copy:
- `src/components/onboarding/ReviewSummaryCard.tsx`

## Files Summary

| File | Change |
|------|--------|
| `src/types/core.ts` | Add `OnboardingFormSubmission`, `SubmissionStatus` enum, update `Enquiry` interface |
| `src/data/seedData.ts` | Add sample submissions for 1-2 enquiries |
| `src/pages/EnquiryDetail.tsx` | Replace pack dialog with link generation; add submission review card; gate conversion on approval; use submission data for account creation |
| `src/components/onboarding/ReviewSummaryCard.tsx` | Copy from Terrisage Agency Onboard project |

