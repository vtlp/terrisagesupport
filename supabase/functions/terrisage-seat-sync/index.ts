// Terrisage seat sync — fetches live seat capacity from Terrisage CRM
// and writes a snapshot into seat_usage_snapshots.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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
    if (!accountId) {
      return json({ error: "accountId required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look up tenant_id for the account
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id, tenant_id")
      .eq("id", accountId)
      .maybeSingle();

    if (acctErr) return json({ error: acctErr.message }, 500);
    if (!acct) return json({ error: "Account not found" }, 404);
    if (!acct.tenant_id) {
      return json({ linked: false, reason: "NO_TENANT_ID" }, 200);
    }
    if (!BASE_URL || !API_KEY) {
      return json({ linked: false, reason: "INTEGRATION_NOT_CONFIGURED" }, 200);
    }

    // Call Terrisage to fetch current seat status for the tenant
    const url =
      BASE_URL.replace(/\/$/, "") +
      `/api/integrations/seats/status?tenantId=${encodeURIComponent(
        acct.tenant_id,
      )}`;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
      });
    } catch (e) {
      return json(
        { linked: false, reason: "UPSTREAM_UNREACHABLE", detail: String(e) },
        200,
      );
    }

    const text = await upstream.text();
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
    const members = Array.isArray(payload.members) ? payload.members : [];

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
      members_count: members.length,
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
