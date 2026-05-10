// Pulls channel-partner project requests from Terrisage and upserts them
// into public.project_requests, matching by accounts.tenant_id.
// Runs on a schedule (pg_cron) and is also callable manually from the UI.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

type AnyRec = Record<string, unknown>;
const pick = (o: AnyRec | undefined | null, k: string): string | null => {
  if (!o) return null;
  const v = o[k];
  return typeof v === 'string' && v.trim() ? v : null;
};

function mapTerrisageStatus(s: string | null | undefined): { internal: string | null; raw: string | null } {
  const raw = (s ?? '').toUpperCase() || null;
  if (raw === 'PENDING') return { internal: 'PENDING_REVIEW', raw };
  if (raw === 'APPROVED') return { internal: 'APPROVED', raw };
  if (raw === 'REJECTED') return { internal: 'REJECTED', raw };
  return { internal: null, raw };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const baseUrl = Deno.env.get('TERRISAGE_BASE_URL');
  const apiKey = Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!baseUrl || !apiKey) return json({ ok: false, error: 'INTEGRATION_NOT_CONFIGURED' }, 500);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Optional scoping: when called from an account page, only count/upsert
  // requests that belong to that account's tenant.
  let scopeAccountId: string | null = null;
  let scopeTenantId: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = await req.json() as { accountId?: string };
      if (body?.accountId) {
        scopeAccountId = body.accountId;
        const { data: acct } = await supabase
          .from('accounts').select('tenant_id').eq('id', scopeAccountId).maybeSingle();
        scopeTenantId = (acct?.tenant_id as string | null) ?? null;
        if (!scopeTenantId) {
          return json({ ok: true, fetched: 0, upserted: 0, skipped: 0, errors: 0, scoped: true, note: 'Account has no tenant_id linked yet.' });
        }
      }
    } catch { /* no body, treat as global */ }
  }

  let fetched = 0, upserted = 0, skipped = 0, errors = 0;
  const skippedTenants: string[] = [];

  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/api/integrations/project-requests`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    });
    if (!r.ok) {
      const body = await r.text();
      return json({ ok: false, error: `UPSTREAM_${r.status}`, detail: body.slice(0, 500) }, 502);
    }
    const payload = await r.json() as { ok?: boolean; requests?: AnyRec[] };
    let items = Array.isArray(payload.requests) ? payload.requests : [];

    // If scoped to one account, filter upstream items to that tenant before counting.
    if (scopeTenantId) {
      items = items.filter((it) => {
        const t = (it.requestedByTenant ?? {}) as AnyRec;
        const tid = pick(t, 'id') ?? pick(it, 'requestedByTenantId') ?? pick(it, 'tenantId');
        return tid === scopeTenantId;
      });
    }
    fetched = items.length;

    for (const item of items) {
      try {
        const externalRequestId = pick(item, 'id') ?? pick(item, 'externalRequestId') ?? pick(item, 'requestId');
        if (!externalRequestId) { skipped++; continue; }

        const tenant = (item.requestedByTenant ?? {}) as AnyRec;
        const agent = (item.requestedByAgent ?? {}) as AnyRec;
        const approver = (item.approvedByAgent ?? {}) as AnyRec;
        const project = (item.project ?? {}) as AnyRec;

        const tenantId = pick(tenant, 'id') ?? pick(item, 'requestedByTenantId') ?? pick(item, 'tenantId');
        if (!tenantId) { skipped++; continue; }

        // Match account by tenant_id (always require match)
        const { data: acct } = await supabase
          .from('accounts').select('id').eq('tenant_id', tenantId).maybeSingle();
        if (!acct) {
          skipped++;
          if (!skippedTenants.includes(tenantId)) skippedTenants.push(tenantId);
          continue;
        }

        const { internal: mappedInternal, raw: rawStatus } = mapTerrisageStatus(pick(item, 'status'));
        const requestedAt = pick(item, 'requestedAt') ?? pick(item, 'createdAt') ?? new Date().toISOString();
        const approvedAt = pick(item, 'approvedAt');

        // Look up existing row to avoid regressing internal status past PENDING_REVIEW
        const { data: existing } = await supabase
          .from('project_requests')
          .select('id, status')
          .eq('account_id', acct.id)
          .eq('external_request_id', externalRequestId)
          .maybeSingle();

        const baseFields: AnyRec = {
          account_id: acct.id,
          external_request_id: externalRequestId,
          project_name: pick(project, 'name') ?? pick(item, 'projectName') ?? 'Untitled project',
          location: pick(project, 'location') ?? pick(item, 'location'),
          city: pick(project, 'city') ?? pick(item, 'city'),
          notes: pick(project, 'notes') ?? pick(item, 'notes'),
          representative_name: pick(agent, 'name') ?? pick(agent, 'fullName'),
          representative_phone: pick(agent, 'phone'),
          representative_email: pick(agent, 'email'),
          requested_by_tenant_id: tenantId,
          requested_by_agent_id: pick(agent, 'id'),
          requested_by_agent_name: pick(agent, 'name') ?? pick(agent, 'fullName'),
          requested_by_agent_phone: pick(agent, 'phone'),
          requested_by_agent_email: pick(agent, 'email'),
          approved_by_agent_id: pick(approver, 'id'),
          approved_by_agent_name: pick(approver, 'name') ?? pick(approver, 'fullName'),
          approved_at: approvedAt,
          terrisage_status: rawStatus,
          last_synced_at: new Date().toISOString(),
          payload: item as never,
          requested_at: requestedAt,
          rejection_reason: pick(item, 'rejectionReason'),
        };

        if (existing) {
          // Never regress past PENDING_REVIEW; only let APPROVED/REJECTED bump from PENDING_REVIEW.
          const updates: AnyRec = { ...baseFields };
          delete updates.account_id;
          delete updates.external_request_id;
          if (existing.status === 'PENDING_REVIEW' && mappedInternal && mappedInternal !== 'PENDING_REVIEW') {
            updates.status = mappedInternal;
          } else {
            delete (updates as { status?: string }).status;
          }
          const { error: uErr } = await supabase.from('project_requests').update(updates).eq('id', existing.id);
          if (uErr) { errors++; continue; }
        } else {
          const insertRow: AnyRec = { ...baseFields, status: mappedInternal ?? 'PENDING_REVIEW' };
          const { data: created, error: iErr } = await supabase.from('project_requests').insert(insertRow).select('id').single();
          if (iErr) { errors++; continue; }

          // Notify staff (broadcast — user_id null) when a brand-new request lands.
          try {
            const { data: acctRow } = await supabase
              .from('accounts').select('account_name').eq('id', acct.id).maybeSingle();
            const acctName = (acctRow?.account_name as string | undefined) ?? 'Account';
            const projName = (baseFields.project_name as string | null) ?? 'New project';
            const loc = (baseFields.location as string | null) ?? '';
            await supabase.from('notifications').insert({
              type: 'PROJECT_REQUEST',
              severity: 'INFO',
              title: `New project request: ${projName}`,
              body: `${acctName} requested ${projName}${loc ? ` in ${loc}` : ''}.`,
              entity_type: 'account',
              entity_id: acct.id,
              link_path: `/accounts/${acct.id}?tab=projects`,
              dedupe_key: `project_request:${created?.id ?? externalRequestId}`,
            });
          } catch (_) { /* non-fatal */ }
        }
        upserted++;
      } catch (_e) {
        errors++;
      }
    }
  } catch (e) {
    return json({ ok: false, error: 'FETCH_FAILED', detail: (e as Error).message }, 502);
  }

  // Best-effort summary log
  try {
    await supabase.from('activity_log').insert({
      entity_type: 'system',
      entity_id: '00000000-0000-0000-0000-000000000000',
      event_type: 'IMPORT',
      summary: `Terrisage project-requests pull: fetched ${fetched}, upserted ${upserted}, skipped ${skipped}, errors ${errors}`,
      details: { kind: 'PROJECT_REQUESTS_PULL', fetched, upserted, skipped, errors, skipped_tenants: skippedTenants } as never,
    });
  } catch (_) { /* ignore */ }

  return json({ ok: true, fetched, upserted, skipped, errors, skipped_tenants: skippedTenants });
});
