// Terrisage usage sync — pulls latest usage data from Terrisage CRM
// for all linked accounts (or one account if accountId is provided)
// and upserts snapshots into account_usage_snapshots.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaffOrService } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncBody {
  accountId?: string;
  days?: number; // how many days back to fetch (default 30)
}

interface DayPayload {
  date: string;
  dau?: number;
  wau?: number;
  mau?: number;
  sessions?: number;
  leadsCreated?: number;
  followUps?: number;
  conversions?: number;
  tasksCompleted?: number;
  lastActiveAt?: string | null;
  // Per-feature adoption percentages (0-100). Optional.
  featureUsage?: Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const days = Math.min(Math.max(body.days ?? 30, 1), 365);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BASE_URL = Deno.env.get("TERRISAGE_BASE_URL");
    const API_KEY = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const auth = await requireStaffOrService(req, supabase);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    if (!BASE_URL || !API_KEY) {
      return json({ synced: 0, reason: "INTEGRATION_NOT_CONFIGURED" }, 200);
    }

    // Build list of accounts to sync
    let query = supabase
      .from("accounts")
      .select("id, tenant_id")
      .not("tenant_id", "is", null);
    if (body.accountId) query = query.eq("id", body.accountId);

    const { data: accounts, error: acctErr } = await query;
    if (acctErr) return json({ error: acctErr.message }, 500);
    if (!accounts || accounts.length === 0) {
      return json({ synced: 0, reason: "NO_LINKED_ACCOUNTS" }, 200);
    }

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const allRows: Record<string, unknown>[] = [];
    const errors: { tenantId: string; reason: string }[] = [];
    let accountsSynced = 0;

    for (const acct of accounts) {
      const url =
        BASE_URL.replace(/\/$/, "") +
        `/api/integrations/usage/summary?tenantId=${encodeURIComponent(
          acct.tenant_id!,
        )}&from=${fromStr}&to=${toStr}`;

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
        errors.push({ tenantId: acct.tenant_id!, reason: `unreachable: ${e}` });
        continue;
      }

      if (!upstream.ok) {
        errors.push({
          tenantId: acct.tenant_id!,
          reason: `HTTP ${upstream.status}`,
        });
        continue;
      }

      let payload: { days?: DayPayload[] } = {};
      try {
        payload = await upstream.json();
      } catch {
        errors.push({ tenantId: acct.tenant_id!, reason: "invalid JSON" });
        continue;
      }

      if (!Array.isArray(payload.days)) {
        errors.push({ tenantId: acct.tenant_id!, reason: "no days array" });
        continue;
      }

      for (const d of payload.days) {
        if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
        allRows.push({
          account_id: acct.id,
          snapshot_date: d.date,
          dau: num(d.dau),
          wau: num(d.wau),
          mau: num(d.mau),
          sessions: num(d.sessions),
          leads_created: num(d.leadsCreated),
          follow_ups: num(d.followUps),
          conversions: num(d.conversions),
          tasks_completed: num(d.tasksCompleted),
          last_active_at: d.lastActiveAt ?? null,
          feature_usage: sanitiseFeatureUsage(d.featureUsage),
          source: "terrisage",
          updated_at: new Date().toISOString(),
        });
      }
      accountsSynced++;
    }

    if (allRows.length > 0) {
      const { error: upErr } = await supabase
        .from("account_usage_snapshots")
        .upsert(allRows, { onConflict: "account_id,snapshot_date" });
      if (upErr) return json({ error: upErr.message }, 500);
    }

    return json({
      synced: accountsSynced,
      rows: allRows.length,
      errors,
      from: fromStr,
      to: toStr,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const FEATURE_KEYS = [
  "enquiry_capture",
  "convert_to_lead",
  "manual_leads",
  "creating_tasks",
  "task_types",
  "channel_partner",
] as const;

function sanitiseFeatureUsage(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const key of FEATURE_KEYS) {
    const raw = src[key];
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
    if (Number.isFinite(n)) {
      out[key] = Math.max(0, Math.min(100, Math.round(n)));
    }
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
