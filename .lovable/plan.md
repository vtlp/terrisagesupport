

# Plan: Add Seats / Users List to Account Detail

## What's Missing

Currently, the Account section has a "Seat Expansion Request" workflow (to request additional seats), but there is no actual list of the users/seats being onboarded. There is no way to:
- Record who the individual users are (name, email, phone, role)
- Track whether each user has been onboarded or is still pending
- See a count of active vs pending seats at a glance

The Enquiry captures a `team_size_estimate` (a number), but once an account is created, there is no structured record of the actual people.

---

## Changes (4 Steps)

### Step 1: Data Model -- Add `AccountSeat` interface

**File: `src/types/core.ts`**

Add a new interface:

```text
AccountSeat {
  seat_id: string
  account_id: string
  name: string
  email: string
  phone: string
  role: string              (e.g. "Admin", "Agent", "Manager")
  onboarded: boolean        (whether this user has been set up)
  onboarded_at: string | null
  created_at: string
}
```

Add `seats: AccountSeat[]` field to the `Account` interface.

---

### Step 2: Seed Data -- Add sample seats to existing accounts

**File: `src/data/seedData.ts`**

Add 2-4 sample seats per account (mix of onboarded and pending) so the UI has data to display immediately.

---

### Step 3: Account Detail -- Add "Seats" tab

**File: `src/pages/AccountDetail.tsx`**

Add a new **"Seats"** tab (between "Onboarding" and "Verification") with:

**A. Summary Row**
- Total seats count, onboarded count, pending count -- displayed as small stat cards

**B. Seats Table**
- Columns: Name, Email, Phone, Role, Status (Onboarded / Pending), Onboarded Date
- Each row shows a badge: green for "Onboarded", amber for "Pending"

**C. "Add Seat" Button**
- Opens a small dialog/form to add a new seat (name, email, phone, role)
- New seats default to `onboarded: false`

**D. Toggle Onboarded**
- A button or checkbox on each row to mark a user as onboarded (sets `onboarded: true` and `onboarded_at` to now)

**E. Connection to Seat Expansion**
- The existing "Request Seat Expansion" workflow remains as-is -- it creates a ticket for approval. The Seats tab is the actual roster of users.

---

### Step 4: Wire up the Enquiry-to-Account conversion

**File: `src/pages/EnquiryDetail.tsx`**

When an enquiry is converted to an account, initialize `seats` as an empty array. The `team_size_estimate` from the enquiry can be shown as a reference note, but actual seat entries are added manually in the Account Seats tab.

---

## Files Summary

| File | Change |
|------|--------|
| `src/types/core.ts` | Add `AccountSeat` interface; add `seats` to `Account` |
| `src/data/seedData.ts` | Add sample seat data to existing accounts |
| `src/pages/AccountDetail.tsx` | Add "Seats" tab with table, add/toggle functionality, summary stats |
| `src/pages/EnquiryDetail.tsx` | Initialize `seats: []` on account conversion |

