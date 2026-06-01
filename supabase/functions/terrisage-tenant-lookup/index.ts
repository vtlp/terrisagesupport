// Looks up a Terrisage tenant ID using the account's super-user (owner) email.
// Called from AccountDetail "Sync" button next to the Tenant ID field.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaffOrService } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function softError(body: Record<string, unknown>) {
  return json({ ok: false, ...body });
}

interface Body { accountId?: string; emailOverride?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, emailOverride } = (await req.json().catch(() => ({}))) as Body;
    if (!accountId) return softError({ error: "ACCOUNT_ID_REQUIRED" });

    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");
    if (!BASE_URL || !API_KEY) return softError({ error: "INTEGRATION_NOT_CONFIGURED" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: acct, error: acctErr } = await supabase
      .from("accounts").select("id, owner_email, tenant_id").eq("id", accountId).maybeSingle();
    if (acctErr) return softError({ error: "ACCOUNT_LOOKUP_FAILED", detail: acctErr.message });
    if (!acct) return softError({ error: "ACCOUNT_NOT_FOUND" });

    const email = (emailOverride ?? acct.owner_email ?? "").trim().toLowerCase();
    if (!email) return softError({ error: "NO_OWNER_EMAIL" });

    const base = BASE_URL.replace(/\/$/, "");
    const lookupUrl = `${base}/api/integrations/tenant-by-superuser`;

    const r = await fetch(lookupUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({ email }),
    });
    const text = await r.text();
    if (!r.ok) {
      return softError({ error: "TENANT_NOT_FOUND", email, status: r.status, detail: text.slice(0, 500) });
    }
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch (e) {
      return softError({ error: "INVALID_RESPONSE", detail: text.slice(0, 500) });
    }
    const tenantId = (parsed.tenantId as string | undefined)?.trim();
    if (!tenantId) {
      return json({ ok: false, error: "MISSING_TENANT_ID", raw: parsed }, 502);
    }

    const tenantDisplayName = (parsed.tenantDisplayName as string | undefined) ?? null;
    const superUserAgentId = (parsed.superUserAgentId as string | undefined) ?? null;
    const superUserEmail = (parsed.superUserEmail as string | undefined) ?? null;

    const { error: uErr } = await supabase
      .from("accounts").update({ tenant_id: tenantId }).eq("id", accountId);
    if (uErr) return softError({ error: "ACCOUNT_UPDATE_FAILED", detail: uErr.message });

    return json({ ok: true, tenantId, tenantDisplayName, superUserAgentId, superUserEmail, email });
  } catch (e) {
    return softError({ error: "SERVICE_FAILED", detail: String(e) });
  }
});
