// Outbound: push a fully-reviewed project to Terrisage's Project entity.
//
// Body shapes:
//   { action: 'push', jobId }   → builds payload, POSTs to Terrisage, returns 202+ingestJobId
//   { action: 'poll', jobId }   → GETs ingest-job status from Terrisage
//
// Conforms to TERRISAGE_PROJECT_PUSH_PAYLOAD_SPEC_FOR_SUPPORT (2026-05-16).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// ---------- Enum maps (Support UI label → Terrisage enum) ----------
const STATUS_MAP: Record<string, string> = {
  'Under Construction': 'UNDER_CONSTRUCTION',
  'Phase 1 completed': 'PHASE_1_COMPLETED',
  'Completed': 'COMPLETED_WITH_OC',
};
const COMMUNITY_MAP: Record<string, string> = {
  'Gated': 'GATED',
  'High-rise gated': 'GATED',
  'Open': 'OPEN',
};
const WATER_MAP: Record<string, string> = {
  'Borewell': 'BORE_WELL', 'Bore well': 'BORE_WELL', 'BORE_WELL': 'BORE_WELL',
  'BWSSB': 'MUNICIPAL', 'Municipal': 'MUNICIPAL', 'Corporation': 'MUNICIPAL', 'MUNICIPAL': 'MUNICIPAL',
  'Tanker': 'TANKER', 'TANKER': 'TANKER',
  'Lake': 'LAKE', 'LAKE': 'LAKE',
  'Other': 'OTHER', 'OTHER': 'OTHER',
};
const UTILITY_MAP: Record<string, string> = {
  'Electricity': 'ELECTRICITY', 'ELECTRICITY': 'ELECTRICITY',
  'Water': 'WATER', 'WATER': 'WATER',
  'Gas': 'GAS', 'GAS': 'GAS',
  'Sewage': 'SEWAGE', 'SEWAGE': 'SEWAGE',
  'STP': 'STP',
  'Intercom': 'INTERCOM_SECURITY', 'Security': 'INTERCOM_SECURITY', 'INTERCOM_SECURITY': 'INTERCOM_SECURITY',
  'Rainwater harvesting': 'RAIN_WATER_HARVESTING', 'Rain water harvesting': 'RAIN_WATER_HARVESTING', 'RAIN_WATER_HARVESTING': 'RAIN_WATER_HARVESTING',
  'Storm water drains': 'STORM_WATER_DRAINS', 'STORM_WATER_DRAINS': 'STORM_WATER_DRAINS',
};
const MEDIA_KIND_MAP: Record<string, string> = {
  LOGO: 'LOGO',
  GALLERY: 'PHOTO',
  FLOOR_PLAN: 'FLOORPLAN',
  VIDEO: 'VIDEO',
  BROCHURE: 'OTHER',
  DOCUMENT: 'OTHER',
  OTHER: 'OTHER',
};

// ---------- Coercion helpers ----------
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n == null ? null : Math.round(n);
};
const strOrNull = (v: unknown): string | null => {
  const s = (v == null ? '' : String(v)).trim();
  return s ? s : null;
};
const toIsoDate = (v: unknown): string | null => {
  const s = strOrNull(v);
  if (!s) return null;
  // Accept YYYY-MM-DD passthrough, or DD-MM-YYYY / DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const parseFloorRange = (v: unknown): { from: number | null; to: number | null } => {
  const s = String(v ?? '').trim();
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { from: parseInt(m[1], 10), to: parseInt(m[2], 10) };
  const n = intOrNull(s);
  return { from: n, to: n };
};
const parseDims = (v: unknown): { width: number | null; length: number | null } => {
  const s = String(v ?? '').toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/);
  if (m) return { width: parseFloat(m[1]), length: parseFloat(m[2]) };
  return { width: null, length: null };
};
const mapArr = (arr: unknown, m: Record<string, string>): string[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  for (const x of arr) {
    const v = m[String(x).trim()];
    if (v) seen.add(v);
  }
  return [...seen];
};
const mapUtilities = (arr: unknown): Array<{ utilityType: string; details: string | null }> => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: Array<{ utilityType: string; details: string | null }> = [];
  for (const x of arr) {
    const raw = String(x).trim();
    const v = UTILITY_MAP[raw];
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push({ utilityType: v, details: null });
    }
  }
  return out;
};

// ---------- Builders ----------
function buildProjectMaster(pd: Record<string, unknown>, extracted: Record<string, unknown>, rep: unknown, propertyType: string) {
  const desc: string[] = [];
  if (pd.location) desc.push(`Locality: ${pd.location}`);
  if (pd.overview) desc.push(String(pd.overview));
  const notes: Record<string, unknown> = {};
  if (pd.contact_email) notes.contact_email = pd.contact_email;
  if (pd.office_address) notes.office_address = pd.office_address;
  if (rep && typeof rep === 'object') notes.representative = rep;

  const acres = numOrNull(pd.site_area_acres_total) ?? numOrNull(pd.site_area_acres);

  const project: Record<string, unknown> = {
    projectName: strOrNull(pd.project_name),
    builderName: strOrNull(pd.builder_name),
    city: strOrNull(pd.city),
    projectAddress: strOrNull(pd.address),
    mapsUrl: strOrNull(pd.maps_url),
    reraRegistrationNo: strOrNull(pd.rera_id),
    projectStatus: STATUS_MAP[String(pd.status ?? '')] ?? null,
    openSpacePercent: numOrNull(pd.open_space_pct),
    projectSiteAreaAcres: acres,
    projectCommunityType: COMMUNITY_MAP[String(pd.community_type ?? '')] ?? null,
    approachRoadWidth: numOrNull(pd.approach_road_width),
    projectTotalUnits: intOrNull(pd.total_units),
    projectWebsite: strOrNull(pd.website),
    projectDescription: desc.join('\n\n') || null,
    possessionOrOcDate: toIsoDate(pd.expected_completion_date),
    projectWaterSourceList: mapArr(pd.water_sources, WATER_MAP),
    utilities: mapUtilities(pd.utilities),
    projectUsps: Array.isArray(pd.key_features) ? (pd.key_features as string[]).join('; ') : strOrNull(pd.key_features),
    projectContactPhoneNo: strOrNull(pd.contact_phone),
    approvedBankList: Array.isArray(extracted.approvedBanks) ? (extracted.approvedBanks as string[]).filter(Boolean) : [],
    proximityMetrics: Array.isArray(extracted.proximityMatrix)
      ? (extracted.proximityMatrix as Array<Record<string, unknown>>).map((p, i) => ({
          label: [p.category, p.name].filter(Boolean).join(': ') || strOrNull(p.label) || '',
          distance: p.distance_km != null ? `${p.distance_km} km` : strOrNull(p.distance),
          time: strOrNull(p.time),
          sortOrder: i,
        }))
      : [],
    amenities: [], // TODO: requires Terrisage amenity master ID lookup
    internalNotes: Object.keys(notes).length ? JSON.stringify(notes) : null,
  };

  if (propertyType === 'APARTMENT') {
    project.apartmentDetail = {
      projectOpenSpacePercent: numOrNull(pd.open_space_pct),
      projectTotalTowers: Array.isArray(pd.tower_names_list) ? (pd.tower_names_list as unknown[]).length : null,
      projectTotalFloorsPerTower: intOrNull(pd.floors_each_tower),
      projectUnitsPerFloor: null,
      projectUnitsPerLift: null,
    };
  } else if (propertyType === 'VILLA') {
    const floors = String(pd.floors_per_unit ?? '').match(/(\d+)/);
    project.villaDetail = {
      configurationVillaFloorsPerUnit: floors ? parseInt(floors[1], 10) : null,
      projectRoadWidthAbutting: numOrNull(pd.approach_road_width),
    };
  } else if (propertyType === 'PLOT') {
    project.plotDetail = {};
  }
  return project;
}

function buildConfiguration(c: { id: string; sort_order: number; data: Record<string, unknown> }, propertyType: string) {
  const d = c.data ?? {};
  const cfg: Record<string, unknown> = {
    supportConfigRef: c.id,
    sortOrder: c.sort_order,
    configurationUnitName: strOrNull(d.name),
    configurationUnitBedroomCount: intOrNull(d.bhk),
    configurationUnitBathroomCount: intOrNull(d.bathrooms),
    configurationUnitsTotalCount: intOrNull(d.units_planned),
    configurationUnitCarpetAreaSqft: numOrNull(d.carpet_area),
    configurationUnitBuiltupAreaSqft: numOrNull(d.built_up_area),
    configurationUnitSuperBuiltupAreaSqft: numOrNull(d.super_built_up_area),
    configUnitPriceBaseValue: null,
    configurationUnitPricePerSqft: null,
    configurationUnitDescription: [d.description, d.pricing_range ? `Pricing: ${d.pricing_range}` : null, d.type_no ? `Type: ${d.type_no}` : null, d.unit_numbers ? `Units: ${d.unit_numbers}` : null]
      .filter(Boolean).join('. ') || null,
  };

  const facings = strOrNull(d.facing);
  const facingArr = facings ? facings.split(/[,/]/).map(s => s.trim()).filter(Boolean) : [];

  if (propertyType === 'APARTMENT') {
    cfg.apartmentConfiguration = {
      projectTowerName: strOrNull(d.tower),
      balconyCount: intOrNull(d.balconies),
      masterBedroomSizeSqft: null,
      variations: [],
    };
    const range = parseFloorRange(d.floor_range);
    cfg.mapping = {
      supportBuildingKey: strOrNull(d.tower),
      floorFrom: range.from,
      floorTo: range.to,
      excludedFloors: [],
      availableFacings: facingArr,
    };
  } else if (propertyType === 'VILLA') {
    const dims = parseDims(d.dimensions ?? d.land_area);
    cfg.villaConfiguration = {
      configurationVillaFloorsPerUnit: intOrNull(d.floors_per_unit),
      configurationVillaWidth: dims.width,
      configurationVillaLength: dims.length,
      masterBedroomSizeSqft: null,
    };
    cfg.mapping = { supportClusterKey: strOrNull(d.cluster), availableFacings: facingArr };
  } else if (propertyType === 'PLOT') {
    const dims = parseDims(d.dimensions);
    cfg.plotConfiguration = {
      configurationPlotUnitAreaSqft: numOrNull(d.plot_area),
      configurationPlotUnitAreaSqYd: null,
      configurationPlotWidth: dims.width,
      configurationPlotLength: dims.length,
    };
    cfg.mapping = { supportClusterKey: strOrNull(d.cluster), availableFacings: facingArr };
  }
  return cfg;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { jobId?: string; action?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'INVALID_BODY' }, 400); }
  const jobId = body.jobId;
  const action = body.action ?? 'push';
  if (!jobId) return json({ ok: false, error: 'MISSING_JOB_ID' }, 400);

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

  const baseUrl = Deno.env.get('TERRISAGE_BASE_URL');
  const apiKey = Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!baseUrl || !apiKey) {
    return json({ ok: false, error: 'TERRISAGE_NOT_CONFIGURED', detail: 'TERRISAGE_BASE_URL or SEAT_SUPPORT_INTEGRATION_API_KEY is not set' }, 500);
  }
  const root = baseUrl.replace(/\/$/, '');

  // -------- POLL action --------
  if (action === 'poll') {
    const { data: job } = await supabase.from('import_jobs').select('summary').eq('id', jobId).maybeSingle();
    const summary = (job?.summary ?? {}) as Record<string, unknown>;
    const ingestJobId = summary.ingestJobId as string | undefined;
    if (!ingestJobId) {
      return json({ ok: false, error: 'NO_INGEST_JOB' }, 404);
    }
    try {
      const r = await fetch(`${root}/api/integrations/projects/ingest-jobs/${ingestJobId}`, {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      });
      const text = await r.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!r.ok) return json({ ok: false, error: `HTTP ${r.status}`, detail: text.slice(0, 300) }, 502);
      return json({ ok: true, status: parsed.status, data: parsed });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 502);
    }
  }

  // -------- PUSH action --------
  const { data: job, error: jErr } = await supabase
    .from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (jErr || !job) return json({ ok: false, error: 'JOB_NOT_FOUND' }, 404);
  if (job.kind !== 'PROJECT') return json({ ok: false, error: 'NOT_A_PROJECT_JOB' }, 400);

  const [{ data: configs }, { data: media }, { data: linkRows }, { data: ownerAcct }] = await Promise.all([
    supabase.from('import_project_configs').select('*').eq('job_id', jobId).order('sort_order'),
    supabase.from('import_project_media').select('*').eq('job_id', jobId).order('created_at'),
    supabase.from('import_job_account_links').select('account_id, accounts:account_id(id, tenant_id)').eq('job_id', jobId),
    job.owner_account_id
      ? supabase.from('accounts').select('tenant_id').eq('id', job.owner_account_id).maybeSingle()
      : Promise.resolve({ data: null as { tenant_id: string | null } | null }),
  ]);

  // projectOwnerOrgId: prefer the explicit owner account's tenant_id; fall back to first linked account.
  const linkedTenantIds = ((linkRows ?? []) as Array<{ accounts: { tenant_id: string | null } | null }>)
    .map(r => r.accounts?.tenant_id).filter((t): t is string => !!t);
  const projectOwnerOrgId = (ownerAcct as { tenant_id: string | null } | null)?.tenant_id ?? linkedTenantIds[0] ?? null;

  const extracted = (job.extracted_data ?? {}) as Record<string, unknown>;
  const projectData = (extracted.projectData ?? {}) as Record<string, unknown>;
  const propertyType = String(job.property_type ?? 'APARTMENT');

  const projectMaster = buildProjectMaster(projectData, extracted, job.representative_input, propertyType);

  // Configurations
  const configurations = (configs ?? []).map(c =>
    buildConfiguration({ id: c.id, sort_order: c.sort_order ?? 0, data: (c.data ?? {}) as Record<string, unknown> }, propertyType)
  );

  // Media: sign URLs, map category → kind
  const mediaPayload: Array<Record<string, unknown>> = [];
  for (const m of (media ?? [])) {
    if (m.review_state === 'INCORRECT' || m.review_state === 'DUPLICATE') continue;
    let url = m.external_url ?? null;
    if (!url && m.storage_path) {
      const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(m.storage_path, 60 * 60 * 24);
      url = signed?.signedUrl ?? null;
    }
    const meta = (m.meta ?? {}) as Record<string, unknown>;
    mediaPayload.push({
      kind: MEDIA_KIND_MAP[String(m.category)] ?? 'OTHER',
      url,
      caption: m.caption ?? null,
      configRef: m.config_id ?? null,
      meta: { ...meta, externalUrl: m.external_url ?? null },
    });
  }

  const payload = {
    sourceJobId: job.id,
    propertyType,
    category: 'RESIDENTIAL',
    projectOrigin: 'SUPPORT_ADDED',
    projectOwnerOrgId,
    project: projectMaster,
    buildings: [],         // TODO: requires structures table; spec allows empty
    streetClusters: [],    // TODO: requires structures table; spec allows empty
    configurations,
    media: mediaPayload,
    pushedAt: new Date().toISOString(),
    pushedBy: user.id,
  };

  // POST with retry on network/5xx/401 only (once).
  let lastErr = '';
  let response: Record<string, unknown> | null = null;
  let httpStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${root}/api/integrations/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(payload),
      });
      httpStatus = r.status;
      const text = await r.text();
      try { response = JSON.parse(text); } catch { response = { raw: text }; }
      if (r.status === 202 || r.status === 200) break;
      lastErr = `HTTP ${r.status}: ${text.slice(0, 300)}`;
      // Only retry on 5xx / 401
      if (r.status < 500 && r.status !== 401) break;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }

  if (httpStatus === 202 || httpStatus === 200) {
    const ingestJobId = (response?.ingestJobId as string) ?? (response?.id as string) ?? null;
    const projectId = (response?.projectId as string) ?? null;
    await supabase.from('import_jobs').update({
      summary: {
        ...((job.summary as object) ?? {}),
        ingestJobId,
        terrisage_project_id: projectId,
        configs: configs?.length ?? 0,
        media: mediaPayload.length,
        lastPushAt: new Date().toISOString(),
      } as never,
    }).eq('id', jobId);
    await supabase.from('import_activity').insert([{
      job_id: jobId, event: 'push_to_terrisage_accepted',
      detail: { ingestJobId, httpStatus, response } as never, actor_id: user.id,
    }]);
    return json({ ok: true, ingestJobId, status: response?.status ?? 'PENDING', httpStatus, response });
  }

  await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', jobId);
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'push_to_terrisage_failed',
    detail: { error: lastErr, httpStatus, response } as never, actor_id: user.id,
  }]);
  return json({ ok: false, error: lastErr || 'PUSH_FAILED', httpStatus, response }, 502);
});
