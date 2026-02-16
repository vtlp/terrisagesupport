

# Plan: Complete Seats Operations and Cross-Tab Visibility

## Problem

Seats are a revenue-driving, operationally critical part of account management, but the current implementation only supports **adding** seats and **toggling onboarded status**. There is no way to edit, deactivate, or remove a seat. Additionally, seat information is siloed in the Seats tab and not visible where it matters most -- the Overview and Onboarding tabs.

---

## Changes

### 1. Edit Seat Capability

**File: `src/pages/AccountDetail.tsx`**

Add an "Edit" action to each seat row (via a dropdown menu or pencil icon) that opens a dialog pre-filled with the seat's current data (name, email, phone, role, permissions). On save, update the seat in state. Role change rules still apply (e.g., cannot set a second Super User).

### 2. Deactivate / Remove Seat

**File: `src/pages/AccountDetail.tsx`**

Add a dropdown menu (three-dot icon) on each seat row with two options:

- **Deactivate** -- keeps the seat in the list but visually greys it out and marks it inactive. This is important for billing history (you need to know who was on the account).
- **Remove** -- permanently deletes the seat from the list (with a confirmation). Only available for seats that have never been onboarded.

This requires adding an `is_active` field to track deactivation without deletion.

**File: `src/types/core.ts`**

Add `is_active: boolean` (defaulting to `true`) to the `AccountSeat` interface.

**File: `src/data/seedData.ts`**

Update seed data to include `is_active: true` on all existing seats.

### 3. Overview Tab -- Surface Seats in Quick Stats

**File: `src/pages/AccountDetail.tsx`**

Add a "Seats" entry to the Quick Stats grid on the Overview tab, showing the count of active seats (e.g., "4" with label "Seats"). This gives immediate visibility without switching tabs.

### 4. Onboarding Tab -- Show Seat Onboarding Progress

**File: `src/pages/AccountDetail.tsx`**

Below the existing onboarding checklist, add a "Seat Onboarding Status" summary card showing:
- A small progress bar: X of Y seats onboarded
- A compact list of seat names with their onboarded/pending status

This connects the onboarding workflow to the actual people being onboarded.

### 5. Billing Tab -- Distinguish Active vs Total Seats

**File: `src/pages/AccountDetail.tsx`**

Update the Billing Details card to show:
- **Active Seats** (used for cost calculation) instead of total seats
- **Total Seats** (including deactivated) shown separately for reference
- Total Seat Cost calculated from active seats only

### 6. Accounts List Page -- Show Seat Count

**File: `src/pages/Accounts.tsx`**

Add a small "Seats" column or badge to the accounts table/cards so agents can see team size at a glance without opening each account.

---

## Data Model Change

**File: `src/types/core.ts`**

```text
AccountSeat {
  ...existing fields...
  is_active: boolean    // NEW -- defaults to true, set to false on deactivate
}
```

---

## Seat Row Actions Summary

| Action | When Available | Effect |
|--------|---------------|--------|
| Edit | Always | Opens dialog to change name, email, phone, role, permissions |
| Toggle Onboarded | Active seats only | Flips onboarded status and sets timestamp |
| Deactivate | Active seats | Sets is_active=false, greys out row, excludes from billing |
| Reactivate | Inactive seats | Sets is_active=true, re-includes in billing |
| Remove | Never-onboarded seats only | Permanently deletes seat from list |

---

## Files Summary

| File | Change |
|------|--------|
| `src/types/core.ts` | Add `is_active: boolean` to `AccountSeat` |
| `src/data/seedData.ts` | Add `is_active: true` to all seed seats |
| `src/pages/AccountDetail.tsx` | Edit seat dialog; deactivate/remove actions; seats in Overview Quick Stats; seat progress in Onboarding tab; active vs total in Billing |
| `src/pages/Accounts.tsx` | Add seat count column/badge to accounts list |

