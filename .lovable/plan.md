

# Plan: Seats Flow Fix, Create Invoice, and Session Documentation

## 1. Seats Flow Consistency (Enquiry-to-Account)

### Problem
The `team_size_estimate` from the enquiry is an approximate number captured early in the sales cycle. When the account is created, this number is carried over and displayed in the "From Enquiry" card on the Overview tab. However, the actual seat roster (with names, roles, permissions) is built later in the Seats tab. The current UI does not clearly communicate this distinction -- agents might confuse the enquiry estimate with the actual seat count.

### Changes

**File: `src/pages/AccountDetail.tsx` -- Overview tab, "From Enquiry" card**

- Rename the "Team Size" label to "Team Size (Estimate)" to make it clear this was an approximate figure from the enquiry stage.
- Add a small note below it: "Actual seats: X active" linking to the Seats tab, so agents see the real count alongside the estimate.

**File: `src/pages/AccountDetail.tsx` -- Seats tab**

- Add an informational banner at the top of the Seats tab when the account was created from an enquiry, showing: "Estimated team size from enquiry: N. Add the actual users below." This bridges the gap between the enquiry estimate and the seat roster.

---

## 2. Create Invoice Feature (Billing Tab)

### What It Does

Add a "Create Invoice" button in the Billing tab that generates a structured invoice payload with the company header "VTLP Technologies Private Limited" and all calculated billing details.

### Changes

**File: `src/pages/AccountDetail.tsx` -- Billing tab**

**A. New state:**
- `showInvoicePreview: boolean` to toggle the invoice preview dialog

**B. "Create Invoice" button** added next to existing billing controls.

**C. Invoice Dialog** showing a full invoice preview with:
- **Header**: "VTLP Technologies Private Limited" with company address/details
- **Invoice metadata**: Auto-generated invoice number (format: `VTLP-INV-YYYYMMDD-XXXX`), date, due date (based on billing cycle)
- **Bill To**: Account name, owner name, city, email, phone from account data
- **Line items table**:
  - Row 1: "SaaS Subscription - [Billing Cycle]" with plan amount
  - Row 2: "Active Seats (X seats x Rs.Y/seat)" with total seat cost
- **Subtotal, GST (18%)**, and **Grand Total** auto-calculated
- **Payment terms** derived from billing cycle
- A note showing "Total Seats: X active, Y inactive" for reference

**D. Invoice payload** (functional JSON object) generated with all fields, logged to console and shown as copyable JSON. Fields include:
- `invoice_number`, `invoice_date`, `due_date`
- `from`: VTLP Technologies Pvt Ltd details
- `bill_to`: account details
- `line_items[]`: subscription + seats
- `subtotal`, `gst_rate`, `gst_amount`, `grand_total`
- `billing_cycle`, `remarks`

**E. "Download Invoice" and "Copy Payload"** buttons in the dialog footer. Download simulates a PDF download (toast notification). Copy copies the JSON payload to clipboard.

---

## 3. Session Documentation (Changelog Since 4:15 PM)

This is a documentation request, not a code change. Here is the complete changelog of all updates made during this session:

### Update 1: Add Seats / Users List to Account Detail
- **Data Model**: Created `AccountSeat` interface in `src/types/core.ts` with fields: `seat_id`, `account_id`, `name`, `email`, `phone`, `role`, `onboarded`, `onboarded_at`, `created_at`. Added `seats: AccountSeat[]` to the `Account` interface.
- **Seed Data**: Updated `src/data/seedData.ts` with a `makeSeats` helper to generate 2-4 sample seats per account (mix of onboarded and pending statuses).
- **Account Detail UI**: Added a new "Seats" tab in `src/pages/AccountDetail.tsx` between Onboarding and Verification, featuring:
  - Summary stat cards (Total, Onboarded, Pending)
  - A seats table with columns: Name, Email, Phone, Role, Status, Onboarded Date
  - Status badges (green "Onboarded" / amber "Pending") that toggle onboarded state on click
  - "Add Seat" dialog for manual user registration (name, email, phone, role)
- **Conversion Logic**: Ensured `seats: []` is initialized when converting an enquiry to an account in `src/pages/EnquiryDetail.tsx`.

### Update 2: Enhanced Seat Roles, Permissions, and Billing Integration
- **Data Model**: Added `permissions: string[]` to the `AccountSeat` interface in `src/types/core.ts`.
- **Role System**: Changed role options from generic (Admin, Manager, Agent, Viewer) to structured: **Super User** (single per account), **Admin**, and **Agent**.
- **Conditional Permissions**: When role is "Agent", three permission checkboxes appear:
  - Organization-wide Access (always visible)
  - Agent Network Access (hidden for Builder/Developer tenancy)
  - Publish Access (hidden for Builder/Developer tenancy)
- **Super User Enforcement**: Only one Super User allowed per account -- the option is disabled with "(already assigned)" if one exists.
- **Permissions Display**: Added a "Permissions" column to the seats table showing badges (Org-wide, Agent Network, Publish) or "Full access" for Super User/Admin.
- **Billing Integration**: Added `perSeatPrice` state, auto-calculated `Total Seat Cost = seats.length x perSeatPrice` in the Billing tab.
- **Seed Data**: Updated seed seats with roles (one Super User per account) and permission arrays.

### Update 3: Complete Seats Operations and Cross-Tab Visibility
- **Data Model**: Added `is_active: boolean` to `AccountSeat` interface for deactivation tracking.
- **Seat Lifecycle Actions** (via dropdown menu on each row):
  - **Edit**: Opens dialog pre-filled with seat data; respects Super User limit and tenancy-based permission rules.
  - **Deactivate**: Sets `is_active = false`, greys out row, excludes from billing calculations.
  - **Reactivate**: Sets `is_active = true`, re-includes in billing.
  - **Remove**: Permanently deletes seat (only available for never-onboarded seats), with confirmation dialog.
- **Overview Tab**: Added "Active Seats" to Quick Stats grid for immediate visibility.
- **Onboarding Tab**: Added "Seat Onboarding Status" card with progress bar (X of Y onboarded) and per-seat status list.
- **Billing Tab**: Updated to show Active Seats (for cost calculation), Total Seats (including inactive), and Total Seat Cost based on active seats only.
- **Accounts List**: Added seat count column in `src/pages/Accounts.tsx` showing active count and total if inactive seats exist.
- **Seed Data**: All existing seeds updated with `is_active: true`.

---

## Technical Summary of Code Changes

| File | Change |
|------|--------|
| `src/pages/AccountDetail.tsx` | Add enquiry estimate note in Overview "From Enquiry" card; add estimate banner in Seats tab; add "Create Invoice" button and invoice preview dialog in Billing tab |
| No other files need modification | -- |

