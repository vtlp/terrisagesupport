// Combined Terrisage sync fired on Fulfil.
// Pushes BOTH the new absolute seat allocation AND the current billing-cycle
// metadata to Terrisage CRM in a single call from the client.
//
// Calls (in order):
//   1) POST /api/integrations/seats/seat-allocation   (absolute newAllocatedTotal)
//   2) POST /api/integrations/seats/seat-cycle        (cycle window + frequency)
//
// Returns a per-step result so the UI can report partial success.
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

    // 1. Resolve account + tenant
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

    // 2. Resolve billing settings (seat total + cycle)
    const { data: bs, error: bsErr } = await supabase
      .from("account_billing_settings")
      .select(
        "seats_purchased, billing_cycle, current_period_start, current_period_end",
      )
      .eq("account_id", accountId)
      .maybeSingle();
    if (bsErr) return json({ error: bsErr.message }, 500);
    if (!bs) return json({ pushed: false, reason: "NO_BILLING_SETTINGS" }, 200);

    const base = BASE_URL.replace(/\/$/, "");
    const result: Record<string, unknown> = {
      tenantId: acct.tenant_id,
      allocation: null,
      cycle: null,
    };

    // ---- Step 1: seat-allocation (absolute) ----
    const newAllocatedTotal = Number(bs.seats_purchased ?? 0);
    if (!Number.isFinite(newAllocatedTotal) || newAllocatedTotal < 0) {
      result.allocation = { pushed: false, reason: "INVALID_SEAT_TOTAL" };
    } else {
      const idemKey = requestId
        ? `fulfil-${accountId}-${requestId}`
        : `fulfil-${accountId}-${newAllocatedTotal}-${Date.now()}`;
      try {
        const r = await fetch(`${base}/api/integrations/seats/seat-allocation`, {
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
        const text = await r.text();
        result.allocation = r.ok
          ? { pushed: true, newAllocatedTotal, response: safeParse(text) }
          : {
              pushed: false,
              reason: "UPSTREAM_ERROR",
              status: r.status,
              detail: text.slice(0, 500),
            };
      } catch (e) {
        result.allocation = {
          pushed: false,
          reason: "UPSTREAM_UNREACHABLE",
          detail: String(e),
        };
      }
    }

    // ---- Step 2: seat-cycle ----
    const frequency = mapFrequency(bs.billing_cycle);
    if (!frequency) {
      result.cycle = {
        pushed: false,
        reason: "UNSUPPORTED_CYCLE",
        cycle: bs.billing_cycle,
      };
    } else if (!bs.current_period_start || !bs.current_period_end) {
      result.cycle = { pushed: false, reason: "NO_CYCLE_DATES" };
    } else {
      const start = new Date(bs.current_period_start).toISOString();
      const end = new Date(bs.current_period_end).toISOString();
      if (!(new Date(start) < new Date(end))) {
        result.cycle = { pushed: false, reason: "INVALID_CYCLE_RANGE" };
      } else {
        try {
          const r = await fetch(`${base}/api/integrations/seats/seat-cycle`, {
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
          const text = await r.text();
          result.cycle = r.ok
            ? {
                pushed: true,
                seatBillingCycleStartAt: start,
                seatBillingCycleEndAt: end,
                seatBillingFrequency: frequency,
              }
            : {
                pushed: false,
                reason: "UPSTREAM_ERROR",
                status: r.status,
                detail: text.slice(0, 500),
              };
        } catch (e) {
          result.cycle = {
            pushed: false,
            reason: "UPSTREAM_UNREACHABLE",
            detail: String(e),
          };
        }
      }
    }

    const allocOk = (result.allocation as { pushed?: boolean })?.pushed === true;
    const cycleOk = (result.cycle as { pushed?: boolean })?.pushed === true;
    return json({
      ...result,
      pushed: allocOk && cycleOk,
      partial: allocOk !== cycleOk,
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
      return null;
  }
}

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
