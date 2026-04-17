
**Goal**: 6 fixes — calendar wiring + enquiry parity + account calendar + onboarding parity (mirror reference) + stay-signed-in + duplicate-phone validation.

---

### 1. Calendar — opening events + wiring to enquiries/accounts
- Add an **Event Detail dialog** on `CalendarPage`: clicking a calendar tile or row opens it, showing title/type/time/notes/owner, an "Open linked record" link, edit/delete, and "Sync to Google".
- Extend `CalendarEventForm` to accept and emit `related_entity_type` + `related_entity_id` (selectable via lightweight Enquiry/Account pickers when launched from CalendarPage; pre-filled when launched from a detail page).
- `CalendarPage.handleCreateEvent` now persists `related_entity_type/id` so events show under the correct enquiry/account.

### 2. Enquiry Detail — restore March-5 layout exactly + add "Schedule event"
The current page already has all the v1 fields (focus area, sales focus, property types, team-size estimate, current software, portals in use, demo dates, outcomes, not-interested reason, lost reason). Restore the **structure**:
- Replace the long single editable card with **fieldset groupings** in this order: Contact → Classification → Qualification (agency/builder context-aware) → Outcomes & Dates → Lost reason.
- Move **Actions card** to the bottom-right and **Notes card** to the bottom-left (already done — keep).
- Add a **"Schedule event"** button inside the Actions card → opens `CalendarEventForm` pre-filled with `related_entity_type='ENQUIRY'`, `related_entity_id=enquiry.id`.
- Render upcoming events for this enquiry as a small list above Notes.
- Keep validations: phone regex, email regex, max-lengths; show inline errors on save.

### 3. Account Detail — wire calendar in
- Add a **"Calendar" tab** (between Notes and Activity) listing all `calendar_events` where `related_entity_type='ACCOUNT'` and `related_entity_id=account.id`.
- Tab includes a **"Schedule event"** button → `CalendarEventForm` pre-filled with the account link.
- Each row: open in Event Detail dialog (same component as CalendarPage).

### 4. Onboarding forms — replica of reference project
Rebuild `/onboarding/agency` and `/onboarding/builder` to mirror the reference project (`943a756d-…`):
- Split into two pages: `AgencyOnboarding.tsx`, `BuilderOnboarding.tsx`, plus shared components mirroring the reference: `StepperNav`, `HeroSection`, `StickyActionBar`, `FormField` (TextField/TextAreaField/SelectField/SwitchField), `PhoneField`, `FileUploadField`, `RepeatableCard`, `GuidanceCard`, `ReviewSummaryCard`.
- **Agency steps (4)**: 1) Business & Primary Contact (owner + company + RERA + city + business area + notes) · 2) Team Access & Permissions (seats required + repeatable team members with Admin/Agent role + agent permissions: org-wide lead/property + agent-networks) · 3) Projects & Data Files (repeatable projects + lead file + property file + sheet links) · 4) Review & Submit with declaration checkbox.
- **Builder steps**: equivalent structure with builder-specific fields (project portfolio, RERA per project, etc.) per reference.
- Same copy, British English, same validation messages, same business-area enum (`primary-sales` / `primary-secondary-sales` / `sales-rentals-all` / `rental-only`), same role enum (`admin`/`agent`), same draft save/restore (`onboardingStorage` lib), same success page.
- File uploads write to `onboarding-uploads` storage bucket; metadata stored in `payload`.
- Submit inserts into `onboarding_submissions` with the full reference-shape payload (back-compatible with existing `convert_enquiry_to_account` since it reads from `payload->>company_name` etc.).

### 5. Auth — "Stay signed in"
- Add a **"Stay signed in"** checkbox to `Auth.tsx` (default ON).
- When unchecked, after `signInWithPassword` set a `localStorage` flag `session_persist=false`. On `App` boot, if flag is false and the page was fully closed (use `sessionStorage` sentinel), call `supabase.auth.signOut()`. When checked, do nothing — Supabase's default behaviour persists across browser restarts.
- Tooltip: "Uncheck on shared devices."

### 6. Duplicate-phone validation on enquiry creation
- In `CreateEnquiryDialog.handleSubmit`, before insert: query `enquiries` where normalised `phone` (digits only) equals the new normalised phone, return last 12 months.
- If a match exists, **block** with a toast and inline message: *"An enquiry already exists for this number — opened on {date}, current stage: {stage}. Open existing enquiry?"* with two actions: **Open existing** (navigates to that enquiry) or **Create anyway** (proceeds, also logs an `activity_log` entry "Duplicate phone — created intentionally").
- Same check on **EnquiryDetail save** when phone is edited (warn-only, allow save).
- Add a small `is_duplicate_of` UUID column on `enquiries` (migration) so intentional duplicates link back to the original; surface a "Duplicate of #ENQ-…" badge on the detail header.

---

### Files touched
- New: `src/components/shared/EventDetailDialog.tsx`, `src/components/shared/EntityPicker.tsx`, `src/lib/onboardingStorage.ts`, `src/lib/onboardingValidation.ts`, `src/components/onboarding/{StepperNav,HeroSection,StickyActionBar,FormField,PhoneField,FileUploadField,RepeatableCard,GuidanceCard,ReviewSummaryCard}.tsx`, `src/pages/onboarding/{AgencyOnboarding,BuilderOnboarding,OnboardingSuccess}.tsx`.
- Edited: `CalendarPage.tsx`, `CalendarEventForm.tsx`, `EnquiryDetail.tsx`, `AccountDetail.tsx`, `CreateEnquiryDialog.tsx`, `Auth.tsx`, `App.tsx` (route the two new onboarding pages; keep old `/onboarding/:tenancy` redirect), `OnboardingForm.tsx` (delete or keep as legacy).
- Migration: `enquiries.is_duplicate_of UUID` + index on `phone` for duplicate lookup.

### Out of scope (will skip unless asked)
- Builder onboarding line-by-line copy parity — will mirror the visible structure & enums; if you want the *exact* builder copy verbatim, I'll fetch that file in default mode before writing.
- Google Calendar OAuth (still gated on connector approval).
