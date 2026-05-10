// Auto-map uploaded files for a Project import job.
// - Parses the most recent xlsx/csv (all sheets) into project fields + configurations
// - Classifies images into LOGO / FLOOR_PLAN / GALLERY
// - Records unmapped fields & unmapped spreadsheet columns into job.extracted_data.autoMap
//
// This runs client-side after files are uploaded.

import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import type { ImportJob, ImportFile, PropertyType } from './shared';
import { logActivity } from './shared';

// ---------- Field synonyms ----------

type FieldKey = string;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const PROJECT_SYNONYMS: Record<FieldKey, string[]> = {
  project_name: ['project', 'projectname', 'name', 'projecttitle'],
  builder_name: ['builder', 'developer', 'buildername', 'developername', 'builderdeveloper', 'company'],
  city: ['city', 'town', 'location'],
  address: ['address', 'fulladdress', 'projectaddress', 'siteaddress'],
  rera_id: ['rera', 'reraid', 'reranumber', 'reraapproval', 'approval', 'approvalid'],
  status: ['status', 'projectstatus', 'constructionstatus'],
  site_area: ['sitearea', 'totalarea', 'landarea', 'plotarea', 'area'],
  site_area_unit: ['siteareaunit', 'areaunit', 'unit'],
  community_type: ['communitytype', 'community', 'projecttype'],
  approach_road_width: ['approachroadwidth', 'roadwidth', 'approachroad'],
  total_units: ['totalunits', 'units', 'noofunits', 'totalflats'],
  expected_completion_date: ['expectedcompletion', 'completiondate', 'expectedcompletiondate', 'eta'],
  possession_date: ['possession', 'possessiondate', 'handover', 'handoverdate'],
  website: ['website', 'url', 'web', 'site'],
  open_space_pct: ['openspace', 'openspacepct', 'openspacepercentage'],
  overview: ['overview', 'description', 'about', 'projectoverview', 'summary'],
  water_sources: ['watersources', 'water', 'watersupply'],
  utilities: ['utilities', 'utility'],
  key_features: ['keyfeatures', 'features', 'highlights', 'usp'],
};

const APARTMENT_CONFIG_SYNONYMS: Record<FieldKey, string[]> = {
  name: ['name', 'configname', 'configuration', 'type', 'unittype'],
  bhk: ['bhk', 'bedrooms', 'beds'],
  carpet_area: ['carpet', 'carpetarea', 'carpetsqft'],
  built_up_area: ['builtup', 'builtuparea', 'builtupsqft'],
  super_built_up_area: ['superbuiltup', 'superbuiltuparea', 'sba'],
  balconies: ['balconies', 'balcony'],
  bathrooms: ['bathrooms', 'baths', 'toilets'],
  facing: ['facing', 'orientation'],
  tower: ['tower', 'block', 'wing'],
  floor_range: ['floor', 'floorrange', 'floors'],
  units_planned: ['unitsplanned', 'units', 'count', 'noofunits'],
  pricing_range: ['price', 'pricing', 'pricerange', 'pricingrange', 'cost'],
  description: ['description', 'notes', 'remarks'],
};

const VILLA_CONFIG_SYNONYMS: Record<FieldKey, string[]> = {
  name: APARTMENT_CONFIG_SYNONYMS.name,
  bhk: APARTMENT_CONFIG_SYNONYMS.bhk,
  land_area: ['landarea', 'plotarea', 'land'],
  built_up_area: APARTMENT_CONFIG_SYNONYMS.built_up_area,
  floors: ['floors', 'numberoffloors', 'storeys'],
  bathrooms: APARTMENT_CONFIG_SYNONYMS.bathrooms,
  facing: APARTMENT_CONFIG_SYNONYMS.facing,
  units_planned: APARTMENT_CONFIG_SYNONYMS.units_planned,
  pricing_range: APARTMENT_CONFIG_SYNONYMS.pricing_range,
};

const PLOT_CONFIG_SYNONYMS: Record<FieldKey, string[]> = {
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
  for (const [field, list] of Object.entries(synonyms)) {
    if (list.includes(n)) return field;
    // fuzzy contains
    if (list.some(s => n.includes(s) || s.includes(n))) return field;
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

function looksLikeKeyValue(aoa: unknown[][]): boolean {
  // If most non-empty rows have exactly 2 non-empty cells, treat as key-value.
  const nonEmpty = aoa.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''));
  if (nonEmpty.length < 2) return false;
  const kvRows = nonEmpty.filter(r => {
    const cells = r.map(c => String(c ?? '').trim()).filter(Boolean);
    return cells.length === 2;
  }).length;
  return kvRows / nonEmpty.length >= 0.6;
}

function sheetIsConfigLike(name: string): boolean {
  const n = norm(name);
  return /(config|unit|plan|floorplan|inventory|layout|type)/.test(n);
}
function sheetIsSummaryLike(name: string): boolean {
  const n = norm(name);
  return /(summary|project|overview|info|details|about|main)/.test(n);
}

// ---------- Project field parsing ----------

type ProjectExtract = Record<string, unknown>;

function parseProjectKV(aoa: unknown[][]): { project: ProjectExtract; unmappedColumns: string[] } {
  const project: ProjectExtract = {};
  const unmapped: string[] = [];
  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    const key = String(row[0] ?? '').trim();
    const val = String(row[1] ?? '').trim();
    if (!key || !val) continue;
    const field = matchField(key, PROJECT_SYNONYMS);
    if (field) {
      assignProject(project, field, val);
    } else {
      unmapped.push(key);
    }
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

function assignProject(project: ProjectExtract, field: string, val: string) {
  if (field === 'water_sources' || field === 'utilities' || field === 'key_features') {
    project[field] = val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  } else if (field === 'total_units' || field === 'open_space_pct') {
    const n = Number(val.replace(/[^\d.\-]/g, ''));
    if (!Number.isNaN(n)) project[field] = n;
  } else {
    project[field] = val;
  }
}

// ---------- Config rows parsing ----------

function parseConfigSheet(aoa: unknown[][], pt: PropertyType): { rows: Record<string, unknown>[]; unmappedColumns: string[] } {
  const rows: Record<string, unknown>[] = [];
  const unmapped: string[] = [];
  if (aoa.length < 2) return { rows, unmappedColumns: unmapped };
  const headers = (aoa[0] as unknown[]).map(h => String(h ?? '').trim());
  const synonyms = configSynonymsFor(pt);
  const headerToField: Array<{ header: string; field: string | null }> = headers.map(h => ({ header: h, field: h ? matchField(h, synonyms) : null }));
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
      if (!obj.name) obj.name = `Config ${rows.length + 1}`;
      rows.push(obj);
    }
  }
  return { rows, unmappedColumns: Array.from(new Set(unmapped)) };
}

// ---------- Image classification ----------

function classifyImage(name: string): 'LOGO' | 'FLOOR_PLAN' | 'GALLERY' {
  const n = name.toLowerCase();
  if (n.includes('logo')) return 'LOGO';
  if (/(floor|plan|layout)/.test(n)) return 'FLOOR_PLAN';
  return 'GALLERY';
}

// ---------- Main entry ----------

export type AutoMapResult = {
  mappedAt: string;
  projectFieldsMapped: string[];
  unmappedFields: string[];
  unmappedColumns: string[];
  configsCreated: number;
  mediaCreated: number;
  sheetsParsed: string[];
  filesProcessed: { name: string; kind: 'spreadsheet' | 'image' | 'skipped' }[];
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
  const sheetsParsed: string[] = [];

  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      try {
        const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(f.storage_path, 60 * 5);
        if (!signed?.signedUrl) { filesProcessed.push({ name: f.name, kind: 'skipped' }); continue; }
        const sheets = await readWorkbook(signed.signedUrl, f.name);
        for (const s of sheets) {
          sheetsParsed.push(`${f.name}:${s.name}`);
          if (sheetIsConfigLike(s.name)) {
            const { rows, unmappedColumns: u } = parseConfigSheet(s.aoa, pt);
            configRows.push(...rows);
            u.forEach(c => unmappedColumns.add(`${s.name}.${c}`));
          } else if (sheetIsSummaryLike(s.name) || looksLikeKeyValue(s.aoa)) {
            const { project: p, unmappedColumns: u } = parseProjectKV(s.aoa);
            project = { ...project, ...p };
            u.forEach(c => unmappedColumns.add(`${s.name}.${c}`));
          } else {
            // Try wide first; if nothing mapped, try config layout
            const { project: p, unmappedColumns: uw } = parseProjectWide(s.aoa);
            const mappedAny = Object.keys(p).length > 0;
            if (mappedAny) {
              project = { ...project, ...p };
              uw.forEach(c => unmappedColumns.add(`${s.name}.${c}`));
            } else {
              const { rows, unmappedColumns: uc } = parseConfigSheet(s.aoa, pt);
              configRows.push(...rows);
              uc.forEach(c => unmappedColumns.add(`${s.name}.${c}`));
            }
          }
        }
        filesProcessed.push({ name: f.name, kind: 'spreadsheet' });
      } catch {
        filesProcessed.push({ name: f.name, kind: 'skipped' });
      }
    } else if (f.mime_type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      filesProcessed.push({ name: f.name, kind: 'image' });
    } else {
      filesProcessed.push({ name: f.name, kind: 'skipped' });
    }
  }

  // Insert configurations (only the new ones from this run; we replace nothing existing).
  // To avoid duplicates on re-uploads, only insert configs if no extracted/manual configs are tied to source 'AUTOMAP'.
  const { data: existingAutoConfigs } = await supabase.from('import_project_configs')
    .select('id').eq('job_id', job.id).eq('source', 'AUTOMAP');
  let configsCreated = 0;
  if ((existingAutoConfigs?.length ?? 0) === 0 && configRows.length > 0) {
    const inserts = configRows.map((data, idx) => ({
      job_id: job.id, sort_order: idx, data: data as never, source: 'AUTOMAP',
    }));
    const { error } = await supabase.from('import_project_configs').insert(inserts);
    if (!error) configsCreated = inserts.length;
  }

  // Insert media for images (skip if a media row already references the same storage_path)
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
    .map(f => ({
      job_id: job.id,
      category: classifyImage(f.name),
      storage_path: f.storage_path,
      caption: f.name,
      review_state: 'PENDING' as const,
      source: 'AUTOMAP',
    }));
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
    configsCreated,
    mediaCreated,
    sheetsParsed,
    filesProcessed,
  };

  // Persist the merged project + autoMap report into job.extracted_data
  const merged = {
    ...((job.extracted_data as object) || {}),
    projectData: { ...((job.extracted_data as { projectData?: ProjectExtract })?.projectData || {}), ...project },
    autoMap: result as never,
  };
  await supabase.from('import_jobs').update({ extracted_data: merged as never }).eq('id', job.id);
  await logActivity(supabase, job.id, 'auto_mapped', {
    configsCreated, mediaCreated, mappedFields: projectFieldsMapped.length,
    unmappedFields: unmappedFields.length, unmappedColumns: result.unmappedColumns.length,
  }, actorId ?? null);

  return result;
}
