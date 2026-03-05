

# Plan: Add Save/Cancel Confirmation to Onboarding Checklist

## Problem

Currently, clicking a checklist item immediately toggles its state with no confirmation. The user wants an explicit Save/Cancel workflow: changes are staged locally, a confirmation bar appears, and the user must either save or cancel before navigating away.

## Changes

**File: `src/pages/AccountDetail.tsx`**

### A. Track dirty state for onboarding checklist

Add a `draftChecklist` state (initially null). When a user clicks a checklist item, instead of modifying `checklist` directly, copy `checklist` into `draftChecklist` (if not already dirty) and apply the toggle there. The UI renders from `draftChecklist ?? checklist`.

### B. Show Save/Cancel bar when dirty

When `draftChecklist` is not null (i.e., changes exist), render a sticky action bar at the bottom of the Onboarding tab with:
- "You have unsaved changes" text
- **Save** button -- applies `draftChecklist` to `checklist`, shows a toast ("Onboarding checklist updated"), resets `draftChecklist` to null
- **Cancel** button -- resets `draftChecklist` to null (discards changes)

### C. Prevent tab navigation with unsaved changes

In the `Tabs` `onValueChange` handler, check if `draftChecklist` is not null. If dirty, show a confirmation dialog ("You have unsaved onboarding changes. Discard and switch tabs?") with Discard/Stay options. On Discard, reset `draftChecklist` and proceed with tab switch. On Stay, keep the user on the Onboarding tab.

### D. Visual diff hint

Changed (toggled) items in the draft get a subtle highlight (e.g., light yellow background) so the agent can see what they're about to save.

## Files

| File | Change |
|------|--------|
| `src/pages/AccountDetail.tsx` | Add `draftChecklist` state, modify `toggleChecklistItem` to stage changes, add Save/Cancel bar, guard tab switching with unsaved-changes dialog |

