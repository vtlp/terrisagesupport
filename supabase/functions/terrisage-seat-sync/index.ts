// Terrisage seat sync — fetches live seat capacity from Terrisage CRM
// and writes a snapshot into seat_usage_snapshots.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaffOrService } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncBody {
  accountId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId } = (await req.json().catch(() => ({}))) as SyncBody;
    console.log("[terrisage-seat-sync] invoked", { accountId });
    if (!accountId) {
      return json({ error: "accountId required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");

    console.log("[terrisage-seat-sync] env", {
      hasBaseUrl: !!BASE_URL,
      baseUrlPreview: BASE_URL ? BASE_URL.slice(0, 40) : null,
      hasApiKey: !!API_KEY,
      apiKeyLen: API_KEY ? API_KEY.length : 0,
    });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look up tenant_id for the account
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id, tenant_id")
      .eq("id", accountId)
      .maybeSingle();

    if (acctErr) {
      console.error("[terrisage-seat-sync] account lookup failed", acctErr);
      return json({ error: acctErr.message }, 500);
    }
    if (!acct) {
      console.warn("[terrisage-seat-sync] account not found", { accountId });
      return json({ error: "Account not found" }, 404);
    }
    console.log("[terrisage-seat-sync] account", {
      accountId,
      tenant_id: acct.tenant_id,
    });
    if (!acct.tenant_id) {
      console.warn("[terrisage-seat-sync] NO_TENANT_ID", { accountId });
      return json({ linked: false, reason: "NO_TENANT_ID" }, 200);
    }
    if (!BASE_URL || !API_KEY) {
      console.warn("[terrisage-seat-sync] INTEGRATION_NOT_CONFIGURED", {
        hasBaseUrl: !!BASE_URL,
        hasApiKey: !!API_KEY,
      });
      return json({ linked: false, reason: "INTEGRATION_NOT_CONFIGURED" }, 200);
    }

    // Call Terrisage to fetch current seat snapshot for the tenant.
    // Spec: GET /api/integrations/seats/seat-snapshot?tenantId=<uuid>
    const url =
      BASE_URL.replace(/\/$/, "") +
      `/api/integrations/seats/seat-snapshot?tenantId=${encodeURIComponent(
        acct.tenant_id,
      )}`;
    console.log("[terrisage-seat-sync] calling upstream", { url });

    let upstream: Response;
    const startedAt = Date.now();
    try {
      upstream = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
      });
    } catch (e) {
      console.error("[terrisage-seat-sync] UPSTREAM_UNREACHABLE", {
        url,
        elapsed_ms: Date.now() - startedAt,
        error: String(e),
        name: (e as Error)?.name,
        cause: String((e as { cause?: unknown })?.cause ?? ""),
      });
      return json(
        { linked: false, reason: "UPSTREAM_UNREACHABLE", detail: String(e) },
        200,
      );
    }

    const text = await upstream.text();
    console.log("[terrisage-seat-sync] upstream responded", {
      status: upstream.status,
      ok: upstream.ok,
      elapsed_ms: Date.now() - startedAt,
      bodyPreview: text.slice(0, 200),
    });
    if (!upstream.ok) {
      return json(
        {
          linked: false,
          reason: "UPSTREAM_ERROR",
          status: upstream.status,
          detail: text.slice(0, 500),
        },
        200,
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      return json({ linked: false, reason: "INVALID_RESPONSE" }, 200);
    }

    const allocated = num(payload.allocatedSeats ?? payload.allocated);
    const consumed = num(payload.consumedSeats ?? payload.consumed);
    const reserved = num(payload.reservedSeats ?? payload.reserved);
    const available = num(
      payload.availableSeats ?? payload.available ?? allocated - consumed - reserved,
    );
    // Extra fields exposed by /seat-snapshot — passed through on the snapshot members payload
    // for downstream consumers without altering the existing column shape.
    const invitableAvailable = num(
      payload.invitableAvailableSeats ?? payload.invitable_available_seats ?? available,
    );
    const requested = num(payload.requestedSeats ?? payload.requested);
    const cycleStart = (payload.seatBillingCycleStartAt as string | null) ?? null;
    const cycleEnd = (payload.seatBillingCycleEndAt as string | null) ?? null;
    const cycleFreq = (payload.seatBillingFrequency as string | null) ?? null;
    const members = Array.isArray(payload.members)
      ? payload.members
      : [
          {
            __meta: true,
            invitableAvailable,
            requested,
            seatBillingCycleStartAt: cycleStart,
            seatBillingCycleEndAt: cycleEnd,
            seatBillingFrequency: cycleFreq,
          },
        ];

    // Persist snapshot
    const { error: snapErr } = await supabase
      .from("seat_usage_snapshots")
      .upsert(
        {
          account_id: accountId,
          allocated,
          consumed,
          reserved,
          available,
          requested,
          members,
          source: "terrisage",
          reported_at: new Date().toISOString(),
        },
        { onConflict: "account_id" },
      );

    if (snapErr) return json({ error: snapErr.message }, 500);

    return json({
      linked: true,
      allocated,
      consumed,
      reserved,
      available,
      invitableAvailable,
      requested,
      seatBillingCycleStartAt: cycleStart,
      seatBillingCycleEndAt: cycleEnd,
      seatBillingFrequency: cycleFreq,
      members_count: Array.isArray(payload.members) ? payload.members.length : 0,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
