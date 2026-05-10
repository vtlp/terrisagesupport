// Auto-map uploaded files for a Project import job.
//
// Supports three sources, in priority order:
//   1) JSON extraction file (e.g. moonglade_extraction.json) with keys
//      { project, configurations, missing_fields }
//   2) project_summary.csv / .xlsx (wide or key-value)
//   3) configurations.csv / .xlsx (one row per config)
//
// Side effects:
//   - Inserts AUTOMAP rows into import_project_configs
//   - Inserts AUTOMAP rows into import_project_media for any image files
//     (linking floor plans to configs when filename matches floorplan_crop_file)
//   - Persists merged project data, towers list, and an autoMap report
//     into job.extracted_data

import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import type { ImportJob, ImportFile, PropertyType } from './shared';
import { logActivity } from './shared';
import { defaultMarkets } from '@/data/lookupData';

// Derive an Indian city from a free-text location string by matching against
// the known city list. Strips parenthetical aliases (e.g. "Bangalore (Bengaluru)" → "Bangalore").
export function deriveCityFromLocation(location: string): string | null {
  if (!location) return null;
  const text = ` ${location.toLowerCase()} `;
  // Sort by name length descending so multi-word cities match before substrings.
  const names = defaultMarkets
    .map(m => ({ full: m.value, base: m.value.replace(/\s*\(.*?\)\s*/g, '').trim() }))
    .sort((a, b) => b.base.length - a.base.length);
  for (const n of names) {
    const needle = n.base.toLowerCase();
    if (needle.length < 3) continue;
    const re = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (re.test(text)) return n.full;
  }
  return null;
}

// ---------- Field synonyms ----------

type FieldKey = string;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const PROJECT_SYNONYMS: Record<FieldKey, string[]> = {
  project_name: ['projectname', 'project', 'name', 'projecttitle'],
  builder_name: ['buildername', 'developername', 'developerbrand', 'developer', 'builder', 'builderdeveloper', 'company', 'brand'],
  project_type: ['projecttype', 'type'],
  city: ['city', 'town'],
  location: ['location', 'area', 'locality'],
  address: ['address', 'fulladdress', 'projectaddress', 'siteaddress', 'officeaddress'],
  rera_id: ['reraid', 'rera', 'reranumber', 'reraapproval', 'approval', 'approvalid'],
  status: ['status', 'projectstatus', 'constructionstatus'],
  site_area: ['sitearea', 'totalarea', 'landarea', 'plotarea'],
  site_area_unit: ['siteareaunit', 'areaunit'],
  community_type: ['communitytype', 'community'],
  approach_road_width: ['approachroadwidth', 'roadwidth', 'approachroad'],
  total_units: ['totalunits', 'units', 'noofunits', 'totalflats'],
  expected_completion_date: ['expectedcompletion', 'completiondate', 'expectedcompletiondate', 'eta', 'completion'],
  possession_date: ['possession', 'possessiondate', 'handover', 'handoverdate'],
  website: ['website', 'url', 'web'],
  open_space_pct: ['openspace', 'openspacepct', 'openspacepercentage'],
  overview: ['overview', 'description', 'about', 'projectoverview', 'summary'],
  water_sources: ['watersources', 'water', 'watersupply'],
  utilities: ['utilities', 'utility'],
  key_features: ['keyfeatures', 'features', 'highlights', 'usp'],
  // Brochure-style additional fields
  towers_count: ['towerscount', 'numberoftowers', 'totaltowers'],
  tower_names: ['towernames', 'towers', 'blocks', 'blocknames'],
  floors_each_tower: ['floorseachtower', 'floorspertower', 'floorcount'],
  config_range: ['configrange', 'configurationrange', 'unitrange'],
  clubhouse: ['clubhouse', 'club'],
  parking: ['parking', 'parkinglevels'],
  nearby_access: ['nearbyaccess', 'connectivity', 'access'],
  contact_phone: ['contactphone', 'phone', 'mobile', 'contactnumber'],
  contact_email: ['contactemail', 'email', 'enquiryemail'],
  office_address: ['officeaddress', 'salesoffice', 'siteoffice'],
};

// Map "loose" config headers from spreadsheets/JSON to canonical fields.
// Includes Hi-Tech / Moonglade-style headers.
const APARTMENT_CONFIG_SYNONYMS: Record<FieldKey, string[]> = {
  type_no: ['typeno', 'configno', 'configcode', 'unittype', 'typecode', 'no'],
  name: ['name', 'configname', 'configuration', 'type'],
  bhk: ['bhk', 'bedrooms', 'beds'],
  carpet_area: ['carpet', 'carpetarea', 'carpetareasft', 'carpetsqft'],
  built_up_area: ['builtup', 'builtuparea', 'builtuparesft', 'builtupsqft'],
  super_built_up_area: ['superbuiltup', 'superbuiltuparea', 'sba', 'saleablearea', 'saleableareasft'],
  balconies: ['balconies', 'balcony'],
  balcony_area: ['balconyarea', 'balconyareasft'],
  common_area: ['commonarea', 'commonareasft'],
  utility_area: ['utilityarea', 'utilityareasft'],
  wall_area: ['wallarea', 'wallareasft'],
  bathrooms: ['bathrooms', 'baths', 'toilets'],
  facing: ['facing', 'orientation'],
  tower: ['tower', 'block', 'wing', 'towermapping'],
  floor_range: ['floor', 'floorrange', 'floors'],
  units_planned: ['unitsplanned', 'count', 'noofunits'],
  unit_numbers: ['unitnumbers', 'unitno', 'unitnos', 'units'],
  pricing_range: ['price', 'pricing', 'pricerange', 'pricingrange', 'cost'],
  description: ['description', 'notes', 'remarks'],
  floorplan_crop_file: ['floorplancropfile', 'floorplanfile', 'floorplanimage', 'planfile', 'planimage'],
};

const VILLA_CONFIG_SYNONYMS: Record<FieldKey, string[]> = {
  ...APARTMENT_CONFIG_SYNONYMS,
  land_area: ['landarea', 'plotarea', 'land'],
  floors: ['floors', 'numberoffloors', 'storeys'],
};

const PLOT_CONFIG_SYNONYMS: Record<FieldKey, string[]> = {
  type_no: APARTMENT_CONFIG_SYNONYMS.type_no,
  name: APARTMENT_CONFIG_SYNONYMS.name,
  plot_size_band: ['sizeband', 'plotsizeband', 'band'],
  plot_area: ['plotarea', 'area', 'size'],
  dimensions: ['dimensions', 'plotdimensions'],
  facing: APARTMENT_CONFIG_SYNONYMS.facing,
  units_planned: APARTMENT_CONFIG_SYNONYMS.units_planned,
  cluster: ['cluster', 'zone', 'sector'],
  premium_marker: ['premium', 'premiummarker', 'priority'],
};

function configSynonymsFor(pt: PropertyType): Record<FieldKey, string[]> {
  return pt === 'VILLA' ? VILLA_CONFIG_SYNONYMS : pt === 'PLOT' ? PLOT_CONFIG_SYNONYMS : APARTMENT_CONFIG_SYNONYMS;
}

function matchField(header: string, synonyms: Record<FieldKey, string[]>): FieldKey | null {
  const n = norm(header);
  if (!n) return null;
  // Prefer exact match first to avoid greedy fuzzy collisions.
  for (const [field, list] of Object.entries(synonyms)) if (list.includes(n)) return field;
  for (const [field, list] of Object.entries(synonyms)) {
    if (list.some(s => s.length >= 4 && (n === s || n.startsWith(s) || s.startsWith(n)))) return field;
  }
  return null;
}

// ---------- Sheet shape detection ----------

type ParsedSheet = { name: string; aoa: unknown[][] };

async function readWorkbook(signedUrl: string, name: string): Promise<ParsedSheet[]> {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const res = await fetch(signedUrl);
  if (ext === 'csv') {
    const text = await res.text();
    const wb = XLSX.read(text, { type: 'string' });
    return wb.SheetNames.map(s => ({ name: s, aoa: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, defval: '', raw: false }) }));
  }
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(s => ({ name: s, aoa: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, defval: '', raw: false }) }));
}

async function readJson(signedUrl: string): Promise<unknown> {
  const res = await fetch(signedUrl);
  return await res.json();
}

function looksLikeKeyValue(aoa: unknown[][]): boolean {
  const nonEmpty = aoa.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''));
  if (nonEmpty.length < 2) return false;
  const kv = nonEmpty.filter(r => {
    const cells = r.map(c => String(c ?? '').trim()).filter(Boolean);
    return cells.length === 2;
  }).length;
  return kv / nonEmpty.length >= 0.6;
}

function fileNameHints(name: string): { isProjectSummary: boolean; isConfigurations: boolean; isMissingFields: boolean; isAmenities: boolean; isProximity: boolean } {
  const n = norm(name.replace(/\.[^.]+$/, ''));
  const isAmenities = /(amenit)/.test(n);
  const isProximity = /(proximit|nearby|connectivity|distance)/.test(n);
  return {
    isProjectSummary: /(projectsummary|summary|project|overview|projectinfo|details)/.test(n) && !isAmenities && !isProximity,
    isConfigurations: /(configurations?|units?|floorplans?|inventory|layout|types?|towerinfo|towers)/.test(n) && !isAmenities,
    isMissingFields: /(missing|gaps|todo)/.test(n),
    isAmenities,
    isProximity,
  };
}

function parseAmenitiesCsv(aoa: unknown[][]): string[] {
  if (aoa.length < 2) return [];
  const headers = (aoa[0] as unknown[]).map(h => norm(String(h ?? '')));
  const nameIdx = headers.findIndex(h => h === 'amenityname' || h === 'name' || h === 'amenity');
  if (nameIdx < 0) return [];
  const out: string[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!Array.isArray(r)) continue;
    const v = String(r[nameIdx] ?? '').trim();
    if (v) out.push(v);
  }
  return out;
}

function parseProximityCsv(aoa: unknown[][]): Array<{ name: string; distance_km: number | string }> {
  if (aoa.length < 2) return [];
  const headers = (aoa[0] as unknown[]).map(h => norm(String(h ?? '')));
  const nIdx = headers.findIndex(h => h === 'name' || h === 'place' || h === 'placename' || h === 'landmark');
  const dIdx = headers.findIndex(h => h.startsWith('distance') || h === 'km' || h === 'distancekm');
  if (nIdx < 0) return [];
  const out: Array<{ name: string; distance_km: number | string }> = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!Array.isArray(r)) continue;
    const name = String(r[nIdx] ?? '').trim();
    const d = dIdx >= 0 ? String(r[dIdx] ?? '').trim() : '';
    if (name) out.push({ name, distance_km: d });
  }
  return out;
}

// ---------- Parsers ----------

type ProjectExtract = Record<string, unknown>;

function assignProject(project: ProjectExtract, field: string, val: unknown) {
  const sval = typeof val === 'string' ? val.trim() : val;
  if (sval == null || sval === '') return;
  if (field === 'water_sources' || field === 'utilities' || field === 'key_features') {
    project[field] = String(sval).split(/[,;]/).map(s => s.trim()).filter(Boolean);
  } else if (field === 'total_units' || field === 'open_space_pct' || field === 'towers_count') {
    const n = Number(String(sval).replace(/[^\d.\-]/g, ''));
    if (!Number.isNaN(n)) project[field] = n;
  } else {
    project[field] = sval;
  }
}

function parseProjectKV(aoa: unknown[][]): { project: ProjectExtract; unmappedColumns: string[] } {
  const project: ProjectExtract = {};
  const unmapped: string[] = [];
  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    const key = String(row[0] ?? '').trim();
    const val = String(row[1] ?? '').trim();
    if (!key || !val) continue;
    const field = matchField(key, PROJECT_SYNONYMS);
    if (field) assignProject(project, field, val);
    else unmapped.push(key);
  }
  return { project, unmappedColumns: unmapped };
}

function parseProjectWide(aoa: unknown[][]): { project: ProjectExtract; unmappedColumns: string[] } {
  const project: ProjectExtract = {};
  const unmapped: string[] = [];
  if (aoa.length < 2) return { project, unmappedColumns: unmapped };
  const headers = (aoa[0] as unknown[]).map(h => String(h ?? '').trim());
  const firstData = aoa[1] as unknown[];
  headers.forEach((h, i) => {
    if (!h) return;
    const val = String(firstData?.[i] ?? '').trim();
    if (!val) return;
    const field = matchField(h, PROJECT_SYNONYMS);
    if (field) assignProject(project, field, val);
    else unmapped.push(h);
  });
  return { project, unmappedColumns: unmapped };
}

function parseConfigSheet(aoa: unknown[][], pt: PropertyType): { rows: Record<string, unknown>[]; unmappedColumns: string[] } {
  const rows: Record<string, unknown>[] = [];
  const unmapped: string[] = [];
  if (aoa.length < 2) return { rows, unmappedColumns: unmapped };
  const headers = (aoa[0] as unknown[]).map(h => String(h ?? '').trim());
  const synonyms = configSynonymsFor(pt);
  const headerToField = headers.map(h => ({ header: h, field: h ? matchField(h, synonyms) : null }));
  for (const h of headerToField) if (h.header && !h.field) unmapped.push(h.header);
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!Array.isArray(r) || !r.some(c => String(c ?? '').trim() !== '')) continue;
    const obj: Record<string, unknown> = {};
    let any = false;
    headerToField.forEach((h, idx) => {
      if (!h.field) return;
      const v = String(r[idx] ?? '').trim();
      if (!v) return;
      obj[h.field] = v;
      any = true;
    });
    if (any) {
      if (!obj.name) {
        const tn = obj.type_no ? `Type ${obj.type_no}` : `Config ${rows.length + 1}`;
        obj.name = obj.bhk ? `${tn} · ${obj.bhk}` : tn;
      }
      rows.push(obj);
    }
  }
  return { rows, unmappedColumns: Array.from(new Set(unmapped)) };
}

// JSON shape: { project: {...}, configurations: [...], missing_fields: [{field,status}] }
function parseExtractionJson(j: unknown, pt: PropertyType): {
  project: ProjectExtract;
  configRows: Record<string, unknown>[];
  missingFields: Array<{ field: string; status: string }>;
  unmappedColumns: string[];
} {
  const project: ProjectExtract = {};
  const configRows: Record<string, unknown>[] = [];
  const missingFields: Array<{ field: string; status: string }> = [];
  const unmapped: string[] = [];
  if (!j || typeof j !== 'object') return { project, configRows, missingFields, unmappedColumns: unmapped };
  const obj = j as Record<string, unknown>;

  const proj = (obj.project ?? obj.projectData ?? obj.summary) as Record<string, unknown> | undefined;
  if (proj && typeof proj === 'object') {
    for (const [k, v] of Object.entries(proj)) {
      const field = matchField(k, PROJECT_SYNONYMS);
      if (field) assignProject(project, field, v);
      else unmapped.push(`project.${k}`);
    }
  }

  const cfgs = (obj.configurations ?? obj.configs ?? obj.configurationData) as unknown;
  if (Array.isArray(cfgs)) {
    const synonyms = configSynonymsFor(pt);
    for (const raw of cfgs) {
      if (!raw || typeof raw !== 'object') continue;
      const row: Record<string, unknown> = {};
      let any = false;
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const sval = typeof v === 'string' ? v.trim() : v;
        if (sval == null || sval === '') continue;
        const field = matchField(k, synonyms);
        if (field) { row[field] = sval; any = true; }
        else unmapped.push(`configurations.${k}`);
      }
      if (any) {
        if (!row.name) {
          const tn = row.type_no ? `Type ${row.type_no}` : `Config ${configRows.length + 1}`;
          row.name = row.bhk ? `${tn} · ${row.bhk}` : tn;
        }
        configRows.push(row);
      }
    }
  }

  const miss = obj.missing_fields ?? obj.missingFields;
  if (Array.isArray(miss)) {
    for (const m of miss) {
      if (!m || typeof m !== 'object') continue;
      const r = m as Record<string, unknown>;
      const field = String(r.field ?? '').trim();
      const status = String(r.status ?? r.reason ?? '').trim();
      if (field) missingFields.push({ field, status });
    }
  }
  return { project, configRows, missingFields, unmappedColumns: Array.from(new Set(unmapped)) };
}

function parseMissingFieldsCsv(aoa: unknown[][]): Array<{ field: string; status: string }> {
  if (aoa.length < 2) return [];
  const headers = (aoa[0] as unknown[]).map(h => norm(String(h ?? '')));
  const fIdx = headers.findIndex(h => h === 'field' || h === 'name' || h === 'key');
  const sIdx = headers.findIndex(h => h === 'status' || h === 'reason' || h === 'note');
  if (fIdx < 0) return [];
  const out: Array<{ field: string; status: string }> = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] as unknown[];
    if (!Array.isArray(r)) continue;
    const f = String(r[fIdx] ?? '').trim();
    const s = sIdx >= 0 ? String(r[sIdx] ?? '').trim() : '';
    if (f) out.push({ field: f, status: s });
  }
  return out;
}

// ---------- Image classification ----------

export type ManifestEntry = { category: 'FLOOR_PLAN' | 'GALLERY' | 'LOGO'; caption?: string };

// Parse a manifest array like:
//  [{ source_page: 18, side: 'left', file: 'floorplan_crops/p18_left_fullsheet.png' },
//   { source_page: 17, type: 'master_plan', file: 'project_images/p17_master_plan.png' }]
// Returns a map keyed by lowercase basename.
function parseImageManifest(j: unknown): Map<string, ManifestEntry> {
  const out = new Map<string, ManifestEntry>();
  if (!Array.isArray(j)) return out;
  for (const raw of j) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const file = String(r.file ?? r.path ?? r.name ?? '').trim();
    if (!file) continue;
    const base = (file.split('/').pop() || file).toLowerCase();
    const folder = file.includes('/') ? file.split('/').slice(0, -1).join('/').toLowerCase() : '';
    const type = String(r.type ?? '').trim();
    const side = String(r.side ?? '').trim();
    const page = r.source_page != null ? String(r.source_page) : '';
    let category: ManifestEntry['category'] = 'GALLERY';
    if (folder.includes('floorplan') || /floorplan|floor_plan|fullsheet/.test(base)) category = 'FLOOR_PLAN';
    else if (folder.includes('logo') || base.includes('logo')) category = 'LOGO';
    else category = 'GALLERY';
    const captionParts: string[] = [];
    if (type) captionParts.push(type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    if (page) captionParts.push(`Page ${page}`);
    if (side) captionParts.push(`(${side})`);
    out.set(base, { category, caption: captionParts.join(' · ') || undefined });
  }
  return out;
}

function classifyImageFor(
  name: string,
  configFloorplanFiles: Map<string, string>,
  manifest: Map<string, ManifestEntry>,
): { category: 'LOGO' | 'FLOOR_PLAN' | 'GALLERY'; configId?: string; caption?: string } {
  const lower = name.toLowerCase();
  const base = lower.split('/').pop() || lower;
  // 1. Manifest wins
  const m = manifest.get(base);
  if (m) {
    const configId = m.category === 'FLOOR_PLAN' ? configFloorplanFiles.get(base) : undefined;
    return { category: m.category, configId, caption: m.caption };
  }
  if (lower.includes('logo')) return { category: 'LOGO' };
  // Direct match on floorplan_crop_file references
  if (configFloorplanFiles.has(base)) return { category: 'FLOOR_PLAN', configId: configFloorplanFiles.get(base) };
  // Hi-Tech naming: anything containing project_image / projectimage → gallery
  if (/(projectimage|project_image|elevation|render|gallery|amenity|amenities|clubhouse|view|aerial|location|master_plan|masterplan)/.test(lower)) return { category: 'GALLERY' };
  // Generic floor-plan keywords
  if (/(floorplan|floor_plan|floor-plan|floor|plan|layout|fullsheet)/.test(lower)) return { category: 'FLOOR_PLAN' };
  return { category: 'GALLERY' };
}

// ---------- Main entry ----------

export type AutoMapResult = {
  mappedAt: string;
  projectFieldsMapped: string[];
  unmappedFields: string[];
  unmappedColumns: string[];
  missingFields: Array<{ field: string; status: string }>;
  configsCreated: number;
  mediaCreated: number;
  towersCreated: number;
  sheetsParsed: string[];
  filesProcessed: { name: string; kind: 'json' | 'spreadsheet' | 'image' | 'skipped' }[];
};

const TARGET_PROJECT_FIELDS = Object.keys(PROJECT_SYNONYMS);

export async function autoMapProjectImport(job: ImportJob, actorId?: string | null): Promise<AutoMapResult> {
  const pt = (job.property_type ?? 'APARTMENT') as PropertyType;
  const { data: filesData } = await supabase.from('import_files').select('*').eq('job_id', job.id).order('created_at', { ascending: false });
  const files = (filesData ?? []) as ImportFile[];

  const filesProcessed: AutoMapResult['filesProcessed'] = [];
  let project: ProjectExtract = ((job.extracted_data as { projectData?: ProjectExtract })?.projectData) || {};
  const configRows: Record<string, unknown>[] = [];
  const unmappedColumns = new Set<string>();
  const missingFields: Array<{ field: string; status: string }> = [];
  const sheetsParsed: string[] = [];
  const imageManifest = new Map<string, ManifestEntry>();
  const amenitiesAcc: string[] = [];
  const proximityAcc: Array<{ name: string; distance_km: number | string }> = [];

  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const hints = fileNameHints(f.name);
    try {
      const { data: signed } = ['xlsx', 'xls', 'csv', 'json'].includes(ext)
        ? await supabase.storage.from('import-files').createSignedUrl(f.storage_path, 60 * 5)
        : { data: null };

      if (ext === 'json' && signed?.signedUrl) {
        const j = await readJson(signed.signedUrl);
        // Manifest array: classify uploaded images
        if (Array.isArray(j)) {
          const m = parseImageManifest(j);
          m.forEach((v, k) => imageManifest.set(k, v));
          sheetsParsed.push(`${f.name}:manifest(${m.size})`);
          filesProcessed.push({ name: f.name, kind: 'json' });
          continue;
        }
        const r = parseExtractionJson(j, pt);
        project = { ...project, ...r.project };
        configRows.push(...r.configRows);
        r.unmappedColumns.forEach(c => unmappedColumns.add(c));
        missingFields.push(...r.missingFields);
        sheetsParsed.push(`${f.name}:json`);
        filesProcessed.push({ name: f.name, kind: 'json' });
        continue;
      }

      if (['xlsx', 'xls', 'csv'].includes(ext) && signed?.signedUrl) {
        const sheets = await readWorkbook(signed.signedUrl, f.name);
        for (const s of sheets) {
          sheetsParsed.push(`${f.name}:${s.name}`);
          // missing_fields file
          if (hints.isMissingFields) {
            missingFields.push(...parseMissingFieldsCsv(s.aoa));
            continue;
          }
          // amenities file
          if (hints.isAmenities) {
            amenitiesAcc.push(...parseAmenitiesCsv(s.aoa));
            continue;
          }
          // proximity file
          if (hints.isProximity) {
            proximityAcc.push(...parseProximityCsv(s.aoa));
            continue;
          }
          // configurations file
          if (hints.isConfigurations) {
            const { rows, unmappedColumns: u } = parseConfigSheet(s.aoa, pt);
            configRows.push(...rows);
            u.forEach(c => unmappedColumns.add(`${f.name}.${c}`));
            continue;
          }
          // project summary
          if (hints.isProjectSummary) {
            if (looksLikeKeyValue(s.aoa)) {
              const { project: p, unmappedColumns: u } = parseProjectKV(s.aoa);
              project = { ...project, ...p };
              u.forEach(c => unmappedColumns.add(`${f.name}.${c}`));
            } else {
              const { project: p, unmappedColumns: u } = parseProjectWide(s.aoa);
              project = { ...project, ...p };
              u.forEach(c => unmappedColumns.add(`${f.name}.${c}`));
            }
            continue;
          }
          // Generic: try wide then config then KV
          const wide = parseProjectWide(s.aoa);
          if (Object.keys(wide.project).length >= 3) {
            project = { ...project, ...wide.project };
            wide.unmappedColumns.forEach(c => unmappedColumns.add(`${f.name}.${c}`));
          } else if (looksLikeKeyValue(s.aoa)) {
            const kv = parseProjectKV(s.aoa);
            project = { ...project, ...kv.project };
            kv.unmappedColumns.forEach(c => unmappedColumns.add(`${f.name}.${c}`));
          } else {
            const { rows, unmappedColumns: u } = parseConfigSheet(s.aoa, pt);
            configRows.push(...rows);
            u.forEach(c => unmappedColumns.add(`${f.name}.${c}`));
          }
        }
        filesProcessed.push({ name: f.name, kind: 'spreadsheet' });
        continue;
      }

      if (f.mime_type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        filesProcessed.push({ name: f.name, kind: 'image' });
      } else {
        filesProcessed.push({ name: f.name, kind: 'skipped' });
      }
    } catch {
      filesProcessed.push({ name: f.name, kind: 'skipped' });
    }
  }

  // Derive towers list from project.tower_names (comma separated) — clean &-pairs.
  const towerNamesRaw = String(project.tower_names ?? '').trim();
  const towers: string[] = towerNamesRaw
    ? Array.from(new Set(towerNamesRaw.split(/[,;]/).flatMap(s => s.split(/\s*&\s*/)).map(s => s.trim()).filter(Boolean)))
    : [];

  // Dedup configRows: same config can arrive via JSON + CSV. Key by type_no/name + bhk + areas + tower.
  const dedupKey = (r: Record<string, unknown>) => [
    r.type_no, r.name, r.bhk, r.carpet_area, r.super_built_up_area, r.built_up_area, r.tower,
  ].map(v => norm(String(v ?? ''))).join('|');
  const seen = new Set<string>();
  const dedupedConfigRows: Record<string, unknown>[] = [];
  for (const row of configRows) {
    const k = dedupKey(row);
    if (k === '|||||' || !seen.has(k)) { dedupedConfigRows.push(row); seen.add(k); }
  }

  // Insert configurations (only first AUTOMAP run; never duplicate).
  const { data: existingAutoConfigs } = await supabase.from('import_project_configs')
    .select('id, data').eq('job_id', job.id).eq('source', 'AUTOMAP');
  let configsCreated = 0;
  const configFloorplanFiles = new Map<string, string>(); // filename(lower) -> config_id
  if ((existingAutoConfigs?.length ?? 0) === 0 && dedupedConfigRows.length > 0) {
    const inserts = dedupedConfigRows.map((data, idx) => ({
      job_id: job.id, sort_order: idx, data: data as never, source: 'AUTOMAP',
    }));
    const { data: inserted } = await supabase.from('import_project_configs').insert(inserts).select('id, data');
    configsCreated = inserted?.length ?? 0;
    (inserted ?? []).forEach(c => {
      const fp = (c.data as Record<string, unknown> | null)?.floorplan_crop_file;
      if (typeof fp === 'string' && fp) configFloorplanFiles.set(fp.toLowerCase(), c.id);
    });
  } else {
    (existingAutoConfigs ?? []).forEach(c => {
      const fp = (c.data as Record<string, unknown> | null)?.floorplan_crop_file;
      if (typeof fp === 'string' && fp) configFloorplanFiles.set(fp.toLowerCase(), c.id);
    });
  }

  // Insert media for image files (skip duplicates by storage_path)
  const { data: existingMedia } = await supabase.from('import_project_media')
    .select('storage_path').eq('job_id', job.id);
  const existingPaths = new Set((existingMedia ?? []).map(m => m.storage_path));
  let mediaCreated = 0;
  const imageFiles = files.filter(f => {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    return f.mime_type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  });
  const mediaInserts = imageFiles
    .filter(f => !existingPaths.has(f.storage_path))
    .map(f => {
      const c = classifyImageFor(f.name, configFloorplanFiles, imageManifest);
      return {
        job_id: job.id,
        category: c.category,
        config_id: c.configId ?? null,
        storage_path: f.storage_path,
        caption: c.caption || f.name,
        review_state: 'PENDING' as const,
        source: 'AUTOMAP',
      };
    });
  if (mediaInserts.length > 0) {
    const { error } = await supabase.from('import_project_media').insert(mediaInserts as never);
    if (!error) mediaCreated = mediaInserts.length;
  }

  const projectFieldsMapped = Object.keys(project).filter(k => {
    const v = (project as Record<string, unknown>)[k];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
  const unmappedFields = TARGET_PROJECT_FIELDS.filter(f => !projectFieldsMapped.includes(f));

  const result: AutoMapResult = {
    mappedAt: new Date().toISOString(),
    projectFieldsMapped,
    unmappedFields,
    unmappedColumns: Array.from(unmappedColumns),
    missingFields,
    configsCreated,
    mediaCreated,
    towersCreated: towers.length,
    sheetsParsed,
    filesProcessed,
  };

  const prevAmenities = ((job.extracted_data as { amenities?: string[] })?.amenities) || [];
  const mergedAmenities = Array.from(new Set([...prevAmenities, ...amenitiesAcc].map(s => s.trim()).filter(Boolean)));
  const prevProximity = ((job.extracted_data as { proximityMatrix?: Array<{ name: string; distance_km: number | string }> })?.proximityMatrix) || [];
  const proxKey = (p: { name: string }) => norm(p.name);
  const mergedProximity = [...prevProximity];
  for (const p of proximityAcc) {
    if (p.name && !mergedProximity.some(x => proxKey(x) === proxKey(p))) mergedProximity.push(p);
  }

  const merged = {
    ...((job.extracted_data as object) || {}),
    projectData: { ...((job.extracted_data as { projectData?: ProjectExtract })?.projectData || {}), ...project },
    towers,
    amenities: mergedAmenities,
    proximityMatrix: mergedProximity,
    autoMap: result as never,
  };
  await supabase.from('import_jobs').update({ extracted_data: merged as never }).eq('id', job.id);
  await logActivity(supabase, job.id, 'auto_mapped', {
    configsCreated, mediaCreated, towersCreated: towers.length,
    mappedFields: projectFieldsMapped.length,
    unmappedFields: unmappedFields.length, unmappedColumns: result.unmappedColumns.length,
    missingFields: missingFields.length,
  }, actorId ?? null);

  return result;
}
