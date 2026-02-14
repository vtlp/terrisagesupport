

# Implementation Plan: Tickets, Dashboard, Enquiry, and Accounts Enhancements

This plan covers all requested changes across four modules plus a universal voice-to-text addition and calendar event entity filtering.

---

## 1. Support Tickets Module

### 1.1 Show City (replace "Market" label)
- In `Tickets.tsx` detail panel and `CreateTicketDialog.tsx`, rename the "Market" field label to "City" throughout. The underlying `market_field` data stays the same.

### 1.2 Practical SLA Defaults
- Update `CreateTicketDialog.tsx` SLA calculation to use realistic business-hour windows:
  - P1: First Response = 1 hour, Resolution = 4 hours
  - P2: First Response = 4 hours, Resolution = 8 hours
  - P3: First Response = 8 hours, Resolution = 24 hours
  - P4: First Response = 24 hours, Resolution = 72 hours
- Fix the `SLATimer` display: when breached, show "Breached" (no "left"); when active, show the time remaining clearly.

### 1.3 Merge "Account & Requester" + "Details" into one "Account Details" card
- Combine the two info cards into a single card titled "Account Details" containing: Account link, Requester name, Email, Type, Category, Tags, and City -- all in one clean block.

### 1.4 Editable Ticket Fields
- Make subject, description, type, category, tags, city, requester name, and requester email editable inline.
- Add local state for each editable field. Non-editable fields: Ticket ID, created_at, timeline entries.

### 1.5 Call and WhatsApp CTAs
- Add a "Call" button (tel: link) and a "WhatsApp" button (wa.me link) next to the requester's contact info, using the requester email/phone or linked account's phone.

### 1.6 Update/Cancel + Close Ticket with Comments
- Add "Update" and "Cancel" buttons in the top-right of ticket detail. "Update" persists edits; "Cancel" reverts to original values.
- Add unsaved-changes validation -- warn before navigating away.
- "Close Ticket" button opens a dialog requiring closing comments before setting status to CLOSED and adding a timeline entry.

### 1.7 Collapsible Left Panel
- Add a toggle button to collapse/expand the 384px ticket list panel. When collapsed, the detail view takes full width. Store state locally.

---

## 2. Dashboard

### 2.1 Calendar Events Section
- Add a new card below the existing KPI row: "Today's Calendar" and "This Week" tabs.
- Filter `seedCalendarEvents` for events with `UPCOMING` status.
- Default view: "My Events" (filtered by current user's `user_id`).
- Add a toggle/dropdown: "My Events" vs "All Team" to see events for all users.
- Each event row shows: title, entity type badge, scheduled time, and a link to the parent entity.

---

## 3. Enquiry Module

### 3.1 WhatsApp Toggle Adjacent to Phone + Country Code
- Move the WhatsApp toggle to sit inline next to the primary phone number field.
- Add a country code dropdown (defaulted to "+91 India") before each phone input (primary and alt).
- Add a "Consent" checkbox below the phone section: "Contact consent received".
- Store `consent_given` as a boolean field on the enquiry (add to local state; the type can be extended later).

### 3.2 Allow Backward Stage Movement
- Remove the forward-only restriction in `handleStageChange`. Allow clicking any previous stage pill.
- When moving backward, show a confirmation dialog: "Are you sure you want to revert to [stage]? This is for damage control only."
- Log a timeline/system note on revert.

### 3.3 "Call Later" Outcome Triggers Calendar Event
- When outcome is set to `CALL_LATER` (in stage modal or direct outcome change), automatically open the CalendarEventForm dialog with a pre-filled title "Call back -- [company name]".

### 3.4 Portals as Selectable Options + Current System Dropdown
- Replace the free-text "Portals in Use" input with a multi-select checkbox list of common portals: MagicBricks, 99acres, Housing.com, NoBroker, Square Yards, CommonFloor, Other.
- Replace the "Current System" free-text with a dropdown: CRM, Spreadsheet, Other (with a text input for "Other" to capture details).

### 3.5 Enquiry Calendar Tab (renamed from "Calendar Events")
- Rename the right-sidebar "Calendar Events" section to "Enquiry Calendar".
- Only show events where `entity_type === ENQUIRY` and `entity_id === current enquiry`.
- Add a filter toggle: "My Events" / "All Team" (filter by `created_by_user_id`).

---

## 4. Accounts Module

### 4.1 Verification Tab: Mandatory Note on Status Change
- In the Verification tab, when PAN or Identity status is changed via the dropdown, intercept the change and show a dialog requiring a note before the status update is saved.
- The note is saved to `seedNotes` linked to the account with a prefix like "[PAN Verification] Status changed to VERIFIED: [user note]".

### 4.2 Data Tab: Simplify Exports
- Remove "Export PDF" button.
- Change "Export CSV" to open a dialog with radio options: "Leads Only", "Properties Only", "Enquiries Only", "All".
- Keep "Export Import Log" as-is.

### 4.3 Integrations Tab: Add Custom Integrations
- Add an "Add Integration" button that opens a form with fields: Integration Name, API Key, Endpoint URL, Description, and Status toggle.
- Store integrations in local state as an array of objects.
- Display each integration as a card with: name, status badge, API key (masked), and Connect/Disconnect toggle.
- Pre-populate with common portal names: MagicBricks, 99acres, Housing.com, NoBroker, etc.

### 4.4 Universal Voice-to-Text Mic on All Notes
- Update `NotesPanel.tsx` to include a microphone icon button next to the textarea.
- On click, use the browser's `SpeechRecognition` Web API (with fallback message if unsupported) to transcribe speech and append to the note textarea.
- Since `NotesPanel` is shared across Enquiry, Account, and Ticket detail views, this applies universally.

### 4.5 Carry Over All Enquiry Fields to Account
- When an account is created from an enquiry conversion, ensure these fields are mapped and visible in the Account Overview:
  - `team_size_estimate`, `focus_area`, `sales_focus`, `primary_property_types`, `current_system_text`, `portals_in_use`, `approx_onboarding_date`, `contact_phone`, `contact_phone_alt`, `contact_email`
- Display these under the Account Overview in a "From Enquiry" sub-section (read-only) if `created_from_enquiry_id` is present.

---

## 5. Calendar Event Entity Filtering (Universal Rule)

- All calendar views filter events by entity context:
  - Enquiry Calendar: only shows events with `entity_type === ENQUIRY` and matching `entity_id`
  - Account Calendar: only shows events with `entity_type === ACCOUNT` and matching `entity_id`
  - Dashboard Calendar: shows all events, filterable by "My Events" / "All Team"
- This is already partially in place; the plan ensures strict filtering and consistent labeling.

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/Tickets.tsx` | Editable fields, merged info card, collapsible panel, close dialog, Update/Cancel buttons, Call/WhatsApp CTAs, city label, SLA fixes |
| `src/components/shared/CreateTicketDialog.tsx` | Rename Market to City, update SLA defaults |
| `src/pages/Dashboard.tsx` | Add calendar events section with My/All toggle |
| `src/pages/EnquiryDetail.tsx` | WhatsApp inline, country code, consent checkbox, backward stages, call-later auto-calendar, portals multi-select, current system dropdown, rename calendar section |
| `src/pages/AccountDetail.tsx` | Verification note dialog, export dialog, integrations form, enquiry fields carry-over |
| `src/components/shared/NotesPanel.tsx` | Voice-to-text mic button using Web Speech API |

### New State/Types
- `consent_given: boolean` on enquiry local state
- `customIntegrations: Array<{name, apiKey, endpoint, description, connected}>` on account local state
- `isListCollapsed: boolean` on Tickets page
- `editingTicket: boolean` and field-level state on Tickets page
- `closeTicketDialog: boolean` and `closingComment: string` on Tickets page

### No New Files Required
All changes fit within existing components and pages.

