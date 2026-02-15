# Implementation Plan: Multi-Module Enhancements (9 Items)

This plan covers ticket tag/city lookups, Indian city master list, dashboard navigation, enquiry filters and stage logic, calendar module separation, account billing tab, and reports feature adoption updates.

---

## 1. Tags and Cities from Admin Lookups

### 1.1 Shared Lookup Data

- Create a new file `src/data/lookupData.ts` that exports the default tags, markets/cities, portals, and sources arrays. Both `AdminLookups.tsx` and consuming pages (`CreateTicketDialog.tsx`, `Tickets.tsx`, `EnquiryDetail.tsx`, city dropdowns everywhere) will import from this single source of truth.

### 1.2 Ticket Creation -- Tags from Lookups

- In `CreateTicketDialog.tsx`, replace the free-text tag input with a **selectable tag list** (checkboxes or clickable badges) sourced from `lookupData.ts` default tags, plus retain the ability to type a custom tag.

### 1.3 City Dropdowns from Lookups

- Replace all free-text city inputs (`CreateTicketDialog.tsx` city field, `Tickets.tsx` edit city, `EnquiryDetail.tsx` city, `CreateEnquiryDialog.tsx`) with a `<Select>` dropdown populated from the shared markets/cities list.

---

## 2. Comprehensive Indian Cities List

### 2.1 Update Markets in `lookupData.ts`

- Replace the current 10-city list with a comprehensive list of tier-1 and tier-2 cities across every Indian state.
- **Top 10 (most popular, shown first)**: Mumbai, Delhi, Bangalore, Hyderabad, Pune, Chennai, Kolkata, Ahmedabad, Jaipur, Lucknow
- **Remaining cities in alphabetical order**: Agra, Amritsar, Bhopal, Bhubaneswar, Chandigarh, Coimbatore, Dehradun, Faridabad, Ghaziabad, Goa (Panaji), Gurgaon, Guwahati, Indore, Kanpur, Kochi, Ludhiana, Madurai, Mangalore, Meerut, Mysore, Nagpur, Nashik, Noida, Patna, Raipur, Rajkot, Ranchi, Surat, Thane, Thiruvananthapuram, Udaipur, Vadodara, Varanasi, Vijayawada, Visakhapatnam, and more.
- Update `AdminLookups.tsx` to import from the shared file instead of its own hardcoded defaults.

---

## 3. Dashboard Navigation Links

### 3.1 Clickable Bucket Headers

- Make the "Enquiries" card header in Dashboard link to `/enquiries`.
- Make the "Onboarding Pipeline" card header link to `/accounts`.
- Make the "Tickets & Issues" card header link to `/tickets`.

### 3.2 Attention Cards with Filtered Navigation

- "Accounts Attention" card: on click, navigate to `/accounts?status=STALLED_ONBOARDING`.
- "Enquiries Attention" card: on click, navigate to `/enquiries?status=follow_up_needed`.
- Update `Accounts.tsx` and `Enquiries.tsx` to read URL query parameters and pre-set filters on mount.

---

## 4. Enquiry Pipeline Outcome Filter and British English

### 4.1 Add Outcome Filter

- In `Enquiries.tsx`, add an "Outcome" filter dropdown alongside the existing stage, tenancy, and source filters. Options: All Outcomes, Interested, Call Later, Schedule Demo, Not Interested, Wrong/Bounced Number.

### 4.2 British English Spellings

- Audit all user-facing text across the application and update American spellings to British English where applicable (e.g., "Customize" to "Customise", "Organization" to "Organisation", "Canceled" to "Cancelled", "Categorize" to "Categorise"). This will be applied across all files with visible text.

---

## 5. Latest Contact Outcome Label in Pipeline Stage

- In `EnquiryDetail.tsx`, under the Pipeline Stage card, when the enquiry is at CONTACTED stage and has an outcome set, display a labelled section: **"Latest Contact Outcome"** showing the outcome badge and any associated reason, replacing the current generic "Outcome:" label.

---

## 6. Schedule Demo Outcome Auto-Opens Demo Scheduler

- In `EnquiryDetail.tsx`, when the outcome is changed to `SCHEDULE_DEMO` (via `handleOutcomeChange` or the stage modal), automatically open the demo scheduler (`setShowDemoSchedule(true)`) with:
  - Pre-filled title: "Demo -- [company name]"
  - Pre-filled description with contact email as invitee reference
- Update `CalendarEventForm.tsx` to accept optional `defaultDescription` prop for pre-population.

---

## 7. Stage Update Creates Timeline Note

- In `EnquiryDetail.tsx`, whenever a stage is updated (forward or backward), automatically create a system note with a timestamp entry like: `[System] Stage updated to "Contacted" by [user name] at [timestamp]`.
- This applies to all stage transitions: forward progression, backward revert, and stage modal confirmations. The note is pushed to `seedNotes` and the enquiry's `notes_thread`.

---

## 8. Reports Feature Adoption Update

- In `Reports.tsx`, update the `featureAdoption` array to reflect the requested features:
  - "Enquiry Capture" (replaces current "Lead Capture")
  - "Convert to Lead Button"
  - "Creating Manual Leads"
  - "Creating Tasks"
  - "Task Types Usage"
  - "Channel Partner Section"
- Remove the old items (Follow-ups, Integrations, Reports, Bulk Import, Inventory Mgmt) and replace with the above list.

---

## 9. Separate Calendar Module from Inquiry Pipeline

### 9.1 New Route and Page

- Create `src/pages/CalendarPage.tsx` -- a standalone full calendar page.
- Add route `/calendar` in `App.tsx`.

### 9.2 Calendar Page Content

- Full month calendar grid (reuse the calendar grid pattern from `EnquiryPipelineDashboard.tsx`).
- **Entity filter**: All Events, Enquiries, Accounts, Tickets, Marketing, Others.
- **Team member filter**: Dropdown to select "My Calendar" or any individual team member (populated from `seedUsers`). Admins can view any team member's calendar.
- Below the calendar grid, a **list view** of events for the selected month, sorted chronologically.
- No KPI buckets or funnel -- purely calendar-focused.

### 9.3 Update Sidebar Navigation

- Remove the "Calendar & Dashboard" sub-item from the Inquiry Pipeline collapsible group.
- The Inquiry Pipeline group will only contain "All Enquiries" (or become a single non-collapsible nav item since there is only one sub-item).
- Add a new top-level nav item "Calendar" with the `CalendarDays` icon, positioned after "Inquiry Pipeline".

### 9.4 Clean Up

- Remove or repurpose `EnquiryPipelineDashboard.tsx` since its functionality is now in `CalendarPage.tsx`.
- Remove the `/enquiries/dashboard` route.

---

## 10. Account Billing Tab

### 10.1 Add Billing Tab

- In `AccountDetail.tsx`, add a new "Billing" tab after the existing tabs.

### 10.2 Billing Tab Content

- **Payment Plan Selection**: Radio group with three options:
  - Quarterly (4 months) -- billed 3 times/year
  - Half-Yearly (6 months) -- billed 2 times/year
  - Annual (12 months) -- single payment, billed in advance
- **Billing Details Fields** (manually entered):
  - Plan Amount (currency input)
  - Billing Start Date
  - Next Payment Due Date (auto-calculated based on plan)
  - Payment Status: Paid / Pending / Overdue
  - Invoice Number (text input)
  - Notes/Remarks (textarea)
- **Payment History Table**: Shows past payments with date, amount, invoice number, status, and receipt attachment.
- **Attachment Upload**: Ability to attach receipts or invoices per payment entry.
- **Add Payment** button to log a new payment entry manually.
- Designed so that quarterly and half-yearly options can be easily removed later, leaving only annual.

---

## Technical Details

### Files Created


| File                         | Purpose                                             |
| ---------------------------- | --------------------------------------------------- |
| `src/data/lookupData.ts`     | Shared lookup data (tags, cities, portals, sources) |
| `src/pages/CalendarPage.tsx` | Standalone full calendar page                       |


### Files Modified


| File                                            | Changes                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/pages/admin/AdminLookups.tsx`              | Import from shared lookupData instead of hardcoded defaults                                                   |
| `src/components/shared/CreateTicketDialog.tsx`  | Tags from lookups, city dropdown, British English                                                             |
| `src/pages/Tickets.tsx`                         | City dropdown from lookups, tags from lookups                                                                 |
| `src/pages/EnquiryDetail.tsx`                   | City dropdown, "Latest Contact Outcome" label, Schedule Demo auto-open, stage timeline notes, British English |
| `src/components/shared/CreateEnquiryDialog.tsx` | City dropdown from lookups                                                                                    |
| `src/pages/Enquiries.tsx`                       | Outcome filter, URL query param filtering, British English                                                    |
| `src/pages/Accounts.tsx`                        | URL query param filtering for status                                                                          |
| `src/pages/Dashboard.tsx`                       | Clickable bucket headers, attention card navigation                                                           |
| `src/pages/Reports.tsx`                         | Updated feature adoption list                                                                                 |
| `src/pages/AccountDetail.tsx`                   | New Billing tab                                                                                               |
| `src/components/shared/CalendarEventForm.tsx`   | Accept defaultDescription prop                                                                                |
| `src/components/layout/AppSidebar.tsx`          | Separate Calendar nav item, simplify Inquiry Pipeline                                                         |
| `src/App.tsx`                                   | Add `/calendar` route, remove `/enquiries/dashboard`                                                          |


### State Additions

- `billingPlan`, `payments[]`, `billingDetails` on AccountDetail local state
- `outcomeFilter` on Enquiries page
- `entityFilter`, `teamMemberFilter` on CalendarPage