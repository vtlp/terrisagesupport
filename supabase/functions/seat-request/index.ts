// Inbound webhook called by Terrisage CRM when a tenant raises a request for
// additional seats from inside their app. Creates a `seat_requests` row on
// Support; the matching `seat-allocation` callback is fired separately when a
// Support admin clicks **Fulfil**.
//
// Public endpoint. Authentication is via shared header:
//   X-API-Key: <SEAT_SUPPORT_INTEGRATION_API_KEY>
//
// Contract: see docs/terrisage-seat-request-webhook.md
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  tenantId?: unknown;
  requestedSeats?: unknown;
  requestedByEmail?: unknown;
  reason?: unknown;
  idempotencyKey?: unknown;
  requestedAt?: unknown;
}

const MAX_SEATS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  // ---- Auth ----
  const apiKeyHeader =
    req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
  const expectedKey = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");
  if (!expectedKey) {
    return json({ ok: false, error: "INTEGRATION_NOT_CONFIGURED" }, 500);
  }
  if (!apiKeyHeader || apiKeyHeader !== expectedKey) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  // ---- Parse body ----
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(
      { ok: false, error: "INVALID_BODY", detail: "Body must be JSON" },
      400,
    );
  }

  const tenantId =
    typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const requestedSeats =
    typeof body.requestedSeats === "number"
      ? body.requestedSeats
      : Number(body.requestedSeats);
  const requestedByEmail =
    typeof body.requestedByEmail === "string"
      ? body.requestedByEmail.trim().toLowerCase()
      : "";
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  const idempotencyKey =
    typeof body.idempotencyKey === "string"
      ? body.idempotencyKey.trim().slice(0, 128)
      : "";
  const requestedAt =
    typeof body.requestedAt === "string" && body.requestedAt
      ? body.requestedAt
      : null;

  const errors: string[] = [];
  if (!tenantId) {
    errors.push("tenantId is required");
  } else if (!UUID_RE.test(tenantId)) {
    errors.push("tenantId must be a valid UUID");
  }
  if (!idempotencyKey) errors.push("idempotencyKey is required");
  if (requestedByEmail && !EMAIL_RE.test(requestedByEmail)) {
    errors.push("requestedByEmail must be a valid email when provided");
  }
  if (errors.length) {
    return json(
      { ok: false, error: "INVALID_BODY", detail: errors.join("; ") },
      400,
    );
  }
  if (
    !Number.isFinite(requestedSeats) ||
    !Number.isInteger(requestedSeats) ||
    requestedSeats < 1 ||
    requestedSeats > MAX_SEATS
  ) {
    return json(
      {
        ok: false,
        error: "INVALID_SEAT_COUNT",
        detail: `requestedSeats must be an integer in [1, ${MAX_SEATS}]`,
      },
      422,
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- Resolve tenant -> account ----
  const { data: acct, error: acctErr } = await supabase
    .from("accounts")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (acctErr) {
    return json(
      { ok: false, error: "INTERNAL_ERROR", detail: acctErr.message },
      500,
    );
  }
  if (!acct) {
    return json({ ok: false, error: "TENANT_NOT_FOUND" }, 404);
  }
  if (acct.status === "CANCELLED" || acct.status === "STALLED_ONBOARDING") {
    return json(
      {
        ok: false,
        error: "ACCOUNT_NOT_ACTIVE",
        detail: `status=${acct.status}`,
      },
      409,
    );
  }

  // ---- Idempotency: marker prefixed in `reason` so we can dedupe lookups ----
  const idemMarker = `[idem:${idempotencyKey}]`;
  const composedReason = reason ? `${idemMarker} ${reason}` : idemMarker;

  const { data: existing, error: existErr } = await supabase
    .from("seat_requests")
    .select("id, status")
    .eq("account_id", acct.id)
    .ilike("reason", `${idemMarker}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existErr) {
    return json(
      { ok: false, error: "INTERNAL_ERROR", detail: existErr.message },
      500,
    );
  }
  if (existing) {
    return json({
      ok: true,
      seatRequestId: existing.id,
      status: existing.status,
      duplicate: true,
    });
  }

  // ---- Insert new seat request ----
  const insertPayload: Record<string, unknown> = {
    account_id: acct.id,
    requested_seats: requestedSeats,
    requested_by_email: requestedByEmail || null,
    reason: composedReason,
    status: "PENDING",
  };
  if (requestedAt) insertPayload.created_at = requestedAt;

  const { data: created, error: insErr } = await supabase
    .from("seat_requests")
    .insert(insertPayload)
    .select("id, status")
    .single();
  if (insErr || !created) {
    return json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        detail: insErr?.message ?? "Insert failed",
      },
      500,
    );
  }

  return json({
    ok: true,
    seatRequestId: created.id,
    status: created.status,
    duplicate: false,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
