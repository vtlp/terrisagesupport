Continue the Project Import overhaul with the three remaining items from the previous turn.

## 1. Synonym mapping updates (`autoMapProjectImport.ts`)

Extend the field-synonym dictionary so the auto-mapper recognises the new field model coming out of GPT/OCR:

- `maps_url` ← "google maps", "maps link", "map url", "location url", "gmap"
- `address_full` ← "full address", "site address", "project address"
- `site_area_acres` ← "acres", "area (acres)"
- `site_area_guntas` ← "guntas", "gunta"
- `floors_per_unit` ← "floors per villa", "floors per unit", "no. of floors"
- `tower_names_list` ← "tower names", "blocks", "tower/block list"
- `cluster_names_list` ← "clusters", "streets", "phases"
- `community_type` enum normaliser: map free-text into `Gated | High-rise gated | Open` (apartment) or `Gated | Open` (villa/plot)
- `property_type` normaliser: collapse "Flats/Apartment/Apt" → `Apartment`, "Independent House/Villa" → `Villa`, "Plot/Land" → `Plot`
- `status` adds "Phase 1 completed" matcher
- Configuration `description` ← "notes", "config notes", "remarks", "spec notes"

Also drop synonyms for fields we removed from the console (parking, nearby access, configuration range, clubhouse, possession date) so they no longer auto-populate.

## 2. Multi-image villa configurations (one config → many floor plans)

Data model:

- Reuse existing `import_project_media` rows with `category = 'FLOOR_PLAN'` and existing `config_id` FK. No schema change — the link is already one-to-many.
- For `crm_project_media` (post-import), confirm same FK exists; if not, the Admin migration in the previous turn will add it.

UI in `ProjectImportWorkspace.tsx` Configurations tab (Villa only):

- Inside each config card, render a "Floor plans" gallery: thumbnails of every `import_project_media` row where `config_id = thisConfig.id` AND `category = 'FLOOR_PLAN'`.
- Add an "Upload floor plan" button per config card that uploads to `import-files` bucket and inserts an `import_project_media` row with `config_id` set.
- Each thumbnail gets a remove (×) button and a caption field.
- For Apartment/Plot, keep the single-image behaviour (one floor plan per config) but use the same gallery component capped at 1.

## 3. Update `terrisage-project-push` payload

In `supabase/functions/terrisage-project-push/index.ts`, extend the outgoing payload to include the new fields so the tenant CRM receives them:

- `maps_url`, `address_full`, `locality` (derived)
- `site_area_acres_total` (numeric, acres + guntas/40)
- `community_type` (validated against per-property-type enum)
- `tower_names: string[]` (Apartment only)
- `cluster_names: string[]` (Villa/Plot only)
- `floors_per_unit` (Villa only)
- For each configuration: `description`, plus `floor_plans: [{url, caption}]` array instead of single `floor_plan_url`.

Remove these from the payload (no longer collected): `possession_date`, `configuration_range`, `parking`, `nearby_access`, `clubhouse` (folded into `about_project` text).

## Files to change

```text
src/components/account/imports/autoMapProjectImport.ts
src/components/account/imports/ProjectImportWorkspace.tsx   (Configurations tab only)
supabase/functions/terrisage-project-push/index.ts
```

No new migrations required — `import_project_media.config_id` already supports the one-to-many link.

## Out of scope for this step

- Backfilling existing imported projects with the new fields
- Tenant-side CRM rendering changes (handled on the CRM repo)
