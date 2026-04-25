// Fetches live tenant team members from Terrisage CRM
// GET /api/integrations/seats/tenant-agents?tenantId=<uuid>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  accountId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId } = (await req.json().catch(() => ({}))) as Body;
    if (!accountId) return json({ error: "accountId required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id, tenant_id")
      .eq("id", accountId)
      .maybeSingle();

    if (acctErr) return json({ error: acctErr.message }, 500);
    if (!acct) return json({ error: "Account not found" }, 404);
    if (!acct.tenant_id) return json({ linked: false, reason: "NO_TENANT_ID", agents: [] }, 200);
    if (!BASE_URL || !API_KEY) {
      return json({ linked: false, reason: "INTEGRATION_NOT_CONFIGURED", agents: [] }, 200);
    }

    const url =
      BASE_URL.replace(/\/$/, "") +
      `/api/integrations/seats/tenant-agents?tenantId=${encodeURIComponent(acct.tenant_id)}`;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      });
    } catch (e) {
      return json({ linked: false, reason: "UPSTREAM_UNREACHABLE", detail: String(e), agents: [] }, 200);
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      return json(
        { linked: false, reason: "UPSTREAM_ERROR", status: upstream.status, detail: text.slice(0, 500), agents: [] },
        200,
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      return json({ linked: false, reason: "INVALID_RESPONSE", agents: [] }, 200);
    }

    const rawAgents = Array.isArray(payload.agents) ? payload.agents : [];
    type RawAgent = {
      id?: string;
      name?: string;
      email?: string;
      mobileNumber?: string;
      memberState?: string;
      baseRole?: string;
      abilities?: Record<string, unknown>;
    };
    const agents = (rawAgents as RawAgent[]).map((a) => {
      const ab = (a.abilities ?? {}) as Record<string, unknown>;
      const permissions: string[] = [];
      const composite = String(ab.composite ?? "").toUpperCase();
      const scope = String(ab.bestMatchScope ?? "").toUpperCase();
      if (composite.includes("ORG_WIDE") || scope.includes("COMPANY_WIDE") || scope.includes("ORG")) {
        permissions.push("Organisation wide");
      }
      if (ab.hasAgentNetworks || composite.includes("AGENT") || scope.includes("AGENT")) {
        permissions.push("Agent network");
      }
      return {
        id: a.id ?? null,
        name: a.name ?? "",
        email: a.email ?? "",
        phone: a.mobileNumber ?? "",
        role: a.baseRole ?? "",
        status: a.memberState ?? "",
        permissions,
        scope: (ab.composite as string) ?? null,
      };
    });

    return json({ linked: true, agents });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
