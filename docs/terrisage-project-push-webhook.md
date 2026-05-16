# Support → Terrisage: Project Push Webhook

When the support team finishes reviewing a **project import** in the
Support Console (Admin ► Data ► open project ► **Push to Terrisage**),
the Support backend POSTs the fully-reviewed project payload to a
single inbound endpoint on Terrisage. Terrisage is responsible for
creating the Project entity in its own database, attaching the
configurations, downloading the media, and (optionally) cloning the
project into the linked tenants' workspaces.

This is a **one-way push**. The Support Console does not poll Terrisage
after the call. The response body is stored verbatim on the import job
for audit.

---

## 1. Endpoint

Terrisage must expose:

```
POST {TERRISAGE_BASE_URL}/api/integrations/projects
```

- TLS 1.2+ required.
- `Content-Type: application/json; charset=utf-8`.
- Public endpoint (no Terrisage user JWT). Auth is via shared API key.

The Support backend reads `TERRISAGE_BASE_URL` from its secrets and
appends `/api/integrations/projects` to it.

## 2. Authentication

```
X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
Content-Type: application/json
```

Same shared secret already used for seat-request, usage push, and the
project-request inbound webhook. Reject with `401` on missing/wrong key.

## 3. Idempotency

Each push includes `sourceJobId` (UUID of the Support import job). The
Support backend retries **once** on network failure or non-2xx status
(2 attempts total, no delay). Terrisage MUST treat `sourceJobId` as the
idempotency key:

- First call with a new `sourceJobId` → create.
- Repeat call with the same `sourceJobId` → return the previously
  created project (200 OK) instead of creating a duplicate.

A push is only ever triggered manually by a staff user, so high
concurrency is not expected.

## 4. Request body

Top-level shape:

```jsonc
{
  "sourceJobId": "f4e0…-uuid",          // Support import job id (idempotency key)
  "propertyType": "RESIDENTIAL_APARTMENT" | "VILLA" | "PLOT" | "COMMERCIAL" | …,
  "project":          { … },             // see §4.1
  "configurations":   [ … ],             // see §4.2 — empty array for PLOT
  "media":            [ … ],             // see §4.3 — flat list, all categories
  "linkedTenantIds":  ["tenant_abc", …], // see §4.4
  "linkedAccounts":   [ … ],             // see §4.4
  "pushedAt":   "2026-05-16T14:32:10.123Z",
  "pushedBy":   "auth-uid-of-staff-user"
}
```

All UUIDs are standard v4. Timestamps are ISO 8601 UTC.

### 4.1 `project`

A flat object holding the reviewed master fields. Field set varies by
`propertyType` but the following keys are stable. Unknown keys MUST be
ignored, not rejected.

| Key | Type | Notes |
|---|---|---|
| `project_name` | string | Always present after review. |
| `developer_name` | string \| null | |
| `rera_number` | string \| null | |
| `location` | string \| null | Free-text address shown to end users. |
| `city` | string \| null | |
| `state` | string \| null | |
| `pincode` | string \| null | |
| `latitude`, `longitude` | number \| null | |
| `site_area_acres` | number \| null | Raw acres component. |
| `site_area_guntas` | number \| null | Raw guntas component (0–39). |
| `site_area_acres_total` | number \| null | **Derived** by Support: `acres + guntas/40`. Use this as the canonical area. |
| `total_units` | number \| null | |
| `launch_date` | string (YYYY-MM-DD) \| null | |
| `completion_date` | string (YYYY-MM-DD) \| null | |
| `price_min`, `price_max` | number \| null | INR. |
| `description` | string \| null | Long-form, may contain newlines. |
| `amenities` | string[] | Lifted from `extracted_data.amenities`. |
| `proximityMatrix` | array | Lifted from `extracted_data.proximityMatrix`; each row `{ category, name, distance_km }`. |
| `approvedBanks` | string[] | |
| `representative` | object | Builder/agency contact captured at intake — `{ name, mobile, mobile_code, email, role, … }`. |

The following **legacy keys are stripped** by Support and will never
appear: `possession_date`, `config_range`, `configuration_range`,
`parking`, `nearby_access`, `clubhouse`, `towers_count`.

### 4.2 `configurations`

Per-unit-type rows (1BHK, 2BHK, plot variants, etc.). Empty array when
`propertyType === "PLOT"` and the project has no sub-configurations.

```jsonc
{
  "ref":        "c1a2…-uuid",     // Support config id, stable across retries
  "sortOrder":  0,                 // display order chosen by staff
  "data": {
    "name":            "2 BHK Premium",
    "carpet_area_sqft": 980,
    "built_up_sqft":    1180,
    "super_built_sqft": 1320,
    "bedrooms":         2,
    "bathrooms":        2,
    "balconies":        1,
    "price":            8500000,
    "facing":           "EAST",
    "availability":     "AVAILABLE" | "SOLD_OUT" | "LIMITED",
    // …any additional reviewed attributes
  },
  "floor_plans": [                 // convenience: filtered subset of `media`
    { "url": "https://…signed…", "caption": "Master plan – 2BHK" }
  ]
}
```

`floor_plans` is a denormalised convenience copy of the `FLOOR_PLAN`
items in `media` whose `configRef` equals this row's `ref`. Pick whichever
representation is easier — both point to the same files.

### 4.3 `media`

Flat list, ordered by upload time. Only items the reviewer marked as
correct are sent — `INCORRECT` and `DUPLICATE` items are excluded.

```jsonc
{
  "category":  "HERO" | "GALLERY" | "FLOOR_PLAN" | "MASTER_PLAN" | "BROCHURE" | "VIDEO" | "AMENITY" | "OTHER",
  "url":       "https://…supabase…signed-url…",   // valid for ~24h, see below
  "caption":   "Front elevation" | null,
  "configRef": "c1a2…-uuid" | null,                // set only for FLOOR_PLAN tied to a configuration
  "meta":      { … }                               // free-form: original filename, mime, dims, etc.
}
```

**Important about `url`:**

- All files are hosted in Supabase Storage (private bucket).
- Each URL is a **signed URL valid for 24 hours** from the push time.
- Terrisage MUST download and persist the file inside its own storage
  during ingestion. Do **not** store the signed URL — it will expire.
- If `url` is `null`, the file was registered as an external link
  (already-public asset). In that case `meta.external_url` holds the
  original URL.

### 4.4 Linked tenants

Staff can optionally tag one project with multiple tenants. Two parallel
representations are sent:

```jsonc
"linkedTenantIds": ["tenant_abc", "tenant_xyz"],

"linkedAccounts": [
  { "accountId": "acc-uuid", "tenantId": "tenant_abc", "accountName": "Prestige Group" },
  { "accountId": "acc-uuid", "tenantId": null,        "accountName": "Sobha (not yet live)" }
]
```

- `linkedTenantIds` is a deduplicated array of Terrisage tenant IDs only
  (entries where `tenantId` is not null). Recommended primary input.
- `linkedAccounts` is the raw list including accounts that have not yet
  been provisioned a tenant; useful for logging/debugging.
- Both arrays may be empty — linking is optional. If empty, Terrisage
  should store the project as a **global catalog entry** (not visible to
  any tenant) until a future push or an admin action links it.

Recommended Terrisage behaviour: after persisting the master project,
clone or reference-attach it into each tenant workspace listed in
`linkedTenantIds`.

## 5. Response

Success:

```
HTTP 200 OK
Content-Type: application/json

{
  "projectId": "trs_prj_01HZ…",     // canonical Terrisage project id
  "tenantsLinked": ["tenant_abc"],   // optional, for the audit log
  "warnings": []                     // optional
}
```

Either `projectId` or `id` is accepted at the top level — the Support
backend stores `response.projectId ?? response.id` on the import job.

Failure (any 4xx/5xx):

```
HTTP 4xx/5xx
{
  "error": "VALIDATION_FAILED",
  "message": "configurations[0].data.price must be a positive number",
  "details": { … }                   // optional
}
```

On any non-2xx, Support marks the import job `FAILED`, stores the body
in the activity log, and surfaces the error to the staff user. The staff
user can fix the data in the console and re-push (same `sourceJobId`).

## 6. End-to-end flow

```
Staff opens project in Admin ► Data
     ↓
Reviews fields, configurations, media, linked tenants
     ↓
Clicks "Push to Terrisage"
     ↓
Support → POST /api/integrations/projects   (X-API-Key, body as §4)
     ↓                                        ↑
Terrisage validates → creates project        retries once on network/5xx
     ↓
Terrisage downloads signed media URLs (within 24h)
     ↓
Terrisage clones/links project into each linkedTenantId
     ↓
Returns 200 { projectId }
     ↓
Support marks job IMPORTED, stamps terrisage_project_id on the job summary
```

## 7. Validation checklist for Terrisage

Before returning 200, Terrisage SHOULD verify:

1. `sourceJobId` is a UUID and not already mapped to a different project.
2. `project.project_name` is non-empty.
3. `propertyType` is a supported enum value.
4. Each `configurations[i].ref` is unique within the request.
5. Every `media[i].configRef` (when present) matches some
   `configurations[i].ref`.
6. Every `linkedTenantIds[i]` resolves to a known tenant. Unknown tenant
   IDs may be logged as warnings, not hard-rejected (an account's
   `tenant_id` may temporarily lag during provisioning).

## 8. Test payload

A minimal valid payload (residential apartment, one config, one hero
image, one linked tenant):

```json
{
  "sourceJobId": "11111111-1111-4111-8111-111111111111",
  "propertyType": "RESIDENTIAL_APARTMENT",
  "project": {
    "project_name": "Prestige Sunrise Park",
    "developer_name": "Prestige Group",
    "rera_number": "PRM/KA/RERA/1251/446/PR/180917/001234",
    "city": "Bengaluru",
    "site_area_acres": 12,
    "site_area_guntas": 20,
    "site_area_acres_total": 12.5,
    "total_units": 480,
    "amenities": ["Clubhouse", "Pool", "Gym"],
    "proximityMatrix": [
      { "category": "School", "name": "DPS East", "distance_km": 2.1 }
    ],
    "approvedBanks": ["HDFC", "SBI"],
    "representative": { "name": "Asha R", "mobile": "9876543210", "mobile_code": "+91" }
  },
  "configurations": [
    {
      "ref": "22222222-2222-4222-8222-222222222222",
      "sortOrder": 0,
      "data": { "name": "2 BHK", "carpet_area_sqft": 980, "bedrooms": 2, "bathrooms": 2, "price": 8500000 },
      "floor_plans": [
        { "url": "https://…signed…/floorplan-2bhk.png", "caption": "2 BHK plan" }
      ]
    }
  ],
  "media": [
    { "category": "HERO", "url": "https://…signed…/hero.jpg", "caption": null, "configRef": null, "meta": {} },
    { "category": "FLOOR_PLAN", "url": "https://…signed…/floorplan-2bhk.png", "caption": "2 BHK plan",
      "configRef": "22222222-2222-4222-8222-222222222222", "meta": {} }
  ],
  "linkedTenantIds": ["tenant_abc"],
  "linkedAccounts": [
    { "accountId": "33333333-3333-4333-8333-333333333333", "tenantId": "tenant_abc", "accountName": "Prestige Group" }
  ],
  "pushedAt": "2026-05-16T14:32:10.123Z",
  "pushedBy": "44444444-4444-4444-8444-444444444444"
}
```

Expected success response:

```json
{ "projectId": "trs_prj_01HZABCDEF", "tenantsLinked": ["tenant_abc"] }
```
