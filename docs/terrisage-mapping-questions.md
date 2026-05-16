# Terrisage Project Import — Open Questions

We're wiring up the async project push from our CRM into Terrisage. Below are the gaps we hit while mapping our CSV/UI data to the documented payload. Items marked **Blocker** stop us from pushing correctly; **Clarification** items we can ship with a sensible default but want to confirm.

---

## 1. Project ownership & multi-tenant sharing  *(Resolved)*

**Confirmed by Terrisage:** `projectOwnerOrgId` is the same UUID space as our `accounts.tenant_id`. On push we send the selected builder account's `tenant_id`. Agency visibility is handled via a separate call (`POST /api/integrations/projects/{projectId}/agency-access`) per linked agency, only after the project is imported on our side. Exact endpoint path / payload shape for the agency-access call is still to be confirmed.

## 2. Amenities  *(Blocker)*

You mentioned amenities are enum-backed, not free text. We currently collect them as free-text labels from CSV.

- Can you share the **full list of valid `amenityId` values** (UUID + display label)?
- Is the payload shape `amenities: [{ amenityId: "uuid" }]`, or just `amenities: ["uuid", ...]`, or something else?
- Do you have a recommended **label → amenityId alias map** for common CSV variants (e.g. "Swimming Pool", "Pool", "Swim Pool" → same ID)? If not, we'll build our own mapping table and would appreciate review.
- What should we do with amenities we can't map — drop silently, send under an "Other" ID, or fail the push?

## 3. Project status enum  *(Blocker)*

- Full list of valid `projectStatus` values, please.
- Does it accept values like `PHASE_1_COMPLETED`, or should phase information live elsewhere?
- Current values we emit: `PRE_LAUNCH`, `LAUNCHED`, `UNDER_CONSTRUCTION`, `READY_TO_MOVE`, `COMPLETED` — all valid?

## 4. Community type enum  *(Blocker)*

- Full list of valid `projectCommunityType` values.
- Is `HIGH_RISE_GATED` (or similar composites) a real value, or do we need to split into `HIGH_RISE` + a separate `isGated` flag?
- Current values we emit: `GATED_COMMUNITY`, `STANDALONE`, `TOWNSHIP`, `HIGH_RISE`, `LOW_RISE`, `VILLA_COMMUNITY`, `PLOTTED_DEVELOPMENT`.

## 5. Water sources enum  *(Blocker)*

- Full list of valid `projectWaterSourceList` values.
- Any India-specific values we should include (e.g. `MUNICIPAL`, `BOREWELL`, `TANKER`, `RAINWATER_HARVESTING`, `WATER_BOARD`)?

## 6. Utilities enum  *(Blocker)*

- Full list of valid `utilities` values.
- **`Solar` / `Solar panels`** appears frequently in our CSVs — there's no obvious utility enum match. Should it be:
  - a utility enum value we're missing,
  - an amenity instead,
  - or dropped from utilities entirely?
- Current values we emit: `POWER_BACKUP`, `WATER_SUPPLY_24_7`, `GAS_PIPELINE`, `SEWAGE_TREATMENT`, `RAINWATER_HARVESTING`, `WASTE_MANAGEMENT`, `STREET_LIGHTING`.

## 7. Media `kind` enum  *(Blocker)*

- Full list of valid `kind` values for media items.
- Are there dedicated kinds for `BROCHURE`, `MASTER_PLAN`, `FLOOR_PLAN`, `WALKTHROUGH_VIDEO`, `LOGO`? Today we collapse `GALLERY` → `PHOTO`; we'd rather send the specific kind if it exists.
- Is `mimeType` required, or inferred from the signed URL?

## 8. Configurations  *(Clarification)*

- Are `configUnitPriceBaseValue` and `configurationUnitPricePerSqft` **required**, or optional? Many of our rows only have one of them.
- Is `masterBedroomSizeSqft` required for apartments, or optional?
- Shape of `variations[]` — can you share a sample? We currently send `[]`.
- For `floorRangeStart`/`floorRangeEnd`, is a single floor expressed as `start == end`, or via a different field?
- `dimensionsLength` / `dimensionsWidth` for plots — units (ft vs m) and required precision?

## 9. Towers / clusters / buildings  *(Blocker)*

- Today our CSV references tower/cluster **names** inside `configurations[].mapping` but we don't have first-class building/cluster records. Is it acceptable to send:
  - `buildings: []` and `streetClusters: []`, while `configurations[].mapping` still references names as strings?
- If not, what's the **minimum required shape** per building and per street cluster?
- Is there an `excludedFloors: number[]` (or similar) on buildings for non-contiguous floor sets (e.g. no 13th floor)?

## 10. Facings  *(Clarification)*

- Is the facing field an enum (`NORTH`, `NORTH_EAST`, …) or free text? Full list if enum.

## 11. Proximity metrics  *(Clarification)*

- For each proximity entry: should `distance` be a number (km) and `time` a number (minutes), or strings with units (`"1.2 km"`, `"5 min"`)?
- Is `category` an enum? If so, what are the values (`SCHOOL`, `HOSPITAL`, `METRO`, `AIRPORT`, …)?

## 12. Approved banks  *(Clarification)*

- Is `approvedBanks` free text or an enum/master list of bank IDs? If enum, please share the list.

## 13. Async ingest contract  *(Blocker)*

We've switched to the async flow. Please confirm:
- Exact response field name on the initial `202` — is it `ingestJobId`, `jobId`, or something else?
- Terminal status strings — we're assuming `SUCCEEDED` and `FAILED`. Are there others (`PARTIAL`, `CANCELLED`)?
- Does the poll endpoint accept our `?sourceJobId=<our-uuid>` for idempotency / dedupe on retries?
- Is the final Terrisage `projectId` returned in the poll response body, or only via webhook? If webhook, what's the payload shape and where do we register the URL?
- Recommended poll interval and max duration before we should give up and surface an error to staff?

## 14. Internal notes & representative  *(Clarification)*

- Is sending a JSON-stringified blob in `internalNotes` acceptable, or do you prefer first-class fields (`internalRepresentativeName`, `internalRepresentativePhone`, etc.)?
- If first-class, please share the field names and whether any are required.

---

**Once we have answers (especially the enum lists in §2–§7 and the ownership model in §1), we can finalise the mapping and ship the integration end-to-end.** Happy to hop on a quick call if easier than writing it all out.
