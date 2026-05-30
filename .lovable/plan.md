# Terrisage project ingest — ChatGPT field reference

## Goal

Produce a single, self-contained field reference for the Terrisage **project ingest** endpoint that you can paste into ChatGPT as a system/context prompt. It must list every accepted field, its type, allowed values, and an example, organised by property type (APARTMENT / VILLA / PLOT). No code changes — pure documentation, derived line-by-line from `supabase/functions/terrisage-project-push/index.ts` (the authoritative builder) so there is zero hallucination this time.

## What the doc will contain

1. **§0 How to read this doc** — source of truth pointer (`terrisage-project-push/index.ts`), wire format = JSON, transport = `POST /api/integrations/projects` with `X-API-Key`, async response, all enums case-sensitive.

2. **§1 Top-level envelope** — every key actually sent by the builder (lines 921–934):
   - `sourceJobId` (uuid), `propertyType` (`APARTMENT|VILLA|PLOT`), `category` (`RESIDENTIAL`), `projectOrigin` (`SUPPORT_ADDED`), `projectOwnerOrgId` (uuid|null), `project` (object), `buildings[]`, `streetClusters[]`, `configurations[]`, `media[]`, `pushedAt` (ISO), `pushedBy` (uuid).

3. **§2 `project` master** — every field in `buildProjectMaster` (lines 465–527) with:
   - Type, required/optional, example.
   - Full enum tables sourced from the `*_LOOKUP` constants:
     - `projectStatus`: `UNDER_CONSTRUCTION | PHASE_1_COMPLETED | COMPLETED_WITH_OC`
     - `projectCommunityType`: `GATED | OPEN`
     - `projectWaterSourceList[]`: `BORE_WELL | MUNICIPAL | TANKER | LAKE | OTHER`
     - `utilities[].utilityType`: `ELECTRICITY | WATER | GAS | SEWAGE | STP | INTERCOM_SECURITY | RAIN_WATER_HARVESTING | STORM_WATER_DRAINS` (plus optional `details` string)
   - Numeric coercion rules (ranges → upper bound; "1.2 Cr" → 12000000 INR).
   - `proximityMetrics[]` shape `{ label, distance, time, sortOrder }`.
   - `amenities[]` shape `{ amenityId (uuid from Terrisage master), boolValue: true }`.

4. **§3 Property-type detail blocks** (sibling of `project`, written by the builder for the matching type):
   - **APARTMENT** → `apartmentDetail`: `projectOpenSpacePercent`, `projectTotalTowers`, `projectTotalFloorsPerTower`, `projectUnitsPerFloor`, `projectUnitsPerLift`.
   - **VILLA** → `villaDetail`: `configurationVillaFloorsPerUnit`, `projectRoadWidthAbutting`.
   - **PLOT** → `plotDetail`: `{}` (empty object).

5. **§4 Inventory arrays**
   - `buildings[]` (APARTMENT only): `supportBuildingKey` (slug, Support-only — CRM ignores), `buildingName`, `totalUnits`, `sortOrder`, `totalFloors?`.
   - `streetClusters[]` (VILLA + PLOT): `supportClusterKey`, `clusterName`, `totalUnits`, `sortOrder`.
   - **Invariants**:
     - Σ(`buildings[].totalUnits`) + Σ(`streetClusters[].totalUnits`) === `project.projectTotalUnits`
     - `project.projectTotalUnits` === Σ(`configurations[].configurationUnitsTotalCount`) (else 422)

6. **§5 Configurations — per property type** (the part you most need ChatGPT to get right). One sub-section each:

   **APARTMENT config** (from `buildConfiguration` lines 571–590):
   - Common keys: `supportConfigRef`, `sortOrder`, `configurationUnitName`, `configurationUnitBedroomCount`, `configurationUnitBathroomCount`, `configurationUnitsTotalCount`, `configurationUnitCarpetAreaSqft`, `configurationUnitBuiltupAreaSqft`, `configurationUnitSuperBuiltupAreaSqft`, `configUnitPriceBaseValue` (INR), `configurationUnitPricePerSqft`, `configurationUnitDescription`.
   - `apartmentConfiguration`: `projectTowerName` (first tower), `projectTowerNames[]` (Support-only echo), `balconyCount`, `masterBedroomSizeSqft` (string e.g. `"12x14"`), `variations[] { text, sortOrder }`.
   - `mapping`: `supportBuildingKey`, `supportBuildingKeys[]` (Support-only echo), `floorFrom`, `floorTo`, `excludedFloors[]`, `availableFacings[]` (e.g. `["East","North-East"]`).

   **VILLA config** (lines 591–605):
   - Same common keys above.
   - `villaConfiguration`: `configurationVillaFloorsPerUnit`, `configurationVillaWidth` (ft), `configurationVillaLength` (ft), `masterBedroomSizeSqft`.
   - `mapping`: `supportClusterKey`, `supportClusterKeys[]`, `availableFacings[]`.
   - Note: villa dims in ft, area still sqft, plot/land area NOT in this block.

   **PLOT config** (lines 606–620):
   - Common keys minus bedroom/bathroom (which will be null).
   - `plotConfiguration`: `configurationPlotUnitAreaSqft`, `configurationPlotUnitAreaSqYd` (currently always null from builder; Terrisage accepts), `configurationPlotWidth` (ft), `configurationPlotLength` (ft).
   - `mapping`: `supportClusterKey`, `supportClusterKeys[]`, `availableFacings[]`.

7. **§6 `media[]`** (lines 896–919):
   - Shape: `{ kind, url, caption, configRef, meta }`.
   - `kind` enum on wire: `LOGO | PHOTO | VIDEO | FLOORPLAN | TOUR_3D | OTHER` only.
   - Internal → wire mapping table (`MEDIA_KIND_MAP`): GALLERY/MASTER_PLAN/IMAGE/RENDER → PHOTO; FLOOR_PLAN → FLOORPLAN; WALKTHROUGH_VIDEO → VIDEO; VIRTUAL_TOUR → TOUR_3D; BROCHURE/DOCUMENT → OTHER (with `meta.mime = "application/pdf"`).
   - `url` is a 24h signed URL.
   - `configRef` ties FLOORPLAN to a specific configuration UUID.

8. **§7 Support-only fields CRM ignores** — explicit list so ChatGPT doesn't treat them as required:
   - `supportBuildingKey(s)`, `supportClusterKey(s)`, `projectTowerNames`, `internalNotes`.

9. **§8 End-to-end JSON examples** — one realistic payload per property type, generated by mentally running the builder over plausible input (correct enums, correct keys, sums tied to invariants). About 30-50 lines each.

10. **§9 Response & polling contract**
    - `POST` → `202 { ingestJobId, sourceJobId, status: "QUEUED" }`
    - `GET /api/integrations/projects/ingest-jobs?sourceJobId={sourceJobId}` → `{ status: QUEUED|RUNNING|SUCCEEDED|FAILED, projectId?, failureCode?, message? }`
    - Standard error envelope: `{ success: false, error: { message, code, statusCode } }`.

11. **§10 Quick "do/don't" cheat-sheet for ChatGPT** — 10–15 bullet points: case-sensitive enums; never invent kinds like `GALLERY`/`FLOOR_PLAN`/`BROCHURE` on the wire; utilities are objects not strings; dims in ft; areas in sqft; INR absolute integers; sums must tie out.

## Deliverables

- `/mnt/documents/terrisage-project-ingest-fields_chatgpt.md`
- `/mnt/documents/terrisage-project-ingest-fields_chatgpt.docx`
- QA: render docx pages to images, eyeball every page for table overflow / clipped enum cells before handing over.

## Out of scope

No code, schema, edge function, or UI changes. The builder already emits the correct shape — this is a fresh, code-grounded reference for ChatGPT to use when transforming raw brochure data into builder-ready input.
