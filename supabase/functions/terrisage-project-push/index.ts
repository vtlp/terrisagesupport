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

// Terrisage standard error envelope per spec:
//   { success: false, error: { message, code, statusCode } }
// Extract code + message so toasts and import_activity show the real reason instead of just "HTTP 422".
function parseTerrisageError(parsed: unknown, fallbackStatus: number): { code: string; message: string } {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const err = (p.error ?? {}) as Record<string, unknown>;
  const code = String(err.code ?? p.code ?? `HTTP_${fallbackStatus}`);
  const message = String(err.message ?? p.message ?? p.raw ?? 'Unknown error');
  return { code, message };
}

// Log every Terrisage call with method, path, status, latency, and (on failure) the parsed body.
// These show up in the Edge Function Logs panel and make debugging push failures trivial.
function logTerrisage(label: string, info: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`[terrisage] ${label}`, JSON.stringify(info));
}


// ---------- Enum maps (Support UI label → Terrisage enum) ----------
// Confirmed by Terrisage 2026-05-16: only the values below are accepted; everything else falls back.
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

// Status: exact lookup first, then a forgiving substring pass so values like "Nearing completion",
// "Soft launch", "Tower 1 handed over" still land on the closest spec value.
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
const mapStatus = (v: unknown): string | null => {
  const n = norm(v);
  if (!n) return null;
  if (STATUS_LOOKUP[n]) return STATUS_LOOKUP[n];
  if (/\b(oc|occupation|handover|handed over|possess)/.test(n)) return 'COMPLETED_WITH_OC';
  if (/\b(phase|tower)\s*\d*\s*(complete|done|handed|ready)/.test(n) || /nearing/.test(n)) return 'PHASE_1_COMPLETED';
  if (/\b(launch|construct|ongoing|progress|excavat|foundation|piling|booking)/.test(n)) return 'UNDER_CONSTRUCTION';
  if (/\bcomplete|finished|ready\b/.test(n)) return 'COMPLETED_WITH_OC';
  return null;
};

// Community: substring-friendly. Falls back to GATED for community-style words
// (township, enclave, residency) so we don't lose intent.
const mapCommunity = (v: unknown): string | null => {
  const n = norm(v);
  if (!n) return null;
  if (/\bopen\b|\bstandalone\b|\bplotted\b/.test(n)) return 'OPEN';
  if (/gated|high\s*rise|township|enclave|community|residency|gateway|villa community/.test(n)) return 'GATED';
  return null;
};

const WATER_LOOKUP: Record<string, string> = {
  'bore well': 'BORE_WELL', 'borewell': 'BORE_WELL', 'bore': 'BORE_WELL',
  'municipal': 'MUNICIPAL', 'bwssb': 'MUNICIPAL', 'corporation': 'MUNICIPAL',
  'water board': 'MUNICIPAL', 'cauvery': 'MUNICIPAL', 'kaveri': 'MUNICIPAL',
  'tanker': 'TANKER',
  'lake': 'LAKE',
  'other': 'OTHER',
};
// Try exact, then substring; anything left non-empty falls back to OTHER so we don't silently lose it.
const mapWater = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  for (const x of arr) {
    const n = norm(x);
    if (!n) continue;
    let v = WATER_LOOKUP[n];
    if (!v) {
      for (const [k, val] of Object.entries(WATER_LOOKUP)) {
        if (n.includes(k)) { v = val; break; }
      }
    }
    if (!v) v = 'OTHER';
    seen.add(v);
  }
  return [...seen];
};

// Utilities → { utilityType, details? }.
const UTILITY_TYPES = new Set(['ELECTRICITY','WATER','GAS','SEWAGE','STP','INTERCOM_SECURITY','RAIN_WATER_HARVESTING','STORM_WATER_DRAINS']);
const UTILITY_LOOKUP: Record<string, { utilityType: string; details?: string }> = {
  'electricity': { utilityType: 'ELECTRICITY' },
  'power': { utilityType: 'ELECTRICITY' },
  'power backup': { utilityType: 'ELECTRICITY', details: 'Power backup' },
  'dg backup': { utilityType: 'ELECTRICITY', details: 'DG backup' },
  'generator': { utilityType: 'ELECTRICITY', details: 'DG backup' },
  'solar': { utilityType: 'ELECTRICITY', details: 'Solar panels' },
  'solar panels': { utilityType: 'ELECTRICITY', details: 'Solar panels' },
  'solar water heater': { utilityType: 'ELECTRICITY', details: 'Solar water heater' },
  'ev charging': { utilityType: 'ELECTRICITY', details: 'EV charging' },
  'water': { utilityType: 'WATER' },
  'water supply 24 7': { utilityType: 'WATER', details: '24x7 supply' },
  'gas': { utilityType: 'GAS' },
  'gas pipeline': { utilityType: 'GAS', details: 'Piped gas' },
  'piped gas': { utilityType: 'GAS', details: 'Piped gas' },
  'sewage': { utilityType: 'SEWAGE' },
  'sewage treatment': { utilityType: 'STP' },
  'stp': { utilityType: 'STP' },
  'intercom': { utilityType: 'INTERCOM_SECURITY' },
  'security': { utilityType: 'INTERCOM_SECURITY' },
  '24 7 security': { utilityType: 'INTERCOM_SECURITY', details: '24x7 security' },
  'cctv': { utilityType: 'INTERCOM_SECURITY', details: 'CCTV' },
  'intercom security': { utilityType: 'INTERCOM_SECURITY' },
  'rain water harvesting': { utilityType: 'RAIN_WATER_HARVESTING' },
  'rainwater harvesting': { utilityType: 'RAIN_WATER_HARVESTING' },
  'rwh': { utilityType: 'RAIN_WATER_HARVESTING' },
  'storm water drains': { utilityType: 'STORM_WATER_DRAINS' },
  'storm water': { utilityType: 'STORM_WATER_DRAINS' },
};

// Media kind: only LOGO|PHOTO|VIDEO|FLOORPLAN|TOUR_3D|OTHER on the wire.
// Unknown categories fall through to OTHER so the media item is still sent.
const MEDIA_KIND_MAP: Record<string, string> = {
  LOGO: 'LOGO',
  GALLERY: 'PHOTO',
  MASTER_PLAN: 'PHOTO',
  PHOTO: 'PHOTO',
  IMAGE: 'PHOTO',
  RENDER: 'PHOTO',
  FLOOR_PLAN: 'FLOORPLAN',
  FLOORPLAN: 'FLOORPLAN',
  VIDEO: 'VIDEO',
  WALKTHROUGH_VIDEO: 'VIDEO',
  TOUR_3D: 'TOUR_3D',
  VIRTUAL_TOUR: 'TOUR_3D',
  BROCHURE: 'OTHER',
  DOCUMENT: 'OTHER',
  OTHER: 'OTHER',
};

// Indian price band parser: "1.2 Cr", "85 Lakh", "₹95L", "1.2-1.5 Cr onwards" → absolute INR.
// Returns the low end of a range when present.
const parseIndianPrice = (v: unknown): number | null => {
  const s = String(v ?? '').toLowerCase().replace(/,/g, '');
  if (!s.trim()) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lakh|lac|lacs|k)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? '').replace(/s$/, '');
  if (unit === 'cr' || unit === 'crore') return Math.round(n * 1_00_00_000);
  if (unit === 'l' || unit === 'lakh' || unit === 'lac') return Math.round(n * 1_00_000);
  if (unit === 'k') return Math.round(n * 1_000);
  // Bare number ≥ 1000 → treat as INR already; smaller numbers without a unit are too ambiguous.
  return n >= 1000 ? Math.round(n) : null;
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
    const raw = String(x ?? '').trim();
    const key = norm(raw);
    if (!key) continue;
    let mapped = UTILITY_LOOKUP[key];
    if (!mapped) {
      const upper = raw.toUpperCase().replace(/\s+/g, '_');
      if (UTILITY_TYPES.has(upper)) mapped = { utilityType: upper };
    }
    // Substring pass over the lookup so variants like "24x7 power backup", "Piped gas connection",
    // "Rainwater harvesting system" still resolve.
    if (!mapped) {
      for (const [k, v] of Object.entries(UTILITY_LOOKUP)) {
        if (key.includes(k)) { mapped = { ...v, details: v.details ?? raw }; break; }
      }
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
  // Exact lookup by display_name and code, plus a token list for substring fallback.
  const exact = new Map<string, string>();
  const tokens: Array<{ key: string; id: string }> = [];
  for (const m of master) {
    if (m.property_type && m.property_type !== propertyType) continue;
    const dn = norm(m.display_name);
    exact.set(dn, m.amenity_id);
    tokens.push({ key: dn, id: m.amenity_id });
    if (m.code) {
      const cn = norm(m.code);
      exact.set(cn, m.amenity_id);
      tokens.push({ key: cn, id: m.amenity_id });
    }
  }
  const seen = new Set<string>();
  const out: Array<{ amenityId: string; boolValue: boolean }> = [];
  const unmapped: string[] = [];
  for (const raw of labels) {
    const n = norm(raw);
    if (!n) continue;
    let id = exact.get(n);
    // Substring fallback: prefer the longest master entry contained in or containing the input.
    if (!id) {
      let bestLen = 0;
      for (const t of tokens) {
        if ((t.key.length >= 4 && (n.includes(t.key) || t.key.includes(n))) && t.key.length > bestLen) {
          id = t.id;
          bestLen = t.key.length;
        }
      }
    }
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
  projectTotalUnits: number | null,
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

  // Sum config.units_planned per tower/cluster — Terrisage requires totalUnits on each
  // and the sum across buildings/clusters must equal projectTotalUnits (else 422).
  const unitsByName = new Map<string, number>();
  const nameKey = propertyType === 'APARTMENT' ? 'tower' : 'cluster';
  let assignedUnits = 0;
  let assignedCount = 0;
  for (const c of configs) {
    const name = strOrNull(c.data[nameKey]);
    if (!name) continue;
    const u = intOrNull(c.data.units_planned) ?? 0;
    unitsByName.set(name, (unitsByName.get(name) ?? 0) + u);
    assignedUnits += u;
    assignedCount += 1;
  }
  // If config-level units don't add up to projectTotalUnits, distribute the diff evenly across
  // the buildings/clusters so the spec invariant holds. Otherwise the push will be rejected with 422.
  let diff = 0;
  if (projectTotalUnits != null && unitsByName.size > 0) {
    const sum = [...unitsByName.values()].reduce((a, b) => a + b, 0);
    diff = projectTotalUnits - sum;
  }

  const distribute = (names: string[]): Map<string, number> => {
    const out = new Map<string, number>();
    if (names.length === 0) return out;
    for (const n of names) out.set(n, unitsByName.get(n) ?? 0);
    if (diff !== 0) {
      const per = Math.floor(diff / names.length);
      let leftover = diff - per * names.length;
      for (const n of names) {
        const cur = (out.get(n) ?? 0) + per;
        out.set(n, cur + (leftover > 0 ? 1 : leftover < 0 ? -1 : 0));
        if (leftover > 0) leftover -= 1; else if (leftover < 0) leftover += 1;
      }
      // Clamp to >= 1 per building (Terrisage will reject 0)
      for (const n of names) if ((out.get(n) ?? 0) < 1) out.set(n, 1);
    } else {
      for (const n of names) if ((out.get(n) ?? 0) < 1) out.set(n, 1);
    }
    return out;
  };

  if (propertyType === 'APARTMENT') {
    const names: string[] = [];
    for (const c of configs) {
      const name = strOrNull(c.data.tower);
      if (!name || buildingKeyByName.has(name)) continue;
      buildingKeyByName.set(name, slugify(name));
      names.push(name);
    }
    const allocated = distribute(names);
    names.forEach((name, i) => {
      buildings.push({
        supportBuildingKey: buildingKeyByName.get(name)!,
        buildingName: name,
        totalUnits: allocated.get(name) ?? 1,
        sortOrder: i,
      });
    });
  } else {
    const names: string[] = [];
    for (const c of configs) {
      const name = strOrNull(c.data.cluster);
      if (!name || clusterKeyByName.has(name)) continue;
      clusterKeyByName.set(name, slugify(name));
      names.push(name);
    }
    const allocated = distribute(names);
    names.forEach((name, i) => {
      streetClusters.push({
        supportClusterKey: clusterKeyByName.get(name)!,
        clusterName: name,
        totalUnits: allocated.get(name) ?? 1,
        sortOrder: i,
      });
    });
  }
  // Silence unused vars for the assigned counters (kept for future telemetry).
  void assignedUnits; void assignedCount;
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
  // Numeric first, then Indian price band ("1.2 Cr", "85 Lakh", "1.2-1.5 Cr onwards") as fallback.
  // pricing_range often holds the band when price_base/price_per_sqft are blank.
  const baseNum = numOrNull(d.price_base) ?? parseIndianPrice(d.price_base) ?? parseIndianPrice(d.pricing_range);
  const perSqftNum = numOrNull(d.price_per_sqft) ?? parseIndianPrice(d.price_per_sqft);
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
  // Spec: PROJECT_REQUEST_SUPPORT_INTEGRATION_API_KEY is preferred, falls back to SEAT_SUPPORT_INTEGRATION_API_KEY.
  const apiKey = Deno.env.get('PROJECT_REQUEST_SUPPORT_INTEGRATION_API_KEY')
    ?? Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!baseUrl || !apiKey) {
    return json({ ok: false, error: 'TERRISAGE_NOT_CONFIGURED', detail: 'TERRISAGE_BASE_URL or integration API key is not set' }, 500);
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
  async function runAmenityRefresh(): Promise<{ total: number; errors: Array<{ propertyType: string; error: string }> }> {
    const types = ['APARTMENT', 'VILLA', 'PLOT'];
    let total = 0;
    const errors: Array<{ propertyType: string; error: string }> = [];
    for (const pt of types) {
      try {
        const r = await fetch(`${root}/api/integrations/amenities?propertyType=${pt}`, {
          method: 'GET',
          headers: { 'X-API-Key': apiKey },
        });
        if (!r.ok) { errors.push({ propertyType: pt, error: `HTTP ${r.status}` }); continue; }
        // Spec response: { societyAmenities[], unitAmenities[], tags[] } each with { id, code, displayName, category, valueType }.
        // Merge all three so a user-entered label like "Reserved parking" (unit amenity) still resolves.
        const parsed = await r.json() as {
          societyAmenities?: Array<{ id: string; code?: string; displayName: string; category?: string }>;
          unitAmenities?: Array<{ id: string; code?: string; displayName: string; category?: string }>;
          tags?: Array<{ id: string; code?: string; displayName: string; category?: string }>;
        };
        const all = [
          ...(parsed.societyAmenities ?? []),
          ...(parsed.unitAmenities ?? []),
          ...(parsed.tags ?? []),
        ];
        const rows = all.map(a => ({
          amenity_id: a.id,
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
    return { total, errors };
  }
  if (action === 'refresh-amenities') {
    const { total, errors } = await runAmenityRefresh();
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

  // Auto-refresh the amenity master if it's empty or older than 24h. Failures here are non-fatal:
  // we'll fall through and just produce more "unmapped" warnings than usual.
  let autoRefresh: { ran: boolean; total?: number; errors?: unknown } = { ran: false };
  const { data: freshness } = await supabase
    .from('terrisage_amenity_master')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastFetched = freshness?.fetched_at ? new Date(freshness.fetched_at).getTime() : 0;
  const STALE_MS = 24 * 60 * 60 * 1000;
  if (!lastFetched || Date.now() - lastFetched > STALE_MS) {
    const r = await runAmenityRefresh();
    autoRefresh = { ran: true, total: r.total, errors: r.errors };
  }

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
    synthesiseBuildings(configsRaw, propertyType, intOrNull(projectMaster.projectTotalUnits));

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
    // Unknown categories fall back to OTHER so we still ship the asset rather than losing it.
    const kind = MEDIA_KIND_MAP[String(m.category)] ?? 'OTHER';
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
          amenityAutoRefresh: autoRefresh,
        },
        lastPushAt: new Date().toISOString(),
      } as never,
    }).eq('id', jobId);
    await supabase.from('import_activity').insert([{
      job_id: jobId, event: 'push_to_terrisage_accepted',
      detail: { ingestJobId, httpStatus, response, unmappedAmenities, amenityAutoRefresh: autoRefresh } as never, actor_id: user.id,
    }]);
    return json({ ok: true, ingestJobId, status: response?.status ?? 'PENDING', httpStatus, response, warnings: { unmappedAmenities, amenityAutoRefresh: autoRefresh } });
  }

  await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', jobId);
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'push_to_terrisage_failed',
    detail: { error: lastErr, httpStatus, response } as never, actor_id: user.id,
  }]);
  return json({ ok: false, error: lastErr || 'PUSH_FAILED', httpStatus, response }, 502);
});
