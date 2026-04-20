

## Marketing module — full backend + admin editing wired to live data

Confirming: yes, this plan includes the **complete backend** (DB tables, RLS, indexes, triggers) plus the UI rewiring. The existing `marketing_*` tables stay; new ones cover the gaps (targets, settings, typed records, simple cost items).

---

### 1. Database — new tables (admin write, staff read)

**`marketing_targets`** — quarterly + total target per tenancy per year
`(id, year int, tenancy_type tenancy_type, q1 int, q2 int, q3 int, q4 int, total_target int, created_by, updated_at)` · UNIQUE (year, tenancy_type)

**`marketing_settings`** — single-row admin overrides (e.g. manual Total Spend)
`(id, total_spend_override numeric, updated_by, updated_at)` · seeded with one row.

**`marketing_referrals`**
`(id, referrer_name, referrer_phone, referrer_email, referred_company, city, status text, notes, created_by, created_at, updated_at)`

**`marketing_contacts`**
`(id, name, title, company, phone, email, city, notes, created_by, created_at, updated_at)`

**`marketing_champions`**
`(id, name, company, role, reach int, city, notes, created_by, created_at, updated_at)`

**`marketing_events`**
`(id, event_name, location, city, event_date date, attendees int, notes, created_by, created_at, updated_at)`

**`marketing_cost_items`** — the simple Title/Description/Amount spend records you described (separate from existing campaign-linked `marketing_costs`)
`(id, title, description, amount numeric, cost_type 'ONLINE'|'OFFLINE', spend_date date, city, notes, created_by, created_at, updated_at)`

**RLS on all new tables**
- Admin: full access (`has_role(auth.uid(), 'admin')`)
- Staff: SELECT only (read for visibility — actual page is admin-gated anyway)

**Indexes**: city on the 5 record tables (geography count); (year, tenancy_type) on targets; (cost_type, spend_date) on cost items.

**Triggers**: `update_updated_at_column` on each new table.

---

### 2. Overview tab (no UI restructure, behaviour rewired)

- **Remove tiles**: "Cold Call Leads" and "Lead Sources".
- **Quarterly target cards** (Agency + Builder):
  - Q1–Q4 numbers + a new **Total Target** field, all click-to-edit (admin only). Default render is read-only chip; click → inline input → save → back to read-only.
  - Progress denominator = quarter target. Numerator = `accounts.status='LIVE' AND tenancy_type=X` created in that calendar quarter.
- **Cost summary tiles**:
  - Online = SUM(`marketing_cost_items` WHERE cost_type='ONLINE')
  - Offline = SUM(... 'OFFLINE')
  - Total Spend = `marketing_settings.total_spend_override` (admin inline-editable; not auto-summed, per your note)
- **Geography Coverage chips**: cities from `lookup_cities`. Count per chip = number of records across `marketing_referrals + contacts + champions + events + cost_items` with matching `city`.

---

### 3. Pipeline KPIs tab — live data

Swap `seedEnquiries`/`seedAccounts`/`seedTickets` for live queries on `enquiries`, `accounts`, `tickets`. Same five-stage funnel, same source pie, same operational KPIs. No UI change.

---

### 4. Activity Log tab — empty state

Render "Activity log mapping coming soon." No data wiring yet (per your instruction).

---

### 5. Costs tab — editable, with add-new

Two cards (Online / Offline) reading from `marketing_cost_items`:
- Each row: Title · Description · Amount · row actions (edit, delete).
- "Add spend" button → dialog with **Title, Description, Amount** (+ optional date, city).
- Card footer shows total; these totals feed Overview tiles.

---

### 6. New tabs — list + add-new

Final tab order: `Overview · Pipeline KPIs · Activity Log · Referrals & Contacts & Champions · Events · Costs`

- **Referrals & Contacts & Champions** (single tab, three sub-toggles per your wording): each sub-view is a list with search + "Add new" dialog matching existing UI.
- **Events**: list with search + "Add new" dialog.

---

### 7. Access control

Marketing route already admin-gated in `Marketing.tsx` (`if (!isAdmin) return <Navigate to="/" />`). No change.

---

### Files

**Migration (new)**: 7 tables + RLS policies + indexes + updated_at triggers + seed `marketing_settings` singleton row.

**New code**:
- `src/lib/marketingApi.ts` — typed CRUD helpers per table (targets, settings, referrals, contacts, champions, events, cost_items).
- `src/components/marketing/EditableNumber.tsx` — click-to-edit numeric chip (admin gated).
- `src/components/marketing/MarketingTargetCard.tsx` — Agency/Builder card with inline-edit Q1–Q4 + Total.
- `src/components/marketing/AddSpendDialog.tsx`
- `src/components/marketing/AddRecordDialog.tsx` — generic, schema-driven for referrals/contacts/champions/events.
- `src/components/marketing/RecordsTab.tsx` — three-toggle list view.
- `src/components/marketing/EventsTab.tsx`

**Edited**: `src/pages/Marketing.tsx` — remove 2 tiles, wire targets, costs, geography, pipeline KPIs to live data; add 2 new tabs.

---

### Open mapping note

Geography count rule: a record is counted under city X when `record.city = X` (case-insensitive match against `lookup_cities.name`). Records with empty city are excluded. Multi-city tagging is out of scope here.

