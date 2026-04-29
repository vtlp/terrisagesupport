// Start extraction: signs URLs for every registered file, dispatches HMAC-signed
// payload to the external worker (or runs the simulate path). Always returns 202.
// POST { jobId, propertyType? } (propertyType overrides job's stored hint)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, jsonResponse, errorResponse, getBearer, signPayload, canTransition } from '../_shared/extraction.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WORKER_URL = Deno.env.get('EXTRACTION_SERVICE_URL'); // e.g. https://my-worker.fly.dev
const SIGNING_SECRET = Deno.env.get('EXTRACTION_HMAC_SECRET') || ''; // shared with worker
const SIGNED_URL_TTL = 60 * 60; // 1 hour

function callbackUrl(): string {
  // Public callback endpoint of this Lovable project
  return `${SUPABASE_URL}/functions/v1/extraction-callback`;
}

async function buildSyntheticResult(propertyType: string | null) {
  const pt = (propertyType || 'APARTMENT').toUpperCase();
  return {
    projectData: {
      project_name: 'Sample Greens',
      builder_name: 'Sample Developers Pvt Ltd',
      city: 'Hyderabad',
      address: 'Plot 12, Madhapur, Hyderabad, Telangana 500081',
      rera_id: 'P02400001234',
      status: 'Under Construction',
      open_space_pct: 65,
      site_area: '8.4', site_area_unit: 'acres',
      community_type: 'Gated', approach_road_width: '60 ft',
      water_sources: ['Borewell','Municipal'],
      utilities: ['Power backup','STP'],
      expected_completion_date: '2027-06-30', possession_date: '2027-09-30',
      total_units: 420, website: 'https://example.com',
      overview: 'A premium gated community offering modern living with extensive amenities.',
      key_features: ['Clubhouse','Swimming pool','Landscaped gardens'],
    },
    configurationData: pt === 'PLOT' ? [
      { name: '150 sq.yd', plot_size_band: '120-180', plot_area: '150', dimensions: '30x45', units_planned: 60, facing: 'East' },
      { name: '200 sq.yd', plot_size_band: '180-240', plot_area: '200', dimensions: '30x60', units_planned: 40, facing: 'North' },
    ] : pt === 'VILLA' ? [
      { name: '4 BHK Villa', bhk: 4, land_area: '300 sq.yd', built_up_area: '3200', floors: 2, bathrooms: 5, units_planned: 24, facing: 'East' },
    ] : [
      { name: '2 BHK', bhk: 2, carpet_area: '950', built_up_area: '1180', super_built_up_area: '1280', balconies: 2, bathrooms: 2, facing: 'East', units_planned: 120 },
      { name: '3 BHK', bhk: 3, carpet_area: '1380', built_up_area: '1620', super_built_up_area: '1780', balconies: 3, bathrooms: 3, facing: 'East', units_planned: 200 },
    ],
    floorPlans: [
      { caption: '2 BHK Floor Plan', config_index: 0, confidence: 0.92, source_page_no: 4, crop_type: 'page-region', state: 'detected' },
      { caption: '3 BHK Floor Plan', config_index: 1, confidence: 0.87, source_page_no: 5, crop_type: 'page-region', state: 'detected' },
    ],
    mediaAssets: [
      { category: 'GALLERY', caption: 'Project elevation' },
      { category: 'GALLERY', caption: 'Clubhouse rendering' },
      { category: 'LOGO', caption: 'Builder logo' },
    ],
    documents: [{ caption: 'RERA approval' }, { caption: 'Master plan' }],
    amenities: ['Swimming pool','Gym','Clubhouse',"Children's play area",'Yoga deck','24x7 security'],
    proximityMatrix: [
      { name: 'IKEA Hyderabad', distance_km: 1.2 },
      { name: 'HITEC City Metro', distance_km: 2.4 },
      { name: 'Inorbit Mall', distance_km: 3.1 },
    ],
    approvedBanks: ['HDFC','SBI','ICICI','Axis'],
    missingFields: [
      { entity_type: 'project', field_name: 'internal_road_widths', reason: 'not present in brochure', requires_review: true },
    ],
    assumptions: [
      { entity_type: 'project', field_name: 'possession_date', reason: 'inferred from brochure copy', confidence: 0.7 },
    ],
    confidenceWarnings: [
      { entity_type: 'project', field_name: 'approach_road_width', confidence: 0.55, reason: 'low-resolution page' },
    ],
    errors: [],
    plotConfigSuggestions: pt === 'PLOT' ? [
      { family: 'Standard', plot_area_band: '120-180', count: 60 },
      { family: 'Premium', plot_area_band: '180-240', count: 40 },
    ] : [],
    summary: { propertyType: pt, configCount: pt === 'PLOT' ? 2 : pt === 'VILLA' ? 1 : 2, floorPlanCount: pt === 'PLOT' ? 0 : 2, mediaCount: 3, documentCount: 2 },
  };
}

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
  if (!jobId) return errorResponse('jobId required');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job, error: jErr } = await admin.from('extraction_jobs').select('*').eq('id', jobId).maybeSingle();
  if (jErr || !job) return errorResponse('job not found', 404);

  const fromStatus = job.status as string;
  if (!canTransition(fromStatus as never, 'QUEUED' as never) && !canTransition(fromStatus as never, 'EXTRACTING' as never)) {
    return errorResponse(`cannot start from status ${fromStatus}`, 409);
  }

  // Allow caller to override property_type
  const overridePropType = (body.propertyType as string)?.toUpperCase();
  const propertyType = overridePropType || job.property_type || 'APARTMENT';

  // Move to QUEUED, then PREPROCESSING
  await admin.from('extraction_jobs').update({
    status: 'QUEUED',
    property_type: propertyType,
    started_at: new Date().toISOString(),
    last_error: null,
  }).eq('id', jobId);
  await admin.from('extraction_activity_log').insert({
    job_id: jobId, event_type: 'queued', event_message: 'Job queued for extraction',
    metadata: { simulate: job.simulate_mode, property_type: propertyType }, actor_id: userId,
  });

  // -------- SIMULATE MODE --------
  if (job.simulate_mode) {
    await admin.from('extraction_jobs').update({ status: 'PREPROCESSING' }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({ job_id: jobId, event_type: 'preprocessing', event_message: 'Simulated preprocessing' });

    await admin.from('extraction_jobs').update({ status: 'EXTRACTING' }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({ job_id: jobId, event_type: 'extracting', event_message: 'Simulated extraction' });

    const synthetic = await buildSyntheticResult(propertyType);
    await admin.from('extraction_results').upsert({
      job_id: jobId,
      project_data: synthetic.projectData,
      configuration_data: synthetic.configurationData,
      floorplans: synthetic.floorPlans,
      media_assets: synthetic.mediaAssets,
      documents: synthetic.documents,
      amenities: synthetic.amenities,
      proximity_matrix: synthetic.proximityMatrix,
      approved_banks: synthetic.approvedBanks,
      missing_fields: synthetic.missingFields,
      assumptions: synthetic.assumptions,
      confidence_warnings: synthetic.confidenceWarnings,
      errors: synthetic.errors,
      plot_config_suggestions: synthetic.plotConfigSuggestions,
      summary: synthetic.summary,
    });
    await admin.from('extraction_jobs').update({
      status: 'NEEDS_REVIEW',
      finished_at: new Date().toISOString(),
      result_summary: synthetic.summary,
      warnings_count: synthetic.confidenceWarnings.length + synthetic.missingFields.length,
      errors_count: synthetic.errors.length,
      floorplans_detected: synthetic.floorPlans.length,
    }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({
      job_id: jobId, event_type: 'needs_review', event_message: 'Simulated extraction complete',
      metadata: synthetic.summary,
    });
    return jsonResponse({ ok: true, simulated: true, status: 'NEEDS_REVIEW' }, 202);
  }

  // -------- REAL WORKER PATH --------
  // Sign URLs for every registered file
  const { data: files } = await admin.from('extraction_files').select('*').eq('job_id', jobId);
  const signedFiles: Array<Record<string, unknown>> = [];
  for (const f of files || []) {
    const { data: signed, error: sErr } = await admin.storage
      .from('extraction-files')
      .createSignedUrl(f.storage_path, SIGNED_URL_TTL);
    if (sErr) {
      await admin.from('extraction_activity_log').insert({
        job_id: jobId, event_type: 'sign_url_failed', event_message: sErr.message, metadata: { storage_path: f.storage_path },
      });
      continue;
    }
    signedFiles.push({
      id: f.id,
      fileName: f.file_name,
      fileType: f.file_type,
      mimeType: f.mime_type,
      sizeBytes: f.size_bytes,
      pageCount: f.page_count,
      signedUrl: signed.signedUrl,
    });
  }

  if (signedFiles.length === 0) {
    await admin.from('extraction_jobs').update({
      status: 'FAILED', finished_at: new Date().toISOString(), last_error: 'No files registered',
      errors_count: 1,
    }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({ job_id: jobId, event_type: 'failed', event_message: 'No files to process' });
    return errorResponse('no files registered', 400);
  }

  if (!WORKER_URL) {
    await admin.from('extraction_jobs').update({
      status: 'FAILED', finished_at: new Date().toISOString(),
      last_error: 'EXTRACTION_SERVICE_URL not configured. Enable simulate_mode or deploy the worker.',
      errors_count: 1,
    }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({
      job_id: jobId, event_type: 'failed', event_message: 'Worker URL not configured',
    });
    return errorResponse('EXTRACTION_SERVICE_URL not configured', 503);
  }

  const payload = {
    jobId,
    accountId: job.account_id,
    importType: job.import_type,
    propertyType,
    files: signedFiles,
    callbackUrl: callbackUrl(),
    issuedAt: Math.floor(Date.now() / 1000),
  };
  const rawBody = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  let signature = '';
  if (SIGNING_SECRET) signature = await signPayload(SIGNING_SECRET, ts, rawBody);

  await admin.from('extraction_jobs').update({ status: 'PREPROCESSING' }).eq('id', jobId);
  await admin.from('extraction_activity_log').insert({
    job_id: jobId, event_type: 'preprocessing', event_message: `Dispatched ${signedFiles.length} file(s) to worker`,
    metadata: { worker_url: WORKER_URL, file_count: signedFiles.length },
  });

  // Fire-and-forget dispatch (worker is async; it will POST callback later)
  try {
    const resp = await fetch(`${WORKER_URL.replace(/\/$/, '')}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extraction-timestamp': ts,
        'x-extraction-signature': signature,
      },
      body: rawBody,
    });
    const respText = await resp.text();
    if (!resp.ok) {
      await admin.from('extraction_jobs').update({
        status: 'FAILED', finished_at: new Date().toISOString(),
        last_error: `Worker returned ${resp.status}: ${respText.slice(0, 200)}`,
        errors_count: 1,
      }).eq('id', jobId);
      await admin.from('extraction_activity_log').insert({
        job_id: jobId, event_type: 'failed', event_message: 'Worker dispatch failed',
        metadata: { status: resp.status, body: respText.slice(0, 500) },
      });
      return errorResponse('worker dispatch failed', 502, { workerStatus: resp.status, workerBody: respText.slice(0, 500) });
    }
    let workerRef: string | null = null;
    try { workerRef = JSON.parse(respText)?.workerJobId ?? null; } catch { /* ignore */ }
    await admin.from('extraction_jobs').update({
      status: 'EXTRACTING', worker_job_ref: workerRef,
    }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({
      job_id: jobId, event_type: 'extracting', event_message: 'Worker accepted job', metadata: { workerRef },
    });
  } catch (e) {
    await admin.from('extraction_jobs').update({
      status: 'FAILED', finished_at: new Date().toISOString(),
      last_error: `Worker unreachable: ${(e as Error).message}`, errors_count: 1,
    }).eq('id', jobId);
    await admin.from('extraction_activity_log').insert({
      job_id: jobId, event_type: 'failed', event_message: 'Worker unreachable', metadata: { error: (e as Error).message },
    });
    return errorResponse('worker unreachable', 502);
  }

  return jsonResponse({ ok: true, status: 'EXTRACTING', simulated: false }, 202);
});
