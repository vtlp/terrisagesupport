// Pushes billing-cycle metadata for an account to Terrisage CRM.
// Called after a seat request is fulfilled so the upstream CRM knows
// the current cycle window + frequency for the additional seats.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaffOrService } from "../_shared/auth.ts";

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

    const auth = await requireStaffOrService(req, supabase);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

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
      .select("billing_cycle, current_period_start, current_period_end")
      .eq("account_id", accountId)
      .maybeSingle();
    if (bsErr) return json({ error: bsErr.message }, 500);
    if (!bs) return json({ pushed: false, reason: "NO_BILLING_SETTINGS" }, 200);
    if (!bs.current_period_start || !bs.current_period_end) {
      return json({ pushed: false, reason: "NO_CYCLE_DATES" }, 200);
    }

    const frequency = mapFrequency(bs.billing_cycle);
    if (!frequency) {
      return json(
        { pushed: false, reason: "UNSUPPORTED_CYCLE", cycle: bs.billing_cycle },
        200,
      );
    }

    const start = new Date(bs.current_period_start).toISOString();
    const end = new Date(bs.current_period_end).toISOString();
    if (!(new Date(start) < new Date(end))) {
      return json({ pushed: false, reason: "INVALID_CYCLE_RANGE" }, 200);
    }

    const url =
      BASE_URL.replace(/\/$/, "") + `/api/integrations/seats/seat-cycle`;

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
          seatBillingCycleStartAt: start,
          seatBillingCycleEndAt: end,
          seatBillingFrequency: frequency,
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
      seatBillingCycleStartAt: start,
      seatBillingCycleEndAt: end,
      seatBillingFrequency: frequency,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function mapFrequency(cycle: string | null | undefined): string | null {
  switch (cycle) {
    case "HALF_YEARLY":
      return "SIX_MONTH";
    case "ANNUAL":
      return "YEARLY";
    default:
      return null; // MONTHLY / QUARTERLY are not supported by the Terrisage endpoint
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
