

# Plan: Explicit CalendarEventType + "Create Event" Button on Calendar Page

**STATUS: ✅ IMPLEMENTED**

All 8 steps have been completed.

---

## Completed Changes

### ✅ Step 1: Data Model — `CalendarEventType` Enum
Added to `src/types/core.ts`: enum with DEMO, FOLLOW_UP, CALL_BACK, CHECK_IN, ONBOARDING, GENERAL. Added `event_type` field to `CalendarEvent` interface.

### ✅ Step 2: Updated `CalendarEventForm`
Added `defaultEventType` prop and Event Type `<Select>` dropdown. `event_type` included in submit payload.

### ✅ Step 3: Tagged All 20 Seed Events
Each event in `seedData.ts` tagged with appropriate `event_type`.

### ✅ Step 4: Enquiry Module
Demo scheduling passes `DEMO`, Call Later passes `CALL_BACK`, ghosted/no-show passes `FOLLOW_UP`. Handlers include `event_type`.

### ✅ Step 5: Account Module
Schedule Event form defaults to `FOLLOW_UP`. Seat expansion auto-event tagged `FOLLOW_UP`. Go-live checkup tagged `ONBOARDING`.

### ✅ Step 6: Ticket Module
Schedule Follow-up defaults to `FOLLOW_UP`. Handler includes `event_type`.

### ✅ Step 7: Calendar Page
- **Create Event button** with dialog
- **Event Type filter dropdown** alongside Entity and Team filters
- **Colour-coded badges** in grid cells and list view

### ✅ Step 8: Dashboard
Event type badges shown next to each upcoming event.
