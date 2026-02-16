

# Plan: Explicit CalendarEventType + "Create Event" Button on Calendar Page

This plan covers everything from the previously approved steps, plus one addition: a "Create New Event" button directly on the Calendar page. Currently, the Calendar page is read-only with no way to create events from it.

---

## All Changes (8 Steps)

### Step 1: Data Model -- Add `CalendarEventType` Enum

**File: `src/types/core.ts`**

- Add `CalendarEventType` enum with 6 values: `DEMO`, `FOLLOW_UP`, `CALL_BACK`, `CHECK_IN`, `ONBOARDING`, `GENERAL`
- Add `event_type: CalendarEventType` field to the `CalendarEvent` interface

---

### Step 2: Update `CalendarEventForm`

**File: `src/components/shared/CalendarEventForm.tsx`**

- Add `defaultEventType` prop (optional, defaults to `GENERAL`)
- Add an "Event Type" dropdown with all 6 options
- Include `event_type` in the `onSubmit` data payload

---

### Step 3: Tag All Seed Events

**File: `src/data/seedData.ts`**

Tag all 22 existing seed events with the appropriate `event_type` based on title keywords (e.g. "Demo" = `DEMO`, "Follow-up" = `FOLLOW_UP`, "Onboarding prep" = `ONBOARDING`, etc.)

---

### Step 4: Enquiry Module

**File: `src/pages/EnquiryDetail.tsx`**

- Demo scheduling: pass `defaultEventType={DEMO}`
- Call later outcome: pass `defaultEventType={CALL_BACK}`
- No-show/ghosted follow-up: pass `defaultEventType={FOLLOW_UP}`
- Manual creation: pass `defaultEventType={GENERAL}`
- Update handlers to include `event_type` when pushing events

---

### Step 5: Account Module

**File: `src/pages/AccountDetail.tsx`**

- "Schedule Event" form: pass `defaultEventType={FOLLOW_UP}`
- Seat expansion programmatic event: set `event_type: FOLLOW_UP`
- Go-live auto-event: set `event_type: ONBOARDING`
- Update handler to include `event_type`

---

### Step 6: Ticket Module

**File: `src/pages/Tickets.tsx`**

- "Schedule Follow-up" form: pass `defaultEventType={FOLLOW_UP}`
- Update handler to include `event_type`

---

### Step 7: Calendar Page -- Filter, Badges, and NEW "Create Event" Button

**File: `src/pages/CalendarPage.tsx`**

This is the largest change. Three additions:

**A. "Create Event" Button (NEW)**
- Add a "Create Event" button in the card header, next to the filters
- Clicking it opens a Dialog containing the `CalendarEventForm` (with `defaultEventType={GENERAL}` so the user can pick any type)
- The form's entity fields are optional since this is a standalone event (not linked to a specific enquiry/account/ticket)
- On submit, push the new event into `seedCalendarEvents` with all fields including `event_type`, and show a success toast

**B. Event Type Filter Dropdown**
- Add a new "Event Type" filter dropdown alongside the existing Entity and Team filters
- Options: All Types, Demo, Follow-up, Call Back, Check-in, Onboarding, General
- Applied in the `useMemo` filter logic for both grid and list views

**C. Colour-Coded Event Type Badges**
- Display event type as a badge on both calendar grid cells and list view rows
- Colour scheme:
  - Demo: purple
  - Follow-up: blue
  - Call Back: amber
  - Check-in: teal
  - Onboarding: green
  - General: grey

---

### Step 8: Dashboard -- Event Type Badge

**File: `src/pages/Dashboard.tsx`**

- Show event type badge next to each event in the upcoming events section

---

## Files Summary

| File | Changes |
|------|---------|
| `src/types/core.ts` | Add `CalendarEventType` enum; add `event_type` to `CalendarEvent` |
| `src/components/shared/CalendarEventForm.tsx` | Add `defaultEventType` prop; add event type dropdown; include in payload |
| `src/data/seedData.ts` | Add `event_type` to all 22 seed events |
| `src/pages/EnquiryDetail.tsx` | Pass `defaultEventType` to both form instances; update handlers |
| `src/pages/AccountDetail.tsx` | Pass `defaultEventType` to form; tag programmatic events |
| `src/pages/Tickets.tsx` | Pass `defaultEventType` to form; update handler |
| `src/pages/CalendarPage.tsx` | Add "Create Event" button with dialog; add event type filter; add colour-coded badges |
| `src/pages/Dashboard.tsx` | Show event type badge in upcoming events |

