// Pushes the new absolute seat allocation to Terrisage CRM after a seat
// request has been fulfilled on Support.
//
// Flow:
//   1. GET  /api/integrations/seats/seat-snapshot      (read CRM baseline)
//   2. newAllocatedTotal = CRM.allocatedSeats + requested_seats
//   3. UPDATE local account_billing_settings.seats_purchased = newAllocatedTotal
//   4. POST /api/integrations/seats/seat-allocation    (push absolute total)
//
// Cycle metadata is pushed separately by `terrisage-seat-cycle-sync` whenever
// the billing cycle dates are saved on the BillingTab.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaffOrService } from "../_shared/auth.ts";

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
    console.log("[terrisage-seat-fulfil-sync] invoked", { accountId, requestId });
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

    // Look up the seat request to know how many seats were requested.
    // Also guard: if this request has already been pushed, do not push again.
    let requestedSeats = 0;
    if (requestId) {
      const { data: sr, error: srErr } = await supabase
        .from("seat_requests")
        .select("requested_seats, terrisage_pushed_at")
        .eq("id", requestId)
        .maybeSingle();
      if (srErr) return json({ error: srErr.message }, 500);
      if (sr?.terrisage_pushed_at) {
        return json(
          {
            pushed: false,
            reason: "ALREADY_PUSHED",
            pushedAt: sr.terrisage_pushed_at,
          },
          200,
        );
      }
      requestedSeats = Number(sr?.requested_seats ?? 0);
    }
    if (!Number.isFinite(requestedSeats) || requestedSeats < 0) {
      return json({ pushed: false, reason: "INVALID_REQUESTED_SEATS" }, 200);
    }

    // Step 1: Sync down — read current allocatedSeats from Terrisage.
    const snapshotUrl =
      BASE_URL.replace(/\/$/, "") +
      `/api/integrations/seats/seat-snapshot?tenantId=${encodeURIComponent(acct.tenant_id)}`;
    console.log("[terrisage-seat-fulfil-sync] fetching CRM snapshot", { snapshotUrl });

    let crmAllocated = 0;
    try {
      const snapRes = await fetch(snapshotUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      });
      const snapText = await snapRes.text();
      if (!snapRes.ok) {
        console.warn("[terrisage-seat-fulfil-sync] snapshot upstream error", {
          status: snapRes.status,
          body: snapText.slice(0, 300),
        });
        return json(
          {
            pushed: false,
            reason: "SNAPSHOT_UPSTREAM_ERROR",
            status: snapRes.status,
            detail: snapText.slice(0, 500),
          },
          200,
        );
      }
      const snap = snapText ? JSON.parse(snapText) : {};
      crmAllocated = Number(snap?.allocatedSeats ?? snap?.allocated ?? 0);
      console.log("[terrisage-seat-fulfil-sync] CRM baseline", { crmAllocated });
    } catch (e) {
      return json(
        { pushed: false, reason: "SNAPSHOT_UNREACHABLE", detail: String(e) },
        200,
      );
    }

    if (!Number.isFinite(crmAllocated) || crmAllocated < 0) crmAllocated = 0;

    // Step 2: New absolute total = CRM baseline + requested.
    const newAllocatedTotal = crmAllocated + requestedSeats;
    console.log("[terrisage-seat-fulfil-sync] computed new total", {
      crmAllocated,
      requestedSeats,
      newAllocatedTotal,
    });

    // Step 3: Update local seats_purchased to stay in sync with CRM.
    const { error: bsErr } = await supabase
      .from("account_billing_settings")
      .update({ seats_purchased: newAllocatedTotal })
      .eq("account_id", accountId);
    if (bsErr) {
      console.error("[terrisage-seat-fulfil-sync] local update failed", bsErr);
      return json({ error: bsErr.message }, 500);
    }

    // Fetch invoiceRef from the paid upsell link tied to this seat request.
    let invoiceRef: string | null = null;
    if (requestId) {
      const { data: upsell } = await supabase
        .from("seat_upsell_links")
        .select("payment_reference, link_id")
        .eq("seat_request_id", requestId)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invoiceRef =
        (upsell?.payment_reference as string | null) ??
        (upsell?.link_id as string | null) ??
        null;
    }

    const idemKey = invoiceRef
      ? `alloc-${acct.tenant_id}-${invoiceRef}`
      : requestId
        ? `fulfil-${accountId}-${requestId}`
        : `fulfil-${accountId}-${newAllocatedTotal}-${Date.now()}`;

    // Step 4: Push the new absolute seat total.
    const url =
      BASE_URL.replace(/\/$/, "") + `/api/integrations/seats/seat-allocation`;

    const payload: Record<string, unknown> = {
      tenantId: acct.tenant_id,
      newAllocatedTotal,
      idempotencyKey: idemKey,
    };
    if (invoiceRef) payload.invoiceRef = invoiceRef;

    console.log("[terrisage-seat-fulfil-sync] pushing allocation", { url, payload });

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify(payload),
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

    // Mark this request as pushed so we never push it twice.
    if (requestId) {
      await supabase
        .from("seat_requests")
        .update({ terrisage_pushed_at: new Date().toISOString() })
        .eq("id", requestId);
    }

    return json({
      pushed: true,
      tenantId: acct.tenant_id,
      crmAllocatedBefore: crmAllocated,
      requestedSeats,
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
