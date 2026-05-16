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
// Confirmed by Terrisage 2026-05-16: only the values below are accepted; everything else falls back.
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const STATUS_LOOKUP: Record<string, string> = {
  'under construction': 'UNDER_CONSTRUCTION',
  'uc': 'UNDER_CONSTRUCTION',
  'pre launch': 'UNDER_CONSTRUCTION',
  'launched': 'UNDER_CONSTRUCTION',
  'launch': 'UNDER_CONSTRUCTION',
  'phase 1 completed': 'PHASE_1_COMPLETED',
  'phase 1 complete': 'PHASE_1_COMPLETED',
  'phase1 completed': 'PHASE_1_COMPLETED',
  'completed': 'COMPLETED_WITH_OC',
  'completed with oc': 'COMPLETED_WITH_OC',
  'ready to move': 'COMPLETED_WITH_OC',
  'ready to move in': 'COMPLETED_WITH_OC',
  'rtm': 'COMPLETED_WITH_OC',
};
const mapStatus = (v: unknown): string | null => STATUS_LOOKUP[norm(v)] ?? null;

// Only GATED / OPEN are accepted. Unknown values are dropped (null) so we never send a
// fabricated value to Terrisage.
const mapCommunity = (v: unknown): string | null => {
  const n = norm(v);
  if (!n) return null;
  if (n === 'open') return 'OPEN';
  if (n === 'gated' || n === 'high rise gated' || n === 'highrise gated') return 'GATED';
  return null;
};

const WATER_LOOKUP: Record<string, string> = {
  'bore well': 'BORE_WELL', 'borewell': 'BORE_WELL',
  'municipal': 'MUNICIPAL', 'bwssb': 'MUNICIPAL', 'corporation': 'MUNICIPAL', 'water board': 'MUNICIPAL',
  'tanker': 'TANKER',
  'lake': 'LAKE',
  'other': 'OTHER',
};
// Drop anything we can't confidently map. Send only spec-accepted values.
const mapWater = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  for (const x of arr) {
    const v = WATER_LOOKUP[norm(x)];
    if (v) seen.add(v);
  }
  return [...seen];
};

// Utilities → { utilityType, details? }.
const UTILITY_TYPES = new Set(['ELECTRICITY','WATER','GAS','SEWAGE','STP','INTERCOM_SECURITY','RAIN_WATER_HARVESTING','STORM_WATER_DRAINS']);
const UTILITY_LOOKUP: Record<string, { utilityType: string; details?: string }> = {
  'electricity': { utilityType: 'ELECTRICITY' },
  'power': { utilityType: 'ELECTRICITY' },
  'power backup': { utilityType: 'ELECTRICITY', details: 'Power backup' },
  'solar': { utilityType: 'ELECTRICITY', details: 'Solar panels' },
  'solar panels': { utilityType: 'ELECTRICITY', details: 'Solar panels' },
  'water': { utilityType: 'WATER' },
  'water supply 24 7': { utilityType: 'WATER', details: '24x7 supply' },
  'gas': { utilityType: 'GAS' },
  'gas pipeline': { utilityType: 'GAS', details: 'Piped gas' },
  'sewage': { utilityType: 'SEWAGE' },
  'sewage treatment': { utilityType: 'STP' },
  'stp': { utilityType: 'STP' },
  'intercom': { utilityType: 'INTERCOM_SECURITY' },
  'security': { utilityType: 'INTERCOM_SECURITY' },
  'intercom security': { utilityType: 'INTERCOM_SECURITY' },
  'rain water harvesting': { utilityType: 'RAIN_WATER_HARVESTING' },
  'rainwater harvesting': { utilityType: 'RAIN_WATER_HARVESTING' },
  'storm water drains': { utilityType: 'STORM_WATER_DRAINS' },
};

// Media kind: only LOGO|PHOTO|VIDEO|FLOORPLAN|TOUR_3D|OTHER on the wire.
const MEDIA_KIND_MAP: Record<string, string> = {
  LOGO: 'LOGO',
  GALLERY: 'PHOTO',
  MASTER_PLAN: 'PHOTO',
  PHOTO: 'PHOTO',
  FLOOR_PLAN: 'FLOORPLAN',
  FLOORPLAN: 'FLOORPLAN',
  VIDEO: 'VIDEO',
  WALKTHROUGH_VIDEO: 'VIDEO',
  TOUR_3D: 'TOUR_3D',
  BROCHURE: 'OTHER',
  DOCUMENT: 'OTHER',
  OTHER: 'OTHER',
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';

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
const mapUtilities = (arr: unknown): Array<{ utilityType: string; details?: string }> => {
  if (!Array.isArray(arr)) return [];
  const seenKey = new Set<string>();
  const out: Array<{ utilityType: string; details?: string }> = [];
  for (const x of arr) {
    const key = norm(x);
    if (!key) continue;
    let mapped = UTILITY_LOOKUP[key];
    if (!mapped) {
      const upper = String(x).trim().toUpperCase().replace(/\s+/g, '_');
      if (UTILITY_TYPES.has(upper)) mapped = { utilityType: upper };
    }
    if (!mapped) continue;
    const k = `${mapped.utilityType}|${mapped.details ?? ''}`;
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    out.push(mapped.details ? { utilityType: mapped.utilityType, details: mapped.details } : { utilityType: mapped.utilityType });
  }
  return out;
};

type AmenityMaster = { amenity_id: string; code: string | null; display_name: string; property_type: string };
function resolveAmenities(
  labels: unknown,
  master: AmenityMaster[],
  propertyType: string,
): { amenities: Array<{ amenityId: string; boolValue: boolean }>; unmapped: string[] } {
  if (!Array.isArray(labels) || master.length === 0) {
    return { amenities: [], unmapped: Array.isArray(labels) ? (labels as unknown[]).map(String) : [] };
  }
  const lookup = new Map<string, string>();
  for (const m of master) {
    if (m.property_type && m.property_type !== propertyType) continue;
    lookup.set(norm(m.display_name), m.amenity_id);
    if (m.code) lookup.set(norm(m.code), m.amenity_id);
  }
  const seen = new Set<string>();
  const out: Array<{ amenityId: string; boolValue: boolean }> = [];
  const unmapped: string[] = [];
  for (const raw of labels) {
    const id = lookup.get(norm(raw));
    if (id) {
      if (!seen.has(id)) { seen.add(id); out.push({ amenityId: id, boolValue: true }); }
    } else {
      const s = String(raw).trim();
      if (s) unmapped.push(s);
    }
  }
  return { amenities: out, unmapped };
}

function synthesiseBuildings(
  configs: Array<{ data: Record<string, unknown> }>,
  propertyType: string,
): {
  buildings: Array<Record<string, unknown>>;
  streetClusters: Array<Record<string, unknown>>;
  buildingKeyByName: Map<string, string>;
  clusterKeyByName: Map<string, string>;
} {
  const buildingKeyByName = new Map<string, string>();
  const clusterKeyByName = new Map<string, string>();
  const buildings: Array<Record<string, unknown>> = [];
  const streetClusters: Array<Record<string, unknown>> = [];

  if (propertyType === 'APARTMENT') {
    let sort = 0;
    for (const c of configs) {
      const name = strOrNull(c.data.tower);
      if (!name || buildingKeyByName.has(name)) continue;
      const key = slugify(name);
      buildingKeyByName.set(name, key);
      buildings.push({ supportBuildingKey: key, buildingName: name, sortOrder: sort++ });
    }
  } else {
    let sort = 0;
    for (const c of configs) {
      const name = strOrNull(c.data.cluster);
      if (!name || clusterKeyByName.has(name)) continue;
      const key = slugify(name);
      clusterKeyByName.set(name, key);
      streetClusters.push({ supportClusterKey: key, clusterName: name, sortOrder: sort++ });
    }
  }
  return { buildings, streetClusters, buildingKeyByName, clusterKeyByName };
}

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
    projectStatus: mapStatus(pd.status),
    openSpacePercent: numOrNull(pd.open_space_pct),
    projectSiteAreaAcres: acres,
    projectCommunityType: mapCommunity(pd.community_type),
    approachRoadWidth: numOrNull(pd.approach_road_width),
    projectTotalUnits: intOrNull(pd.total_units),
    projectWebsite: strOrNull(pd.website),
    projectDescription: desc.join('\n\n') || null,
    possessionOrOcDate: toIsoDate(pd.expected_completion_date),
    projectWaterSourceList: mapWater(pd.water_sources),
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
    amenities: [] as Array<{ amenityId: string; boolValue: boolean }>, // filled in by handler after master lookup
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

function buildConfiguration(
  c: { id: string; sort_order: number; data: Record<string, unknown> },
  propertyType: string,
  buildingKeyByName: Map<string, string>,
  clusterKeyByName: Map<string, string>,
) {
  const d = c.data ?? {};
  // Prefer parsed price band → string description. Numeric base/per-sqft kept null unless explicitly numeric.
  const baseNum = numOrNull(d.price_base);
  const perSqftNum = numOrNull(d.price_per_sqft);
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
    configUnitPriceBaseValue: baseNum,
    configurationUnitPricePerSqft: perSqftNum,
    configurationUnitDescription: [
      d.description,
      d.pricing_range ? `Pricing: ${d.pricing_range}` : null,
      d.type_no ? `Type: ${d.type_no}` : null,
      d.unit_numbers ? `Units: ${d.unit_numbers}` : null,
    ].filter(Boolean).join('. ') || null,
  };

  const facings = strOrNull(d.facing);
  const facingArr = facings ? facings.split(/[,/]/).map(s => s.trim()).filter(Boolean) : [];
  const excludedFloors = Array.isArray(d.excluded_floors)
    ? (d.excluded_floors as unknown[]).map(String)
    : [];
  const variationsRaw = Array.isArray(d.variations) ? d.variations as unknown[] : [];
  const variations = variationsRaw.map((v, i) => ({
    text: typeof v === 'string' ? v : (v as Record<string, unknown>)?.text ? String((v as Record<string, unknown>).text) : '',
    sortOrder: i,
  })).filter(v => v.text);

  if (propertyType === 'APARTMENT') {
    const towerName = strOrNull(d.tower);
    cfg.apartmentConfiguration = {
      projectTowerName: towerName,
      balconyCount: intOrNull(d.balconies),
      masterBedroomSizeSqft: strOrNull(d.master_bedroom_size),
      variations,
    };
    const range = parseFloorRange(d.floor_range);
    cfg.mapping = {
      supportBuildingKey: towerName ? (buildingKeyByName.get(towerName) ?? slugify(towerName)) : null,
      floorFrom: range.from,
      floorTo: range.to,
      excludedFloors,
      availableFacings: facingArr,
    };
  } else if (propertyType === 'VILLA') {
    const clusterName = strOrNull(d.cluster);
    const dims = parseDims(d.dimensions ?? d.land_area);
    cfg.villaConfiguration = {
      configurationVillaFloorsPerUnit: intOrNull(d.floors_per_unit),
      configurationVillaWidth: dims.width,
      configurationVillaLength: dims.length,
      masterBedroomSizeSqft: strOrNull(d.master_bedroom_size),
    };
    cfg.mapping = {
      supportClusterKey: clusterName ? (clusterKeyByName.get(clusterName) ?? slugify(clusterName)) : null,
      availableFacings: facingArr,
    };
  } else if (propertyType === 'PLOT') {
    const clusterName = strOrNull(d.cluster);
    const dims = parseDims(d.dimensions);
    cfg.plotConfiguration = {
      configurationPlotUnitAreaSqft: numOrNull(d.plot_area),
      configurationPlotUnitAreaSqYd: null,
      configurationPlotWidth: dims.width,
      configurationPlotLength: dims.length,
    };
    cfg.mapping = {
      supportClusterKey: clusterName ? (clusterKeyByName.get(clusterName) ?? slugify(clusterName)) : null,
      availableFacings: facingArr,
    };
  }
  return cfg;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { jobId?: string; action?: string; accountId?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'INVALID_BODY' }, 400); }
  const jobId = body.jobId;
  const action = body.action ?? 'push';
  // refresh-amenities doesn't need a jobId; everything else does.
  if (action !== 'refresh-amenities' && !jobId) return json({ ok: false, error: 'MISSING_JOB_ID' }, 400);

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
  // Confirmed: poll by sourceJobId. projectId arrives in the poll JSON when status === 'SUCCEEDED'.
  if (action === 'poll') {
    try {
      const r = await fetch(`${root}/api/integrations/projects/ingest-jobs?sourceJobId=${encodeURIComponent(jobId)}`, {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      });
      const text = await r.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!r.ok) return json({ ok: false, error: `HTTP ${r.status}`, detail: text.slice(0, 300) }, 502);
      // Persist projectId on terminal SUCCEEDED.
      const status = parsed.status as string | undefined;
      const projectId = (parsed.projectId as string) ?? null;
      if (status === 'SUCCEEDED' && projectId) {
        const { data: jobRow } = await supabase.from('import_jobs').select('summary').eq('id', jobId).maybeSingle();
        await supabase.from('import_jobs').update({
          summary: { ...((jobRow?.summary as object) ?? {}), terrisage_project_id: projectId, lastPollAt: new Date().toISOString() } as never,
        }).eq('id', jobId);
      }
      return json({ ok: true, status, projectId, data: parsed });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 502);
    }
  }

  // -------- REFRESH-AMENITIES action --------
  // Pulls Terrisage's amenity master per propertyType into the local cache so we can map free-text labels → amenityId.
  if (action === 'refresh-amenities') {
    const types = ['APARTMENT', 'VILLA', 'PLOT'];
    let total = 0;
    const errors: Array<{ propertyType: string; error: string }> = [];
    for (const pt of types) {
      try {
        const r = await fetch(`${root}/api/integrations/amenities?propertyType=${pt}`, {
          method: 'GET',
          headers: { 'X-API-Key': apiKey },
        });
        if (!r.ok) {
          errors.push({ propertyType: pt, error: `HTTP ${r.status}` });
          continue;
        }
        const parsed = await r.json() as { amenities?: Array<{ amenityId: string; code?: string; displayName: string; category?: string }> };
        const rows = (parsed.amenities ?? []).map(a => ({
          amenity_id: a.amenityId,
          code: a.code ?? null,
          display_name: a.displayName,
          category: a.category ?? null,
          property_type: pt,
          fetched_at: new Date().toISOString(),
        }));
        if (rows.length > 0) {
          await supabase.from('terrisage_amenity_master').upsert(rows as never, { onConflict: 'amenity_id' });
          total += rows.length;
        }
      } catch (e) {
        errors.push({ propertyType: pt, error: (e as Error).message });
      }
    }
    return json({ ok: errors.length === 0, total, errors });
  }

  // -------- LINK-AGENCY action --------
  // Asks Terrisage to grant an existing project visibility to an agency tenant.
  if (action === 'link-agency') {
    const accountId = body.accountId;
    if (!accountId) return json({ ok: false, error: 'MISSING_ACCOUNT_ID' }, 400);

    const [{ data: job }, { data: acct }] = await Promise.all([
      supabase.from('import_jobs').select('summary').eq('id', jobId).maybeSingle(),
      supabase.from('accounts').select('tenant_id, account_name, tenancy_type').eq('id', accountId).maybeSingle(),
    ]);
    const terrisageProjectId = ((job?.summary ?? {}) as Record<string, unknown>).terrisage_project_id as string | undefined;
    if (!terrisageProjectId) {
      return json({ ok: false, error: 'PROJECT_NOT_PUSHED', detail: 'Push the project to Terrisage first before linking an agency.' }, 409);
    }
    if (!acct?.tenant_id) {
      return json({ ok: false, error: 'AGENCY_HAS_NO_TENANT', detail: 'Selected agency has no tenant ID on its account.' }, 400);
    }
    if (acct.tenancy_type !== 'AGENCY_BROKERAGE_CONSULTANCY') {
      return json({ ok: false, error: 'NOT_AN_AGENCY' }, 400);
    }

    try {
      const r = await fetch(`${root}/api/integrations/projects/${terrisageProjectId}/agency-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ agencyOrgId: acct.tenant_id, sourceJobId: jobId }),
      });
      const text = await r.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      await supabase.from('import_activity').insert([{
        job_id: jobId,
        event: r.ok ? 'terrisage_agency_linked' : 'terrisage_agency_link_failed',
        detail: { accountId, agencyOrgId: acct.tenant_id, httpStatus: r.status, response: parsed } as never,
        actor_id: user.id,
      }]);
      if (!r.ok) return json({ ok: false, error: `HTTP ${r.status}`, detail: text.slice(0, 300) }, 502);
      return json({ ok: true, response: parsed });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 502);
    }
  }
  const { data: job, error: jErr } = await supabase
    .from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (jErr || !job) return json({ ok: false, error: 'JOB_NOT_FOUND' }, 404);
  if (job.kind !== 'PROJECT') return json({ ok: false, error: 'NOT_A_PROJECT_JOB' }, 400);

  const [{ data: configs }, { data: media }, { data: linkRows }, { data: ownerAcct }, { data: amenityMaster }] = await Promise.all([
    supabase.from('import_project_configs').select('*').eq('job_id', jobId).order('sort_order'),
    supabase.from('import_project_media').select('*').eq('job_id', jobId).order('created_at'),
    supabase.from('import_job_account_links').select('account_id, accounts:account_id(id, tenant_id)').eq('job_id', jobId),
    job.owner_account_id
      ? supabase.from('accounts').select('tenant_id').eq('id', job.owner_account_id).maybeSingle()
      : Promise.resolve({ data: null as { tenant_id: string | null } | null }),
    supabase.from('terrisage_amenity_master').select('amenity_id, code, display_name, property_type'),
  ]);

  // projectOwnerOrgId: prefer the explicit owner account's tenant_id; fall back to first linked account.
  const linkedTenantIds = ((linkRows ?? []) as Array<{ accounts: { tenant_id: string | null } | null }>)
    .map(r => r.accounts?.tenant_id).filter((t): t is string => !!t);
  const projectOwnerOrgId = (ownerAcct as { tenant_id: string | null } | null)?.tenant_id ?? linkedTenantIds[0] ?? null;

  const extracted = (job.extracted_data ?? {}) as Record<string, unknown>;
  const projectData = (extracted.projectData ?? {}) as Record<string, unknown>;
  const propertyType = String(job.property_type ?? 'APARTMENT');

  const projectMaster = buildProjectMaster(projectData, extracted, job.representative_input, propertyType);

  // Amenities: free-text labels → { amenityId, boolValue } via local cache of Terrisage master.
  const amenityLabels = Array.isArray(extracted.amenities) ? extracted.amenities : [];
  const { amenities: amenityPayload, unmapped: unmappedAmenities } = resolveAmenities(
    amenityLabels, (amenityMaster ?? []) as AmenityMaster[], propertyType,
  );
  projectMaster.amenities = amenityPayload;

  // Buildings/clusters: synthesise from configs (Terrisage rejects empty when mappings reference keys).
  const configsRaw = (configs ?? []).map(c => ({
    id: c.id, sort_order: c.sort_order ?? 0, data: (c.data ?? {}) as Record<string, unknown>,
  }));
  const { buildings, streetClusters, buildingKeyByName, clusterKeyByName } =
    synthesiseBuildings(configsRaw, propertyType);

  const configurations = configsRaw.map(c =>
    buildConfiguration(c, propertyType, buildingKeyByName, clusterKeyByName)
  );

  // Media: sign URLs, map category → kind, attach meta.mime for non-image kinds.
  const mediaPayload: Array<Record<string, unknown>> = [];
  for (const m of (media ?? [])) {
    if (m.review_state === 'INCORRECT' || m.review_state === 'DUPLICATE') continue;
    let url = m.external_url ?? null;
    if (!url && m.storage_path) {
      const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(m.storage_path, 60 * 60 * 24);
      url = signed?.signedUrl ?? null;
    }
    const meta = (m.meta ?? {}) as Record<string, unknown>;
    const kind = MEDIA_KIND_MAP[String(m.category)];
    // Per spec, only LOGO|PHOTO|VIDEO|FLOORPLAN|TOUR_3D|OTHER are accepted. Skip anything we can't map.
    if (!kind) continue;
    // Brochures/documents → meta.mime hint for downstream download.
    if (!meta.mime && (m.category === 'BROCHURE' || m.category === 'DOCUMENT')) {
      meta.mime = 'application/pdf';
    }
    mediaPayload.push({
      kind,
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
    buildings,
    streetClusters,
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
        buildings: buildings.length,
        streetClusters: streetClusters.length,
        amenitiesSent: amenityPayload.length,
        push_warnings: {
          unmappedAmenities,
        },
        lastPushAt: new Date().toISOString(),
      } as never,
    }).eq('id', jobId);
    await supabase.from('import_activity').insert([{
      job_id: jobId, event: 'push_to_terrisage_accepted',
      detail: { ingestJobId, httpStatus, response, unmappedAmenities } as never, actor_id: user.id,
    }]);
    return json({ ok: true, ingestJobId, status: response?.status ?? 'PENDING', httpStatus, response, warnings: { unmappedAmenities } });
  }

  await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', jobId);
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'push_to_terrisage_failed',
    detail: { error: lastErr, httpStatus, response } as never, actor_id: user.id,
  }]);
  return json({ ok: false, error: lastErr || 'PUSH_FAILED', httpStatus, response }, 502);
});
