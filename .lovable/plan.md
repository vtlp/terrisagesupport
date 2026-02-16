

# Fix: Clarify Calendar Filter Dropdowns + BRD Update Summary

## Part 1: Fix the Contradicting Dropdowns

**Problem:** Two dropdowns sit side by side — the first defaults to "All Events" (filters by source entity), the second defaults to "All Types" (filters by event type). "All Events" is misleading because it sounds like it covers all filtering, making "All Types" seem redundant.

**Solution:** Rename the first dropdown's default label from "All Events" to "All Sources" and keep the options as Enquiries, Accounts, Tickets, Marketing, Others. This makes it clear:
- **"All Sources"** = which module the event came from
- **"All Types"** = what kind of event it is (Demo, Follow-up, etc.)

**File: `src/pages/CalendarPage.tsx`**
- Change `ENTITY_FILTERS[0].label` from `'All Events'` to `'All Sources'`
- No logic changes needed — only the display label

---

## Part 2: Complete List of CalendarEventType Updates (for BRD)

Here is every change made in the previous implementation, as bullet points for your BRD:

**Data Model**
- Added `CalendarEventType` enum to `src/types/core.ts` with 6 values: `DEMO`, `FOLLOW_UP`, `CALL_BACK`, `CHECK_IN`, `ONBOARDING`, `GENERAL`
- Added `event_type: CalendarEventType` field to the `CalendarEvent` interface

**Shared Component: CalendarEventForm**
- Added optional `defaultEventType` prop (defaults to `GENERAL`)
- Added "Event Type" dropdown to the form UI with all 6 options
- `event_type` is now included in the form's submit payload

**Enquiry Module (EnquiryDetail.tsx)**
- Demo scheduling (outcome = `SCHEDULE_DEMO`) now passes `defaultEventType = DEMO`
- Call later (outcome = `CALL_LATER`) now passes `defaultEventType = CALL_BACK`
- No-show / ghosted follow-up now passes `defaultEventType = FOLLOW_UP`
- `handleDemoScheduled` handler now includes `event_type` when creating events
- `handleCalendarEventCreated` handler now includes `event_type` when creating events

**Account Module (AccountDetail.tsx)**
- "Schedule Event" button on Calendar tab now passes `defaultEventType = FOLLOW_UP`
- Seat expansion programmatic event now tagged with `event_type = FOLLOW_UP`
- Go-live auto-created check-in event now tagged with `event_type = ONBOARDING`
- `handleCreateEvent` handler now includes `event_type` when creating events

**Ticket Module (Tickets.tsx)**
- "Schedule Follow-up" button now passes `defaultEventType = FOLLOW_UP`
- `handleCreateEvent` handler now includes `event_type` when creating events

**Seed Data (seedData.ts)**
- All 20+ pre-seeded calendar events retroactively tagged with the correct `event_type` based on their context (e.g., demo events tagged `DEMO`, onboarding events tagged `ONBOARDING`)

**Calendar Page (CalendarPage.tsx)**
- Added "Create Event" button at the top of the page with a dialog containing CalendarEventForm (defaults to `GENERAL`)
- Added "Event Type" filter dropdown alongside the existing source and team filters
- Calendar grid cells are now colour-coded by event type (purple = Demo, blue = Follow-up, amber = Call Back, teal = Check-in, green = Onboarding, grey = General)
- List view rows now display event type badge, entity source badge, and status badge
- Filter logic updated to support filtering by entity source, event type, and team member simultaneously
- First filter dropdown label to be renamed from "All Events" to "All Sources" (this fix)

**Dashboard (Dashboard.tsx)**
- Upcoming events section now displays the event type badge next to each event for quick visual identification

