// Outbound: notify the client CRM when a project_requests row changes status.
// Called from the Support Console (admin actions) or the import-completion path.
// Best-effort: returns 200 even if upstream is unreachable, but logs the failure.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { requireStaffOrService } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { requestId?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'INVALID_BODY' }, 400); }
  const requestId = body.requestId;
  if (!requestId) return json({ ok: false, error: 'MISSING_REQUEST_ID' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pr, error } = await supabase
    .from('project_requests')
    .select('id, account_id, external_request_id, project_name, status, rejection_reason, crm_project_id')
    .eq('id', requestId).maybeSingle();
  if (error || !pr) return json({ ok: false, error: 'REQUEST_NOT_FOUND' }, 404);

  const { data: acct } = await supabase
    .from('accounts').select('tenant_id').eq('id', pr.account_id).maybeSingle();

  const baseUrl = Deno.env.get('TERRISAGE_BASE_URL');
  const apiKey = Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!baseUrl || !apiKey || !acct?.tenant_id) {
    // Nothing to call — record and return.
    await supabase.from('activity_log').insert({
      entity_type: 'account', entity_id: pr.account_id,
      event_type: 'IMPORT',
      summary: `Project request "${pr.project_name}" status: ${pr.status} (CRM sync skipped: missing config)`,
      details: { kind: 'PROJECT_REQUEST_CALLBACK_SKIPPED', request_id: pr.id } as never,
    });
    return json({ ok: true, skipped: true });
  }

  // Map our internal status enum to the vocabulary Terrisage expects on their side.
  const STATUS_TO_TERRISAGE: Record<string, string> = {
    PENDING_REVIEW: 'PENDING_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    IMPORT_IN_PROGRESS: 'PENDING',
    LIVE: 'LIVE',
    CANCELLED: 'CANCELLED',
  };
  const outboundStatus = STATUS_TO_TERRISAGE[pr.status] ?? pr.status;

  const payload = {
    tenantId: acct.tenant_id,
    externalRequestId: pr.external_request_id,
    requestId: pr.id,
    projectName: pr.project_name,
    status: outboundStatus,
    internalStatus: pr.status,
    liveProjectId: pr.crm_project_id,
    rejectionReason: pr.rejection_reason,
    at: new Date().toISOString(),
  };

  let success = false;
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${baseUrl.replace(/\/$/, '')}/api/integrations/projects/request-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(payload),
      });
      if (r.ok) { success = true; break; }
      lastErr = `HTTP ${r.status}`;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }

  await supabase.from('activity_log').insert({
    entity_type: 'account', entity_id: pr.account_id,
    event_type: 'IMPORT',
    summary: success
      ? `CRM notified: project request "${pr.project_name}" → ${pr.status}`
      : `CRM sync FAILED for "${pr.project_name}" → ${pr.status}: ${lastErr}`,
    details: { kind: 'PROJECT_REQUEST_CALLBACK', request_id: pr.id, success, error: success ? null : lastErr } as never,
  });

  return json({ ok: success, error: success ? null : lastErr });
});
