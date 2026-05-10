// Looks up a Terrisage tenant ID using the account's super-user (owner) email.
// Called from AccountDetail "Sync" button next to the Tenant ID field.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

interface Body { accountId?: string; emailOverride?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, emailOverride } = (await req.json().catch(() => ({}))) as Body;
    if (!accountId) return json({ ok: false, error: "accountId required" }, 400);

    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");
    if (!BASE_URL || !API_KEY) return json({ ok: false, error: "INTEGRATION_NOT_CONFIGURED" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: acct, error: acctErr } = await supabase
      .from("accounts").select("id, owner_email, tenant_id").eq("id", accountId).maybeSingle();
    if (acctErr) return json({ ok: false, error: acctErr.message }, 500);
    if (!acct) return json({ ok: false, error: "ACCOUNT_NOT_FOUND" }, 404);

    const email = (emailOverride ?? acct.owner_email ?? "").trim().toLowerCase();
    if (!email) return json({ ok: false, error: "NO_OWNER_EMAIL" }, 400);

    const base = BASE_URL.replace(/\/$/, "");
    const lookupUrl = `${base}/api/integrations/tenant-by-superuser`;

    const r = await fetch(lookupUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({ email }),
    });
    const text = await r.text();
    if (!r.ok) {
      return json({ ok: false, error: "TENANT_NOT_FOUND", email, status: r.status, detail: text.slice(0, 200) }, 404);
    }
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch (e) {
      return json({ ok: false, error: "INVALID_RESPONSE", detail: text.slice(0, 200) }, 502);
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
    if (uErr) return json({ ok: false, error: uErr.message }, 500);

    return json({ ok: true, tenantId, tenantDisplayName, superUserAgentId, superUserEmail, email });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
