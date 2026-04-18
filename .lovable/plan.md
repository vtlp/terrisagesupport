
Goal: make the enquiry page safe for real work so data never disappears, even if you add notes, schedule a demo, or change stage in any order.

1. Fix the data-loss root cause in Enquiry Details
- Stop using the full `load()` refresh after note creation and other side actions when it is not needed.
- Split page loading into separate refresh paths:
  - enquiry record
  - notes list
  - events list
  - submission state
- This prevents unsaved form edits from being overwritten by a full re-fetch.

2. Add proper autosave for enquiry edits
- Introduce debounced autosave for enquiry field changes, including payload fields.
- Keep a visible save state such as:
  - Saving…
  - Saved
  - Unsaved changes
- Keep the existing Save button as a manual fallback, but make autosave the primary behaviour.
- Before stage change, scheduling, onboarding actions, or note submission, flush any pending autosave first so the latest draft is persisted.

3. Make Notes safe
- Update “Add note” so it does not reset or rebuild the enquiry draft.
- After adding a note, refresh only the notes list or optimistically append the new note.
- Ensure adding notes can happen at any point in the workflow without losing enquiry details.

4. Change “Current system / software” to a multi-select dropdown
- Replace the current single Select with the shared `MultiSelect` component.
- Options:
  - Sell.do
  - LeadRat
  - Houssed
  - Excel sheet only
  - Other
- If “Other” is selected, show a free-text input.
- Store this as an array in the enquiry payload and keep backward compatibility by normalising older single-value data.

5. Make the enquiry workflow order-independent
- Support this sequence cleanly:
  - create enquiry
  - call customer
  - fill details
  - add notes
  - schedule demo
  - save or autosave
  - update stage whenever needed
- Apply the same protection to other side actions on the page, not just notes, so no action wipes draft data.

6. Technical details
- Files likely involved:
  - `src/pages/EnquiryDetail.tsx`
  - possibly `src/components/shared/MultiSelect.tsx` only if minor UX tweaks are needed
- No database schema change is required.
- Data model adjustment is inside `payload` only:
  - `current_system` becomes array-friendly
  - `current_system_text` remains the free-text companion for “Other”

7. QA after implementation
- Test creating/editing an enquiry without manually saving.
- Type into multiple enquiry fields, add a note, confirm data stays.
- Type into fields, schedule an event, confirm data stays.
- Change stage after editing, confirm the latest data is still present.
- Test multi-select current system with and without “Other”.
- Test re-opening the enquiry to confirm all saved values persist correctly.
