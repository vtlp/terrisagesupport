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

    // Try a few likely Terrisage endpoints; first that returns a tenantId wins.
    const base = BASE_URL.replace(/\/$/, "");
    const candidates = [
      { method: "GET", url: `${base}/api/integrations/tenants/lookup?email=${encodeURIComponent(email)}` },
      { method: "GET", url: `${base}/api/integrations/tenant-by-email?email=${encodeURIComponent(email)}` },
      { method: "POST", url: `${base}/api/integrations/tenants/lookup`, body: JSON.stringify({ email }) },
    ];

    const attempts: Array<{ url: string; status: number; detail?: string }> = [];
    let tenantId: string | null = null;
    let raw: unknown = null;

    for (const c of candidates) {
      try {
        const r = await fetch(c.url, {
          method: c.method,
          headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
          body: c.method === "POST" ? c.body : undefined,
        });
        const text = await r.text();
        attempts.push({ url: c.url, status: r.status, detail: text.slice(0, 200) });
        if (!r.ok) continue;
        let parsed: Record<string, unknown> = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { continue; }
        const t = (parsed.tenantId ?? parsed.tenant_id
          ?? (parsed.tenant as Record<string, unknown> | undefined)?.id) as string | undefined;
        if (typeof t === "string" && t.trim()) {
          tenantId = t.trim();
          raw = parsed;
          break;
        }
      } catch (_e) {
        attempts.push({ url: c.url, status: 0, detail: "fetch_failed" });
      }
    }

    if (!tenantId) {
      return json({ ok: false, error: "TENANT_NOT_FOUND", email, attempts }, 404);
    }

    // Persist on the account
    const { error: uErr } = await supabase
      .from("accounts").update({ tenant_id: tenantId }).eq("id", accountId);
    if (uErr) return json({ ok: false, error: uErr.message }, 500);

    return json({ ok: true, tenantId, email, raw });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
