// Push an import job's source file to Terrisage's onboarding ingestion API.
//
// Body:
//   { action: 'import' | 'poll', accountId, jobId, entityType?: 'leads' | 'properties' }
//
// On 'import':
//   - download the latest CSV/XLSX source file for the job
//   - convert CSV -> XLSX if needed
//   - POST multipart to {TERRISAGE_BASE_URL}/api/support/onboarding/tenants/:tenantId/:entityType/import
//     with X-API-Key + X-Idempotency-Key (entityType:jobId)
//   - persist upstreamJobId / upstreamStatus into import_jobs.summary
//
// On 'poll':
//   - GET .../tenants/:tenantId/import-jobs/:upstreamJobId and mirror status into summary

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type EntityType = 'leads' | 'properties';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { action?: string; accountId?: string; jobId?: string; entityType?: EntityType };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'INVALID_BODY' }, 400); }
  const { action, accountId, jobId } = body;
  if (!action || !accountId || !jobId) return json({ ok: false, error: 'MISSING_FIELDS' }, 400);

  // Auth
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const baseUrl = Deno.env.get('TERRISAGE_BASE_URL');
  const apiKey = Deno.env.get('SUPPORT_ONBOARDING_INGESTION_API_KEY');
  if (!baseUrl || !apiKey) {
    return json({ ok: false, error: 'CONFIGURATION_ERROR', detail: 'TERRISAGE_BASE_URL or SUPPORT_ONBOARDING_INGESTION_API_KEY is not set' }, 500);
  }
  const root = baseUrl.replace(/\/$/, '');

  // Resolve tenant
  const { data: account } = await supabase.from('accounts').select('id, tenant_id').eq('id', accountId).maybeSingle();
  if (!account) return json({ ok: false, error: 'ACCOUNT_NOT_FOUND' }, 404);
  if (!account.tenant_id) return json({ ok: false, error: 'NO_TENANT' });

  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return json({ ok: false, error: 'JOB_NOT_FOUND' }, 404);

  const mergeSummary = async (patch: Record<string, unknown>) => {
    const summary = { ...(job.summary as Record<string, unknown> ?? {}), ...patch };
    await supabase.from('import_jobs').update({ summary: summary as never }).eq('id', jobId);
    return summary;
  };

  if (action === 'poll') {
    const summary = (job.summary ?? {}) as Record<string, unknown>;
    const upstreamJobId = summary.upstreamJobId as string | undefined;
    if (!upstreamJobId) return json({ ok: false, error: 'NO_UPSTREAM_JOB' });
    try {
      const r = await fetch(`${root}/api/support/onboarding/tenants/${account.tenant_id}/import-jobs/${upstreamJobId}`, {
        headers: { 'X-API-Key': apiKey },
      });
      const text = await r.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!r.ok) {
        await mergeSummary({ upstreamPollError: `HTTP ${r.status}: ${text.slice(0, 200)}` });
        return json({ ok: false, error: `HTTP_${r.status}`, detail: text.slice(0, 200) }, 502);
      }
      const status = (data.status as string) || 'PENDING';
      const patch: Record<string, unknown> = {
        upstreamStatus: status,
        upstreamInserted: data.inserted ?? null,
        upstreamTotalRows: data.totalRows ?? null,
        upstreamReport: data,
        upstreamPolledAt: new Date().toISOString(),
      };
      await mergeSummary(patch);
      if (status === 'SUCCEEDED' || status === 'FAILED') {
        await supabase.from('import_activity').insert([{
          job_id: jobId,
          event: status === 'SUCCEEDED' ? 'upstream_succeeded' : 'upstream_failed',
          detail: { upstreamJobId, inserted: data.inserted, totalRows: data.totalRows, failureCode: data.failureCode } as never,
          actor_id: user.id,
        }]);
      }
      return json({ ok: true, status, data });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 502);
    }
  }

  if (action !== 'import') return json({ ok: false, error: 'INVALID_ACTION' }, 400);

  const entityType: EntityType = body.entityType ?? (job.kind === 'SECONDARY_PROPERTY' ? 'properties' : 'leads');

  // Fetch latest source file
  const { data: files } = await supabase.from('import_files')
    .select('*').eq('job_id', jobId).eq('category', 'CSV')
    .order('created_at', { ascending: false }).limit(1);
  if (!files?.length) return json({ ok: false, error: 'NO_SOURCE_FILE' }, 400);
  const file = files[0];

  const { data: dl, error: dlErr } = await supabase.storage.from('import-files').download(file.storage_path);
  if (dlErr || !dl) return json({ ok: false, error: 'DOWNLOAD_FAILED', detail: dlErr?.message }, 500);

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  let xlsxBytes: Uint8Array;
  let uploadName = file.name;

  if (ext === 'xlsx' || ext === 'xls') {
    xlsxBytes = new Uint8Array(await dl.arrayBuffer());
  } else {
    // Convert CSV -> XLSX
    const csvText = await dl.text();
    const wb = XLSX.read(csvText, { type: 'string' });
    // Ensure sheet name matches what Terrisage expects for properties
    const firstSheet = wb.SheetNames[0];
    if (entityType === 'properties' && firstSheet !== 'properties') {
      wb.SheetNames[0] = 'properties';
      wb.Sheets['properties'] = wb.Sheets[firstSheet];
      delete wb.Sheets[firstSheet];
    }
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    xlsxBytes = new Uint8Array(out);
    uploadName = file.name.replace(/\.csv$/i, '') + '.xlsx';
  }

  const idempotencyKey = `${entityType}:${jobId}`;

  // Compute SHA-256 (informational — server stores its own, used for replay)
  const digest = await crypto.subtle.digest('SHA-256', xlsxBytes);
  const sha = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

  const form = new FormData();
  form.append('file', new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), uploadName);

  const url = `${root}/api/support/onboarding/tenants/${account.tenant_id}/${entityType}/import`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'X-Idempotency-Key': idempotencyKey },
      body: form,
    });
  } catch (e) {
    await mergeSummary({ upstreamError: (e as Error).message, upstreamSubmittedAt: new Date().toISOString() });
    return json({ ok: false, error: 'NETWORK', detail: (e as Error).message }, 502);
  }

  const text = await r.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (r.status === 202 || r.status === 200) {
    const upstreamJobId = (data.jobId as string) ?? null;
    await mergeSummary({
      upstreamJobId,
      upstreamStatus: 'PENDING',
      upstreamEntityType: entityType,
      upstreamIdempotencyKey: idempotencyKey,
      upstreamSha256: sha,
      upstreamSubmittedAt: new Date().toISOString(),
      upstreamError: null,
    });
    await supabase.from('import_activity').insert([{
      job_id: jobId, event: 'upstream_submitted',
      detail: { entityType, upstreamJobId, idempotencyKey, tenantId: account.tenant_id } as never,
      actor_id: user.id,
    }]);
    return json({ ok: true, upstreamJobId, replayed: false });
  }

  // Error path
  const errorCode = (data.error as string) || `HTTP_${r.status}`;
  await mergeSummary({
    upstreamError: `${errorCode}: ${text.slice(0, 300)}`,
    upstreamSubmittedAt: new Date().toISOString(),
  });
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'upstream_submit_failed',
    detail: { status: r.status, errorCode, body: text.slice(0, 500) } as never,
    actor_id: user.id,
  }]);
  return json({ ok: false, error: errorCode, status: r.status, detail: text.slice(0, 300) }, r.status >= 500 ? 502 : 400);
});
