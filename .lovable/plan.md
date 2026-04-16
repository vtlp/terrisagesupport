
The user wants the existing plan extended so that **Accounts** module is also wired to the backend, completing the full flow: Enquiry → Onboarding form submission → Review → Convert to Account (persisted in DB).

I'll add Accounts to the in-scope list and detail the conversion persistence.

---

# Plan (Updated): Backend for Dashboard, Enquiries, Calendar, KB, Admin (Users) + **Accounts & Full Conversion Flow**

## What's new in this revision

**Accounts module is now in scope.** The full pipeline persists end-to-end:

```text
Sign in → Enquiry (DB) → Send Onboarding Link (Copy / Email / WhatsApp)
       → Customer fills public onboarding form (/onboarding/agency|builder)
       → Submission saved to DB (status = PENDING_REVIEW)
       → Agent reviews on Enquiry detail → Approve / Reject
       → Convert to Account (gated on APPROVED)
       → Account row + AccountSeats inserted from submission payload
       → Enquiry stage = ACCOUNT_CREATED, linked to new account_id
       → Account appears in Accounts list / detail (live from DB)
```

## Scope (this round)

In scope: **Auth, Dashboard, Enquiries, Calendar, Knowledge Base, Admin → Teams & Users, Onboarding form (working) + share dialog, Accounts (list + detail + conversion).**
Out of scope: Tickets, Marketing, Reports, Admin → Queues / Lookups (remain on seed data).

## 1. Auth + Roles
(unchanged from previous plan)
- Lovable Cloud + email/password, no public sign-up.
- Admin seeded from credentials you provide; first-login password reset.
- `profiles` + `user_roles` (separate table) + `has_role()` security-definer function.
- Remove "Switch to Support Agent" toggle, add real Sign Out.
- Public routes: `/auth`, `/onboarding/agency`, `/onboarding/builder`.

## 2. Database tables

| Table | Purpose |
|---|---|
| `profiles`, `user_roles` | Auth + RBAC |
| `enquiries`, `enquiry_notes` | Enquiry pipeline |
| `calendar_events` | Calendar |
| `kb_folders`, `kb_files`, `kb_articles` | Knowledge base |
| `onboarding_submissions` | Form payloads |
| **`accounts`** | Live account records |
| **`account_seats`** | Team members per account |
| **`account_notes`** | Account notes thread |
| **`account_checklist_items`** | Onboarding checklist per account |

Storage: `kb-files`, `onboarding-uploads` (private buckets, RLS).

**RLS:** authenticated read/write across operational tables; admin-only writes on `profiles`/`user_roles`; public INSERT on `onboarding_submissions` (scoped by `enquiry_id` token); read of submissions only by authenticated staff.

## 3. Conversion flow (the new piece)

When agent clicks **Convert to Account** (only enabled when submission `APPROVED`):

1. Insert `accounts` row using **submission payload**: `account_name`, `city`, `tenancy_type`, owner fields, GST/PAN/RERA, website.
2. Bulk insert `account_seats` from `submission.team_members`.
3. Seed default `account_checklist_items` (standard onboarding checklist).
4. Copy uploaded files (from `onboarding-uploads`) reference into `account` documents.
5. Update `enquiries`: `stage = ACCOUNT_CREATED`, store `converted_account_id`.
6. Log timeline note on both enquiry and account.
7. Navigate to new `/accounts/:id`.

All steps wrapped in a Postgres function `convert_enquiry_to_account(enquiry_id)` for atomicity, called via `supabase.rpc(...)`.

## 4. Accounts module wiring

- **`Accounts.tsx`** — list from `accounts` table; filters by status / tenancy / city; counts live.
- **`AccountDetail.tsx`** — read account + seats + notes + checklist from DB; existing tabs (Overview, Seats, Onboarding checklist with Save/Cancel guard, Notes, Documents) all persist.
- Seat add/edit/deactivate persists to `account_seats`.
- Checklist save commits draft to `account_checklist_items`.

## 5. Onboarding form + share dialog
(unchanged from previous plan)
- Public routes `/onboarding/agency` and `/onboarding/builder`, multi-step, writes one row to `onboarding_submissions`.
- **Share dialog** with Copy / Email (`mailto:`) / WhatsApp (`wa.me/<phone>?text=...`) — no auto-clipboard.

## 6. Dashboard / Enquiries / Calendar / KB / Admin Users
(unchanged from previous plan — all switch from seed to live queries.)

## 7. UI cleanup
- Remove role-switch menu item.
- Header shows real user from `profiles` + role.
- Route guard: redirect to `/auth` unless on a public route.

## What I still need from you

1. **Admin email + temp password** to seed the first admin.
2. Confirm the onboarding form lives **in this app** at `/onboarding/agency|builder` (recommended — keeps submissions in the same DB and avoids cross-project plumbing).

## Files / surfaces touched (delta from previous plan)

| Area | Change |
|---|---|
| Migration | + `accounts`, `account_seats`, `account_notes`, `account_checklist_items` tables + RLS + `convert_enquiry_to_account()` RPC |
| `src/pages/Accounts.tsx`, `AccountDetail.tsx` | Switch from seed to Supabase queries; persist seats / notes / checklist |
| `src/pages/EnquiryDetail.tsx` | `handleConvertToAccount` calls RPC; navigates to new account |
| (all other items as in prior plan) | — |
