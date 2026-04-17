
Updated plan covering all 3 items, with Feb-16 enquiry layout and full builder onboarding parity included (no scope-outs).

### 1. EnquiryDetail — restore Feb 16 layout + add scheduling/duplicate badge

**Layout (Feb 16 grouping)** — two-column grid, fieldset cards in this order:
- **Left column**: Contact card → Classification card → Qualification card (context-aware: agency vs builder fields) → Outcomes & Dates card → Lost reason card (only when stage = LOST)
- **Right column (sticky)**: Header summary (code, stage chip, owner, **Duplicate-of badge** when `is_duplicate_of` set) → Actions card (Convert / Send onboarding / **Schedule event** / Mark lost) → Upcoming Events list → Notes panel → Activity timeline

**Behaviour**
- Stage transitions gated by validations (phone+email, demo date before CONVERTED, onboarding pack sent before CONVERTED) — same rules as Feb 16.
- "Schedule event" opens dialog with `CalendarEventForm` pre-filled `lockedEntityType='ENQUIRY'`, `lockedEntityId=enquiry.id`, label = company or full_name.
- Upcoming Events: query `calendar_events` where `related_entity_type='ENQUIRY'` and id matches, ordered by `scheduled_at asc`, only future + today. Click row → `EventDetailDialog`.
- Duplicate-of badge: fetch original enquiry's `enquiry_code`, render as link to `/enquiries/{original_id}`.

### 2. Onboarding — full replica of reference 943a756d (Agency AND Builder)

**Copy verbatim from reference project**:
- Libs: `src/lib/onboardingStorage.ts`, `src/lib/onboardingValidation.ts`
- Shared components: `StepperNav`, `StickyActionBar`, `HeroSection`, `FormField`, `PhoneField`, `FileUploadField`, `RepeatableCard`, `GuidanceCard`, `ReferencePanel`, `ReviewSummaryCard`
- Pages: `AgencyOnboarding.tsx`, `BuilderOnboarding.tsx`, `OnboardingSuccess.tsx`

**Builder flow (NOT scoped out)** — full parity with reference:
- Step 1: Business & Primary Contact (builder name, RERA, HQ city, contact)
- Step 2: Team Access & Permissions (seats + repeatable members + role enum)
- Step 3: Project Portfolio (repeatable projects with per-project RERA, location, type, status)
- Step 4: Inventory & Data Files (lead file, inventory file, sheet links)
- Step 5: Review & Submit with declaration checkbox

**Adaptations to fit our backend**:
- File uploads → `onboarding-uploads` storage bucket; paths stored in payload
- On submit → insert into `onboarding_submissions(tenancy_type, payload, enquiry_id)` where `enquiry_id` comes from `?enquiry_id=` query param
- Install `framer-motion` if missing
- Routes added to `App.tsx`: `/onboarding/agency`, `/onboarding/builder`, `/onboarding/agency/success`, `/onboarding/builder/success`. Legacy `/onboarding/:tenancy` redirects to the appropriate new route.

### 3. Storage & migration
- Migration: ensure `onboarding-uploads` private bucket exists with policies — anon INSERT, staff SELECT.

### Files
- **Edited**: `src/pages/EnquiryDetail.tsx`, `src/App.tsx`
- **New (copied from reference)**: 13 files listed above
- **Migration**: `onboarding-uploads` bucket + RLS

### Out of scope
- Google Calendar OAuth (still gated on connector approval — manual sync button remains).
