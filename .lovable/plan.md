## Goal

Align our project push to match the confirmed Terrisage spec answers. All changes are server-side in `supabase/functions/terrisage-project-push/index.ts` plus one schema column + a minimal UI surface for the amenity master cache. No new tables besides a cache of the amenity master.

## Changes (grouped)

### 1. Enums — replace existing maps with spec-exact values
- **projectStatus** → only `UNDER_CONSTRUCTION` | `PHASE_1_COMPLETED` | `COMPLETED_WITH_OC`. Map `COMPLETED`/`READY_TO_MOVE` → `COMPLETED_WITH_OC`; `PRE_LAUNCH`/`LAUNCHED` → `UNDER_CONSTRUCTION`; unknown → `null`.
- **projectCommunityType** → only `GATED` | `OPEN`. Map `STANDALONE` → `OPEN`; everything else → `GATED`; unknown → `null`.
- **projectWaterSourceList[]** → `BORE_WELL` | `MUNICIPAL` | `TANKER` | `LAKE` | `OTHER`. BWSSB/water-board/corporation → `MUNICIPAL`. Drop `RAINWATER_HARVESTING` from water sources.
- **utilities[]** → push as `{ utilityType, details? }` (not bare strings). Valid types: `ELECTRICITY`, `WATER`, `GAS`, `SEWAGE`, `STP`, `INTERCOM_SECURITY`, `RAIN_WATER_HARVESTING`, `STORM_WATER_DRAINS`. `SOLAR`/`Solar panels` → `{ utilityType: 'ELECTRICITY', details: 'Solar panels' }`. `POWER_BACKUP` → `{ ELECTRICITY, 'Power backup' }`. Drop unmappable.
- **media.kind** → `LOGO` | `PHOTO` | `VIDEO` | `FLOORPLAN` | `TOUR_3D` | `OTHER`. Map `GALLERY`/`MASTER_PLAN` → `PHOTO`; `BROCHURE`/`DOCUMENT` → `OTHER` with `meta.mime: 'application/pdf'`. `FLOORPLAN` carries `configRef`.

### 2. Amenities — object shape + master fetch
- New table `terrisage_amenity_master(amenity_id uuid pk, code text, display_name text, category text, property_type text, fetched_at timestamptz)`.
- New action in push function: `action: 'refresh-amenities'` → calls `GET /api/integrations/amenities?propertyType=…` for `APARTMENT|VILLA|PLOT`, upserts the cache.
- On push, look up each free-text amenity by normalised `displayName`/`code` against the cache (filtered by job's `property_type`). Build payload as `[{ amenityId, boolValue: true }]`. Unmapped amenities go into `push_warnings` on `import_jobs.summary` (don't fail the push).
- Admin Data page: small "Refresh Terrisage amenity master" button calling the new action. Show last-refreshed timestamp.

### 3. Buildings / clusters synthesis (Blocker)
- Today we send `buildings: []` / `streetClusters: []`. Spec rejects empty when mappings reference tower/cluster keys.
- Derive unique tower names from `configurations[].data.towerName` (and cluster names from `clusterName` for VILLA/PLOT).
- Synthesise:
  - `buildings: [{ supportBuildingKey: slug(name), buildingName: name, sortOrder }]` for APARTMENT.
  - `streetClusters: [{ supportClusterKey: slug(name), clusterName: name, sortOrder }]` for VILLA/PLOT.
- Rewrite each config's `mapping.supportBuildingKey` / `supportClusterKey` to match the slug.
- `mapping.excludedFloors: string[]` passes through.

### 4. Proximity, banks, facings
- Proximity: drop `category`; combine into `label` (`"School: DPS East"`). `distance` stringified with unit (`"2.1 km"`), `time` string (`"15 min"` or null), `sortOrder` int.
- Approved banks: free-text array (already correct, just confirm).
- Facings: free text array on `mapping.availableFacings` (already free text).

### 5. Configurations
- Make `configUnitPriceBaseValue` / `configurationUnitPricePerSqft` nullable in payload (no synthetic 0s). Free-text bands go into `configurationUnitDescription`.
- `masterBedroomSizeSqft` accepted as string.
- `variations[]` shape: `[{ text, sortOrder }]`.

### 6. Async ingest contract
- Poll by `sourceJobId`: change poll to `GET …/ingest-jobs?sourceJobId={jobId}` instead of using stored `ingestJobId`. Keep `ingestJobId` for logging.
- Terminal: `SUCCEEDED` | `FAILED`. Running: `PENDING` | `RUNNING`. On `SUCCEEDED`, persist `summary.terrisage_project_id` from poll response.
- UI poll cadence: 10s for first 2 min, then 30s, up to ~15 min then surface "still processing".

### 7. Internal notes
- Keep current JSON-stringified representative blob in `internalNotes`. Append office/email there. Move phone to `projectContactPhoneNo`.

### 8. Agency access endpoint
- Keep current `POST …/projects/{terrisageProjectId}/agency-access` placeholder but flag as `TODO: confirm path` in code comment (spec answer didn't include this endpoint — Terrisage said agency visibility is out-of-scope for this contract; it's `ChannelPartnerProject` in CRM app, no bulk API). Leave UI hidden if endpoint returns 404, with a clearer error.

## Files to touch

- `supabase/functions/terrisage-project-push/index.ts` — all enum maps, builders, payload assembly, poll-by-sourceJobId, amenity lookup, building/cluster synthesis, action `refresh-amenities`.
- `supabase/migrations/...` — create `terrisage_amenity_master` table + RLS (staff read; service role write).
- `src/pages/admin/AdminData.tsx` (or AdminIntegrations) — add "Refresh amenity master" button + last-refreshed display.
- `src/components/account/imports/ProjectImportWorkspace.tsx` — surface `push_warnings` (unmapped amenities) after a push.
- `docs/terrisage-mapping-questions.md` — mark all answered.

## Out of scope

- Multi-builder co-ownership (Terrisage v1 picks one primary).
- Agency-share bulk API (not in contract).
- Auto-creating amenity master entries when missing — log only.

## Validation plan

1. Deploy edge function; call `refresh-amenities`; verify cache populated.
2. Push a sample APARTMENT job with multi-tower configs; assert `buildings[]` synthesised and `mapping.supportBuildingKey` matches.
3. Push with mixed-case amenities; assert mapped ones come back with UUIDs, unmapped land in `push_warnings`.
4. Poll by `sourceJobId`; assert `projectId` appears once status reaches `SUCCEEDED`.

Approve to proceed and I'll execute in this order: schema → edge function → admin refresh UI → push UX for warnings → doc update.