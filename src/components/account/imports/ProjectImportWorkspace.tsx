import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/shared/MultiSelect';
import {
  Loader2, Save, Sparkles, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Plus, Trash2, Upload, X,
  Image as ImageIcon, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ImportJob, STATUS_LABEL, STATUS_TONE, ImportStatus, PropertyType, PROPERTY_TYPE_LABEL,
  ImportConfig, ImportMedia, MediaCategory, MediaReview, logActivity,
} from './shared';
import { SourceFiles } from './SourceFiles';
import { ActivityLog } from './ActivityLog';
import { LinkedAccountsCard } from './LinkedAccountsCard';
import { OwnerAccountCard } from './OwnerAccountCard';
import { autoMapProjectImport, deriveCityFromLocation, type AutoMapResult } from './autoMapProjectImport';
import { useUser } from '@/context/UserContext';

type Rep = {
  builder_name?: string; project_name?: string; city?: string;
  representative_name?: string; representative_phone?: string; representative_email?: string;
  website?: string; expected_completion_date?: string; banks?: string; notes?: string;
  // Deprecated/hidden fields kept for backward compatibility (not shown in UI)
  address?: string; rera_id?: string; status?: string; possession_date?: string;
};

type ProjectExtract = {
  project_name?: string; builder_name?: string; city?: string;
  address?: string; maps_url?: string;
  rera_id?: string; status?: string; open_space_pct?: number;
  site_area?: string; site_area_unit?: string;
  site_area_acres?: number | string; site_area_guntas?: number | string;
  community_type?: string;
  approach_road_width?: string; total_units?: number; website?: string;
  overview?: string; expected_completion_date?: string;
  water_sources?: string[]; utilities?: string[]; key_features?: string[];
  location?: string;
  // Apartment
  tower_names_list?: string[]; floors_each_tower?: string;
  // Villa / Plot
  clusters_count?: number | string; cluster_names?: string[];
  // Villa
  floors_per_unit?: string;
  contact_phone?: string; contact_email?: string; office_address?: string;
  // Deprecated/hidden — auto-folded into overview where present
  possession_date?: string; project_type?: string;
  towers_count?: number | string; tower_names?: string;
  config_range?: string; clubhouse?: string; parking?: string; nearby_access?: string;
};

const REQUIRED_FIELDS: Array<keyof ProjectExtract> = ['project_name', 'builder_name', 'city', 'address'];

// Only values that Terrisage explicitly accepts. Anything from the CSV that doesn't match these is
// silently dropped on push (per spec) so we never offer non-accepted options here.
const COMMUNITY_TYPES_BY_PT: Record<PropertyType, string[]> = {
  APARTMENT: ['Gated', 'Open'],
  VILLA: ['Gated', 'Open'],
  PLOT: ['Gated', 'Open'],
};

const STATUS_OPTIONS = ['Under Construction', 'Phase 1 completed', 'Completed (with OC)'];

const WATER_SOURCE_OPTIONS = ['Borewell', 'Municipal', 'Tanker', 'Lake', 'Other'];
const UTILITY_OPTIONS = ['Electricity', 'Water', 'Gas', 'Sewage', 'STP', 'Intercom', 'Rainwater harvesting', 'Storm water drains'];

// Parse "4.5", "4 acres 11 guntas", or numeric to {acres, guntas}
function parseAcresGuntas(siteArea: unknown): { acres: number; guntas: number } {
  const s = String(siteArea ?? '').trim();
  if (!s) return { acres: 0, guntas: 0 };
  const ag = s.match(/([\d.]+)\s*ac[a-z]*\s*([\d.]+)?\s*gun/i);
  if (ag) return { acres: Number(ag[1]) || 0, guntas: Number(ag[2] ?? 0) || 0 };
  const n = Number(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return { acres: 0, guntas: 0 };
  const acres = Math.floor(n);
  const guntas = Math.round((n - acres) * 40);
  return { acres, guntas };
}

function combineAcresGuntas(acres: number | string, guntas: number | string): number {
  const a = Number(acres) || 0;
  const g = Number(guntas) || 0;
  return Number((a + g / 40).toFixed(4));
}

// Derive a locality from a Google Maps URL or free-text address
function deriveLocalityFromMapsUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
    if (q) return decodeURIComponent(q.split(',')[0].trim());
    const place = u.pathname.match(/\/place\/([^/]+)/);
    if (place) return decodeURIComponent(place[1].replace(/\+/g, ' ').split(',')[0].trim());
  } catch { /* not a URL */ }
  return '';
}

const MEDIA_CATEGORIES: MediaCategory[] = ['LOGO', 'GALLERY', 'FLOOR_PLAN', 'BROCHURE', 'VIDEO', 'DOCUMENT', 'OTHER'];
const MEDIA_REVIEWS: MediaReview[] = ['PENDING', 'CORRECT', 'INCORRECT', 'DUPLICATE', 'NEEDS_RECROP'];

// 'tower' is rendered as a Select (Apartment only) wired to tower_names_list.
const APARTMENT_FIELDS = [
  ['type_no', 'Type no.'], ['name', 'Configuration name'], ['bhk', 'BHK'],
  ['carpet_area', 'Carpet area (sqft)'], ['super_built_up_area', 'Saleable / SBA (sqft)'],
  ['built_up_area', 'Built-up (sqft)'], ['balcony_area', 'Balcony area (sqft)'],
  ['common_area', 'Common area (sqft)'], ['utility_area', 'Utility area (sqft)'],
  ['wall_area', 'Wall area (sqft)'], ['balconies', 'Balconies'], ['bathrooms', 'Bathrooms'],
  ['master_bedroom_size', 'Master bedroom size'], ['variant', 'Variant'],
  ['facing', 'Facing'], ['tower', 'Tower / Block'], ['floor_range', 'Floor range'],
  ['units_planned', 'Units planned'], ['unit_numbers', 'Unit numbers'],
  ['pricing_range', 'Pricing range'], ['floorplan_crop_file', 'Floor plan file'],
];
const VILLA_FIELDS = [
  ['name', 'Configuration name'], ['bhk', 'BHK'], ['land_area', 'Land area'],
  ['built_up_area', 'Built-up (sqft)'], ['floors', 'Number of floors'], ['bathrooms', 'Bathrooms'],
  ['master_bedroom_size', 'Master bedroom size'], ['variant', 'Variant'],
  ['facing', 'Facing'], ['units_planned', 'Units planned'], ['pricing_range', 'Pricing range'],
];
const PLOT_FIELDS = [
  ['name', 'Plot family name'], ['plot_size_band', 'Size band'], ['plot_area', 'Plot area'],
  ['dimensions', 'Dimensions'], ['facing', 'Facing'], ['units_planned', 'Units planned'],
  ['cluster', 'Cluster / Zone'], ['premium_marker', 'Premium marker'],
];

/** Convert any string date (ISO, dd/mm/yyyy, "Dec 2026", etc.) into yyyy-mm-dd for <input type="date">. Returns '' when not parseable. */
function toDateInput(v: string | null | undefined): string {
  if (!v) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return '';
}

function fieldsFor(pt: PropertyType): string[][] {
  return pt === 'VILLA' ? VILLA_FIELDS : pt === 'PLOT' ? PLOT_FIELDS : APARTMENT_FIELDS;
}

export function ProjectImportWorkspace({ job, onChange }: { job: ImportJob; onChange?: () => void }) {
  const { currentUser } = useUser();
  const propertyType = (job.property_type ?? 'APARTMENT') as PropertyType;

  const [rep, setRep] = useState<Rep>(((job.representative_input as Rep) || {}));
  const [project, setProject] = useState<ProjectExtract>(((job.extracted_data as { projectData?: ProjectExtract })?.projectData || {}));
  const [amenities, setAmenities] = useState<string>(((job.extracted_data as { amenities?: string[] })?.amenities || []).join(', '));
  const [proximity, setProximity] = useState<Array<{ name: string; distance_km: number | string }>>(((job.extracted_data as { proximityMatrix?: Array<{ name: string; distance_km: number | string }> })?.proximityMatrix || []));
  const [banks, setBanks] = useState<string>(((job.extracted_data as { approvedBanks?: string[] })?.approvedBanks || []).join(', '));

  const [configs, setConfigs] = useState<ImportConfig[]>([]);
  const [media, setMedia] = useState<ImportMedia[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [amenityMaster, setAmenityMaster] = useState<Array<{ display_name: string; code: string | null; property_type: string }>>([]);

  useEffect(() => {
    supabase.from('terrisage_amenity_master')
      .select('display_name, code, property_type')
      .then(({ data }) => setAmenityMaster(data ?? []));
  }, []);

  // Map typed amenities against the Terrisage master for the selected property type.
  const { mappedAmenities, unmappedAmenities } = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    const lookup = new Map<string, { display_name: string; code: string | null }>();
    for (const m of amenityMaster) {
      if (m.property_type && m.property_type !== propertyType) continue;
      lookup.set(norm(m.display_name), { display_name: m.display_name, code: m.code });
      if (m.code) lookup.set(norm(m.code), { display_name: m.display_name, code: m.code });
    }
    const items = amenities.split(',').map(s => s.trim()).filter(Boolean);
    const mapped: Array<{ input: string; display_name: string; code: string | null }> = [];
    const unmapped: string[] = [];
    for (const a of items) {
      const hit = lookup.get(norm(a));
      if (hit) mapped.push({ input: a, display_name: hit.display_name, code: hit.code });
      else unmapped.push(a);
    }
    return { mappedAmenities: mapped, unmappedAmenities: unmapped };
  }, [amenities, amenityMaster, propertyType]);
  
  const [importing, setImporting] = useState(false);
  const [hasOwner, setHasOwner] = useState<boolean>(!!(job as { owner_account_id?: string | null }).owner_account_id);
  const [savingRep, setSavingRep] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const refresh = useCallback(async () => {
    const [{ data: cfg }, { data: m }] = await Promise.all([
      supabase.from('import_project_configs').select('*').eq('job_id', job.id).order('sort_order'),
      supabase.from('import_project_media').select('*').eq('job_id', job.id).order('created_at'),
    ]);
    setConfigs((cfg ?? []) as ImportConfig[]);
    setMedia((m ?? []) as ImportMedia[]);
  }, [job.id]);
  useEffect(() => { refresh(); }, [refresh]);

  // Generate signed URLs for media items so thumbnails actually render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const needs = media.filter(m => m.storage_path && !mediaUrls[m.id]);
      if (needs.length === 0) return;
      const entries = await Promise.all(needs.map(async m => {
        if (m.external_url) return [m.id, m.external_url] as const;
        const { data } = await supabase.storage.from('import-files').createSignedUrl(m.storage_path!, 60 * 60);
        return [m.id, data?.signedUrl ?? ''] as const;
      }));
      if (cancelled) return;
      setMediaUrls(prev => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [media, mediaUrls]);

  // Re-sync local edit state when job changes (e.g. after extraction).
  // Representative input only carries fields not duplicated on the project record.
  useEffect(() => {
    const incomingRep = (job.representative_input as Rep) || {};
    const proj = (job.extracted_data as { projectData?: ProjectExtract })?.projectData || {};
    const repFromProject: Rep = {
      builder_name: proj.builder_name,
      project_name: proj.project_name,
      city: proj.city,
      representative_phone: proj.contact_phone,
      representative_email: proj.contact_email,
      website: proj.website,
      expected_completion_date: proj.expected_completion_date,
    };
    const merged: Rep = { ...repFromProject };
    (Object.keys(incomingRep) as (keyof Rep)[]).forEach(k => {
      const v = incomingRep[k];
      if (v != null && String(v).trim() !== '') (merged as Record<string, unknown>)[k] = v;
    });
    setRep(merged);
    setProject(proj);
    setAmenities(((job.extracted_data as { amenities?: string[] })?.amenities || []).join(', '));
    setProximity((job.extracted_data as { proximityMatrix?: Array<{ name: string; distance_km: number | string }> })?.proximityMatrix || []);
    setBanks(((job.extracted_data as { approvedBanks?: string[] })?.approvedBanks || []).join(', '));
  }, [job.id, job.extracted_data, job.representative_input]);

  // Live-derive total_units = sum of units_planned across configurations.
  // Also infer city from location when blank. These keep the review pane in
  // sync as the user edits configs without needing a full re-extract.
  useEffect(() => {
    const sum = configs.reduce((acc, c) => {
      const v = (c.data as Record<string, unknown> | null)?.units_planned;
      const n = Number(String(v ?? '').replace(/[^\d.\-]/g, ''));
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    setProject(prev => {
      const next = { ...prev };
      let changed = false;
      if (sum > 0 && Number(prev.total_units ?? 0) !== sum) {
        next.total_units = sum;
        changed = true;
      }
      if ((!prev.city || String(prev.city).trim() === '') && prev.location) {
        const inferred = deriveCityFromLocation(String(prev.location));
        if (inferred) { next.city = inferred; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [configs]);

  // Auto-derive locality from Google Maps URL when location is empty.
  useEffect(() => {
    const url = (project.maps_url || '').trim();
    if (!url) return;
    const loc = deriveLocalityFromMapsUrl(url);
    if (loc && (!project.location || String(project.location).trim() === '')) {
      setProject(p => ({ ...p, location: loc }));
    }
  }, [project.maps_url, project.location]);

  const saveRep = async () => {
    setSavingRep(true);
    const { error } = await supabase.from('import_jobs').update({ representative_input: rep as never }).eq('id', job.id);
    setSavingRep(false);
    if (error) { toast.error(error.message); return; }
    await logActivity(supabase, job.id, 'representative_input_saved', {}, currentUser?.user_id);
    toast.success('Saved');
    onChange?.();
  };

  const [mapping, setMapping] = useState(false);
  const runMapping = useCallback(async () => {
    setMapping(true);
    try {
      const res = await autoMapProjectImport(job, currentUser?.user_id ?? null);
      const parts: string[] = [];
      if (res.projectFieldsMapped.length) parts.push(`${res.projectFieldsMapped.length} field(s)`);
      if (res.configsCreated) parts.push(`${res.configsCreated} config(s)`);
      if (res.mediaCreated) parts.push(`${res.mediaCreated} media`);
      toast.success(`Mapped: ${parts.join(', ') || 'no recognised data'}`);
      if (res.unmappedFields.length) {
        toast.info(`${res.unmappedFields.length} field(s) still unmapped. See Overview.`);
      }
      await refresh();
      onChange?.();
    } catch (e) {
      toast.error(`Mapping failed: ${(e as Error).message}`);
    } finally {
      setMapping(false);
    }
  }, [job, currentUser?.user_id, refresh, onChange]);

  const saveReview = async () => {
    setSavingReview(true);
    const merged = {
      ...((job.extracted_data as object) || {}),
      projectData: project,
      amenities: amenities.split(',').map(s => s.trim()).filter(Boolean),
      proximityMatrix: proximity,
      approvedBanks: banks.split(',').map(s => s.trim()).filter(Boolean),
    };
    const { error } = await supabase.from('import_jobs').update({ extracted_data: merged as never }).eq('id', job.id);
    setSavingReview(false);
    if (error) { toast.error(error.message); return; }
    await logActivity(supabase, job.id, 'review_edited', {}, currentUser?.user_id);
    toast.success('Review saved');
    onChange?.();
  };

  const updateConfig = async (id: string, patch: Record<string, unknown>) => {
    const target = configs.find(c => c.id === id);
    if (!target) return;
    const data = { ...((target.data as object) || {}), ...patch };
    setConfigs(cs => cs.map(c => c.id === id ? { ...c, data: data as never } : c));
    await supabase.from('import_project_configs').update({ data: data as never }).eq('id', id);
  };

  const addConfig = async () => {
    const minSort = configs.reduce((m, c) => Math.min(m, c.sort_order ?? 0), 0);
    const { data, error } = await supabase.from('import_project_configs').insert([{
      job_id: job.id, sort_order: minSort - 1, data: { name: 'New configuration' } as never, source: 'MANUAL',
    }]).select('*').single();
    if (error) { toast.error(error.message); return; }
    setConfigs(cs => [data as ImportConfig, ...cs]);
  };

  const removeConfig = async (id: string) => {
    if (!confirm('Remove this configuration?')) return;
    await supabase.from('import_project_configs').delete().eq('id', id);
    setConfigs(cs => cs.filter(c => c.id !== id));
  };

  const updateMedia = async (id: string, patch: Partial<ImportMedia>) => {
    setMedia(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m));
    await supabase.from('import_project_media').update(patch as never).eq('id', id);
  };
  const removeMedia = async (id: string) => {
    if (!confirm('Remove this media item?')) return;
    await supabase.from('import_project_media').delete().eq('id', id);
    setMedia(ms => ms.filter(m => m.id !== id));
  };
  const addMedia = async () => {
    const { data, error } = await supabase.from('import_project_media').insert([{
      job_id: job.id, category: 'GALLERY', caption: 'New media item', source: 'MANUAL',
    }]).select('*').single();
    if (error) { toast.error(error.message); return; }
    setMedia(ms => [data as ImportMedia, ...ms]);
  };

  const uploadForConfig = async (configId: string, fileList: FileList | null, category: 'FLOOR_PLAN' | 'GALLERY') => {
    if (!fileList || !fileList.length) return;
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const path = `${job.account_id ?? 'global'}/${job.id}/${category.toLowerCase()}-${configId}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('import-files').upload(path, file, { contentType: file.type || undefined });
      if (upErr) { toast.error(upErr.message); continue; }
      const { data: ins, error } = await supabase.from('import_project_media').insert([{
        job_id: job.id, category, storage_path: path,
        caption: file.name, source: 'MANUAL', config_id: configId,
      }]).select('*').single();
      if (error) { toast.error(error.message); continue; }
      setMedia(ms => [ins as ImportMedia, ...ms]);
      uploaded++;
    }
    if (uploaded > 0) toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? 's' : ''}`);
  };

  const uploadBulkMedia = async (fileList: FileList | null, category: MediaCategory = 'GALLERY') => {
    if (!fileList || !fileList.length) return;
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const path = `${job.account_id ?? 'global'}/${job.id}/${category.toLowerCase()}-bulk-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('import-files').upload(path, file, { contentType: file.type || undefined });
      if (upErr) { toast.error(upErr.message); continue; }
      const { data: ins, error } = await supabase.from('import_project_media').insert([{
        job_id: job.id, category, storage_path: path, caption: file.name, source: 'MANUAL',
      }]).select('*').single();
      if (error) { toast.error(error.message); continue; }
      setMedia(ms => [ins as ImportMedia, ...ms]);
      uploaded++;
    }
    if (uploaded > 0) toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? 's' : ''}`);
  };

  const replaceMediaFile = async (mediaId: string, file: File | undefined, category: MediaCategory) => {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const path = `${job.account_id ?? 'global'}/${job.id}/${category.toLowerCase()}-replace-${mediaId}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from('import-files').upload(path, file, { contentType: file.type || undefined });
    if (upErr) { toast.error(upErr.message); return; }
    const { error } = await supabase.from('import_project_media').update({ storage_path: path, caption: file.name, external_url: null }).eq('id', mediaId);
    if (error) { toast.error(error.message); return; }
    setMedia(ms => ms.map(m => m.id === mediaId ? { ...m, storage_path: path, caption: file.name, external_url: null } : m));
    toast.success('File replaced');
  };

  // VALIDATION — split into hard errors (block Terrisage push) and soft warnings.
  const validation = useMemo(() => {
    const missing: string[] = [];
    REQUIRED_FIELDS.forEach(k => { if (!project[k]) missing.push(k); });

    const rawWarnings = (job.extracted_data as { confidenceWarnings?: Array<Record<string, unknown>> })?.confidenceWarnings || [];
    const warnings: Array<{ field: string; note: string }> = rawWarnings.map(w => {
      const field = String((w.field ?? w.field_name ?? w.entity_type) ?? 'field');
      const note = String(w.note ?? w.reason ?? '');
      const conf = typeof w.confidence === 'number' ? ` (confidence ${(w.confidence * 100).toFixed(0)}%)` : '';
      return { field, note: `${note}${conf}` };
    });
    const fpWithoutConfig = media.filter(m => m.category === 'FLOOR_PLAN' && !m.config_id).length;
    if (fpWithoutConfig > 0) warnings.push({ field: 'floor_plans', note: `${fpWithoutConfig} floor plan(s) not yet mapped to a configuration` });
    const needsRecrop = media.filter(m => m.review_state === 'NEEDS_RECROP').length;
    if (needsRecrop > 0) warnings.push({ field: 'media', note: `${needsRecrop} media item(s) marked for re-crop` });
    const incorrect = media.filter(m => m.review_state === 'INCORRECT').length;
    if (incorrect > 0) warnings.push({ field: 'media', note: `${incorrect} media item(s) marked incorrect` });

    // ---- Terrisage-spec hard errors (only enforced when pushing globally) ----
    const errors: Array<{ field: string; note: string }> = [];
    const intOf = (v: unknown) => {
      const n = Number(String(v ?? '').replace(/[^\d.\-]/g, ''));
      return Number.isFinite(n) ? Math.round(n) : 0;
    };

    if (configs.length === 0) {
      errors.push({ field: 'configurations', note: 'Add at least one configuration before pushing.' });
    }

    // Each configuration needs a name, units_planned > 0, and a building/cluster.
    const groupKey: 'tower' | 'cluster' = propertyType === 'APARTMENT' ? 'tower' : 'cluster';
    const groupLabel = propertyType === 'APARTMENT' ? 'tower' : 'cluster';
    const perGroup = new Map<string, number>();
    let configsSum = 0;
    configs.forEach((c, i) => {
      const d = (c.data ?? {}) as Record<string, unknown>;
      const label = String(d.name ?? '').trim() || `#${i + 1}`;
      if (!String(d.name ?? '').trim()) {
        errors.push({ field: 'configuration', note: `Configuration ${label}: name is required.` });
      }
      const u = intOf(d.units_planned);
      if (u <= 0) {
        errors.push({ field: 'configuration', note: `Configuration "${label}": units planned must be greater than 0.` });
      }
      configsSum += u;
      const g = String(d[groupKey] ?? '').trim();
      if (!g) {
        errors.push({ field: 'configuration', note: `Configuration "${label}": ${groupLabel} is required.` });
      } else {
        perGroup.set(g, (perGroup.get(g) ?? 0) + u);
      }
    });

    // Project-level total_units must match sum across configs (Terrisage invariant).
    const declaredTotal = intOf(project.total_units);
    if (declaredTotal <= 0) {
      errors.push({
        field: 'total_units',
        note: 'Project total units must be greater than 0. Set it in Overview or it will be derived from configurations.',
      });
    } else if (configsSum > 0 && declaredTotal !== configsSum) {
      errors.push({
        field: 'total_units',
        note: `Project total units (${declaredTotal}) must equal sum of configuration units planned (${configsSum}).`,
      });
    }

    // Per-tower/cluster: each group needs at least 1 unit.
    perGroup.forEach((sum, name) => {
      if (sum <= 0) {
        errors.push({
          field: groupLabel,
          note: `${groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1)} "${name}": total units must be greater than 0.`,
        });
      }
    });

    // ---- Overview tab: enum sanity (Terrisage silently drops non-matching values) ----
    const STATUS_OK = new Set(['Under Construction', 'Phase 1 completed', 'Completed (with OC)', 'Completed']);
    if (project.status && !STATUS_OK.has(String(project.status).trim())) {
      warnings.push({ field: 'status', note: `"${project.status}" will not map to a Terrisage status and will be sent as empty.` });
    }
    // Mirror push function's mapCommunity(): anything matching gated/high-rise/township/etc → GATED; standalone/open → OPEN.
    const mapsToCommunity = (raw: string): 'GATED' | 'OPEN' | null => {
      const n = raw.toLowerCase().trim();
      if (!n) return null;
      if (/gated|high\s*rise|township|enclave|community|residency|gateway|villa community/.test(n)) return 'GATED';
      if (/open|standalone|independent|plot/.test(n)) return 'OPEN';
      return null;
    };
    if (project.community_type && !mapsToCommunity(String(project.community_type))) {
      warnings.push({ field: 'community_type', note: `"${project.community_type}" is not a recognised community type and will be dropped.` });
    }
    if (propertyType === 'APARTMENT') {
      const towerNames = Array.isArray(project.tower_names_list) ? project.tower_names_list.filter(Boolean) : [];
      // A single config may list multiple towers in one field (e.g. "Bellatrix & Delta", "A, B"). Split before checking.
      const splitTowers = (raw: string) =>
        raw.split(/\s*(?:&|,|\/|\band\b|\+)\s*/i).map(s => s.trim()).filter(Boolean);
      const towersUsedByConfigs = new Set<string>();
      configs.forEach(c => {
        const raw = String((c.data as Record<string, unknown>)?.tower ?? '').trim();
        if (!raw) return;
        splitTowers(raw).forEach(t => towersUsedByConfigs.add(t));
      });
      const towerNamesNorm = new Set(towerNames.map(n => n.toLowerCase()));
      if (towerNames.length === 0 && towersUsedByConfigs.size > 0) {
        warnings.push({ field: 'tower_names_list', note: 'Configurations reference towers but no tower names are listed in Overview.' });
      }
      towersUsedByConfigs.forEach(t => {
        if (towerNames.length > 0 && !towerNamesNorm.has(t.toLowerCase())) {
          warnings.push({ field: 'tower_names_list', note: `Tower "${t}" used by a configuration is not listed in Overview.` });
        }
      });
    }

    // ---- Amenities & Proximity tab ----
    // Amenities are optional; unmappedAmenities already surfaces in the Amenities card.
    const proximityRows = (job.extracted_data as { proximityMatrix?: Array<{ name?: string; distance_km?: number | string }> })?.proximityMatrix || [];
    const badProx = proximityRows.filter(p => !String(p.name ?? '').trim() || String(p.distance_km ?? '').trim() === '').length;
    if (badProx > 0) {
      warnings.push({ field: 'proximity', note: `${badProx} proximity row(s) missing name or distance — they will be sent but show as blank in Terrisage.` });
    }

    // ---- Media & Floor plans tab ----
    // Hard block: a pushable media item without storage_path or external_url would push url:null and break Terrisage's download step.
    const pushableMedia = media.filter(m => m.review_state !== 'INCORRECT' && m.review_state !== 'DUPLICATE');
    const orphanMedia = pushableMedia.filter(m => !m.storage_path && !m.external_url).length;
    if (orphanMedia > 0) {
      errors.push({ field: 'media', note: `${orphanMedia} media item(s) have neither an uploaded file nor an external URL. Remove them or attach a source.` });
    }
    const pendingReview = media.filter(m => m.review_state === 'PENDING').length;
    if (pendingReview > 0) {
      warnings.push({ field: 'media', note: `${pendingReview} media item(s) still in PENDING review — mark them Correct, Incorrect, or Duplicate.` });
    }
    if (propertyType === 'APARTMENT' || propertyType === 'VILLA') {
      const configsWithFp = new Set(media.filter(m => m.category === 'FLOOR_PLAN' && m.config_id).map(m => m.config_id));
      const missingFp = configs.filter(c => !configsWithFp.has(c.id)).length;
      if (missingFp > 0) {
        warnings.push({ field: 'floor_plans', note: `${missingFp} configuration(s) have no floor plan attached.` });
      }
    }

    return {
      missing,
      warnings,
      errors,
      configsCount: configs.length,
      configsSum,
      declaredTotal,
      perGroup: Array.from(perGroup.entries()).map(([name, units]) => ({ name, units })),
      groupLabel,
    };
  }, [project, media, configs, job.extracted_data, propertyType]);

  const isGlobal = !job.account_id;
  const isImported = job.status === 'IMPORTED';
  const canImport = validation.missing.length === 0 && configs.length > 0 &&
    (!isGlobal || validation.errors.length === 0) &&
    job.status !== 'IMPORTING';

  // Reusable poller: queries Terrisage /api/integrations/projects/ingest-jobs?sourceJobId=<jobId>
  // until SUCCEEDED/FAILED or timeout. Updates the local import_jobs row accordingly.
  const pollUpstreamUntilTerminal = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const start = Date.now();
    const maxMs = 5 * 60 * 1000;
    let interval = 5000;
    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, interval));
      if (Date.now() - start > 2 * 60 * 1000) interval = 15000;
      try {
        const { data: poll } = await supabase.functions.invoke('terrisage-project-push', { body: { action: 'poll', jobId: job.id } });
        const p = poll as { ok?: boolean; status?: string; data?: { projectId?: string; failureCode?: string; message?: string } } | null;
        if (!p?.ok) continue;
        if (p.status === 'SUCCEEDED') {
          await supabase.from('import_jobs').update({ status: 'IMPORTED', imported_at: new Date().toISOString() }).eq('id', job.id);
          await supabase.from('import_activity').insert([{
            job_id: job.id, event: 'import_completed',
            detail: { source: 'terrisage', projectId: p.data?.projectId ?? null, message: 'Terrisage accepted project' } as never,
          }]);
          if (!silent) toast.success(`Terrisage accepted project${p.data?.projectId ? ` (id: ${p.data.projectId.slice(0, 8)})` : ''}`);
          onChange?.();
          return 'SUCCEEDED' as const;
        }
        if (p.status === 'FAILED') {
          const shortMsg = (p.data?.message ?? '').toString().split('\n')[0].slice(0, 200);
          const code = p.data?.failureCode ?? 'FAILED';
          await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
          await supabase.from('import_activity').insert([{
            job_id: job.id, event: 'import_failed',
            detail: { source: 'terrisage', code, message: shortMsg } as never,
          }]);
          if (!silent) toast.error(`Terrisage rejected project: ${code}${shortMsg ? ` - ${shortMsg}` : ''}`);
          onChange?.();
          return 'FAILED' as const;
        }
      } catch { /* keep polling */ }
    }
    if (!silent) toast.message('Terrisage push still processing - check Activity tab later.');
    return 'TIMEOUT' as const;
  }, [job.id, onChange]);

  // Resume polling if we reopen a job that is still IMPORTING upstream.
  useEffect(() => {
    if (!isGlobal) return;
    if (job.status !== 'IMPORTING') return;
    const summary = (job.summary ?? {}) as { ingestJobId?: string };
    if (!summary.ingestJobId) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      toast.message('Resuming Terrisage status check…');
      await pollUpstreamUntilTerminal({ silent: false });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.status, isGlobal]);

  const finalImport = async () => {
    const confirmMsg = isGlobal
      ? (isImported
          ? 'Re-push this project to Terrisage as an upsert? Same sourceJobId will be reused, project fields will be updated in place, and project-level media (gallery, logo, floor plans) will be REPLACED with the current set. Continue?'
          : 'Push this project directly to Terrisage as an independent project?')
      : 'Confirm final import to CRM?';
    if (!confirm(confirmMsg)) return;
    setImporting(true);
    await supabase.from('import_jobs').update({ status: 'IMPORTING' }).eq('id', job.id);
    try {
      if (isGlobal) {
        // Save the latest review payload first so the edge function reads fresh data.
        const merged = {
          ...((job.extracted_data as object) || {}),
          projectData: project,
          amenities: amenities.split(',').map(s => s.trim()).filter(Boolean),
          proximityMatrix: proximity,
          approvedBanks: banks.split(',').map(s => s.trim()).filter(Boolean),
        };
        await supabase.from('import_jobs').update({ extracted_data: merged as never }).eq('id', job.id);

        const { data, error } = await supabase.functions.invoke('terrisage-project-push', { body: { action: 'push', jobId: job.id } });
        if (error) throw error;
        const res = data as { ok?: boolean; ingestJobId?: string; status?: string; error?: string } | null;
        if (!res?.ok) throw new Error(res?.error || 'Push failed');
        const ingestId = res.ingestJobId;
        toast.success(`Submitted to Terrisage${ingestId ? ` (ingest ${ingestId.slice(0, 8)})` : ''}. Waiting for confirmation…`);

        // Poll until terminal via shared helper (also writes concise activity log).
        await pollUpstreamUntilTerminal({ silent: false });
      } else {
        const fullProject = {
          ...project,
          amenities: amenities.split(',').map(s => s.trim()).filter(Boolean),
          proximityMatrix: proximity,
          approvedBanks: banks.split(',').map(s => s.trim()).filter(Boolean),
          representative: rep,
        };
        const { data: cp, error: pErr } = await supabase.from('crm_projects').insert([{
          account_id: job.account_id, source_job_id: job.id, property_type: propertyType,
          data: fullProject as never, created_by: currentUser?.user_id ?? null,
        }]).select('id').single();
        if (pErr) throw pErr;

        const configIdMap: Record<string, string> = {};
        for (const c of configs) {
          const { data: ic, error: cErr } = await supabase.from('crm_project_configs').insert([{
            project_id: cp.id, sort_order: c.sort_order, data: c.data as never,
          }]).select('id').single();
          if (cErr) throw cErr;
          configIdMap[c.id] = ic.id;
        }

        const mediaToImport = media.filter(m => m.review_state !== 'INCORRECT' && m.review_state !== 'DUPLICATE');
        for (const m of mediaToImport) {
          await supabase.from('crm_project_media').insert([{
            project_id: cp.id,
            config_id: m.config_id ? (configIdMap[m.config_id] ?? null) : null,
            category: m.category, storage_path: m.storage_path, external_url: m.external_url,
            caption: m.caption, meta: m.meta as never,
          }]);
        }

        await supabase.from('import_jobs').update({
          status: 'IMPORTED', imported_at: new Date().toISOString(),
          records_imported: 1 + configs.length + mediaToImport.length, records_total: 1 + configs.length + mediaToImport.length,
          summary: { project_id: cp.id, configs: configs.length, media: mediaToImport.length } as never,
        }).eq('id', job.id);
        await logActivity(supabase, job.id, 'import_completed', { project_id: cp.id }, currentUser?.user_id);
        toast.success('Project imported to CRM');
      }
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
      await logActivity(supabase, job.id, isGlobal ? 'push_to_terrisage_failed' : 'import_failed', { error: msg }, currentUser?.user_id);
      toast.error(msg);
    } finally {
      setImporting(false);
      onChange?.();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Project import
                <Badge variant="outline" className="text-[10px]">{PROPERTY_TYPE_LABEL[propertyType]}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{job.label || `Job ${job.id.slice(0, 8)}`} · {job.source_files_count} files</p>
            </div>
            <Badge className={`text-[10px] ${STATUS_TONE[job.status as ImportStatus]}`}>{STATUS_LABEL[job.status as ImportStatus]}</Badge>
          </div>
        </CardHeader>
      </Card>

      {(() => {
        const am = (job.extracted_data as { autoMap?: AutoMapResult })?.autoMap;
        if (!am) return null;
        const PROJECT_LABELS: Record<string, string> = {
          project_name: 'Project name', builder_name: 'Builder / Developer', city: 'City', address: 'Address',
          rera_id: 'RERA / Approval IDs', status: 'Status', site_area: 'Site area', site_area_unit: 'Site area unit',
          community_type: 'Community type', approach_road_width: 'Approach road width', total_units: 'Total units',
          expected_completion_date: 'Expected completion', possession_date: 'Possession date', website: 'Website',
          open_space_pct: 'Open space %', overview: 'Overview',
          water_sources: 'Water sources', utilities: 'Utilities', key_features: 'Key features',
          project_type: 'Project type', location: 'Location', towers_count: 'Towers count',
          tower_names: 'Tower names', floors_each_tower: 'Floors per tower', config_range: 'Configuration range',
          clubhouse: 'Clubhouse', parking: 'Parking', nearby_access: 'Nearby access',
          contact_phone: 'Contact phone', contact_email: 'Contact email', office_address: 'Office address',
        };
        return (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className={`rounded-md border p-3 text-xs ${am.unmappedFields.length === 0 ? 'border-success/40 bg-success/5 text-success' : 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400'}`}>
                <div className="font-medium flex items-center gap-2">
                  {am.unmappedFields.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  Review summary · auto-mapped from {am.sheetsParsed.length} sheet(s) · {am.projectFieldsMapped.length} field(s) · {am.configsCreated} config(s) · {am.mediaCreated} media{am.towersCreated ? ` · ${am.towersCreated} tower(s)` : ''}
                </div>
                {am.unmappedFields.length > 0 && (
                  <div className="mt-1">{am.unmappedFields.length} field(s) could not be mapped. Fill them in manually under the relevant Review tab below.</div>
                )}
                <div className="mt-1 text-muted-foreground">Mapped {new Date(am.mappedAt).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {!job.account_id && (
        <>
          <OwnerAccountCard jobId={job.id} onOwnerChange={setHasOwner} />
          <LinkedAccountsCard
            jobId={job.id}
            disabled={hasOwner || job.status !== 'IMPORTED'}
            disabledReason={
              hasOwner
                ? 'Disabled while a builder owner is selected. Clear the owner to link agencies instead.'
                : job.status !== 'IMPORTED'
                  ? 'Available after the project is imported. Complete the import to link agencies.'
                  : undefined
            }
          />
        </>
      )}

      <Tabs defaultValue="files">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="files">Source files</TabsTrigger>
          <TabsTrigger value="rep">Representative input</TabsTrigger>
          
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configs">Configurations</TabsTrigger>
          <TabsTrigger value="media">Media & Floor Plans</TabsTrigger>
          <TabsTrigger value="extra">Amenities & Proximity</TabsTrigger>
          <TabsTrigger value="validate">Validate & Import</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* SOURCE FILES */}
        <TabsContent value="files">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm">Source files & mapping</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload spreadsheets, JSON manifests, brochures, and images. Mapping runs automatically after each upload. If you add files later, click Re-run mapping to update the review.</p>
                </div>
                <Button size="sm" variant="outline" onClick={runMapping} disabled={mapping || job.source_files_count === 0}>
                  {mapping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Re-run mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <SourceFiles
                jobId={job.id}
                accountId={job.account_id}
                onChange={onChange}
                onAfterUpload={runMapping}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* REP INPUT */}
        <TabsContent value="rep">
          <Card>
            <CardHeader><CardTitle className="text-sm">Representative input</CardTitle>
              <p className="text-xs text-muted-foreground">Manual values from the project representative or for overrides.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['builder_name', 'Builder / Developer name'],
                  ['project_name', 'Project name'],
                  ['city', 'City'],
                  ['representative_name', 'Representative name'],
                  ['representative_phone', 'Representative phone'],
                  ['representative_email', 'Representative email'],
                  ['website', 'Website'],
                  ['expected_completion_date', 'Expected completion date'],
                  ['banks', 'Approved banks'],
                ].map(([k, l]) => {
                  const val = (rep as Record<string, string>)[k] ?? '';
                  if (k === 'expected_completion_date') {
                    return (
                      <div key={k} className="space-y-1">
                        <Label>{l}</Label>
                        <Input type="date" value={toDateInput(val)} onChange={e => setRep(s => ({ ...s, [k]: e.target.value }))} />
                      </div>
                    );
                  }
                  return (
                    <div key={k} className="space-y-1">
                      <Label>{l}</Label>
                      <Input value={val} onChange={e => setRep(s => ({ ...s, [k]: e.target.value }))} />
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={2} value={rep.notes ?? ''} onChange={e => setRep(s => ({ ...s, notes: e.target.value }))} />
              </div>
              <Button onClick={saveRep} disabled={savingRep}>
                {savingRep && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Save className="h-4 w-4 mr-1" />Save representative input
              </Button>
            </CardContent>
          </Card>
        </TabsContent>



        {/* OVERVIEW */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Project overview</CardTitle>
                <Button size="sm" onClick={saveReview} disabled={savingReview}>
                  {savingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const ag = parseAcresGuntas(project.site_area_acres ?? project.site_area);
                const acres = project.site_area_acres != null && project.site_area_acres !== '' ? Number(project.site_area_acres) : ag.acres;
                const guntas = project.site_area_guntas != null && project.site_area_guntas !== '' ? Number(project.site_area_guntas) : ag.guntas;
                const setAg = (a: number, g: number) => {
                  const total = combineAcresGuntas(a, g);
                  setProject(p => ({ ...p, site_area_acres: a, site_area_guntas: g, site_area: String(total), site_area_unit: 'acres' }));
                };
                const communityOptions = COMMUNITY_TYPES_BY_PT[propertyType];
                return (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Project name</Label>
                      <Input value={project.project_name ?? ''} onChange={e => setProject(p => ({ ...p, project_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Builder / Developer</Label>
                      <Input value={project.builder_name ?? ''} onChange={e => setProject(p => ({ ...p, builder_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>City</Label>
                      <Input value={project.city ?? ''} onChange={e => setProject(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Locality (auto-filled from Maps URL)</Label>
                      <Input value={project.location ?? ''} onChange={e => setProject(p => ({ ...p, location: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>RERA / Approval IDs</Label>
                      <Input value={project.rera_id ?? ''} onChange={e => setProject(p => ({ ...p, rera_id: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={(project.status as string) || '__none__'} onValueChange={v => setProject(p => ({ ...p, status: v === '__none__' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Community type</Label>
                      <Select value={(project.community_type as string) || '__none__'} onValueChange={v => setProject(p => ({ ...p, community_type: v === '__none__' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Select community type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {communityOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Site area</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={0} step="0.01" placeholder="Acres" value={acres || ''} onChange={e => setAg(Number(e.target.value) || 0, guntas)} />
                        <span className="text-xs text-muted-foreground">ac</span>
                        <Input type="number" min={0} max={39} step="1" placeholder="Guntas" value={guntas || ''} onChange={e => setAg(acres, Number(e.target.value) || 0)} />
                        <span className="text-xs text-muted-foreground">gu</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Total: {combineAcresGuntas(acres, guntas)} acres</p>
                    </div>
                    <div className="space-y-1">
                      <Label>Approach road width</Label>
                      <Input value={project.approach_road_width ?? ''} onChange={e => setProject(p => ({ ...p, approach_road_width: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Total units planned</Label>
                      <Input value={project.total_units != null ? String(project.total_units) : ''} onChange={e => setProject(p => ({ ...p, total_units: e.target.value as never }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Open space %</Label>
                      <Input value={project.open_space_pct != null ? String(project.open_space_pct) : ''} onChange={e => setProject(p => ({ ...p, open_space_pct: Number(e.target.value) || 0 }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Contact phone</Label>
                      <Input value={project.contact_phone ?? ''} onChange={e => setProject(p => ({ ...p, contact_phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Contact email</Label>
                      <Input value={project.contact_email ?? ''} onChange={e => setProject(p => ({ ...p, contact_email: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Expected completion</Label>
                      <Input type="date" value={toDateInput(project.expected_completion_date)} onChange={e => setProject(p => ({ ...p, expected_completion_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Website</Label>
                      <Input value={project.website ?? ''} onChange={e => setProject(p => ({ ...p, website: e.target.value }))} />
                    </div>
                  </div>
                );
              })()}

              {/* Address + Maps URL */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Full address</Label>
                  <Textarea rows={2} value={project.address ?? ''} onChange={e => setProject(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Google Maps location URL</Label>
                  <Input type="url" placeholder="https://maps.google.com/..." value={project.maps_url ?? ''} onChange={e => setProject(p => ({ ...p, maps_url: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">Locality is auto-derived from this URL.</p>
                </div>
              </div>

              {/* Apartment-only: tower names + floors per tower */}
              {propertyType === 'APARTMENT' && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Tower names</Label>
                    <Button size="sm" variant="outline" onClick={() => setProject(p => ({ ...p, tower_names_list: [...(p.tower_names_list || []), ''] }))}>
                      <Plus className="h-3 w-3 mr-1" />Add tower
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {(project.tower_names_list || []).map((t, i) => (
                      <div key={i} className="flex gap-1">
                        <Input className="h-8 text-sm" value={t} onChange={e => setProject(p => ({ ...p, tower_names_list: (p.tower_names_list || []).map((x, j) => j === i ? e.target.value : x) }))} />
                        <Button size="sm" variant="ghost" onClick={() => setProject(p => ({ ...p, tower_names_list: (p.tower_names_list || []).filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {(!project.tower_names_list || project.tower_names_list.length === 0) && (
                      <p className="text-xs text-muted-foreground md:col-span-3">No towers yet. Add one or run mapping.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Floors per tower</Label>
                    <Input className="h-8 text-sm" value={project.floors_each_tower ?? ''} onChange={e => setProject(p => ({ ...p, floors_each_tower: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Villa / Plot: clusters + (villa) floors per unit */}
              {(propertyType === 'VILLA' || propertyType === 'PLOT') && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Clusters / Streets count</Label>
                      <Input type="number" min={0} value={project.clusters_count != null ? String(project.clusters_count) : ''} onChange={e => setProject(p => ({ ...p, clusters_count: Number(e.target.value) || 0 }))} />
                    </div>
                    {propertyType === 'VILLA' && (
                      <div className="space-y-1">
                        <Label>Floors per unit</Label>
                        <Input value={project.floors_per_unit ?? ''} onChange={e => setProject(p => ({ ...p, floors_per_unit: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Cluster / Street names</Label>
                      <Button size="sm" variant="outline" onClick={() => setProject(p => ({ ...p, cluster_names: [...(p.cluster_names || []), ''] }))}>
                        <Plus className="h-3 w-3 mr-1" />Add
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {(project.cluster_names || []).map((t, i) => (
                        <div key={i} className="flex gap-1">
                          <Input className="h-8 text-sm" value={t} onChange={e => setProject(p => ({ ...p, cluster_names: (p.cluster_names || []).map((x, j) => j === i ? e.target.value : x) }))} />
                          <Button size="sm" variant="ghost" onClick={() => setProject(p => ({ ...p, cluster_names: (p.cluster_names || []).filter((_, j) => j !== i) }))}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>About the project (clubhouse, parking, nearby access etc.)</Label>
                <Textarea rows={4} value={project.overview ?? ''} onChange={e => setProject(p => ({ ...p, overview: e.target.value }))} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Office address</Label>
                  <Textarea rows={2} value={project.office_address ?? ''} onChange={e => setProject(p => ({ ...p, office_address: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Water sources</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WATER_SOURCE_OPTIONS.map(opt => {
                      const active = (project.water_sources || []).includes(opt);
                      return (
                        <button key={opt} type="button"
                          onClick={() => setProject(p => {
                            const cur = p.water_sources || [];
                            return { ...p, water_sources: active ? cur.filter(x => x !== opt) : [...cur, opt] };
                          })}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Utilities</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {UTILITY_OPTIONS.map(opt => {
                      const active = (project.utilities || []).includes(opt);
                      return (
                        <button key={opt} type="button"
                          onClick={() => setProject(p => {
                            const cur = p.utilities || [];
                            return { ...p, utilities: active ? cur.filter(x => x !== opt) : [...cur, opt] };
                          })}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Key features (comma separated)</Label>
                  <Input value={(project.key_features || []).join(', ')}
                    onChange={e => setProject(p => ({ ...p, key_features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIGS */}
        <TabsContent value="configs" className="space-y-3">
          {(() => {
            const towers = ((job.extracted_data as { towers?: string[] })?.towers) || [];
            if (towers.length === 0) return null;
            const configsLinkedTo = (t: string) => configs.filter(c => {
              const tv = String((c.data as Record<string, unknown> | null)?.tower ?? '');
              return tv.toLowerCase().includes(t.toLowerCase());
            }).length;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Towers / Blocks · {towers.length}</CardTitle>
                  <p className="text-xs text-muted-foreground">Detected from project summary. Each tower is linked to the configurations whose Tower field matches its name.</p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {towers.map(t => {
                      const n = configsLinkedTo(t);
                      return (
                        <div key={t} className="rounded-md border px-2.5 py-1.5 flex items-center gap-2">
                          <span className="text-sm font-medium">{t}</span>
                          {n > 0 ? (
                            <Badge variant="secondary" className="text-[10px]">{n} config(s)</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-500/40">Needs mapping</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Configurations · {PROPERTY_TYPE_LABEL[propertyType]}</CardTitle>
                <Button size="sm" onClick={addConfig}><Plus className="h-4 w-4 mr-1" />Add configuration</Button>
              </div>
              {propertyType === 'PLOT' && (
                <p className="text-xs text-muted-foreground">Group similar plots into families. Use the size band to consolidate dozens of unique plot sizes into a manageable set.</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {configs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No configurations yet. Run extraction or add manually.</p>
              ) : configs.map(c => {
                const data = (c.data as Record<string, unknown>) || {};
                return (
                  <div key={c.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{(data.name as string) || 'Untitled config'}</span>
                        <Badge variant="outline" className="text-[10px]">{c.source}</Badge>
                        {c.confidence != null && <Badge variant="outline" className="text-[10px]">conf {(Number(c.confidence) * 100).toFixed(0)}%</Badge>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeConfig(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {fieldsFor(propertyType).map(([k, l]) => {
                        // Tower (Apartment) and Cluster (Villa/Plot) both support multi-select
                        // bound to the project's name list. Stored as a comma-joined string so the
                        // existing validator, linkage card, and Terrisage push (which already calls
                        // splitMulti) all keep working without further changes.
                        if ((k === 'tower' && propertyType === 'APARTMENT') || (k === 'cluster' && (propertyType === 'VILLA' || propertyType === 'PLOT'))) {
                          const nameOpts = (k === 'tower'
                            ? (project.tower_names_list || [])
                            : (project.cluster_names || [])
                          ).filter(Boolean);
                          const raw = data[k] != null ? String(data[k]) : '';
                          const selected = raw
                            .split(/\s*(?:,|;|\/|\||&|\+| and )\s*/i)
                            .map(s => s.trim())
                            .filter(Boolean);
                          const placeholder = k === 'tower' ? 'Select tower(s)' : 'Select cluster(s)';
                          return (
                            <div key={k} className="space-y-1">
                              <Label className="text-xs">{l}</Label>
                              {nameOpts.length > 0 ? (
                                <MultiSelect
                                  className="text-xs"
                                  placeholder={placeholder}
                                  options={nameOpts.map(t => ({ value: t, label: t }))}
                                  selected={selected.filter(s => nameOpts.some(o => o.toLowerCase() === s.toLowerCase()))}
                                  onChange={vals => updateConfig(c.id, { [k]: vals.join(', ') })}
                                />
                              ) : (
                                <Input className="h-8 text-sm" value={raw} onChange={e => updateConfig(c.id, { [k]: e.target.value })} />
                              )}
                            </div>
                          );
                        }
                        return (
                          <div key={k} className="space-y-1">
                            <Label className="text-xs">{l}</Label>
                            <Input className="h-8 text-sm"
                              value={data[k] != null ? String(data[k]) : ''}
                              onChange={e => updateConfig(c.id, { [k]: e.target.value })} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 space-y-1">
                      <Label className="text-xs">Description / notes (location, parking mentions, price structure)</Label>
                      <Textarea rows={2} className="text-sm" value={data.description != null ? String(data.description) : ''}
                        onChange={e => updateConfig(c.id, { description: e.target.value })} />
                    </div>
                    {/* Per-config floor plan uploads. These also appear under Media & Floor Plans. */}
                    {(() => {
                      const linked = media.filter(m => m.config_id === c.id && m.category === 'FLOOR_PLAN');
                      return (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <Label className="text-xs">Floor plans for this configuration</Label>
                            <label className="inline-flex">
                              <input type="file" multiple accept="image/*" className="hidden"
                                onChange={async e => { await uploadForConfig(c.id, e.target.files, 'FLOOR_PLAN'); (e.target as HTMLInputElement).value = ''; }} />
                              <span className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent text-xs h-7 px-2 cursor-pointer">
                                <Plus className="h-3 w-3 mr-1" />Upload floor plan
                              </span>
                            </label>
                          </div>
                          {linked.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No floor plans yet.</p>
                          ) : (
                            <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                              {linked.map(m => {
                                const url = mediaUrls[m.id] || m.external_url || '';
                                return (
                                  <div key={m.id} className="rounded border p-1.5 space-y-1 relative">
                                    <button type="button" onClick={() => removeMedia(m.id)}
                                      className="absolute top-1 right-1 z-10 rounded-full bg-background/90 border p-0.5 hover:bg-destructive hover:text-destructive-foreground">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                    <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                                      {url ? (
                                        <img src={url} alt={m.caption ?? 'floor plan'} className="w-full h-full object-contain" loading="lazy" />
                                      ) : (
                                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                      )}
                                    </div>
                                    <Input className="h-7 text-xs" placeholder="Caption" value={m.caption ?? ''}
                                      onChange={e => updateMedia(m.id, { caption: e.target.value })} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEDIA */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm">Media & floor plans</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-muted cursor-pointer">
                    <Plus className="h-3 w-3" /> Bulk upload
                    <input type="file" accept="image/*,application/pdf" multiple className="hidden"
                      onChange={async e => { await uploadBulkMedia(e.target.files); (e.target as HTMLInputElement).value = ''; }} />
                  </label>
                  <Button size="sm" variant="outline" onClick={addMedia}><Plus className="h-4 w-4 mr-1" />Add empty item</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Floor plans should be cleanly cropped and mapped to the right configuration. Mark items that need re-cropping or are incorrect.</p>
            </CardHeader>
            <CardContent>
              {media.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No media yet. Run extraction or add manually.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {media.map(m => {
                    const isImg = m.category === 'GALLERY' || m.category === 'FLOOR_PLAN' || m.category === 'LOGO';
                    const url = mediaUrls[m.id] || m.external_url || '';
                    const linkedConfig = m.config_id ? configs.find(c => c.id === m.config_id) : null;
                    const linkedName = linkedConfig ? ((linkedConfig.data as Record<string, unknown>)?.name as string) : '';
                    return (
                      <div key={m.id} className="rounded-md border p-3 space-y-2">
                        <div className="relative aspect-video bg-muted rounded overflow-hidden flex items-center justify-center text-muted-foreground group">
                          {isImg && url ? (
                            <img src={url} alt={m.caption ?? 'media'} className="w-full h-full object-contain" loading="lazy" />
                          ) : isImg ? (
                            <ImageIcon className="h-8 w-8" />
                          ) : (
                            <FileText className="h-8 w-8" />
                          )}
                          <button type="button" onClick={() => removeMedia(m.id)}
                            title="Delete"
                            className="absolute top-1 right-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-background/90 border shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <label
                            title={m.storage_path || m.external_url ? 'Replace file' : 'Upload file'}
                            className="absolute top-1 left-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-background/90 border shadow-sm hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                            <Upload className="h-3 w-3" />
                            <input type="file" accept="image/*,application/pdf" className="hidden"
                              onChange={async e => { await replaceMediaFile(m.id, e.target.files?.[0], m.category); (e.target as HTMLInputElement).value = ''; }} />
                          </label>
                        </div>
                        {linkedName && (
                          <Badge variant="secondary" className="text-[10px]">Linked: {linkedName}</Badge>
                        )}
                        <Input className="h-8 text-sm" placeholder="Caption" value={m.caption ?? ''} onChange={e => updateMedia(m.id, { caption: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={m.category} onValueChange={v => updateMedia(m.id, { category: v as MediaCategory })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{MEDIA_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={m.review_state} onValueChange={v => updateMedia(m.id, { review_state: v as MediaReview })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{MEDIA_REVIEWS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {m.category === 'FLOOR_PLAN' && (
                          <Select value={m.config_id ?? '__none__'} onValueChange={v => updateMedia(m.id, { config_id: v === '__none__' ? null : v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Map to configuration" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Not mapped</SelectItem>
                              {configs.map(c => <SelectItem key={c.id} value={c.id}>{(c.data as Record<string, unknown>).name as string || 'Config'}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {m.confidence != null && (
                          <div className="text-xs text-muted-foreground">conf {(Number(m.confidence) * 100).toFixed(0)}%</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXTRA: AMENITIES, PROXIMITY, BANKS */}
        <TabsContent value="extra">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Amenities & Proximity</CardTitle>
                <Button size="sm" onClick={saveReview} disabled={savingReview}>
                  {savingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Amenities (comma separated)</Label>
                <Textarea rows={2} value={amenities} onChange={e => setAmenities(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">
                  {mappedAmenities.length} mapped · {unmappedAmenities.length} unmapped · {mappedAmenities.length + unmappedAmenities.length} total
                </p>
              </div>
              {mappedAmenities.length > 0 && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-sm mb-2">
                    <CheckCircle2 className="h-4 w-4" /> Mapped amenities ({mappedAmenities.length})
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mb-2">
                    These will be sent to Terrisage with their resolved master IDs.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {mappedAmenities.map(m => (
                      <Badge
                        key={m.input}
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        title={m.input.toLowerCase() !== m.display_name.toLowerCase() ? `Input: ${m.input}` : undefined}
                      >
                        {m.display_name}
                        {m.input.toLowerCase() !== m.display_name.toLowerCase() && (
                          <span className="ml-1 opacity-60">← {m.input}</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="hidden">
              </div>
              {unmappedAmenities.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm mb-2">
                    <AlertTriangle className="h-4 w-4" /> Unmapped amenities
                  </div>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mb-2">
                    These amenities are not available in Terrisage's master list for {PROPERTY_TYPE_LABEL[propertyType]} and will be skipped on push. Refresh the amenity master from Admin → Integrations if you expect them to be present.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {unmappedAmenities.map(a => (
                      <Badge key={a} variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Proximity matrix</Label>
                  <Button size="sm" variant="outline" onClick={() => setProximity(p => [...p, { name: '', distance_km: '' }])}>
                    <Plus className="h-4 w-4 mr-1" />Add
                  </Button>
                </div>
                {proximity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No proximity items yet.</p>
                ) : (
                  <div className="space-y-2">
                    {proximity.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="Place name" value={p.name} onChange={e => setProximity(arr => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                        <Input className="w-32" placeholder="Distance (km)" value={String(p.distance_km)} onChange={e => setProximity(arr => arr.map((x, j) => j === i ? { ...x, distance_km: e.target.value } : x))} />
                        <Button size="sm" variant="ghost" onClick={() => setProximity(arr => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VALIDATE & IMPORT */}
        <TabsContent value="validate">
          <Card>
            <CardHeader><CardTitle className="text-sm">Validation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {validation.missing.length === 0 ? (
                <div className="flex items-center gap-2 text-success text-sm"><CheckCircle2 className="h-4 w-4" /> All required fields present.</div>
              ) : (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-1"><XCircle className="h-4 w-4" /> Missing required fields</div>
                  <ul className="text-xs text-destructive list-disc pl-4">
                    {validation.missing.map(m => <li key={m}>{m.replace(/_/g, ' ')}</li>)}
                  </ul>
                </div>
              )}

              {isGlobal && validation.errors.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm mb-1">
                    <XCircle className="h-4 w-4" /> Terrisage pre-flight checks failed
                  </div>
                  <p className="text-[11px] text-destructive/80 mb-2">
                    Fix these before pushing. Terrisage will reject the import otherwise.
                  </p>
                  <ul className="text-xs text-destructive list-disc pl-4 space-y-0.5">
                    {validation.errors.map((e, i) => <li key={i}><span className="font-medium">{e.field}:</span> {e.note}</li>)}
                  </ul>
                </div>
              )}

              {isGlobal && validation.perGroup.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-medium mb-2">
                    Unit totals · project {validation.declaredTotal || 0} = Σ configs {validation.configsSum}
                    {validation.declaredTotal === validation.configsSum && validation.configsSum > 0 && (
                      <CheckCircle2 className="inline h-3.5 w-3.5 ml-1 text-success" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {validation.perGroup.map(g => (
                      <div key={g.name} className="flex items-center justify-between text-xs rounded border px-2 py-1 bg-background">
                        <span className="truncate capitalize">{validation.groupLabel} {g.name}</span>
                        <Badge variant={g.units > 0 ? 'outline' : 'destructive'} className="text-[10px] ml-2">{g.units}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm mb-1"><AlertTriangle className="h-4 w-4" /> Warnings</div>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
                    {validation.warnings.map((w, i) => <li key={i}>{w.field}: {w.note}</li>)}
                  </ul>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {validation.configsCount} configuration{validation.configsCount === 1 ? '' : 's'} · {media.length} media item{media.length === 1 ? '' : 's'}
              </div>
              <div className="border-t pt-3">
                <Button onClick={finalImport} disabled={!canImport || importing} variant={isImported ? 'outline' : 'default'}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isGlobal
                    ? (isImported ? 'Re-push to Terrisage (upsert)' : 'Push to Terrisage')
                    : 'Confirm and import to CRM'}
                </Button>
                {isGlobal && isImported && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Re-uses the same sourceJobId. Project fields upsert in place; project-level media is replaced with the current set. Signed URLs and pushedAt are refreshed automatically.
                  </p>
                )}
                {!canImport && validation.missing.length === 0 && configs.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Add at least one configuration before import.</p>
                )}
                {isGlobal && !canImport && validation.errors.length > 0 && (
                  <p className="text-xs text-destructive mt-2">Resolve the pre-flight checks above to enable the push.</p>
                )}
              </div>
              {job.status === 'IMPORTED' && job.summary && (
                <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm">
                  <div className="font-medium text-success mb-1 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Imported</div>
                  <pre className="text-xs">{JSON.stringify(job.summary, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="pt-4"><ActivityLog jobId={job.id} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
