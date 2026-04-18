
The user has 7 distinct requests. Let me investigate the relevant files first to plan precisely.

## Investigation needed
1. EnquiryDetail.tsx — notes panel, fields to remove, multi-select usage
2. ActivityTimeline.tsx — remove arrow + JSON output, filter out stage changes
3. Notes API/component — exclude stage_change events from notes
4. Dashboard.tsx — redesign while preserving metrics
5. CreateTicketDialog.tsx — focus ring clipping (likely overflow on scroll container)

## Plan

### 1. Activity Timeline cleanup (`ActivityTimeline.tsx`)
- Remove the "→" arrow rendering and any raw JSON/details dump.
- Render only summary + actor + timestamp.
- Filter out `STAGE_CHANGE` events (those belong to the enquiry stage tracker, not the audit trail).

### 2. Notes — exclude stage-change activities
- Wherever notes are sourced (likely `enquiry_notes` table only — confirm), ensure no activity_log STAGE_CHANGE entries leak in. If notes panel currently merges activity_log + notes, change it to show only `enquiry_notes` rows.

### 3. EnquiryDetail.tsx — remove four fields
- Remove inputs/labels for: Demo outcome, Demo scheduled, Call outcome, Demo completed (since they're shown at the top stage tracker).

### 4. Multi-select for multi-option fields
- Audit enquiry fields in EnquiryDetail (focus area, sales focus, primary property types, portals currently in use). Replace single Select with `MultiSelect` component (already exists at `src/components/shared/MultiSelect.tsx`).
- Persist as arrays in `enquiries.payload` JSONB.

### 5. Dashboard redesign (`Dashboard.tsx`)
- Keep all current metrics, but restructure with:
  - Hero KPI strip (large numbers, deltas, trend arrows)
  - Sectioned cards: "Pipeline health", "Today's actions", "Service & SLA", "Conversion"
  - Use semantic tokens, consistent card heights, clear hierarchy.
- No new data sources — same queries, better presentation.

### 6. Ticket dialog focus clipping (`CreateTicketDialog.tsx`)
- Scroll container `overflow-y-auto` clips the focus ring. Add horizontal padding (e.g., `px-1`) and/or `-mx-1` so the ring isn't cut off; or change to `overflow-y-auto overflow-x-visible` with adequate padding.

## Files to edit
- `src/components/shared/ActivityTimeline.tsx`
- `src/pages/EnquiryDetail.tsx`
- `src/components/shared/NotesPanel.tsx` (if it merges activity)
- `src/pages/Dashboard.tsx`
- `src/components/shared/CreateTicketDialog.tsx`

## Out of scope
- Marketing / Lookups / Reports backend wiring (paused per user).
- Any change to underlying database schema.

I'll read the relevant files first, then implement.
