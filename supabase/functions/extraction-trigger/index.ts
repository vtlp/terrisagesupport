// Triggers extraction for a Project import job.
// - If EXTRACTION_SERVICE_URL secret is set, POSTs job context to it (real service).
// - Otherwise (or when ?mock=1), generates a synthetic payload and writes it directly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SERVICE_URL = Deno.env.get('EXTRACTION_SERVICE_URL');
const SERVICE_TOKEN = Deno.env.get('EXTRACTION_SERVICE_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function syntheticExtraction(propertyType: string | null) {
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
      site_area: '8.4',
      site_area_unit: 'acres',
      community_type: 'Gated',
      approach_road_width: '60 ft',
      water_sources: ['Borewell', 'Municipal'],
      utilities: ['Power backup', 'STP'],
      expected_completion_date: '2027-06-30',
      possession_date: '2027-09-30',
      total_units: 420,
      website: 'https://example.com',
      overview: 'A premium gated community offering modern living with extensive amenities.',
      key_features: ['Clubhouse', 'Swimming pool', 'Landscaped gardens'],
    },
    configurationData: pt === 'PLOT'
      ? [
          { name: '150 sq.yd', plot_size_band: '120-180', plot_area: '150', dimensions: '30x45', units_planned: 60, facing: 'East' },
          { name: '200 sq.yd', plot_size_band: '180-240', plot_area: '200', dimensions: '30x60', units_planned: 40, facing: 'North' },
        ]
      : pt === 'VILLA'
      ? [
          { name: '4 BHK Villa', bhk: 4, land_area: '300 sq.yd', built_up_area: '3200', floors: 2, bathrooms: 5, units_planned: 24, facing: 'East' },
        ]
      : [
          { name: '2 BHK', bhk: 2, carpet_area: '950', built_up_area: '1180', super_built_up_area: '1280', balconies: 2, bathrooms: 2, facing: 'East', units_planned: 120 },
          { name: '3 BHK', bhk: 3, carpet_area: '1380', built_up_area: '1620', super_built_up_area: '1780', balconies: 3, bathrooms: 3, facing: 'East', units_planned: 200 },
        ],
    floorPlans: [
      { caption: '2 BHK Floor Plan', config_index: 0, confidence: 0.92 },
      { caption: '3 BHK Floor Plan', config_index: 1, confidence: 0.87 },
    ],
    mediaAssets: [
      { category: 'GALLERY', caption: 'Project elevation' },
      { category: 'GALLERY', caption: 'Clubhouse rendering' },
      { category: 'LOGO', caption: 'Builder logo' },
    ],
    documents: [
      { caption: 'RERA approval' },
      { caption: 'Master plan' },
    ],
    amenities: ['Swimming pool', 'Gym', 'Clubhouse', "Children's play area", 'Yoga deck', '24x7 security'],
    proximityMatrix: [
      { name: 'IKEA Hyderabad', distance_km: 1.2 },
      { name: 'HITEC City Metro', distance_km: 2.4 },
      { name: 'Inorbit Mall', distance_km: 3.1 },
    ],
    approvedBanks: ['HDFC', 'SBI', 'ICICI', 'Axis'],
    missingFields: ['Internal road widths', 'Approved bank list verification'],
    assumptions: ['Possession date inferred from brochure copy'],
    confidenceWarnings: [
      { field: 'approach_road_width', confidence: 0.55, note: 'Read from low-resolution brochure page' },
    ],
    errors: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { jobId, mode } = body || {};
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: job, error: jobErr } = await admin.from('import_jobs').select('*').eq('id', jobId).maybeSingle();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (job.kind !== 'PROJECT') {
      return new Response(JSON.stringify({ error: 'Extraction only available for project imports' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('import_jobs').update({
      status: 'EXTRACTING',
      extraction_started_at: new Date().toISOString(),
    }).eq('id', jobId);
    await admin.from('import_activity').insert({ job_id: jobId, event: 'extraction_triggered', detail: { mode: mode || (SERVICE_URL ? 'live' : 'mock') } });

    const useMock = mode === 'mock' || !SERVICE_URL;

    if (useMock) {
      const payload = syntheticExtraction(job.property_type);
      // Persist extracted_data + create config + media rows
      await admin.from('import_jobs').update({ extracted_data: payload }).eq('id', jobId);

      // configs
      const configRows = (payload.configurationData || []).map((d: Record<string, unknown>, i: number) => ({
        job_id: jobId, sort_order: i, data: d, source: 'EXTRACTED',
      }));
      let createdConfigs: Array<{ id: string; sort_order: number }> = [];
      if (configRows.length) {
        const { data } = await admin.from('import_project_configs').insert(configRows).select('id, sort_order');
        createdConfigs = data || [];
      }

      // floor plans + media
      const mediaRows: Array<Record<string, unknown>> = [];
      (payload.floorPlans || []).forEach((fp: Record<string, unknown>) => {
        const idx = (fp.config_index as number) ?? -1;
        const cfg = createdConfigs.find((c) => c.sort_order === idx);
        mediaRows.push({
          job_id: jobId, category: 'FLOOR_PLAN', caption: fp.caption,
          config_id: cfg?.id ?? null, confidence: fp.confidence, source: 'EXTRACTED',
        });
      });
      (payload.mediaAssets || []).forEach((m: Record<string, unknown>) => {
        mediaRows.push({ job_id: jobId, category: m.category || 'GALLERY', caption: m.caption, source: 'EXTRACTED' });
      });
      (payload.documents || []).forEach((d: Record<string, unknown>) => {
        mediaRows.push({ job_id: jobId, category: 'DOCUMENT', caption: d.caption, source: 'EXTRACTED' });
      });
      if (mediaRows.length) await admin.from('import_project_media').insert(mediaRows);

      await admin.from('import_jobs').update({
        status: 'NEEDS_REVIEW',
        extraction_finished_at: new Date().toISOString(),
      }).eq('id', jobId);
      await admin.from('import_activity').insert({ job_id: jobId, event: 'extraction_completed', detail: { mode: 'mock' } });

      return new Response(JSON.stringify({ ok: true, mode: 'mock' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Live mode: forward to external service. Service is expected to call our callback when done.
    const callbackUrl = `${SUPABASE_URL}/functions/v1/extraction-callback`;
    const res = await fetch(SERVICE_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(SERVICE_TOKEN ? { Authorization: `Bearer ${SERVICE_TOKEN}` } : {}) },
      body: JSON.stringify({ jobId, accountId: job.account_id, propertyType: job.property_type, callbackUrl }),
    });
    if (!res.ok) {
      const txt = await res.text();
      await admin.from('import_jobs').update({ status: 'EXTRACTION_FAILED' }).eq('id', jobId);
      await admin.from('import_activity').insert({ job_id: jobId, event: 'extraction_failed', detail: { error: txt.slice(0, 500) } });
      return new Response(JSON.stringify({ error: 'Extraction service rejected request', detail: txt }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, mode: 'live' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
