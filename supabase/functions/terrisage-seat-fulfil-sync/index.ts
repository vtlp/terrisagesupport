// Pushes the new absolute seat allocation to Terrisage CRM after a seat
// request has been fulfilled on Support.
//
// Calls: POST /api/integrations/seats/seat-allocation
// Cycle metadata is pushed separately by `terrisage-seat-cycle-sync` whenever
// the billing cycle dates are saved on the BillingTab.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  accountId?: string;
  requestId?: string; // optional – used to build idempotency key
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, requestId } = (await req.json().catch(() => ({}))) as Body;
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
    if (!acct.tenant_id) {
      return json({ pushed: false, reason: "NO_TENANT_ID" }, 200);
    }
    if (!BASE_URL || !API_KEY) {
      return json({ pushed: false, reason: "INTEGRATION_NOT_CONFIGURED" }, 200);
    }

    const { data: bs, error: bsErr } = await supabase
      .from("account_billing_settings")
      .select("seats_purchased")
      .eq("account_id", accountId)
      .maybeSingle();
    if (bsErr) return json({ error: bsErr.message }, 500);
    if (!bs) return json({ pushed: false, reason: "NO_BILLING_SETTINGS" }, 200);

    const newAllocatedTotal = Number(bs.seats_purchased ?? 0);
    if (!Number.isFinite(newAllocatedTotal) || newAllocatedTotal < 0) {
      return json({ pushed: false, reason: "INVALID_SEAT_TOTAL" }, 200);
    }

    const idemKey = requestId
      ? `fulfil-${accountId}-${requestId}`
      : `fulfil-${accountId}-${newAllocatedTotal}-${Date.now()}`;

    const url =
      BASE_URL.replace(/\/$/, "") + `/api/integrations/seats/seat-allocation`;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          tenantId: acct.tenant_id,
          newAllocatedTotal,
          idempotencyKey: idemKey,
        }),
      });
    } catch (e) {
      return json(
        { pushed: false, reason: "UPSTREAM_UNREACHABLE", detail: String(e) },
        200,
      );
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      return json(
        {
          pushed: false,
          reason: "UPSTREAM_ERROR",
          status: upstream.status,
          detail: text.slice(0, 500),
        },
        200,
      );
    }

    return json({
      pushed: true,
      tenantId: acct.tenant_id,
      newAllocatedTotal,
      response: safeParse(text),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function safeParse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text.slice(0, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
