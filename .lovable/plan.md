# Fix the Terrisage CRM push documentation

## What's going on

The CRM developer audited the doc I generated at `/mnt/documents/terrisage-crm-push-fields.md` and `.docx` and flagged 7 mismatches against the actual Terrisage contract. I re-read our own builder at `supabase/functions/terrisage-project-push/index.ts` and confirmed:

**Our code is correct in every case. The documentation is wrong.** I hallucinated several field names and enum values when writing the doc and didn't cross-check them against the builder.

Below is the diff between what the doc claims and what our edge function actually emits.

## Doc errors vs. real code

| # | Area | Doc said (wrong) | Code actually sends (correct) |
|---|---|---|---|
| 1 | Response | Synchronous `{ projectId, tenantsLinked, warnings }` | `202` + `{ ingestJobId, sourceJobId, status }`, then poll |
| 2 | `projectCommunityType` | `GATED \| HIGH_RISE_GATED \| OPEN` | `GATED \| OPEN` only (see `mapCommunity`) |
| 3 | `projectStatus` | `... \| COMPLETED` | `... \| COMPLETED_WITH_OC` (see `STATUS_LOOKUP`) |
| 4 | `projectWaterSourceList` | `["BOREWELL", ...]` | `["BORE_WELL", ...]` (see `WATER_LOOKUP`) |
| 5 | `utilities` | `string[]` like `["SOLAR","STP"]` | `{ utilityType, details? }[]` (see `mapUtilities`) |
| 6 | `buildings[]` keys | `name`, `unitsCount` | `buildingName`, `totalUnits` (line 432-434) |
| 6 | `streetClusters[]` keys | `name`, `unitsCount` | `clusterName`, `totalUnits` (line 452-454) |
| 7 | `media.kind` | `LOGO \| GALLERY \| FLOOR_PLAN \| BROCHURE \| VIDEO \| DOCUMENT \| OTHER` | `LOGO \| PHOTO \| VIDEO \| FLOORPLAN \| TOUR_3D \| OTHER` (see `MEDIA_KIND_MAP` — GALLERY→PHOTO, FLOOR_PLAN→FLOORPLAN, BROCHURE/DOCUMENT→OTHER) |
| 8 | `projectTotalUnits` rule | "must equal sum of config `units_planned`" | Must equal sum of `buildings[].totalUnits + streetClusters[].totalUnits` (line 866-873) |

### Extra fields the doc included that are real but worth clarifying
- `mapping.supportBuildingKeys` / `supportClusterKeys` (plural) — yes, our builder does send these (line 585, 603, 618) alongside the singular form, but Terrisage ignores them. Note it as "Support-only, ignored by CRM" rather than removing.
- `apartmentConfiguration.projectTowerNames` — same: emitted by us at line 584-585 area, but not in Terrisage's accepted types. Same note.

## Fix

Rewrite `/mnt/documents/terrisage-crm-push-fields.md` and `.docx` (call them `_v2`) section-by-section from the actual builder output rather than from memory:

1. **§1 envelope** — keep as is, accurate.
2. **§2 project** — correct the three enum tables (status, community type, water sources) to match the exact `*_LOOKUP` output values in the code; rewrite `utilities` row to show the object shape.
3. **§3 inventory** — rename `name` → `buildingName`/`clusterName`, `unitsCount` → `totalUnits`. Add the cross-sum invariant explicitly.
4. **§4 configurations** — keep, but mark `projectTowerNames`, `supportBuildingKeys`, `supportClusterKeys` as "Support-only, CRM ignores".
5. **§5 media** — rewrite the kind table to `LOGO/PHOTO/VIDEO/FLOORPLAN/TOUR_3D/OTHER` with a mapping note showing how Support's internal categories (`GALLERY`, `FLOOR_PLAN`, `BROCHURE`, `DOCUMENT`) collapse to the wire enum.
6. **§6 response contract** — replace synchronous response with the real async flow: `POST` → `202 { ingestJobId, sourceJobId, status:"QUEUED" }`, then `GET /api/integrations/projects/ingest-jobs/{ingestJobId}` polled by `upstreamPush.ts` `pollUntilTerminal`.
7. **§7 end-to-end example** — regenerate by running a real payload assembly mentally against the builder (correct enum strings, object utilities, correct inventory keys).
8. **§8 upsert** — accurate, keep.
9. **§9 changelog** — add entry: "2026-05-28 — corrected enum values, inventory keys, media kinds, utilities shape, and response contract to match `terrisage-project-push/index.ts` after CRM developer audit."

Also add a new section **§0 "How to read this doc"** that says: source of truth is `supabase/functions/terrisage-project-push/index.ts`; this doc must be regenerated from that file, not the other way round.

## Out of scope

No edge function, validator, or builder code changes — the code already matches the CRM contract. This is purely a documentation correction so the CRM team has accurate reference material.

## Deliverables

- `/mnt/documents/terrisage-crm-push-fields_v2.md`
- `/mnt/documents/terrisage-crm-push-fields_v2.docx`
- QA: convert docx pages to images and visually verify before handing over.
