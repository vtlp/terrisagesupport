// Terrisage usage ingest — accepts daily snapshot pushes from Terrisage CRM.
// Auth: X-API-Key header must match SEAT_SUPPORT_INTEGRATION_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SnapshotPayload {
  tenantId: string;
  snapshotDate: string; // YYYY-MM-DD
  dau?: number;
  wau?: number;
  mau?: number;
  sessions?: number;
  leadsCreated?: number;
  followUps?: number;
  conversions?: number;
  tasksCompleted?: number;
  lastActiveAt?: string | null;
  // Per-feature adoption percentages (0-100). Keys:
  //   enquiry_capture, convert_to_lead, manual_leads,
  //   creating_tasks, task_types, channel_partner
  featureUsage?: Record<string, number>;
}

interface IngestBody {
  snapshots: SnapshotPayload[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedKey = Deno.env.get("SEAT_SUPPORT_INTEGRATION_API_KEY");
  const providedKey = req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
  if (!expectedKey || providedKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || !Array.isArray(body.snapshots)) {
    return json({ error: "snapshots array required" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve tenant_id → account_id once (batch)
  const tenantIds = [...new Set(body.snapshots.map((s) => s.tenantId).filter(Boolean))];
  if (tenantIds.length === 0) {
    return json({ accepted: 0, skipped: 0, errors: ["No tenantIds provided"] }, 200);
  }

  const { data: accounts, error: acctErr } = await supabase
    .from("accounts")
    .select("id, tenant_id")
    .in("tenant_id", tenantIds);

  if (acctErr) return json({ error: acctErr.message }, 500);

  const tenantToAccount = new Map<string, string>();
  for (const a of accounts ?? []) {
    if (a.tenant_id) tenantToAccount.set(a.tenant_id, a.id);
  }

  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const s of body.snapshots) {
    const accountId = tenantToAccount.get(s.tenantId);
    if (!accountId) {
      skipped++;
      errors.push(`Unknown tenantId: ${s.tenantId}`);
      continue;
    }
    if (!s.snapshotDate || !/^\d{4}-\d{2}-\d{2}$/.test(s.snapshotDate)) {
      skipped++;
      errors.push(`Invalid snapshotDate for tenant ${s.tenantId}`);
      continue;
    }
    rows.push({
      account_id: accountId,
      snapshot_date: s.snapshotDate,
      dau: num(s.dau),
      wau: num(s.wau),
      mau: num(s.mau),
      sessions: num(s.sessions),
      leads_created: num(s.leadsCreated),
      follow_ups: num(s.followUps),
      conversions: num(s.conversions),
      tasks_completed: num(s.tasksCompleted),
      last_active_at: s.lastActiveAt ?? null,
      source: "terrisage",
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    return json({ accepted: 0, skipped, errors }, 200);
  }

  const { error: upErr } = await supabase
    .from("account_usage_snapshots")
    .upsert(rows, { onConflict: "account_id,snapshot_date" });

  if (upErr) return json({ error: upErr.message, accepted: 0, skipped, errors }, 500);

  return json({ accepted: rows.length, skipped, errors }, 200);
});

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
