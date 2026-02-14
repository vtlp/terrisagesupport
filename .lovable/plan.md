

# Terrisage Support UI - Complete Restructure

This is a large-scale restructuring of the entire application. The work is broken into **6 phases** to be implemented sequentially. Each phase builds on the previous one.

---

## Phase 1: Foundation - New Data Model + Types + Seed Data

Replace all existing type files and mock data with the new authoritative data model.

### Files to create/replace:
- `src/types/core.ts` -- All 11 entity interfaces (User, Enquiry, Account, CalendarEvent, Note, SupportTicket, KnowledgeBaseItem, MarketingLog, DataIngestionJob, Document, AuditTrail) with all enums (EnquiryStage, EnquirySource, EnquiryOutcome, TenancyType, AccountStatus, VerificationStatus, FocusArea, SalesFocus, TicketPriority, TicketStatus, DemoOutcome, NotInterestedReason, CalendarEventStatus, KBBucket, MarketingObjectType, etc.)
- `src/data/seedData.ts` -- 25 enquiries across stages/outcomes/tenancy types, 15 accounts, 20 calendar events, 15 tickets, 30 KB items, 30 marketing log entries, 5 users, ingestion jobs, documents, notes threads
- Remove old type files: `src/types/enquiry.ts`, `src/types/onboarding.ts`, `src/types/routing.ts`, `src/types/support.ts`
- Remove old data files: `src/data/enquiryData.ts`, `src/data/onboardingData.ts`, `src/data/mockData.ts`, `src/data/routingData.ts`

### Key data model changes from current:
- Enquiry stages simplified to: NEW_ENQUIRY, CONTACTED, DEMO_SCHEDULED, DEMO_COMPLETED, ACCOUNT_CREATED
- Enquiry gains: company_name, contact_phone_alt, whatsapp_enabled, tenancy_type (AGENCY_BROKERAGE_CONSULTANCY / BUILDER_DEVELOPER), outcome enum, focus_area[], sales_focus[], primary_property_types[], onboarding_pack_sent, demo_event_id, notes_thread[]
- Account gains: status enum (LIVE, ONBOARDING_IN_PROGRESS, DEACTIVATED, STALLED_ONBOARDING), verification_pan_status, verification_identity_status, onboarding_checklist[], notes_thread[] (carried from enquiry), documents[], integrations, data_ingestion_jobs[], created_from_enquiry_id
- CalendarEvent replaces "Next Action" -- entity_type + entity_id, status (UPCOMING/COMPLETED/CANCELLED)
- Note is a standalone entity with entity_type/entity_id
- SupportTicket adds linked_entity_type/id, market dropdown, configurable tags
- KnowledgeBaseItem uses bucket enum (9 buckets defined)
- MarketingLog is new (admin-only)
- All 48-hour references removed

---

## Phase 2: Navigation + Layout Restructure

### Sidebar (`AppSidebar.tsx`) -- replace entirely:
Exact nav items:
1. Dashboard
2. Inquiry Pipeline
3. Accounts (single item, no sub-nav)
4. Support Tickets
5. Knowledge Base
6. Marketing (admin-only, shown conditionally)
7. Reports
8. Admin (collapsible: Teams/Users, Lookup Management, Assignment Rules)

Remove: Demos and Calendar (merged into Enquiry pipeline), Onboarding (merged into Accounts detail), Imports (merged into Account detail), Integrations, Activation, Support Actions, Search, Macros, Playbooks, Technical View, Settings (merged into Admin)

### Header (`AppHeader.tsx`):
- Quick Create: "Create Enquiry" and "Create Support Ticket" only (remove "Create Account", "Schedule Demo", "Start Import")
- Keep search, notifications bell, profile menu, theme toggle

### Router (`App.tsx`):
Remove routes: `/demos`, `/onboarding`, `/imports`, `/integrations`, `/activation`, `/support-actions`, `/search`, `/macros`, `/playbooks`, `/technical`, `/settings`, `/tickets/new`, `/admin/sla`, `/admin/audit`
Add routes: `/marketing`
Keep: `/`, `/enquiries`, `/enquiries/:id`, `/accounts`, `/accounts/:id`, `/tickets`, `/tickets/:id`, `/knowledge`, `/reports`, `/admin/users`, `/admin/queues`

### Delete pages:
`Demos.tsx`, `Onboarding.tsx`, `Imports.tsx`, `Integrations.tsx`, `Activation.tsx`, `SupportActions.tsx`, `SearchPage.tsx`, `Macros.tsx`, `Playbooks.tsx`, `TechnicalView.tsx`, `Settings.tsx`, `NewTicket.tsx`, `admin/AdminSLA.tsx`, `admin/AdminAudit.tsx`

### Add role context:
- Create `src/context/UserContext.tsx` -- simple React context providing current user + role (ADMIN / SUPPORT_AGENT), defaulting to ADMIN for demo
- Wrap app in this provider
- Use context to conditionally show Marketing nav item and enforce admin-only restrictions

---

## Phase 3: Dashboard Redesign

Replace `Dashboard.tsx` entirely:

### Layout (single view, no tabs):
1. **3 Top Buckets** (display-only counters, NOT clickable):
   - Enquiries: total, new today, contacted, converted (stage=ACCOUNT_CREATED), follow-up needed (has upcoming CalendarEvent), not contacted
   - Onboarding Pipeline: live, onboarding in progress, stalled, deactivated
   - Tickets: open, in progress, urgent/high

2. **KPI Widgets**:
   - Quarterly targets (builder vs agency) -- editable by admin only
   - Monthly active users count
   - "Accounts requiring attention" (stalled OR next action overdue OR verification pending too long)
   - "Enquiries requiring attention" (not contacted + old, OR follow-up overdue)
   - "Tickets requiring attention" (urgent/high or overdue)

3. **Knowledge Base Quick Links** (bottom):
   - Links to top KB buckets (after-first-call scripts, onboarding checklists, demo pitches, templates)

Remove: Business/Operational/Technical tabs, 48h metrics, funnel visualization, "Verification Ticket" and "New Account" buttons

---

## Phase 4: Enquiry Pipeline Module (Full Rebuild)

### 4A: Enquiry List View (`Enquiries.tsx`)
- Top counters (NOT clickable): Total, New Today, Contacted, Converted, Follow-up Needed, Not Contacted
- Search by name/city/phone
- Multi-select filters: stage, tenancy_type, source
- Table columns: enquiry_id, name, phone, city, source, stage, outcome, assigned_to, notes preview (3-4 lines), next action (title+date)
- No action CTAs on rows -- clicking row opens detail view
- Mobile card layout

### 4B: Enquiry Detail View (`EnquiryDetail.tsx` -- new page at `/enquiries/:id`)
Full-page layout with sections:

**A) Header**: company_name, contact info (name, phone, alt phone, email), WhatsApp toggle, city, tenancy_type selector, assignment dropdown

**B) Tenancy-dependent fields**:
- Agency/Brokerage: team_size, current_system, focus_area (SALES/RENTALS), sales_focus (conditional), primary_property_types (conditional), portals_in_use
- Builder/Developer: team_size, current_system, focus_area, project pipeline notes, portals_in_use

**C) Stage + Outcome controls**:
- Stage dropdown with validation rules
- Outcome dropdown (required once CONTACTED)
- NOT_INTERESTED shows reason chips + free text
- Outcome change triggers business rules (WhatsApp follow-up prompt, calendar event prompt, blocker checks for DEMO_SCHEDULED)

**D) Notes panel** (always visible, threaded, timestamped)

**E) Calendar Event section**: Create button + upcoming event summary

**F) Action bar** (sticky bottom on mobile):
- Assign/Reassign
- Change Stage
- Change Outcome
- Schedule Demo (guided flow with prerequisite blockers)
- Send Onboarding Pack (mark sent + copy content)
- Convert to Account (creates Account, carries all data + notes, sets stage ACCOUNT_CREATED)
- Add Attachments

**G) Demo scheduling flow**: blocker UI checks (tenancy_type, team_size, email, WhatsApp), creates CalendarEvent, sets DEMO_SCHEDULED. Demo outcomes (NO_SHOW, LIKED_WANT_ONBOARD_SOON, GHOSTED) recorded when moving to DEMO_COMPLETED.

### Shared components to create:
- `src/components/shared/NotesPanel.tsx` -- threaded notes with timestamp + author
- `src/components/shared/CalendarEventForm.tsx` -- title, date/time, notes
- `src/components/shared/AssignmentSelect.tsx` -- assign/reassign dropdown
- `src/components/shared/AttachmentUploader.tsx` -- file upload linked to entity

---

## Phase 5: Accounts, Tickets, Knowledge Base, Marketing, Reports

### 5A: Accounts List (`Accounts.tsx` rewrite)
- Top buckets: All, Live, Onboarding In Progress, Deactivated, Stalled Onboarding
- Search by account_name or phone
- Filters: status, city, tenancy_type
- Table: account_name, city, tenancy_type, owner/superuser_name, status, next_action (title+date), notes preview
- No row CTAs

### 5B: Account Detail (`AccountDetail.tsx` rewrite)
- Header: account_name (admin-only edit), city, tenancy_type, status, verification pills (PAN + Identity), next calendar event
- **9 Tabs**: Overview, Onboarding, Verification, Data Ingestion, Integrations, Notes, Documents/Attachments, Calendar, Support Tickets
- Overview: carried-over enquiry details, admin-only editing
- Onboarding: pack info, checklist (tickable items with timestamps)
- Verification: PAN + Identity status management
- Data Ingestion: import history table + Start Import wizard (5-step: type, upload, mapping, review, run)
- Integrations: Meta/Google/Website config with connection status
- Notes: all carried-over enquiry notes + ongoing notes
- Documents: folder creation, upload, list, download
- Calendar: full event history, create new event
- Support Tickets: ticket history + create new (prefilled account)

### 5C: Support Tickets (`Tickets.tsx` update)
- Add prominent "Create New Ticket" button with form
- Support linked_entity_type/id (link to Account or Enquiry)
- Configurable tags and market dropdown
- Assignment support
- Mobile-friendly attachments

### 5D: Knowledge Base (`Knowledge.tsx` rewrite)
- Bucket-based navigation (9 buckets from spec)
- Searchable items with copy-to-clipboard
- Each item: title, rich content, attachments, tags

### 5E: Marketing Module (`Marketing.tsx` -- new page)
- Admin-only (redirect or block for non-admin)
- Targets section: quarterly targets for builder vs agency, editable
- Logging: CRUD screens for Referrals, Contacts, Champions, Cold Call Leads, Lead Source Repository, Events, Costs
- Geography/tenancy type tagging
- Cost tracking (online/offline)

### 5F: Reports (`Reports.tsx` rewrite)
- Report cards: Account usage, Ops pipeline KPIs (enquiry funnel), Account KPIs, Area heat maps, Ticket KPIs
- Viewable by all users

---

## Phase 6: Admin Module + Final Polish

### Admin restructure:
- Teams/Users: keep current functionality
- Lookup Management (new): manage sources, tags, market dropdown values, portals list
- Assignment Rules: keep routing config
- Remove separate Settings page (merge notification prefs into Admin)
- Remove SLA Policies and Audit Log as standalone pages

### Mobile responsiveness pass:
- Ensure every screen uses responsive grid (grid-cols-1 on mobile)
- Sticky action bars on detail views
- Collapsible sidebar with hamburger menu
- Touch-friendly tap targets

### Notifications:
- In-app notification on assignment
- Overdue next-action indicator (drives "requiring attention")
- No 48-hour rules

---

## Technical Notes

- All data remains client-side mock (no backend). State management via React useState with seed data initialization
- Role context (UserContext) drives admin-only visibility: Marketing nav, account name editing, quarterly target editing
- Shared components (NotesPanel, CalendarEventForm, AssignmentSelect, AttachmentUploader) are reused across Enquiry detail, Account detail, and Ticket detail
- "Convert to Account" creates a new account entry in local state, copies all enquiry fields + notes, and sets enquiry stage to ACCOUNT_CREATED
- "Converted" counter = enquiries with stage === ACCOUNT_CREATED
- "Follow-up needed" counter = enquiries with an associated CalendarEvent in UPCOMING status
- CalendarEvent is the sole mechanism for "Next Action" across the app
- The import wizard from the existing StartImportDialog component will be adapted and embedded in the Account Detail Data Ingestion tab
- All 48-hour references, Business/Technical tabs, and the Settings page will be removed

### Estimated file count:
- ~8 new/rewritten page files
- ~4 new shared components
- ~2 new type/data files
- ~15 files deleted
- ~5 files modified (App.tsx, AppSidebar.tsx, AppHeader.tsx, etc.)

