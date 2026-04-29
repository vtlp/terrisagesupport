// Webhook endpoint for the external extraction service to POST results to.
// Expected payload shape:
// { jobId, projectData, configurationData[], floorPlans[], mediaAssets[], documents[],
//   amenities[], proximityMatrix[], approvedBanks[], missingFields[], assumptions[], confidenceWarnings[], errors[] }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-extraction-token',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CALLBACK_TOKEN = Deno.env.get('EXTRACTION_CALLBACK_TOKEN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Optional shared-secret check
  if (CALLBACK_TOKEN) {
    const header = req.headers.get('x-extraction-token');
    if (header !== CALLBACK_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    const body = await req.json();
    const { jobId } = body || {};
    if (!jobId) return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: job } = await admin.from('import_jobs').select('id, kind').eq('id', jobId).maybeSingle();
    if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const hasErrors = Array.isArray(body.errors) && body.errors.length > 0 && !body.projectData;
    if (hasErrors) {
      await admin.from('import_jobs').update({
        status: 'EXTRACTION_FAILED',
        extracted_data: body,
        extraction_finished_at: new Date().toISOString(),
      }).eq('id', jobId);
      await admin.from('import_activity').insert({ job_id: jobId, event: 'extraction_failed', detail: { errors: body.errors } });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('import_jobs').update({ extracted_data: body }).eq('id', jobId);

    // Replace any prior staging rows
    await admin.from('import_project_configs').delete().eq('job_id', jobId);
    await admin.from('import_project_media').delete().eq('job_id', jobId);

    const configRows = (body.configurationData || []).map((d: Record<string, unknown>, i: number) => ({
      job_id: jobId, sort_order: i, data: d, source: 'EXTRACTED',
    }));
    let createdConfigs: Array<{ id: string; sort_order: number }> = [];
    if (configRows.length) {
      const { data } = await admin.from('import_project_configs').insert(configRows).select('id, sort_order');
      createdConfigs = data || [];
    }

    const mediaRows: Array<Record<string, unknown>> = [];
    (body.floorPlans || []).forEach((fp: Record<string, unknown>) => {
      const idx = (fp.config_index as number) ?? -1;
      const cfg = createdConfigs.find((c) => c.sort_order === idx);
      mediaRows.push({
        job_id: jobId, category: 'FLOOR_PLAN', caption: fp.caption,
        storage_path: fp.storage_path, external_url: fp.url,
        config_id: cfg?.id ?? null, confidence: fp.confidence, source: 'EXTRACTED',
      });
    });
    (body.mediaAssets || []).forEach((m: Record<string, unknown>) => {
      mediaRows.push({
        job_id: jobId, category: m.category || 'GALLERY', caption: m.caption,
        storage_path: m.storage_path, external_url: m.url, source: 'EXTRACTED',
      });
    });
    (body.documents || []).forEach((d: Record<string, unknown>) => {
      mediaRows.push({
        job_id: jobId, category: 'DOCUMENT', caption: d.caption,
        storage_path: d.storage_path, external_url: d.url, source: 'EXTRACTED',
      });
    });
    if (mediaRows.length) await admin.from('import_project_media').insert(mediaRows);

    await admin.from('import_jobs').update({
      status: 'NEEDS_REVIEW',
      extraction_finished_at: new Date().toISOString(),
    }).eq('id', jobId);
    await admin.from('import_activity').insert({ job_id: jobId, event: 'extraction_completed', detail: { source: 'callback' } });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
