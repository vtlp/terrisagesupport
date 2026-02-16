

# Plan: Enhanced Seat Roles, Permissions, and Billing Integration

## Overview

Update the Add Seat dialog to use structured roles (Super User, Admin, Agent) with conditional permissions, enforce a single Super User per account, and connect seat counts to the Billing tab with per-seat pricing.

---

## Changes

### 1. Data Model Update

**File: `src/types/core.ts`**

Add a `permissions` field to the `AccountSeat` interface:

```text
permissions: string[]   // e.g. ['org_wide_access', 'agent_network_access', 'publish_access']
```

### 2. Add Seat Dialog -- Role and Permissions Logic

**File: `src/pages/AccountDetail.tsx`**

**A. Role dropdown** -- Change options from (Admin, Manager, Agent, Viewer) to:
- **Super User** -- full access, no separate permissions needed
- **Admin** -- full access, no separate permissions needed
- **Agent** -- requires permission selection

**B. Conditional permissions (visible only when role = Agent):**
- Organization-wide Access (checkbox)
- Agent Network Access (checkbox) -- hidden if tenancy type is Builder/Developer
- Publish Access (checkbox) -- hidden if tenancy type is Builder/Developer

**C. Super User enforcement:**
- If an existing seat already has role "Super User", disable the "Super User" option in the dropdown with a note "(already assigned)"
- Only one Super User allowed per account

**D. State additions:**
- `newSeatPermissions: string[]` state to track selected permissions
- Reset permissions when role changes away from Agent

### 3. Seats Table -- Show Permissions

**File: `src/pages/AccountDetail.tsx`**

Add a "Permissions" column (or show permissions as small badges under the Role column) so agents can see what permissions each seat has at a glance.

### 4. Billing Tab -- Seat Count and Per-Seat Pricing

**File: `src/pages/AccountDetail.tsx`**

Add to the Billing Details card:
- **Number of Seats** -- auto-calculated from `seats.length`, displayed as a read-only field
- **Per Seat Price (INR)** -- new editable input field (state: `perSeatPrice`)
- **Total Seat Cost** -- auto-calculated as `seats.length x perSeatPrice`, displayed below

This gives billing visibility into how many seats are active and the associated cost.

### 5. Seed Data -- Add Permissions to Existing Seats

**File: `src/data/seedData.ts`**

Update the `makeSeats` helper to accept a `permissions` parameter and retroactively tag existing seed seats with appropriate permissions. Ensure each account has exactly one Super User.

---

## Tenancy-Based Permission Rules

```text
Role = Super User or Admin --> No permission checkboxes shown (full access implied)

Role = Agent + Tenancy = Agency/Brokerage:
  [x] Organization-wide Access
  [x] Agent Network Access
  [x] Publish Access

Role = Agent + Tenancy = Builder/Developer:
  [x] Organization-wide Access
  [ ] Agent Network Access    (hidden)
  [ ] Publish Access           (hidden)
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/types/core.ts` | Add `permissions: string[]` to `AccountSeat` |
| `src/pages/AccountDetail.tsx` | Update Add Seat dialog (roles, permissions, Super User limit); add permissions display in table; add seat count and per-seat price to Billing tab |
| `src/data/seedData.ts` | Update seed seats with permissions and one Super User per account |

