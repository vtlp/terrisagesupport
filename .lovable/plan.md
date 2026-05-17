## Problem

The push function already accepts multiple towers/clusters per configuration (comma/slash/&/+/"and"-separated, or arrays), but the **UI still forces a single choice**. In `ProjectImportWorkspace.tsx` the `tower` field is rendered as a Radix `Select` (one value), and the `cluster` field is just a plain text `Input`. That's why you can't pick A–K for one config in Home Boja.

## Fix

Replace those single-pick controls with multi-selects bound to the project's tower / cluster name list.

### 1. Tower field (Apartment) — `ProjectImportWorkspace.tsx` ~lines 1185-1203

Swap the `Select` for the existing `MultiSelect` (`src/components/shared/MultiSelect.tsx`), populated from `project.tower_names_list`.

- Read: parse `data.tower` with the same splitter used by validation (`splitTowers`) into `string[]`.
- Write: join the chosen array back with `", "` and store on `data.tower` (keeps the stored shape unchanged, so the push function, validation, and the "Towers / Blocks" linkage card all keep working without further changes).
- Fallback: if `tower_names_list` is empty, keep the free-text `Input` so users can still type names before they've filled Overview.

### 2. Cluster field (Villa / Plot) — same file, default field branch

Add a dedicated branch for `k === 'cluster'` mirroring the tower branch, bound to `project.cluster_names`. Same read/write convention (comma-joined string).

### 3. Validation & linkage card

No changes needed. `splitTowers` already handles comma-separated lists, and the "Towers / Blocks" card at line ~1126 matches by substring, so a config with `"A, B, C"` will show up under each of A, B, and C automatically.

### 4. Backend / push

No changes. `terrisage-project-push/index.ts` already calls `splitMulti(d.tower)` / `splitMulti(d.cluster)` and emits `supportBuildingKeys[]` / `supportClusterKeys[]`.

## Out of scope

- Changing the stored shape to a real array (would ripple through extraction worker, auto-map, CSV parsing, and existing jobs). Comma-joined string is the least invasive change and the push function already normalises both.
- Multi-tower floor-range overrides (one range per tower). Today a config's `floor_range` applies to all its mapped towers; revisit only if Terrisage rejects that.

## Files to touch

- `src/components/account/imports/ProjectImportWorkspace.tsx` — tower branch + new cluster branch in the config field renderer.