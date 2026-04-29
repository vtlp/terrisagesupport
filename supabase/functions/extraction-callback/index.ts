// HMAC-verified webhook from the external Python extraction worker.
// Replaces the previous token-only version. Persists to the new
// extraction_results table and advances the job state machine.
//
// Headers: x-extraction-timestamp, x-extraction-signature (hex HMAC-SHA256)
// Signature = HMAC_SHA256(EXTRACTION_HMAC_SECRET, `${timestamp}.${rawBody}`)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, jsonResponse, errorResponse, verifySignature } from '../_shared/extraction.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SIGNING_SECRET = Deno.env.get('EXTRACTION_HMAC_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('POST required', 405);

  const rawBody = await req.text();

  // Verify HMAC signature (skip only if no secret configured, which is dev mode)
  if (SIGNING_SECRET) {
    const ts = req.headers.get('x-extraction-timestamp') || '';
    const sig = req.headers.get('x-extraction-signature') || '';
    const v = await verifySignature(SIGNING_SECRET, ts, rawBody, sig);
    if (!v.ok) return errorResponse(`signature invalid: ${v.reason}`, 401);
  }

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(rawBody); } catch { return errorResponse('invalid JSON'); }

  const jobId = body.jobId as string | undefined;
  if (!jobId) return errorResponse('jobId required');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin.from('extraction_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return errorResponse('job not found', 404);

  // ----- Failure path -----
  const errors = (body.errors as unknown[]) || [];
  const projectData = (body.projectData as Record<string, unknown>) || null;
  const fatalFailure = !!body.failed || (Array.isArray(errors) && errors.length > 0 && !projectData);
  if (fatalFailure) {
    await admin.from('extraction_jobs').update({
      status: 'FAILED',
      finished_at: new Date().toISOString(),
      errors_count: Array.isArray(errors) ? errors.length : 1,
      last_error: typeof body.errorMessage === 'string' ? body.errorMessage : 'Worker reported failure',
      result_summary: { failed: true },
    }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({
      job_id: jobId, event_type: 'failed', event_message: 'Worker reported failure',
      metadata: { errors, message: body.errorMessage ?? null },
    });
    return jsonResponse({ ok: true, status: 'FAILED' });
  }

  // ----- Success path: persist normalized result -----
  const configurations = (body.configurationData as unknown[]) || [];
  const floorPlans = (body.floorPlans as unknown[]) || [];
  const mediaAssets = (body.mediaAssets as unknown[]) || [];
  const documents = (body.documents as unknown[]) || [];
  const amenities = (body.amenities as unknown[]) || [];
  const proximity = (body.proximityMatrix as unknown[]) || [];
  const banks = (body.approvedBanks as unknown[]) || [];
  const missing = (body.missingFields as unknown[]) || [];
  const assumptions = (body.assumptions as unknown[]) || [];
  const warnings = (body.confidenceWarnings as unknown[]) || [];
  const plotSuggestions = (body.plotConfigSuggestions as unknown[]) || [];
  const summary = (body.summary as Record<string, unknown>) || {
    propertyType: job.property_type,
    configCount: configurations.length,
    floorPlanCount: floorPlans.length,
    mediaCount: mediaAssets.length,
    documentCount: documents.length,
  };

  await admin.from('extraction_results').upsert({
    job_id: jobId,
    project_data: projectData ?? {},
    configuration_data: configurations,
    floorplans: floorPlans,
    media_assets: mediaAssets,
    documents,
    amenities,
    proximity_matrix: proximity,
    approved_banks: banks,
    missing_fields: missing,
    assumptions,
    confidence_warnings: warnings,
    errors,
    plot_config_suggestions: plotSuggestions,
    raw_ocr: (body.rawOcr as Record<string, unknown>) ?? null,
    summary,
  });

  await admin.from('extraction_jobs').update({
    status: 'NEEDS_REVIEW',
    finished_at: new Date().toISOString(),
    pages_processed: (body.pagesProcessed as number) ?? job.pages_processed ?? 0,
    floorplans_detected: floorPlans.length,
    warnings_count: warnings.length + missing.length,
    errors_count: Array.isArray(errors) ? errors.length : 0,
    result_summary: summary,
  }).eq('id', jobId);

  await admin.from('extraction_activity_log').insert({
    job_id: jobId, event_type: 'needs_review',
    event_message: `Extraction complete: ${configurations.length} configs, ${floorPlans.length} floor plans`,
    metadata: summary,
  });

  return jsonResponse({ ok: true, status: 'NEEDS_REVIEW' });
});
