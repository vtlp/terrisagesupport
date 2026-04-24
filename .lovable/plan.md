

## Review: `CRM_Integration_Handover_v1.md`

**Verdict:** Still valuable as the backbone — the five seat states, four-counter model, endpoint list and reconciliation rules all match what's deployed. But it has **6 factual drifts** versus the live edge functions and **1 major gap** (no mention of TRIAL accounts, which we shipped today). It should be re-issued as **v1.1** before handover.

---

### Drifts vs. implementation

| # | Doc says | Code actually does | Fix |
|---|---|---|---|
| 1 | `GET /seat-capacity` returns fields named `plan_name`, `billing_cycle`, `subscription_status`, `next_renewal_at`, `requested_pending`, `as_of` | Returns `plan`, `cycle`, `status`, no `next_renewal_at`, field is `requested` (not `_pending`), timestamp is `last_crm_sync_at` (not `as_of`) | Update D1 sample response to match `seat-capacity/index.ts` exactly, or rename the function fields to match the doc — pick one. |
| 2 | `POST /seat-usage` 200 body lists `allocated/reserved/consumed/available/over_capacity` | Code also returns `account_id` | Add `account_id` to the D4 example. |
| 3 | `POST /seat-request` returns 200 | Code returns **201 Created** on insert; idempotent-return-of-existing-PENDING is **not** implemented (DB has no unique constraint on `(account_id, status='PENDING')`) | Either (a) implement the idempotency the doc promises, or (b) remove the "same row is returned" sentence and document 201. |
| 4 | `GET /seat-request/:id` exists for status polling (in code) | Not mentioned in the doc at all | Add as D5b — the CRM will want to poll request status without waiting for a `REQUEST_FULFILLED` event. |
| 5 | `seat-usage` payload requires `external_id` | Code falls back to `email` as match key when `external_id` is missing | Mark `external_id` as "✅ recommended" with note: "if absent, Console matches on `email`; rows with neither are skipped." |
| 6 | `CRM_SYNC_STALE` raised after 24h with no heartbeat | No cron is currently deployed that writes this notification — the threshold exists in spec only | Either ship the cron now or downgrade the wording to "planned" so the CRM team doesn't expect the alert in pilot. |

---

### Major gap — TRIAL accounts (shipped today)

The doc assumes every account is `ACTIVE` from day one. Post-today, an account can open in `subscription_status = 'TRIAL'`, with the first paid invoice raised only after the trial-conversion link is paid. CRM behaviour during `TRIAL` is currently undefined for the integrator. Add a short section:

- **`status` enum**: add `TRIAL` to D1 / D2 / E.
- **Behaviour during TRIAL**: seats are still allocated (`seats_purchased` from billing settings); CRM should treat capacity exactly as it does for `ACTIVE`. No proration applies.
- **Transition signal**: when the trial-conversion payment lands, the Console flips status `TRIAL → ACTIVE` and creates the first `CYCLE` invoice. Today this is **silent on `/seat-events`** (no event reason exists for it). Decide: either add a new event reason `TRIAL_CONVERTED`, or have the CRM detect it by polling `/account-profile` for the status change. Recommendation: add `TRIAL_CONVERTED` to the events stream — it's the cleanest signal and matches the existing pattern.

---

### Minor copy/clarity tweaks

- Section A: rename the stage-context table header so "Counts as" reads "Reserved (R) / Consumed (C) / Released at renewal" — current single-column form is ambiguous for `DELETION_REQUESTED`.
- Section B row 2: `current_period_start/end` are nullable while in `TRIAL`; flag this.
- Section C3: clarify that the 5-min keepalive is **in addition to** state-change pushes, not a replacement.
- Section F "Rate limits": these are aspirational — no limiter is enforced server-side. Mark as "soft target, monitored, not enforced".
- Section H: add "Trial-conversion payment collection — handled inside Console, CRM sees only the resulting status flip."

---

### What stays as-is (no change needed)

- Five-state model, counter math, hard rules block (A).
- Auth via `x-account-api-key` SHA-256 (D, F).
- Event reasons `REQUEST_FULFILLED / RENEWAL / MANUAL_ADJUSTMENT / CANCELLATION / SUPERUSER_TRANSFER` (C6, D3) — all still emitted.
- Member schema in E.
- Test plan in G — scenarios all still execute correctly; just add a TRIAL → ACTIVE scenario.
- Quick handover checklist (closing) — still the right pre-flight.

---

### Proposed action

Re-issue as **v1.1** with: (a) the 6 field/return-code corrections, (b) the TRIAL section, (c) the `GET /seat-request/:id` addition, (d) decision on `TRIAL_CONVERTED` event, (e) the "soft / aspirational" hedging on rate-limit and stale-sync claims that aren't enforced yet. Roughly 15-20 line diff, no structural rewrite.

If you want, I can produce the v1.1 markdown in one pass — say the word and I'll switch to default mode and write the updated file plus, if you choose, the `TRIAL_CONVERTED` event wiring in the webhook.

