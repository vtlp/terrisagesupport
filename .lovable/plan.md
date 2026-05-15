# Project Import Overhaul

A large set of changes to the Project import workspace, the Admin → Data list, the Representative input, the configuration/media model, and the cross-tenant linking flow.

## 1. Enums and field model

**Community type** (now per property type):
- **Apartment**: `Gated`, `High-rise gated`, `Open`
- **Villa**: `Gated`, `Open`
- **Plot**: `Gated`, `Open`
- Replace the free-text input with a Select on the Overview tab; options switch based on `job.property_type`.

**Project type**: restrict to `Apartment`, `Villa`, `Plot`. Remove the free-text `project_type` field; rely on `job.property_type`.

**Tower names (Apartment only)**:
- Add an editable list of tower names on Apartment Overview (chip/multi-input). Stored as `tower_names: string[]`.
- Auto-populated from extraction when present; supports add / rename / remove.
- Each Apartment configuration's "Tower / Block" field becomes a Select sourced from this list (with free-text fallback).
- Hidden for Villa / Plot (replaced by Clusters / Streets — see §3).

**Address split**:
- `address` → "Full address" (textarea).
- New `maps_url` → "Google Maps location URL" (text input, validated).

**Location**:
- `location` becomes "Locality" derived automatically from `maps_url` (parse `?q=` / place segment) or, if blank, from address text. Manual override allowed.

**Site area**:
- Convert to a single numeric (acres). Two small inputs (acres + guntas) combined as `acres + guntas/40` (e.g. 4 acres 11 guntas = 4.275). Stored as a number; unit fixed to "acres".

**Status enum**: add `Phase 1 completed` to existing options (`Under Construction`, `Completed`, `Phase 1 completed`).

## 2. Representative input cleanup
Remove from the Representative tab: Address, Status, RERA ID, Possession date.
Keep: builder name, project name, city, contact phone/email, website, expected completion date, banks, notes.

## 3. Overview / Console field cleanup
Remove from console UI:
- Possession date (entirely)
- Configuration range
- Parking
- Nearby access
- Clubhouse field (auto-fold its text into "About the project" overview instead)
- Towers count for Villa and Plot — replace with **Clusters / Streets** (count + names list)

Add for Villa overview: **Floors per unit** field.

## 4. Configurations
- Add **Description / Notes** field on every configuration, populated by auto-mapper / GPT (location of the config in the project, parking notes, price-structure mentions drawn from brochure images and text). Editable in console.
- **Villa configs** support **multiple floor plan images per single config**. Switch the config↔media link to one-to-many for villa floor plans (UI: gallery within the config card, multi-upload).
- Apartment config "Tower" picker pulls from §1 tower names.

## 5. Media uploads in console
- Add a manual **upload** action in the Media tab so support can upload Gallery images and Floor plans separately into the `import-files` bucket with category preselected.

## 6. Admin → Data list view
- Show **project name** prominently in each row (from `extracted_data.projectData.project_name` → `representative_input.project_name` → `label`).
- After a successful project request OR a successful onboarding-imported project, the resulting global project also appears in this list. Implementation: when a tenant-scoped import job reaches `IMPORTED` (or a `project_request` is fulfilled), insert/clone a corresponding row into `import_jobs` with `account_id = NULL`, `status = IMPORTED`.

## 7. Link a global project to a tenant
- New "Link to tenant…" action on each Admin → Data project row.
- Dialog: pick account, optional notes.
- On confirm: create a tenant-scoped `import_jobs` row (account_id set, status `READY_TO_IMPORT`) cloned from the global one, copy configs and media references, then push upstream so the tenant gains access.

---

## Technical notes

**Files:**
- `src/components/account/imports/ProjectImportWorkspace.tsx` — community-type Select, tower-names manager, site-area acres+guntas, status enum, villa floors-per-unit, multiple floor plans per villa config, manual media upload, config description.
- `src/components/account/imports/autoMapProjectImport.ts` — extract `maps_url`, derive locality, parse acres+guntas to numeric, add `description` synonyms, fold `clubhouse`/`parking`/`nearby_access` into `overview`, swap `towers_count` → `clusters` for VILLA/PLOT, surface `tower_names` array.
- `src/pages/admin/AdminData.tsx` — show project name, "Link to tenant" dialog, surface auto-cloned global jobs.
- `src/components/account/imports/shared.ts` — community-type and status enums.
- `supabase/functions/terrisage-project-push/index.ts` — include new fields in payload.
- New RPC / edge function `link_global_project_to_account(jobId, accountId)`.
- Migration: add `account_link_origin_job_id` on `import_jobs` to track clones; trigger to auto-clone on tenant-job IMPORTED (deduped by project_name + builder_name).

**No data destruction**: removed UI fields are simply hidden; underlying JSON keys remain.
