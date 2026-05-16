# Support → Terrisage: Project Push Webhook

> Complete integration contract for the **"Push to Terrisage"** action
> in the Support Console (Admin ► Data ► open project). Read this end
> to end before implementing the Terrisage side. Nothing is too small
> to mention; every field, enum, and behaviour below is exactly what
> Support sends today.

---

## 1. High-level flow

```
Staff opens a PROJECT import job in Admin ► Data
   │
   ├─ reviews master fields (project section)
   ├─ reviews each configuration (1BHK, 2BHK, plot family, …)
   ├─ reviews each media item (LOGO, GALLERY, FLOOR_PLAN, …)
   ├─ optionally links one or more tenants (account → tenant_id)
   │
   └─ clicks "Push to Terrisage"
          │
          ▼
   Support edge function `terrisage-project-push`
          │
          │ 1. authenticates the staff user (Supabase JWT)
          │ 2. loads job + configs + media + linked accounts
          │ 3. signs every storage_path → 24h URL
          │ 4. builds the JSON payload (see §6)
          │ 5. POST {TERRISAGE_BASE_URL}/api/integrations/projects
          │       X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
          │ 6. retries once on network error or non-2xx
          │
          ▼
   Terrisage endpoint
          │ a. validate X-API-Key
          │ b. idempotency on sourceJobId
          │ c. create Project, Configurations
          │ d. download every media[].url within 24h, persist in own storage
          │ e. attach project to each linkedTenantIds[i] tenant workspace
          │ f. return { projectId } in 200 OK
          ▼
   Support marks the job IMPORTED and stamps `terrisage_project_id`
   on the job. Activity log gets `pushed_to_terrisage` event.
```

This is a **one-way push**. Support does not poll Terrisage after the
call. Whatever Terrisage returns in the response body is stored verbatim
on the import job for the audit log.

---

## 2. Endpoint

Terrisage must expose:

```
POST {TERRISAGE_BASE_URL}/api/integrations/projects
```

- `TERRISAGE_BASE_URL` is configured on the Support side as a secret.
  Support strips a trailing `/` and appends `/api/integrations/projects`.
  Example final URL: `https://api.terrisage.com/api/integrations/projects`.
- TLS 1.2+ required.
- Request body MIME: `application/json; charset=utf-8`.
- The endpoint is **public from Terrisage's perspective** (no Terrisage
  user JWT required). Auth is solely the shared `X-API-Key`.

## 3. Authentication

Headers Support sends on every request:

```
Content-Type: application/json
X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
```

`SEAT_SUPPORT_INTEGRATION_API_KEY` is the **same shared secret already
used for**:
- `seat-request` (inbound from Terrisage)
- the usage push endpoint
- `project-request` (inbound from Terrisage)

Reject any request with a missing or wrong key with HTTP **401**. Do
not echo the key value back in error bodies.

## 4. Idempotency

Every push includes `sourceJobId` (UUID of the Support import job, a
v4 UUID). Support **retries the same payload exactly once** on any
network failure or any non-2xx response (so 2 attempts total per click,
back-to-back with no delay).

Terrisage MUST treat `sourceJobId` as the idempotency key:

| Situation | Required behaviour |
|---|---|
| First call with a brand-new `sourceJobId` | Create the project and return 200 with its `projectId`. |
| Repeat call with the same `sourceJobId` | Return **200 OK** with the **same `projectId`** as the first call. Do NOT create a duplicate. |
| Repeat call but the first call genuinely failed mid-way | Safe-resume: re-download any media not yet fetched, then return 200. |

Concurrency is essentially zero. The push is only triggered manually
by a staff user clicking a button. You can keep the idempotency table
as simple as a unique index on `(source_job_id)`.

## 5. Request envelope

Top-level shape (every key always present):

```jsonc
{
  "sourceJobId":   "f4e0…-uuid",       // §6.1
  "propertyType":  "APARTMENT" | "VILLA" | "PLOT",  // §6.2
  "project":          { … },            // §6.3 — flat object, master fields
  "configurations":   [ … ],            // §6.4 — array, may be empty
  "media":            [ … ],            // §6.5 — flat array of all media
  "linkedTenantIds":  [ "tenant_…", … ],// §6.6 — may be empty
  "linkedAccounts":   [ … ],            // §6.6 — may be empty
  "pushedAt":   "2026-05-16T14:32:10.123Z",   // ISO 8601 UTC
  "pushedBy":   "auth-uid-of-staff-user"      // Supabase auth user id (UUID)
}
```

Conventions used throughout:

- All UUIDs are RFC 4122 v4.
- All timestamps are ISO 8601 in UTC with milliseconds and `Z`.
- All money values are **plain INR rupees** as numbers (no paise, no
  formatting, no currency symbol). Pricing is sometimes a free-text
  range — see §6.4.
- Distances are kilometres.
- Areas are square feet (sqft) unless the field name says otherwise
  (e.g. `site_area_acres`).
- Unknown keys MUST be **ignored**, never rejected. Support reserves
  the right to add fields without breaking the contract.

---

## 6. Field-by-field reference

### 6.1 `sourceJobId`

- Type: UUID v4, always present.
- Comes from `import_jobs.id` on the Support side.
- Stable across retries (this is the idempotency key — see §4).
- Stable across staff edits. If staff re-open the job, fix data, and
  push again, the same `sourceJobId` is sent. Terrisage MUST upsert
  (update the existing project, do not create a second one).

### 6.2 `propertyType`

Enum, exactly one of:

| Value | Meaning |
|---|---|
| `APARTMENT` | Residential apartment / flat project, typically tower-based. Configurations are unit types (1BHK, 2BHK, 3BHK …). |
| `VILLA` | Independent villas in a community. Configurations are villa types. |
| `PLOT` | Plotted development. Configurations are "plot families" (size bands), not individual plots. |

These are the **only three** values. There is no `COMMERCIAL`,
`RESIDENTIAL_APARTMENT`, etc. — those do not exist in the source enum.

### 6.3 `project` (flat master fields)

A single flat object. Field set varies a bit by `propertyType`. All
fields are **optional** unless flagged required. Strings can be empty,
arrays can be empty, numbers can be `null`.

Required (reviewer is blocked from pushing until these are filled):

| Key | Type | Notes |
|---|---|---|
| `project_name` | string | Display name. |
| `builder_name` | string | Developer / builder name. |
| `city` | string | |
| `address` | string | Free-text street address. |

Optional master fields (the full set the console collects):

| Key | Type | Notes |
|---|---|---|
| `maps_url` | string \| null | Google Maps pin URL. |
| `location` | string \| null | Free-text locality, used for the public location label. |
| `rera_id` | string \| null | RERA / regulator approval id(s). May contain multiple ids comma-separated. |
| `status` | string \| null | One of `Under Construction`, `Phase 1 completed`, `Completed` — but free-form, so accept any string. |
| `open_space_pct` | number \| null | 0–100. |
| `site_area` | string \| null | Original free-text as entered (e.g. `"4.5 acres"`, `"4 acres 11 guntas"`). |
| `site_area_unit` | string \| null | Unit label (`acres`, `sqft`, etc.) as entered. |
| `site_area_acres` | number \| null | Parsed acres component. |
| `site_area_guntas` | number \| null | Parsed guntas component (0–39; 40 guntas = 1 acre). |
| `site_area_acres_total` | number \| null | **Derived by Support** as `acres + guntas/40`. Use this as the canonical area whenever both components are present. Absent if both raw components were 0. |
| `community_type` | string \| null | One of `Gated`, `High-rise gated`, `Open` (Apartment only allows the three; Villa/Plot only `Gated`/`Open`). Free-form on the wire. |
| `approach_road_width` | string \| null | E.g. `"60 ft"`. |
| `total_units` | number \| null | |
| `website` | string \| null | Project website URL. |
| `overview` | string \| null | Long-form description; may contain newlines (`\n`). Some legacy fields (clubhouse, parking notes, nearby access) may be folded into this. |
| `expected_completion_date` | string (YYYY-MM-DD) \| null | Always normalised to ISO date. |
| `water_sources` | string[] | Tags, e.g. `["Borewell", "BWSSB"]`. |
| `utilities` | string[] | Tags, e.g. `["Solar", "STP"]`. |
| `key_features` | string[] | Tags / USPs. |
| `contact_phone` | string \| null | Project office phone. |
| `contact_email` | string \| null | Project office email. |
| `office_address` | string \| null | Project office address. |
| `amenities` | string[] | Lifted from `extracted_data.amenities`. Always present (may be `[]`). |
| `proximityMatrix` | array | Lifted from `extracted_data.proximityMatrix`. Each entry typically `{ category, name, distance_km }`. May be `[]`. |
| `approvedBanks` | string[] | Lifted from `extracted_data.approvedBanks`. May be `[]`. |
| `representative` | object | Builder/agency contact captured at intake — typed as `{ builder_name?, project_name?, city?, representative_name?, representative_phone?, representative_email?, website?, expected_completion_date?, banks?, notes? }`. Always present (may be `{}`). |

Property-type-specific master fields:

**APARTMENT only:**
| Key | Type | Notes |
|---|---|---|
| `tower_names_list` | string[] | Canonical list of tower/block names; configurations reference these by name in their `tower` field. |
| `floors_each_tower` | string \| null | Free-text describing floors per tower. |

**VILLA / PLOT:**
| Key | Type | Notes |
|---|---|---|
| `clusters_count` | number \| string \| null | Number of clusters/zones. May arrive as numeric string. |
| `cluster_names` | string[] | Canonical cluster names; PLOT configurations reference these in their `cluster` field. |

**VILLA only:**
| Key | Type | Notes |
|---|---|---|
| `floors_per_unit` | string \| null | E.g. `"G+2"`. |

**Stripped legacy fields** — Support actively removes these before
sending, so they will NEVER appear. Do not code against them:
`possession_date`, `config_range`, `configuration_range`, `parking`,
`nearby_access`, `clubhouse`, `towers_count`.

### 6.4 `configurations`

Array. Empty `[]` is valid (rare, but possible for PLOT projects that
do not subdivide into size families).

Each item shape:

```jsonc
{
  "ref":        "c1a2…-uuid",   // import_project_configs.id, stable across retries
  "sortOrder":  0,               // integer, ascending; preserves staff-chosen order
  "data":       { … },           // free-form jsonb — see field tables below
  "floor_plans": [               // denormalised convenience copy of media w/ same configRef
    { "url": "https://…signed…", "caption": "Plan A" }
  ]
}
```

- `ref` is unique within the request and stable across retries.
- `data` is a JSON object whose key set depends on `propertyType`. Any
  field can be absent or empty string. **Values are sometimes strings
  even when they look numeric** (the UI uses text inputs for most
  numeric fields). Coerce on your side if needed.

Possible keys in `data` by `propertyType`:

**APARTMENT `data`:**
| Key | Typical type | Notes |
|---|---|---|
| `type_no` | string | Internal type number (e.g. `"T1-A"`). |
| `name` | string | Display name (e.g. `"2 BHK Premium"`). Used as the row title. |
| `bhk` | string | E.g. `"2"`, `"2.5"`, `"3+study"`. |
| `carpet_area` | string/number | sqft. |
| `super_built_up_area` | string/number | sqft (also called SBA / saleable). |
| `built_up_area` | string/number | sqft. |
| `balcony_area` | string/number | sqft. |
| `common_area` | string/number | sqft. |
| `utility_area` | string/number | sqft. |
| `wall_area` | string/number | sqft. |
| `balconies` | string/number | Count. |
| `bathrooms` | string/number | Count. |
| `facing` | string | E.g. `"East"`. |
| `tower` | string | Must be one of `project.tower_names_list` when staff used the dropdown. |
| `floor_range` | string | E.g. `"3-12"`. |
| `units_planned` | string/number | Count of units in this configuration. |
| `unit_numbers` | string | Free-text list, e.g. `"301, 302, 401"`. |
| `pricing_range` | string | **Free text**, e.g. `"₹85L - ₹1.1Cr"`. Not parsed. |
| `description` | string | Per-config notes (location, parking mentions, etc.). |
| `floorplan_crop_file` | string | Internal hint; ignore — use the `floor_plans` array / `media[]` for actual files. |

**VILLA `data`:**
| Key | Typical type | Notes |
|---|---|---|
| `name` | string | Display name. |
| `bhk` | string | |
| `land_area` | string | E.g. `"2400 sqft"` or `"30x40"`. |
| `built_up_area` | string/number | sqft. |
| `floors` | string | E.g. `"G+2"`. |
| `bathrooms` | string/number | |
| `facing` | string | |
| `units_planned` | string/number | |
| `pricing_range` | string | Free text. |
| `description` | string | |

**PLOT `data`:**
| Key | Typical type | Notes |
|---|---|---|
| `name` | string | Plot family name. |
| `plot_size_band` | string | E.g. `"1200-1500 sqft"` — used to consolidate many unique sizes. |
| `plot_area` | string | Representative area. |
| `dimensions` | string | E.g. `"30x40"`. |
| `facing` | string | |
| `units_planned` | string/number | |
| `cluster` | string | Should match one of `project.cluster_names` when chosen from the dropdown. |
| `premium_marker` | string | Free text (e.g. `"Corner"`, `"Park-facing"`). |
| `description` | string | |

`floor_plans` array on each configuration: a denormalised, pre-filtered
view of `media[]` items whose `category === "FLOOR_PLAN"` and
`configRef === this.ref`. Each entry has only `{ url, caption }`. The
URL is the same signed URL that appears in the corresponding `media[]`
entry — do not download twice, dedupe by URL. For APARTMENT and PLOT
configs there is **at most one** floor plan; for VILLA configs there
can be many.

### 6.5 `media`

Flat array of all reviewed media items, ordered by `created_at`
(upload time). Only items the reviewer accepted are included.

**Filter rule:** items with `review_state ∈ {INCORRECT, DUPLICATE}` are
excluded. Items with `review_state ∈ {PENDING, CORRECT, NEEDS_RECROP}`
are included (the staff user is expected to either fix or reject
NEEDS_RECROP before pushing, but the rule is permissive on the wire).

Each item shape:

```jsonc
{
  "category":  "LOGO" | "GALLERY" | "FLOOR_PLAN" | "BROCHURE" | "VIDEO" | "DOCUMENT" | "OTHER",
  "url":       "https://…supabase…signed-url…",
  "caption":   "Front elevation" | null,
  "configRef": "c1a2…-uuid" | null,
  "meta":      { … }
}
```

The seven media categories are the complete set (these match the
`import_media_category` Postgres enum):

| Category | Typical use | `configRef` |
|---|---|---|
| `LOGO` | Project / builder logo | always `null` |
| `GALLERY` | Hero shots, elevation renders, amenity photos, site photos | usually `null` |
| `FLOOR_PLAN` | Unit-type floor plan | usually set to a configuration's `ref` |
| `BROCHURE` | PDF brochure | always `null` |
| `VIDEO` | MP4 / external video | always `null` |
| `DOCUMENT` | Other documents (price sheet, RERA copy, etc.) | always `null` |
| `OTHER` | Anything else | usually `null` |

There is no `HERO`, `MASTER_PLAN`, or `AMENITY` category — hero images
and amenity shots are sent as `GALLERY`. Master plans, if present, are
also `GALLERY` (or `DOCUMENT` if PDF).

**`url` semantics** (this is the part most likely to bite you):

- Files live in a **private Supabase Storage bucket** named
  `import-files`.
- For each non-external file, Support generates a **time-limited signed
  URL valid for exactly 24 hours** from `pushedAt`. Format:
  `https://<project>.supabase.co/storage/v1/object/sign/import-files/<path>?token=<JWT>`
  — the token is in the query string, no auth header is needed.
- Just `GET` the URL. The response is the raw file bytes with a
  correct `Content-Type` header. Status codes:
  - `200` — file body
  - `403` / `400` — URL expired or signature invalid (after 24h)
  - `404` — file deleted on Support side (should not happen pre-24h)
- **Terrisage MUST download and persist the file in its own storage
  during ingestion.** Do NOT store the signed URL anywhere durable; it
  will stop working in 24h.
- If `url` is `null`, the reviewer registered the asset as an external
  link rather than uploading bytes. In that case `meta.external_url`
  holds the original public URL — use that.
- File bytes are NEVER sent inline. No multipart, no base64. The JSON
  payload itself is small even for projects with dozens of media.

**`configRef` semantics:**

- `null` → project-level asset; attach to the Project entity.
- UUID equal to some `configurations[i].ref` → attach to that
  configuration.
- UUID that does NOT match any configuration → should not happen, but
  if it does, log a warning and treat as project-level. (It can happen
  briefly if a config is deleted after the media row was created;
  Postgres `ON DELETE SET NULL` should null it, but be defensive.)

**`meta`** is free-form JSON, never `null` (defaults to `{}`). Common
keys when present:

| Key | Meaning |
|---|---|
| `filename` | Original filename |
| `mime` | MIME type detected on upload |
| `size` | Byte size |
| `width`, `height` | Image dimensions (pixels) |
| `pages` | PDF page count |
| `external_url` | Original public URL when `url` is null |
| `extracted_from` | Source PDF / sheet the item was lifted from |
| `confidence` | Extractor confidence 0–1 (when source was AI extraction) |

Treat any key beyond these as opaque pass-through metadata. Store it
on your media row if useful, otherwise ignore.

### 6.6 Linked tenants

Staff can optionally tag a single project with **multiple tenants**
(many-to-many). Two parallel representations of the same data are sent:

```jsonc
"linkedTenantIds": ["tenant_abc", "tenant_xyz"],

"linkedAccounts": [
  { "accountId": "acc-uuid-1", "tenantId": "tenant_abc", "accountName": "Prestige Group" },
  { "accountId": "acc-uuid-2", "tenantId": "tenant_xyz", "accountName": "Sobha Ltd" },
  { "accountId": "acc-uuid-3", "tenantId": null,         "accountName": "New Builder (not yet live)" }
]
```

- `linkedTenantIds` is a deduplicated string array of **only** the
  non-null tenant ids. This is the recommended primary input.
- `linkedAccounts` is the raw mapping including accounts whose
  `tenant_id` is null (account exists in Support but the Terrisage
  tenant has not been provisioned yet). Useful for the audit trail.
- Both arrays may be `[]`. Linking is optional.

Recommended Terrisage behaviour after persisting the master project:

| Case | Behaviour |
|---|---|
| `linkedTenantIds` is non-empty | Clone or reference-attach the project into each tenant workspace listed. |
| `linkedTenantIds` is empty | Store the project as a **global catalog entry** (not visible to any tenant) until a future push or admin action links it. |
| One of the tenant ids is unknown to Terrisage | Log a warning, continue. Do NOT hard-fail the whole request — a tenant id may temporarily lag during provisioning. Include the unknown ids in `response.warnings`. |

### 6.7 `pushedAt` and `pushedBy`

- `pushedAt` is the server timestamp at the moment the payload was
  built (right before the outbound HTTP call). It is what the 24h
  signed-URL window is measured from.
- `pushedBy` is the Supabase auth user id (UUID) of the staff user who
  clicked the button. Store for audit; not meaningful inside Terrisage's
  own user system.

---

## 7. Response contract

### 7.1 Success

```
HTTP 200 OK
Content-Type: application/json

{
  "projectId":     "trs_prj_01HZ…",     // canonical Terrisage project id
  "tenantsLinked": ["tenant_abc"],       // optional, for the audit log
  "warnings":      []                    // optional
}
```

- Either `projectId` or `id` at the top level is accepted. Support
  stores `response.projectId ?? response.id ?? null` in the job summary
  as `terrisage_project_id`.
- Any other keys are stored as-is in the audit log and ignored by code.
- A `200` with no recognisable id is treated as success but
  `terrisage_project_id` will be `null` in the audit — please always
  return one.

### 7.2 Failure

Any HTTP status outside `2xx` is treated as a failure. Recommended
error body shape (not strictly enforced, but used by Support to surface
a readable message to the staff user):

```json
{
  "error":   "VALIDATION_FAILED",
  "message": "configurations[0].data.price must be a positive number",
  "details": { "field": "configurations[0].data.price" }
}
```

On any non-2xx, Support:
1. Marks the import job `status = FAILED`.
2. Inserts an `import_activity` row with event `push_to_terrisage_failed`
   and `detail = { error: "HTTP <status>: <first 200 chars of body>" }`.
3. Shows the error to the staff user, who can fix the data and push
   again (same `sourceJobId`).

If Terrisage returns `200` after an earlier non-2xx for the same
`sourceJobId`, the latest push wins. The job goes back to `IMPORTED`.

### 7.3 Network and timeout behaviour

- Support uses the default Deno `fetch` timeout (no explicit timeout
  set). Long-running requests block the staff user's button — please
  return within ~30 seconds. If you need more time for media downloads,
  return immediately after persisting the JSON (sync ack) and download
  media asynchronously in your own background worker.
- On network errors (DNS, connection reset, timeout) Support retries
  the exact same body once with no delay.
- After the second failure, the job is marked `FAILED`. The staff user
  is responsible for re-pushing.

---

## 8. Validation checklist for Terrisage

Before returning `200`, recommended server-side checks:

1. `X-API-Key` matches the shared secret. → else 401.
2. Body is valid JSON and matches the envelope. → else 400.
3. `sourceJobId` is a UUID. → else 400.
4. `propertyType` is exactly one of `APARTMENT | VILLA | PLOT`. → else 400.
5. `project.project_name`, `project.builder_name`, `project.city`,
   `project.address` are all non-empty strings. → else 422.
6. Each `configurations[i].ref` is a UUID and unique within the array.
   → else 422.
7. For every `media[i]` where `configRef` is set: it matches some
   `configurations[i].ref` (warn but accept otherwise).
8. For every `linkedTenantIds[i]`: warn-only if unknown.
9. Idempotency: if a project with this `sourceJobId` already exists,
   return that project's `projectId` in a 200 (no recreation).

---

## 9. Test payload (complete, copy-pasteable)

A minimal but valid APARTMENT push with one configuration, one logo,
one gallery image, one floor plan, and one linked tenant:

```json
{
  "sourceJobId": "11111111-1111-4111-8111-111111111111",
  "propertyType": "APARTMENT",
  "project": {
    "project_name": "Prestige Sunrise Park",
    "builder_name": "Prestige Group",
    "city": "Bengaluru",
    "address": "Marathahalli ORR, Bengaluru 560037",
    "maps_url": "https://maps.app.goo.gl/abc123",
    "location": "Marathahalli",
    "rera_id": "PRM/KA/RERA/1251/446/PR/180917/001234",
    "status": "Under Construction",
    "open_space_pct": 65,
    "site_area": "12 acres 20 guntas",
    "site_area_unit": "acres",
    "site_area_acres": 12,
    "site_area_guntas": 20,
    "site_area_acres_total": 12.5,
    "community_type": "High-rise gated",
    "approach_road_width": "60 ft",
    "total_units": 480,
    "website": "https://prestigesunrise.example.com",
    "overview": "Premium high-rise community with clubhouse and 2-level basement parking.",
    "expected_completion_date": "2027-12-31",
    "water_sources": ["Borewell", "BWSSB"],
    "utilities": ["Solar", "STP", "Rainwater harvesting"],
    "key_features": ["Sky lounge", "Olympic pool", "EV charging"],
    "tower_names_list": ["Tower A", "Tower B", "Tower C"],
    "floors_each_tower": "G + 28",
    "contact_phone": "+91 9876543210",
    "contact_email": "sales@prestigesunrise.example.com",
    "office_address": "Site office, Marathahalli ORR",
    "amenities": ["Clubhouse", "Pool", "Gym", "Kids play area"],
    "proximityMatrix": [
      { "category": "School", "name": "DPS East", "distance_km": 2.1 },
      { "category": "Hospital", "name": "Manipal", "distance_km": 4.6 }
    ],
    "approvedBanks": ["HDFC", "SBI", "ICICI"],
    "representative": {
      "representative_name": "Asha R",
      "representative_phone": "+91 9876543210",
      "representative_email": "asha@prestige.example.com",
      "notes": "Primary site SPOC"
    }
  },
  "configurations": [
    {
      "ref": "22222222-2222-4222-8222-222222222222",
      "sortOrder": 0,
      "data": {
        "type_no": "T1-A",
        "name": "2 BHK Premium",
        "bhk": "2",
        "carpet_area": "980",
        "super_built_up_area": "1320",
        "built_up_area": "1180",
        "balconies": "1",
        "bathrooms": "2",
        "facing": "East",
        "tower": "Tower A",
        "floor_range": "3-12",
        "units_planned": "120",
        "pricing_range": "₹85L - ₹1.1Cr",
        "description": "Corner units have additional utility balcony."
      },
      "floor_plans": [
        {
          "url": "https://phkzxeajzglbmaymvtmt.supabase.co/storage/v1/object/sign/import-files/global/JOB/floorplan-2bhk.png?token=eyJhbGc…",
          "caption": "2 BHK plan"
        }
      ]
    }
  ],
  "media": [
    {
      "category": "LOGO",
      "url": "https://phkzxeajzglbmaymvtmt.supabase.co/storage/v1/object/sign/import-files/global/JOB/logo.png?token=eyJhbGc…",
      "caption": null,
      "configRef": null,
      "meta": { "filename": "logo.png", "mime": "image/png", "width": 512, "height": 512 }
    },
    {
      "category": "GALLERY",
      "url": "https://phkzxeajzglbmaymvtmt.supabase.co/storage/v1/object/sign/import-files/global/JOB/hero.jpg?token=eyJhbGc…",
      "caption": "Front elevation render",
      "configRef": null,
      "meta": { "filename": "hero.jpg", "mime": "image/jpeg", "width": 3840, "height": 2160 }
    },
    {
      "category": "FLOOR_PLAN",
      "url": "https://phkzxeajzglbmaymvtmt.supabase.co/storage/v1/object/sign/import-files/global/JOB/floorplan-2bhk.png?token=eyJhbGc…",
      "caption": "2 BHK plan",
      "configRef": "22222222-2222-4222-8222-222222222222",
      "meta": { "filename": "floorplan-2bhk.png", "mime": "image/png" }
    }
  ],
  "linkedTenantIds": ["tenant_abc"],
  "linkedAccounts": [
    { "accountId": "33333333-3333-4333-8333-333333333333", "tenantId": "tenant_abc", "accountName": "Prestige Group" }
  ],
  "pushedAt": "2026-05-16T14:32:10.123Z",
  "pushedBy": "44444444-4444-4444-8444-444444444444"
}
```

Expected response:

```json
{
  "projectId": "trs_prj_01HZABCDEF",
  "tenantsLinked": ["tenant_abc"],
  "warnings": []
}
```

---

## 10. Recommended ingestion algorithm

```text
function ingest(payload):
  if existing := projects.find(source_job_id = payload.sourceJobId):
      return 200 { projectId: existing.id, tenantsLinked: existing.tenantIds }

  validate(payload)                              // §8

  project = projects.create(
      source_job_id = payload.sourceJobId,
      property_type = payload.propertyType,
      master       = payload.project,            // store as JSONB if you like
      amenities    = payload.project.amenities,
      proximity    = payload.project.proximityMatrix,
      banks        = payload.project.approvedBanks,
  )

  refMap = {}                                    // ref → terrisage config id
  for c in payload.configurations:
      refMap[c.ref] = configurations.create(
          project_id  = project.id,
          sort_order  = c.sortOrder,
          data        = c.data,
      )

  for m in payload.media:
      file_url = m.url ?? m.meta.external_url
      blob     = http.get(file_url)              // do this WITHIN 24h
      stored   = storage.put(blob, mime = guessMime(m))
      media.create(
          project_id   = project.id,
          config_id    = refMap.get(m.configRef),  // may be null
          category     = m.category,
          file_path    = stored.path,
          caption      = m.caption,
          meta         = m.meta,
      )

  for tenantId in payload.linkedTenantIds:
      if tenants.exists(tenantId):
          tenant_projects.create(tenant_id = tenantId, project_id = project.id)
      else:
          warnings.append("unknown tenant: " + tenantId)

  return 200 { projectId: project.id, tenantsLinked: payload.linkedTenantIds, warnings }
```

---

## 11. Operational notes

- **Re-pushes:** Staff can re-push the same job freely. Each push
  re-signs all URLs (so the 24h clock resets), re-sends the full
  payload, and Terrisage must upsert. There is no incremental / delta
  format.
- **Deletions:** If staff delete media or configurations on the Support
  side and then re-push, the missing items will simply be absent from
  the next payload. Terrisage should reconcile by treating the latest
  push as the source of truth (delete on your side what is not in the
  current payload, if you want a strict mirror). If you prefer
  append-only, that is also acceptable — Support does not currently
  expect deletes to propagate.
- **Account vs tenant:** Inside Support, the entity is an **Account**
  (a Support CRM record). Each Account may or may not have a Terrisage
  `tenant_id` (the actual Terrisage workspace id) set. Only Accounts
  with a non-null `tenant_id` appear in `linkedTenantIds`.
- **No callback:** Terrisage does NOT need to call Support back after a
  push. If Terrisage later wants to revoke / unlink, that is handled
  by a separate, existing flow (the project-request webhook). This
  push endpoint is fire-and-forget from Terrisage's perspective.
- **Logs to share when debugging:** if Terrisage rejects a push,
  Support stores the response body in `import_jobs.summary.response`
  and in `import_activity.detail`. Ask the Support team to share those
  two values plus the `sourceJobId` — that is everything needed to
  reproduce on the Terrisage side.

---

## 12. Change log

| Date | Change |
|---|---|
| 2026-05-16 | Initial contract. APARTMENT / VILLA / PLOT, 7 media categories, many-to-many tenant linking, 24h signed URLs, idempotency on `sourceJobId`. |
