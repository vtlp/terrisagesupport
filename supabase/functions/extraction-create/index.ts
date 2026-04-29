// Create a new extraction job (status = DRAFT).
// POST { accountId, importType?, propertyType?, tenancyType?, simulateMode?, label? }
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

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims) return errorResponse('Unauthorized', 401);
  const userId = claims.claims.sub as string;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return errorResponse('invalid JSON'); }

  const accountId = body.accountId as string | undefined;
  if (!accountId) return errorResponse('accountId required');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job, error } = await admin.from('extraction_jobs').insert({
    account_id: accountId,
    tenancy_type: (body.tenancyType as string) ?? null,
    import_type: (body.importType as string) ?? 'PROJECT',
    property_type: (body.propertyType as string) ?? null,
    simulate_mode: !!body.simulateMode,
    status: 'DRAFT',
    created_by: userId,
    result_summary: { label: body.label ?? null },
  }).select('*').single();

  if (error) return errorResponse(error.message, 500);

  await admin.from('extraction_activity_log').insert({
    job_id: job.id,
    event_type: 'job_created',
    event_message: `Extraction job created (simulate=${job.simulate_mode})`,
    metadata: { property_type: job.property_type, simulate: job.simulate_mode },
    actor_id: userId,
  });

  return jsonResponse({ job });
});
