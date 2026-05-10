// Proxies onboarding import (leads / secondary properties) to UpYard
// /api/support/onboarding/tenants/:tenantId/{leads|properties}/import
// and exposes a status endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Kind = "LEAD" | "SECONDARY_PROPERTY";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "import";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SUPPORT_ONBOARDING_INGESTION_API_KEY");

    if (!BASE_URL || !API_KEY) {
      return json({ ok: false, error: "INTEGRATION_NOT_CONFIGURED",
        detail: { hasBaseUrl: !!BASE_URL, hasApiKey: !!API_KEY } }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));

    // ---- STATUS ----
    if (action === "status") {
      const { tenantId, upyardJobId } = body as { tenantId?: string; upyardJobId?: string };
      if (!tenantId || !upyardJobId) return json({ ok: false, error: "MISSING_PARAMS" }, 400);

      const statusUrl = `${BASE_URL.replace(/\/$/, "")}/api/support/onboarding/tenants/${encodeURIComponent(tenantId)}/import-jobs/${encodeURIComponent(upyardJobId)}`;
      const resp = await fetch(statusUrl, { headers: { "X-API-Key": API_KEY } });
      const text = await resp.text();
      let payload: unknown = text;
      try { payload = JSON.parse(text); } catch { /* keep text */ }
      return json({ ok: resp.ok, status: resp.status, payload }, resp.ok ? 200 : resp.status);
    }

    // ---- IMPORT ----
    const { jobId, accountId, kind, filePath } = body as {
      jobId?: string; accountId?: string; kind?: Kind; filePath?: string;
    };
    if (!jobId || !accountId || !kind || !filePath) {
      return json({ ok: false, error: "MISSING_PARAMS" }, 400);
    }
    if (kind !== "LEAD" && kind !== "SECONDARY_PROPERTY") {
      return json({ ok: false, error: "UNSUPPORTED_KIND" }, 400);
    }

    // Resolve tenant id for the account
    const { data: acct, error: acctErr } = await supabase
      .from("accounts").select("id, tenant_id").eq("id", accountId).maybeSingle();
    if (acctErr) return json({ ok: false, error: "ACCOUNT_LOOKUP_FAILED", detail: acctErr.message }, 500);
    if (!acct) return json({ ok: false, error: "ACCOUNT_NOT_FOUND" }, 404);
    if (!acct.tenant_id) return json({ ok: false, error: "ACCOUNT_NOT_LINKED_TO_TERRISAGE" }, 409);

    // Download the source file from Storage
    const { data: blob, error: dlErr } = await supabase.storage.from("import-files").download(filePath);
    if (dlErr || !blob) return json({ ok: false, error: "FILE_DOWNLOAD_FAILED", detail: dlErr?.message }, 500);

    // Build multipart body
    const fileName = filePath.split("/").pop() || (kind === "LEAD" ? "leads.xlsx" : "properties.xlsx");
    const segment = kind === "LEAD" ? "leads" : "properties";
    const importUrl = `${BASE_URL.replace(/\/$/, "")}/api/support/onboarding/tenants/${encodeURIComponent(acct.tenant_id)}/${segment}/import`;
    const idempotencyKey = `support-job-${jobId}`;

    const fd = new FormData();
    fd.append("file", blob, fileName);

    console.log("[terrisage-onboarding-import] forwarding", { importUrl, fileName, idempotencyKey, size: blob.size });

    const upstream = await fetch(importUrl, {
      method: "POST",
      headers: { "X-API-Key": API_KEY, "X-Idempotency-Key": idempotencyKey },
      body: fd,
    });
    const text = await upstream.text();
    let payload: { jobId?: string } & Record<string, unknown> = {};
    try { payload = JSON.parse(text); } catch { /* keep text */ }

    if (!upstream.ok) {
      return json({ ok: false, status: upstream.status, error: "UPSTREAM_ERROR", detail: payload || text }, upstream.status);
    }

    return json({ ok: true, tenantId: acct.tenant_id, upyardJobId: payload.jobId, payload }, 202);
  } catch (e) {
    console.error("[terrisage-onboarding-import] error", e);
    return json({ ok: false, error: "INTERNAL_ERROR", detail: (e as Error).message }, 500);
  }
});
