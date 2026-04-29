// Retry a FAILED or NEEDS_REVIEW extraction job by chaining into extraction-start.
// POST { jobId }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, jsonResponse, errorResponse, getBearer } from '../_shared/extraction.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('POST required', 405);

  const token = getBearer(req);
  if (!token) return errorResponse('Unauthorized', 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims) return errorResponse('Unauthorized', 401);
  const userId = claims.claims.sub as string;

  const body = await req.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;
  if (!jobId) return errorResponse('jobId required');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin.from('extraction_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return errorResponse('job not found', 404);

  if (!['FAILED', 'NEEDS_REVIEW'].includes(job.status)) {
    return errorResponse(`cannot retry from status ${job.status}`, 409);
  }

  await admin.from('extraction_jobs').update({
    status: 'DRAFT', // reset so extraction-start can re-queue
    retry_count: (job.retry_count ?? 0) + 1,
    last_error: null,
    finished_at: null,
  }).eq('id', jobId);
  await admin.from('extraction_activity_log').insert({
    job_id: jobId, event_type: 'retry_requested',
    event_message: `Retry #${(job.retry_count ?? 0) + 1}`, actor_id: userId,
  });

  // Forward to extraction-start
  const startResp = await fetch(`${SUPABASE_URL}/functions/v1/extraction-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jobId }),
  });
  const startBody = await startResp.text();
  return new Response(startBody, {
    status: startResp.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
