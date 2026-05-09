// Outbound: push a fully-reviewed project (from a "global" import job, no account)
// directly to Terrisage's independent Project entity.
//
// Body: { jobId: string }
// Reads the import job + its configs + media, posts a single payload to
//   POST {TERRISAGE_BASE_URL}/api/integrations/projects
// with the shared X-API-Key. On success, marks the job IMPORTED and stamps
// the returned terrisage project id into job.summary.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { jobId?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'INVALID_BODY' }, 400); }
  const jobId = body.jobId;
  if (!jobId) return json({ ok: false, error: 'MISSING_JOB_ID' }, 400);

  // Auth: must be a signed-in staff user.
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

  const { data: job, error: jErr } = await supabase
    .from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (jErr || !job) return json({ ok: false, error: 'JOB_NOT_FOUND' }, 404);
  if (job.kind !== 'PROJECT') return json({ ok: false, error: 'NOT_A_PROJECT_JOB' }, 400);

  const [{ data: configs }, { data: media }] = await Promise.all([
    supabase.from('import_project_configs').select('*').eq('job_id', jobId).order('sort_order'),
    supabase.from('import_project_media').select('*').eq('job_id', jobId).order('created_at'),
  ]);

  const extracted = (job.extracted_data ?? {}) as Record<string, unknown>;
  const projectData = (extracted.projectData ?? {}) as Record<string, unknown>;

  // Sign storage paths so Terrisage can fetch images for ~24h.
  const mediaPayload: Array<Record<string, unknown>> = [];
  for (const m of (media ?? [])) {
    if (m.review_state === 'INCORRECT' || m.review_state === 'DUPLICATE') continue;
    let url = m.external_url ?? null;
    if (!url && m.storage_path) {
      const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(m.storage_path, 60 * 60 * 24);
      url = signed?.signedUrl ?? null;
    }
    mediaPayload.push({
      category: m.category,
      url,
      caption: m.caption,
      configRef: m.config_id ?? null,
      meta: m.meta ?? {},
    });
  }

  const payload = {
    sourceJobId: job.id,
    propertyType: job.property_type,
    project: {
      ...projectData,
      amenities: extracted.amenities ?? [],
      proximityMatrix: extracted.proximityMatrix ?? [],
      approvedBanks: extracted.approvedBanks ?? [],
      representative: job.representative_input ?? {},
    },
    configurations: (configs ?? []).map(c => ({ ref: c.id, sortOrder: c.sort_order, data: c.data })),
    media: mediaPayload,
    pushedAt: new Date().toISOString(),
    pushedBy: user.id,
  };

  const baseUrl = Deno.env.get('TERRISAGE_BASE_URL');
  const apiKey = Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!baseUrl || !apiKey) {
    return json({ ok: false, error: 'TERRISAGE_NOT_CONFIGURED', detail: 'TERRISAGE_BASE_URL or SEAT_SUPPORT_INTEGRATION_API_KEY is not set' }, 500);
  }

  let success = false;
  let lastErr = '';
  let response: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${baseUrl.replace(/\/$/, '')}/api/integrations/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      try { response = JSON.parse(text); } catch { response = { raw: text }; }
      if (r.ok) { success = true; break; }
      lastErr = `HTTP ${r.status}: ${text.slice(0, 200)}`;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }

  if (success) {
    const r = response as { projectId?: string; id?: string } | null;
    const liveId = r?.projectId ?? r?.id ?? null;
    await supabase.from('import_jobs').update({
      status: 'IMPORTED',
      imported_at: new Date().toISOString(),
      records_imported: 1 + (configs?.length ?? 0) + mediaPayload.length,
      records_total: 1 + (configs?.length ?? 0) + mediaPayload.length,
      summary: { terrisage_project_id: liveId, configs: configs?.length ?? 0, media: mediaPayload.length, response } as never,
    }).eq('id', jobId);
    await supabase.from('import_activity').insert([{
      job_id: jobId, event: 'pushed_to_terrisage',
      detail: { terrisage_project_id: liveId } as never, actor_id: user.id,
    }]);
    return json({ ok: true, terrisageProjectId: liveId, response });
  }

  await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', jobId);
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'push_to_terrisage_failed',
    detail: { error: lastErr } as never, actor_id: user.id,
  }]);
  return json({ ok: false, error: lastErr || 'PUSH_FAILED' }, 502);
});
