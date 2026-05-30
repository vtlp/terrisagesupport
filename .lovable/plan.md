
## What this doc is (and isn't)

- **Audience:** ChatGPT, used to convert raw source material (brochures, PDFs, vendor JSONs, scraped text, spreadsheets) into a structure that drops cleanly into the **Project Import workspace** in the Console.
- **Scope:** **Inbound to Console only.** This is the *upstream* of the pipeline (raw → Import workspace fields → auto-map). It is **not** the CRM push contract — that already lives in `terrisage-project-ingest-fields_chatgpt.docx` and stays untouched.
- **Source of truth:** `src/components/account/imports/ProjectImportWorkspace.tsx`, `src/components/account/imports/autoMapProjectImport.ts`, `src/components/account/imports/shared.ts`, and the extraction worker's `extract_fields.py` / `normalize.py`.

## Output

Two files, regenerated each time (no code, schema, or UI changes):

- `/mnt/documents/terrisage-console-import-fields_chatgpt.md`
- `/mnt/documents/terrisage-console-import-fields_chatgpt.docx`

## Document structure

**§0 — How to read this doc**
- Three accepted upload shapes the Console auto-mapper understands:
  1. **JSON** (preferred) — `{ project: {...}, configurations: [...], missing_fields: [...] }` — single file, no header gymnastics.
  2. **`project_summary.csv` / `.xlsx`** — wide (one data row) **or** key/value (col A = label, col B = value). Auto-detected by shape.
  3. **`configurations.csv` / `.xlsx`** — one row per configuration; per-property-type columns.
  4. Optional companions: `amenities.csv`, `proximity.csv`, image files (auto-attached as media), floor-plan crops (linked via `floorplan_crop_file` filename match).
- Units & conventions to bake into ChatGPT output: **areas in sqft**, **plot area unit fixed to "sq yd"**, **plot dimensions in feet** (e.g. `30 × 40 ft`), **money in absolute INR** (no lakhs/crores), **dates ISO `YYYY-MM-DD`**, list fields use `|` or `,` separators, "Other" allowed where chips offer it.
- What ChatGPT must **not** invent: enum values outside the lists below, banks list (ignored), and any global-editor metadata (ignored).

**§1 — Project-level fields (shared)**
For each, give: canonical key, accepted **header synonyms** (from `PROJECT_SYNONYMS` in `autoMapProjectImport.ts`), type, example, notes.

Fields covered: `project_name`, `builder_name`, `city` (must map to known Indian city list — see `defaultMarkets`), `location`, `address`, `maps_url`, `rera_id`, `status`, `site_area` + `site_area_unit`, `site_area_acres`, `site_area_guntas`, `community_type`, `approach_road_width`, `total_units`, `expected_completion_date`, `website`, `open_space_pct`, `overview`, `water_sources[]`, `utilities[]`, `key_features[]`, `internal_road_widths[]` + `internal_road_widths_other`, `contact_phone`, `contact_email`, `office_address`.

**§2 — Enum dictionaries** (only values the Console accepts; anything else is silently dropped on push)
- `status` ∈ `Under Construction | Phase 1 completed | Completed (with OC)`
- `community_type` ∈ `Gated | Open`
- `water_sources[]` ∈ `Borewell | Municipal | Tanker | Lake | Other`
- `utilities[]` ∈ `Electricity | Water | Gas | Sewage | STP | Intercom | Rainwater harvesting | Storm water drains`
- `internal_road_widths[]` ∈ `20 ft | 30 ft | 40 ft | 60 ft | Other` (free-text via `internal_road_widths_other`)

**§3 — Property-type-specific project fields**
- **APARTMENT:** `tower_names_list[]`, `floors_each_tower` (e.g. `"G+12"` or `"12"`), `tower_units_list[]` (units count per tower, aligned by index with `tower_names_list`).
- **VILLA:** `clusters_count`, `cluster_names[]`, `cluster_units_list[]`, **`floors_per_unit`** (kept per user spec).
- **PLOT:** `clusters_count`, `cluster_names[]`, `cluster_units_list[]`. No floors.

**§4 — Configuration rows (`configurations` array / sheet)**
Three sub-tables, one per property type, with canonical keys, synonyms (from `APARTMENT_CONFIG_SYNONYMS`, `VILLA_CONFIG_SYNONYMS`, `PLOT_CONFIG_SYNONYMS`), and examples:
- **APARTMENT:** `type_no`, `name`, `bhk`, `carpet_area`, `built_up_area`, `super_built_up_area`, `balconies`, `balcony_area`, `common_area`, `utility_area`, `wall_area`, `bathrooms`, `facing`, `tower`, `floor_range`, `units_planned`, `unit_numbers`, `pricing_range`, `description`, `floorplan_crop_file`.
- **VILLA:** apartment fields + `land_area`, `floors`.
- **PLOT:** `type_no`, `name`, `plot_size_band`, `plot_area` (unit **`sq yd`** locked), `dimensions` (ft, e.g. `30 × 40`), `facing`, `units_planned`, `cluster`, `premium_marker`.

**§5 — Amenities, proximity, media companions**
- `amenities.csv` → column `amenity_name` / `name` / `amenity`.
- `proximity.csv` → `name` + `distance_km` (text like `"5 mins"` allowed). Also recognises embedded `proximity_highlights` / `proximity_matrix` `|`-separated lines, and per-category keys (`nearest_school`, `nearest_hospital`, `orr_access`, `metro_station`, `airport`, `key_business_district`, `nearest_leisure_landmark`) plus matching `*_travel_time` keys.
- **Media files:** any image file is auto-attached. Filename matching: when a config row's `floorplan_crop_file` equals an uploaded image filename, the image is linked to that config as a FLOOR_PLAN.

**§6 — Headers the Console silently ignores**
- `field_review_note`, `review_note` (and any header that doesn't match a synonym is shown as "unmapped" — not an error, but ChatGPT should avoid inventing them).
- Banks list, global-editor blobs (per user spec).

**§7 — JSON example payloads (one per property type)**
Three compact `{ project, configurations, missing_fields }` examples — Apartment, Villa, Plot — using realistic Indian project data (~30-40 lines each) so ChatGPT has a literal template to mimic.

**§8 — ChatGPT do/don't cheat-sheet**
- DO emit JSON in the shape of §7.
- DO use only enum values from §2.
- DO leave a field omitted (or list in `missing_fields[]`) when the source is silent — never guess.
- DON'T invent banks, global editor blocks, or fields outside the synonym tables.
- DON'T mix units: sqft for built area, sq yd for plot area, ft for plot dimensions.

## QA

After writing the .docx I will render every page to image and eyeball for:
- enum cells clipped or wrapping mid-word,
- synonym tables overflowing the page,
- JSON example blocks not breaking across pages cleanly.

Fix and re-render until clean, then emit two `<presentation-artifact>` tags (one .md, one .docx).

## Out of scope

- No edits to `terrisage-project-push` payload doc (CRM-bound, already correct).
- No code changes anywhere — pure documentation derived from the Import workspace + auto-mapper.
