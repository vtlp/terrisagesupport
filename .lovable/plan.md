

# CRM Integration Handover Pack — Documentation Plan

Generate a complete, self-contained integration document the CRM team can implement against, plus a short "Console-side checklist" describing what we own. Delivered as a downloadable Markdown file in `/mnt/documents/` and (optionally) as a new in-app reference page extending the existing `AdminCrmSyncContract` screen.

## 1. Deliverable format

- **Primary**: `CRM_Integration_Handover_v1.md` saved to `/mnt/documents/` for the user to share with the CRM developer.
- **Secondary** (in-app): expand `src/pages/admin/AdminCrmSyncContract.tsx` with three tabs — *Our Setup*, *Their Setup*, *API Reference* — mirroring the same content so it stays accessible inside the Console.

## 2. Document structure

### Section A — Overview
- One-paragraph context (Console = billing & seat allocation source of truth; CRM = user lifecycle source of truth).
- The five seat states (`INVITED`, `ACTIVE`, `TEMP_DEACTIVATED`, `DELETION_REQUESTED`, `DELETED`) and the four-counter model (Allocated / Reserved / Consumed / Available).
- Reconciliation rules (block invites when Available = 0, stale-snapshot alerts at 24h, deleted seats released at renewal).

### Section B — What the Console team configures (our side)
1. Generate per-account API key from **Account → API Keys** (`account_api_keys`, hashed with SHA-256).
2. Share with CRM team: `account_id`, `x-account-api-key`, base URL `https://phkzxeajzglbmaymvtmt.supabase.co/functions/v1/`.
3. Confirm `account_billing_settings` row exists with `subscription_started_at`, `current_period_start/end`, `billing_cycle`, `seats_purchased`, `seat_rate`, `gst_pct`, `country`.
4. Approve seat-increase requests via Seats tab → triggers `apply_seat_delta` → emits `SEAT_INCREASE` event for CRM polling.
5. Run renewals via Billing tab → emits `RENEWAL` event.

### Section C — What the CRM developer must build (their side)
1. **Store credentials** securely: `account_id` + `x-account-api-key` per tenant.
2. **Boot read** — call `GET /seat-capacity` on app start to learn entitlement (allocated, current_period_end, owner_name, country, auto_renew).
3. **Heartbeat push** — call `POST /seat-usage` every 5 min AND on every member state change, with the full member roster (no diffs).
4. **Invite TTL ownership** — set `invitation_expires_at` (recommended 7 days); expired invites must drop back to a non-INVITED state so they stop counting as Reserved.
5. **Block invites** when `/seat-capacity` returns `available = 0`.
6. **Poll deltas** — call `GET /seat-events?since=<last_ts>` every 5 min; on `SEAT_INCREASE`/`RENEWAL` unlock new invite slots, on `CANCELLATION` freeze new invites.
7. **Seat-increase request** — call `POST /seat-request` when admin asks for more seats.
8. **Subscription metadata screen** — call `GET /account-profile` to display billing context to the CRM admin.
9. **Superuser transfer notice** — listen for `SUPERUSER_TRANSFER` events on `/seat-events` (Console initiates, CRM reflects new superuser).

### Section D — API reference (verbatim contract)
For each endpoint: method, path, headers, request body schema, response schema, sample `curl`, error codes.

| Endpoint | Direction | Auth |
|---|---|---|
| `GET /seat-capacity` | CRM → Console | `x-account-api-key` |
| `GET /account-profile` | CRM → Console | `x-account-api-key` |
| `GET /seat-events?since=` | CRM → Console | `x-account-api-key` |
| `POST /seat-usage` | CRM → Console | `x-account-api-key` |
| `POST /seat-request` | CRM → Console | `x-account-api-key` |

Each entry includes the full JSON payload taken from the live edge functions (`seat-usage`, `seat-capacity`, `account-profile`, `seat-events`, `seat-request`).

### Section E — Member payload schema (for `/seat-usage`)
Field-by-field table: `external_id`, `full_name`, `email`, `phone`, `role`, `permissions[]`, `state`, `invited_at`, `invitation_expires_at`, `activated_at`, `last_active_at`, `is_superuser` — with required/optional, type, and the rule that derives Reserved/Consumed.

### Section F — Reconciliation & error handling
- Counter math (`reserved`, `consumed`, `available`) the Console performs server-side.
- `OVER_CAPACITY` response when `consumed > allocated`.
- Retry policy: exponential backoff on 5xx, 24-hour silence triggers `CRM_SYNC_STALE` notification on Console bell.
- Idempotency: `/seat-usage` upserts by `account_id`; `/seat-request` deduplicates by pending status.

### Section G — Test plan
- Curl commands for each endpoint with sample payloads.
- Walk-through scenarios: invite a user → verify Reserved tile; activate user → Consumed bumps; expire invite → Reserved drops; request +5 seats → approval bumps Allocated → CRM polls event.

### Section H — Out of scope (so CRM team doesn't expect it)
- Concurrent-seat licensing, open-work reassignment signal, Razorpay auto-collection, CRM-side UI mockups.

## 3. Console-side code change (small, optional)
Extend `src/pages/admin/AdminCrmSyncContract.tsx` to render the same handover content in a tabbed view so the doc lives next to the API key management screen. No new tables or RPCs needed.

## 4. Out of scope for this build

- No new edge functions, RPCs, or migrations.
- No CRM-side code (we only document what they must build).

