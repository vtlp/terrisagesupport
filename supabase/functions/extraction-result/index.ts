// GET /extraction-result?jobId=... → returns the normalized result payload.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, jsonResponse, errorResponse, getBearer } from '../_shared/extraction.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = getBearer(req);
  if (!token) return errorResponse('Unauthorized', 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims) return errorResponse('Unauthorized', 401);

  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) return errorResponse('jobId required');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const [{ data: job }, { data: result }] = await Promise.all([
    admin.from('extraction_jobs').select('id, status, property_type, simulate_mode, result_summary, warnings_count, errors_count, floorplans_detected, started_at, finished_at').eq('id', jobId).maybeSingle(),
    admin.from('extraction_results').select('*').eq('job_id', jobId).maybeSingle(),
  ]);
  if (!job) return errorResponse('job not found', 404);

  return jsonResponse({
    jobId,
    status: job.status,
    summary: job.result_summary,
    propertyType: job.property_type,
    simulateMode: job.simulate_mode,
    warningsCount: job.warnings_count,
    errorsCount: job.errors_count,
    floorPlansDetected: job.floorplans_detected,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    projectData: result?.project_data ?? {},
    configurations: result?.configuration_data ?? [],
    floorPlans: result?.floorplans ?? [],
    mediaAssets: result?.media_assets ?? [],
    documents: result?.documents ?? [],
    amenities: result?.amenities ?? [],
    proximityMatrix: result?.proximity_matrix ?? [],
    approvedBanks: result?.approved_banks ?? [],
    missingFields: result?.missing_fields ?? [],
    assumptions: result?.assumptions ?? [],
    confidenceWarnings: result?.confidence_warnings ?? [],
    errors: result?.errors ?? [],
    plotConfigSuggestions: result?.plot_config_suggestions ?? [],
  });
});
