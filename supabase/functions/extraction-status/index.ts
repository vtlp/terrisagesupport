// GET /extraction-status?jobId=...  → returns job + activity log + file count.
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
  const [{ data: job }, { data: files }, { data: activity }] = await Promise.all([
    admin.from('extraction_jobs').select('*').eq('id', jobId).maybeSingle(),
    admin.from('extraction_files').select('id, file_name, file_type, size_bytes, page_count, uploaded_at').eq('job_id', jobId),
    admin.from('extraction_activity_log').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(50),
  ]);
  if (!job) return errorResponse('job not found', 404);
  return jsonResponse({ job, files: files ?? [], activity: activity ?? [] });
});
