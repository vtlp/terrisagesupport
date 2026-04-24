# Terrisage ↔ Support CRM — Integration API

**Version:** 2.0 (adds `featureUsage`)
**Owner:** Support CRM team
**Last updated:** 2026-04-24

Two-way sync of usage telemetry powering the Reports module
(Usage, Feature Adoption, Engagement, Alerts).

- **PUSH** (Terrisage → Support CRM): daily batch, one row per tenant per day.
- **PULL** (Support CRM → Terrisage): on every Reports page open + nightly fallback.

---

## 1. PUSH endpoint — Terrisage → Support CRM

```
POST https://phkzxeajzglbmaymvtmt.supabase.co/functions/v1/terrisage-usage-ingest
```

**Headers**
| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-API-Key` | shared secret (we will share securely) |

**Request body**
```json
{
  "snapshots": [
    {
      "tenantId": "acme-realty",
      "snapshotDate": "2026-04-24",
      "dau": 12,
      "wau": 35,
      "mau": 80,
      "sessions": 240,
      "leadsCreated": 18,
      "followUps": 22,
      "conversions": 4,
      "tasksCompleted": 31,
      "lastActiveAt": "2026-04-24T17:42:11Z",
      "featureUsage": {
        "enquiry_capture": 92,
        "convert_to_lead": 78,
        "manual_leads": 65,
        "creating_tasks": 58,
        "task_types": 42,
        "channel_partner": 35
      }
    }
  ]
}
```

**Field reference**

| Field | Type | Required | Notes |
|---|---|---|---|
| `tenantId` | string | yes | Must match `accounts.tenant_id` on our side |
| `snapshotDate` | date `YYYY-MM-DD` | yes | One row per tenant per day; re-sending = upsert |
| `dau` / `wau` / `mau` | int ≥ 0 | yes | Active user counts |
| `sessions` | int ≥ 0 | yes | Total sessions that day |
| `leadsCreated` | int ≥ 0 | yes | Leads added that day |
| `followUps` | int ≥ 0 | yes | Follow-ups logged |
| `conversions` | int ≥ 0 | yes | Leads → customers that day |
| `tasksCompleted` | int ≥ 0 | yes | Tasks marked done |
| `lastActiveAt` | ISO 8601 | yes | Most recent user activity in tenant |
| `featureUsage` | object | **NEW — optional** | Per-feature adoption % (0–100). Keys below. Missing keys default to 0. |

**`featureUsage` keys** (all integers, 0–100, % of active users in that tenant who used the feature)

| Key | Powers UI label |
|---|---|
| `enquiry_capture` | Enquiry Capture |
| `convert_to_lead` | Convert to Lead Button |
| `manual_leads` | Creating Manual Leads |
| `creating_tasks` | Creating Tasks |
| `task_types` | Task Types Usage |
| `channel_partner` | Channel Partner Section |

Values outside 0–100 are clamped. Non-numeric values are dropped.

**Responses**
- `200` → `{ "accepted": <int>, "skipped": <int>, "errors": [] }`
- `401` → bad/missing `X-API-Key`
- `400` → malformed body or missing `snapshots` array
- `500` → upstream DB error

**Frequency:** once per 24 h, ideally 00:30–01:30 IST. Batch all tenants in one call.

---

## 2. PULL endpoint — Support CRM → Terrisage

**You build this on Terrisage.**

```
GET {TERRISAGE_BASE_URL}/api/integrations/usage/summary
```

**Headers**
| Header | Value |
|---|---|
| `X-API-Key` | shared secret (Terrisage issues, we store as env var) |

**Query params**
| Param | Required | Example |
|---|---|---|
| `tenantId` | yes | `acme-realty` |
| `from` | yes | `2026-03-25` |
| `to` | yes | `2026-04-24` |

**Response (200)**
```json
{
  "tenantId": "acme-realty",
  "days": [
    {
      "date": "2026-04-24",
      "dau": 12,
      "wau": 35,
      "mau": 80,
      "sessions": 240,
      "leadsCreated": 18,
      "followUps": 22,
      "conversions": 4,
      "tasksCompleted": 31,
      "lastActiveAt": "2026-04-24T17:42:11Z",
      "featureUsage": {
        "enquiry_capture": 92,
        "convert_to_lead": 78,
        "manual_leads": 65,
        "creating_tasks": 58,
        "task_types": 42,
        "channel_partner": 35
      }
    }
  ]
}
```

Same field semantics as PUSH. Return all days in `[from, to]` for which a snapshot exists.

**Responses**
- `200` with `days: []` if no data yet (we won't error)
- `401` if our key is wrong
- `404` if `tenantId` is unknown to Terrisage

---

## 3. Data model on our side

**Table:** `public.account_usage_snapshots`

| Column | Type | Notes |
|---|---|---|
| `account_id` | uuid | FK → `accounts.id` |
| `snapshot_date` | date | |
| `dau`, `wau`, `mau` | int | |
| `sessions`, `leads_created`, `follow_ups`, `conversions`, `tasks_completed` | int | |
| `last_active_at` | timestamptz | |
| `feature_usage` | jsonb | `{ enquiry_capture: 92, ... }` |
| `source` | text | `'terrisage'` for ingested rows |

- **Unique on** `(account_id, snapshot_date, source)` — re-ingesting same date overwrites.
- **Retention:** rows older than 12 months are deleted nightly via `cleanup_usage_snapshots()`.
- **Realtime:** enabled — Reports UI updates instantly when push lands.

---

## 4. How Reports uses each field

| Reports section | Source field(s) | Aggregation |
|---|---|---|
| KPI: Active Accounts | `accounts.status` | count where LIVE / ONBOARDING |
| KPI: Avg DAU / Account | `dau` (latest snapshot) | mean across filtered accounts |
| KPI: Total Sessions | `sessions` | sum over last 30 d |
| KPI: Total Leads | `leads_created` | sum over last 30 d |
| KPI: Inactivity Alerts | `last_active_at` | count where > 7 d ago |
| Usage table | `dau`, `wau`, `leads_created`, `conversions`, `last_active_at` | latest + 30 d sums |
| Live Accounts by Type | `accounts.tenancy_type` | count |
| Sessions by City | `accounts.city` × `sessions` | sum |
| **Feature Adoption bars** | `feature_usage.<key>` | mean across filtered accounts |
| Funnel cards | `leads_created`, `follow_ups`, `tasks_completed`, `conversions` | sum 30 d |
| Engagement weekly trend | `dau`, `sessions` | rolled up to ISO weeks (last 6) |
| DAU/WAU, WAU/MAU | `dau`, `wau`, `mau` | sums then ratio |
| Inactivity Alerts list | `last_active_at` | filter > 7 d, list |

Filter (`all` / `agency` / `builder`) is applied to every section
via `accounts.tenancy_type`.

---

## 5. Sync flow

1. **Daily push (Terrisage cron):** POST batch of all tenants → row upserted →
   Reports UI receives realtime update for any open clients.
2. **On Reports open (Support CRM):** call `terrisage-usage-sync` → we GET
   last 30 days from Terrisage per linked account → upsert.
3. **Inactivity alerts:** computed on our side from `last_active_at > 7 days`.

---

## 6. Setup checklist

**Terrisage side**
- [ ] Build `GET /api/integrations/usage/summary` per spec above (with `featureUsage`).
- [ ] Build a daily cron POSTing to our `/terrisage-usage-ingest`.
- [ ] Issue `X-API-Key` for our pull calls; share securely.
- [ ] Confirm `tenantId` values match what we hold in `accounts.tenant_id`.

**Support CRM side**
- [ ] Provide `X-API-Key` for Terrisage's push calls (stored as `SEAT_SUPPORT_INTEGRATION_API_KEY`).
- [ ] Set `TERRISAGE_BASE_URL` env var for outbound pulls.
- [ ] Backfill historical 12 months optional — pass `?days=365` to `terrisage-usage-sync` once.

---

## 7. Versioning

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-04-24 | Initial PUSH + PULL contract |
| **2.0** | 2026-04-24 | Added optional `featureUsage` object on snapshot for Feature Adoption tab |

Backwards compatible: snapshots without `featureUsage` continue to work
(adoption bars show 0% for that account).
