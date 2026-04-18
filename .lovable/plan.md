
Two small additions on top of the previously approved Enquiry Details plan.

## New items

### 1. Outcome "Interested" → prompt to add notes
- When the user selects an outcome of `INTERESTED` (or equivalent positive interest outcome) in the Contacted stage outcome panel, automatically open the **Add Note** form (focus the textarea) so the agent is nudged to capture context immediately.
- Implementation: in `EnquiryDetail.tsx`, hook into the outcome change handler. If new value === `INTERESTED`, call `setShowNoteForm(true)` (lifted from `NotesPanel` via a prop or controlled mode) and scroll the Notes card into view.
- Show a soft toast: "Add a quick note about what they're interested in."
- Non-blocking: user can dismiss the form without typing; outcome stays selected.

### 2. Move Notes panel above Enquiry Details
- Re-order the right column (or main column) of `EnquiryDetail.tsx` so the **Notes** card sits directly under the **Actions** card and **above** the **Details** card.
- Final card stack on the page becomes:
  1. Header (title, stage, Save / Cancel)
  2. Actions (stage, outcome, Send onboarding, Convert to account, Schedule demo)
  3. **Notes**
  4. Details (Seat count → Focus area → Current system multi-select → other payload fields)
  5. Activity Timeline
  6. Events / Calendar

## Combined plan recap (everything still pending)

1. Save initial note from Create Enquiry dialog into `enquiry_notes`.
2. Reorder fields: Seat count above Focus area.
3. Reorder cards: Actions above Details; **Notes above Details (new)**.
4. Reusable `VoiceTextarea` on every descriptive field.
5. Activity Timeline: include `STAGE_CHANGE`, `CALENDAR_EVENT`, `SUBMISSION`, `CONVERSION`, `FIELD_EDIT` with friendly summaries; keep `NOTE` excluded.
6. Replace autosave with **Save** + **Cancel** buttons; `beforeunload` guard; block side actions when dirty with a toast.
7. Outcome → auto-open Calendar Event form (CALL_BACK / DEMO / FOLLOW_UP), pre-filled and linked to enquiry.
8. Before opening the event form, check for an existing matching future event for this enquiry and offer **Use existing** vs **Create new**.
9. **NEW:** Outcome `INTERESTED` auto-opens the Add Note form and scrolls Notes into view.
10. **NEW:** Notes card moves above Details card.

## Files to edit
- `src/pages/EnquiryDetail.tsx` — card re-order, controlled `showNoteForm` for the Notes panel, outcome handler triggers note prompt, plus all previously planned changes.
- `src/components/shared/NotesPanel.tsx` — accept optional controlled `open` / `onOpenChange` props so the parent can open the Add Note form on demand (kept backward compatible).
- `src/components/shared/CreateEnquiryDialog.tsx` — persist initial note (from earlier plan).
- `src/components/shared/ActivityTimeline.tsx` — include extra event types (from earlier plan).
- `src/components/shared/VoiceTextarea.tsx` *(new)* — reusable mic-enabled textarea/input.
- `src/components/shared/ExistingEventPrompt.tsx` *(new)* — small "Use existing or create new" dialog.

## QA
- Pick outcome "Interested" → Notes form opens, page scrolls to Notes, toast appears; saving the note keeps the outcome selected.
- Notes card visually sits above Details card.
- All previously planned QA steps still pass (Save/Cancel, voice mic, timeline events, existing-event prompt, initial note persistence, seat count above focus area, locked stages).
