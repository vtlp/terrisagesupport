// Inbound webhook called by the client CRM when an end user requests a new
// project to be onboarded onto the platform after their account is live.
// Creates a `project_requests` row on Support; staff triage it from the
// Account ► Project Requests tab.
//
// Public endpoint. Auth: X-API-Key header (shared secret).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Body {
  externalRequestId?: string;
  tenantId?: string;
  projectName?: string;
  location?: string;
  city?: string;
  representativeName?: string;
  representativePhone?: string;
  representativeEmail?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  requestedAt?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const expected = Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!expected) return json({ ok: false, error: 'INTEGRATION_NOT_CONFIGURED' }, 500);
  const got = req.headers.get('x-api-key') ?? req.headers.get('X-API-Key');
  if (!got || got !== expected) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

  let body: Body;
  try { body = await req.json() as Body; } catch { return json({ ok: false, error: 'INVALID_BODY' }, 400); }

  const tenantId = (body.tenantId ?? '').trim();
  const projectName = (body.projectName ?? '').trim();
  const location = (body.location ?? '').trim();
  if (!tenantId || !projectName || !location) {
    return json({ ok: false, error: 'MISSING_FIELDS', detail: 'tenantId, projectName and location are required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: acct, error: aErr } = await supabase
    .from('accounts').select('id, account_name').eq('tenant_id', tenantId).maybeSingle();
  if (aErr) return json({ ok: false, error: 'DB_ERROR', detail: aErr.message }, 500);
  if (!acct) return json({ ok: false, error: 'TENANT_NOT_FOUND' }, 404);

  const externalId = body.externalRequestId
    ?? req.headers.get('x-idempotency-key')
    ?? null;

  // Idempotency
  if (externalId) {
    const { data: existing } = await supabase
      .from('project_requests').select('id, status')
      .eq('account_id', acct.id).eq('external_request_id', externalId).maybeSingle();
    if (existing) {
      return json({ ok: true, requestId: existing.id, status: existing.status, deduped: true });
    }
  }

  const { data: inserted, error: iErr } = await supabase
    .from('project_requests')
    .insert({
      account_id: acct.id,
      external_request_id: externalId,
      project_name: projectName,
      location,
      city: body.city ?? null,
      representative_name: body.representativeName ?? null,
      representative_phone: body.representativePhone ?? null,
      representative_email: body.representativeEmail ?? null,
      notes: body.notes ?? null,
      payload: (body.payload ?? {}) as never,
      requested_at: body.requestedAt ?? new Date().toISOString(),
    })
    .select('id, status').single();
  if (iErr) return json({ ok: false, error: 'DB_ERROR', detail: iErr.message }, 500);

  // Activity log
  await supabase.from('activity_log').insert({
    entity_type: 'account',
    entity_id: acct.id,
    event_type: 'STATUS_CHANGE',
    summary: `New project request: ${projectName} (${location})`,
    details: { kind: 'PROJECT_REQUEST_CREATED', request_id: inserted.id, project_name: projectName } as never,
  });

  return json({ ok: true, requestId: inserted.id, status: inserted.status });
});
