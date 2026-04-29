// Register already-uploaded files against an extraction job.
// Files are uploaded directly to the `extraction-files` bucket from the client
// (so we don't have to stream large brochures through the edge function).
// POST { jobId, files: [{ fileName, storagePath, fileType, mimeType?, sizeBytes?, pageCount? }] }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, jsonResponse, errorResponse, getBearer } from '../_shared/extraction.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_TYPES = ['BROCHURE','LAYOUT','IMAGE','VIDEO','ADDITIONAL_DOCUMENT','OTHER'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('POST required', 405);

  const token = getBearer(req);
  if (!token) return errorResponse('Unauthorized', 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims) return errorResponse('Unauthorized', 401);
  const userId = claims.claims.sub as string;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return errorResponse('invalid JSON'); }

  const jobId = body.jobId as string | undefined;
  const files = body.files as Array<Record<string, unknown>> | undefined;
  if (!jobId || !Array.isArray(files) || files.length === 0) {
    return errorResponse('jobId and files[] required');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job, error: jErr } = await admin.from('extraction_jobs').select('id, status').eq('id', jobId).maybeSingle();
  if (jErr || !job) return errorResponse('job not found', 404);

  const rows = files.map((f) => {
    const ft = String(f.fileType ?? 'OTHER').toUpperCase();
    return {
      job_id: jobId,
      file_name: String(f.fileName ?? 'unknown'),
      storage_path: String(f.storagePath ?? ''),
      file_type: VALID_TYPES.includes(ft) ? ft : 'OTHER',
      mime_type: (f.mimeType as string) ?? null,
      size_bytes: (f.sizeBytes as number) ?? null,
      page_count: (f.pageCount as number) ?? null,
      uploaded_by: userId,
    };
  }).filter((r) => r.storage_path);

  if (rows.length === 0) return errorResponse('no valid files (storagePath required)');

  const { data: inserted, error: iErr } = await admin.from('extraction_files').insert(rows).select('*');
  if (iErr) return errorResponse(iErr.message, 500);

  await admin.from('extraction_activity_log').insert({
    job_id: jobId,
    event_type: 'files_registered',
    event_message: `${inserted.length} file(s) registered`,
    metadata: { count: inserted.length, types: rows.map((r) => r.file_type) },
    actor_id: userId,
  });

  return jsonResponse({ files: inserted });
});
