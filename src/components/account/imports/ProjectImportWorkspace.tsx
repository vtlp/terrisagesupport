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
import {
  Loader2, Save, Sparkles, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Plus, Trash2,
  Image as ImageIcon, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ImportJob, STATUS_LABEL, STATUS_TONE, ImportStatus, PropertyType, PROPERTY_TYPE_LABEL,
  ImportConfig, ImportMedia, MediaCategory, MediaReview, logActivity,
} from './shared';
import { SourceFiles } from './SourceFiles';
import { ActivityLog } from './ActivityLog';
import { autoMapProjectImport, deriveCityFromLocation, type AutoMapResult } from './autoMapProjectImport';
import { useUser } from '@/context/UserContext';

type Rep = {
  builder_name?: string; project_name?: string; city?: string; address?: string;
  representative_name?: string; representative_phone?: string; representative_email?: string;
  website?: string; rera_id?: string; status?: string;
  expected_completion_date?: string; possession_date?: string; banks?: string; notes?: string;
};

type ProjectExtract = {
  project_name?: string; builder_name?: string; city?: string; address?: string;
  rera_id?: string; status?: string; open_space_pct?: number;
  site_area?: string; site_area_unit?: string; community_type?: string;
  approach_road_width?: string; total_units?: number; website?: string;
  overview?: string; expected_completion_date?: string; possession_date?: string;
  water_sources?: string[]; utilities?: string[]; key_features?: string[];
  // Brochure-style additions
  project_type?: string; location?: string;
  towers_count?: number | string; tower_names?: string; floors_each_tower?: string;
  config_range?: string; clubhouse?: string; parking?: string; nearby_access?: string;
  contact_phone?: string; contact_email?: string; office_address?: string;
};

const REQUIRED_FIELDS: Array<keyof ProjectExtract> = ['project_name', 'builder_name', 'city', 'address'];

const MEDIA_CATEGORIES: MediaCategory[] = ['LOGO', 'GALLERY', 'FLOOR_PLAN', 'BROCHURE', 'VIDEO', 'DOCUMENT', 'OTHER'];
const MEDIA_REVIEWS: MediaReview[] = ['PENDING', 'CORRECT', 'INCORRECT', 'DUPLICATE', 'NEEDS_RECROP'];

const APARTMENT_FIELDS = [
  ['type_no', 'Type no.'], ['name', 'Configuration name'], ['bhk', 'BHK'],
  ['carpet_area', 'Carpet area (sqft)'], ['super_built_up_area', 'Saleable / SBA (sqft)'],
  ['built_up_area', 'Built-up (sqft)'], ['balcony_area', 'Balcony area (sqft)'],
  ['common_area', 'Common area (sqft)'], ['utility_area', 'Utility area (sqft)'],
  ['wall_area', 'Wall area (sqft)'], ['balconies', 'Balconies'], ['bathrooms', 'Bathrooms'],
  ['facing', 'Facing'], ['tower', 'Tower / Block'], ['floor_range', 'Floor range'],
  ['units_planned', 'Units planned'], ['unit_numbers', 'Unit numbers'],
  ['pricing_range', 'Pricing range'], ['floorplan_crop_file', 'Floor plan file'],
  ['description', 'Description'],
];
const VILLA_FIELDS = [
  ['name', 'Configuration name'], ['bhk', 'BHK'], ['land_area', 'Land area'],
  ['built_up_area', 'Built-up (sqft)'], ['floors', 'Number of floors'], ['bathrooms', 'Bathrooms'],
  ['facing', 'Facing'], ['units_planned', 'Units planned'], ['pricing_range', 'Pricing range'],
];
const PLOT_FIELDS = [
  ['name', 'Plot family name'], ['plot_size_band', 'Size band'], ['plot_area', 'Plot area'],
  ['dimensions', 'Dimensions'], ['facing', 'Facing'], ['units_planned', 'Units planned'],
  ['cluster', 'Cluster / Zone'], ['premium_marker', 'Premium marker'],
];

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
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
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

  // Re-sync local edit state when job changes (e.g. after extraction).
  // For Representative input we MERGE: any rep field still empty inherits from
  // the auto-mapped project data so the user does not retype shared values.
  useEffect(() => {
    const incomingRep = (job.representative_input as Rep) || {};
    const proj = (job.extracted_data as { projectData?: ProjectExtract })?.projectData || {};
    const repFromProject: Rep = {
      builder_name: proj.builder_name,
      project_name: proj.project_name,
      city: proj.city,
      address: proj.address,
      representative_phone: proj.contact_phone,
      representative_email: proj.contact_email,
      website: proj.website,
      rera_id: proj.rera_id,
      status: proj.status,
      expected_completion_date: proj.expected_completion_date,
      possession_date: proj.possession_date,
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

  const saveRep = async () => {
    setSavingRep(true);
    const { error } = await supabase.from('import_jobs').update({ representative_input: rep as never }).eq('id', job.id);
    setSavingRep(false);
    if (error) { toast.error(error.message); return; }
    await logActivity(supabase, job.id, 'representative_input_saved', {}, currentUser?.user_id);
    toast.success('Saved');
    onChange?.();
  };

  const runExtraction = async (mode?: 'mock' | 'live') => {
    setExtracting(true);
    const { error } = await supabase.functions.invoke('extraction-trigger', { body: { jobId: job.id, mode } });
    setExtracting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Extraction completed');
    onChange?.();
    refresh();
  };

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
    const { data, error } = await supabase.from('import_project_configs').insert([{
      job_id: job.id, sort_order: configs.length, data: { name: 'New configuration' } as never, source: 'MANUAL',
    }]).select('*').single();
    if (error) { toast.error(error.message); return; }
    setConfigs(cs => [...cs, data as ImportConfig]);
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
    setMedia(ms => [...ms, data as ImportMedia]);
  };

  // VALIDATION
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
    return { missing, warnings, configsCount: configs.length };
  }, [project, media, configs, job.extracted_data]);

  const isGlobal = !job.account_id;
  const canImport = validation.missing.length === 0 && configs.length > 0 &&
    !['IMPORTED', 'IMPORTING'].includes(job.status as string);

  const finalImport = async () => {
    const confirmMsg = isGlobal
      ? 'Push this project directly to Terrisage as an independent project?'
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

        const { data, error } = await supabase.functions.invoke('terrisage-project-push', { body: { jobId: job.id } });
        if (error) throw error;
        const res = data as { ok?: boolean; terrisageProjectId?: string; error?: string } | null;
        if (!res?.ok) throw new Error(res?.error || 'Push failed');
        toast.success(`Pushed to Terrisage${res.terrisageProjectId ? ` (id: ${res.terrisageProjectId})` : ''}`);
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
              {(am.unmappedFields.length > 0 || am.unmappedColumns.length > 0 || (am.missingFields?.length ?? 0) > 0) && (
                <div className="rounded-md border p-3 space-y-3">
                  {am.unmappedFields.length > 0 && (
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Unmapped target fields</div>
                      <div className="flex flex-wrap gap-1.5">
                        {am.unmappedFields.map(f => (
                          <Badge key={f} variant="outline" className="text-[10px]">{PROJECT_LABELS[f] || f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(am.missingFields?.length ?? 0) > 0 && (() => {
                    const seen = new Set<string>();
                    const unique = am.missingFields.filter(m => {
                      const k = `${(m.field || '').toLowerCase()}::${(m.status || '').toLowerCase()}`;
                      if (seen.has(k)) return false;
                      seen.add(k);
                      return true;
                    });
                    return (
                      <div>
                        <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Flagged missing in source</div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {unique.map((m, i) => (
                            <div key={`${m.field}-${i}`} className="flex items-center justify-between gap-2 rounded-md border bg-background/50 px-2.5 py-1.5">
                              <span className="text-xs font-medium truncate">{PROJECT_LABELS[m.field] || m.field.replace(/_/g, ' ')}</span>
                              <Badge variant="outline" className="text-[10px] capitalize whitespace-nowrap">{(m.status || 'missing').replace(/_/g, ' ').toLowerCase()}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {am.unmappedColumns.length > 0 && (
                    <div>
                      <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Source columns we did not recognise</div>
                      <div className="flex flex-wrap gap-1.5">
                        {am.unmappedColumns.map(c => (
                          <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Rename these headers in the source file, or map manually, if they should populate a known field.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <Tabs defaultValue="files">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="files">Source files</TabsTrigger>
          <TabsTrigger value="rep">Representative input</TabsTrigger>
          <TabsTrigger value="extract">Extraction</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configs">Configurations</TabsTrigger>
          <TabsTrigger value="media">Media & Floor Plans</TabsTrigger>
          <TabsTrigger value="extra">Amenities & Proximity</TabsTrigger>
          <TabsTrigger value="validate">Validate & Import</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* SOURCE FILES */}
        <TabsContent value="files">
          <Card><CardContent className="pt-4">
            <SourceFiles
              jobId={job.id}
              accountId={job.account_id}
              onChange={onChange}
              onAfterUpload={async () => {
                try {
                  const res = await autoMapProjectImport(job, currentUser?.user_id ?? null);
                  const parts: string[] = [];
                  if (res.projectFieldsMapped.length) parts.push(`${res.projectFieldsMapped.length} field(s)`);
                  if (res.configsCreated) parts.push(`${res.configsCreated} config(s)`);
                  if (res.mediaCreated) parts.push(`${res.mediaCreated} media`);
                  toast.success(`Auto-mapped: ${parts.join(', ') || 'no recognised data'}`);
                  if (res.unmappedFields.length) {
                    toast.info(`${res.unmappedFields.length} field(s) still unmapped. See Review · Overview.`);
                  }
                  await refresh();
                  onChange?.();
                } catch (e) {
                  toast.error(`Auto-map failed: ${(e as Error).message}`);
                }
              }}
            />
          </CardContent></Card>
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
                  ['rera_id', 'RERA / Approval IDs'],
                  ['status', 'Status'],
                  ['expected_completion_date', 'Expected completion date'],
                  ['possession_date', 'Possession date'],
                  ['banks', 'Approved banks'],
                ].map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label>{l}</Label>
                    <Input value={(rep as Record<string, string>)[k] ?? ''} onChange={e => setRep(s => ({ ...s, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Textarea rows={2} value={rep.address ?? ''} onChange={e => setRep(s => ({ ...s, address: e.target.value }))} />
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

        {/* EXTRACTION */}
        <TabsContent value="extract">
          <Card>
            <CardHeader><CardTitle className="text-sm">Extraction</CardTitle>
              <p className="text-xs text-muted-foreground">
                Send uploaded brochures and source files to the extraction service. Use the simulate option for testing the review flow without a live service.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runExtraction()} disabled={extracting || job.source_files_count === 0}>
                  {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Run extraction
                </Button>
                <Button variant="outline" onClick={() => runExtraction('mock')} disabled={extracting}>
                  <PlayCircle className="h-4 w-4 mr-1" /> Simulate response (testing)
                </Button>
              </div>
              {job.extraction_started_at && (
                <p className="text-xs text-muted-foreground">
                  Last triggered {new Date(job.extraction_started_at).toLocaleString()}
                  {job.extraction_finished_at && <> · finished {new Date(job.extraction_finished_at).toLocaleString()}</>}
                </p>
              )}
              {(job.extracted_data as { missingFields?: unknown[] })?.missingFields?.length ? (
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase text-amber-700 dark:text-amber-400 mb-1">Missing fields reported</div>
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {(job.extracted_data as { missingFields?: unknown[] }).missingFields!.map((m, i) => {
                      const text = typeof m === 'string'
                        ? m
                        : (() => {
                            const o = (m ?? {}) as Record<string, unknown>;
                            const name = o.field_name ?? o.field ?? o.entity_type ?? 'field';
                            const reason = o.reason ? ` — ${o.reason}` : '';
                            return `${name}${reason}`;
                          })();
                      return <li key={i}>{text}</li>;
                    })}
                  </ul>
                </div>
              ) : null}
              {(job.extracted_data as { assumptions?: unknown[] })?.assumptions?.length ? (
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Assumptions</div>
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {(job.extracted_data as { assumptions?: unknown[] }).assumptions!.map((m, i) => {
                      const text = typeof m === 'string'
                        ? m
                        : (() => {
                            const o = (m ?? {}) as Record<string, unknown>;
                            return String(o.note ?? o.reason ?? o.field_name ?? JSON.stringify(o));
                          })();
                      return <li key={i}>{text}</li>;
                    })}
                  </ul>
                </div>
              ) : null}
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
              {/* Auto-map summary now lives above the tabs as a global review banner. */}
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['project_name', 'Project name'], ['builder_name', 'Builder / Developer'],
                  ['project_type', 'Project type'], ['location', 'Location'],
                  ['city', 'City'], ['rera_id', 'RERA / Approval IDs'],
                  ['status', 'Status'], ['site_area', 'Site area'],
                  ['site_area_unit', 'Site area unit'], ['community_type', 'Community type'],
                  ['approach_road_width', 'Approach road width'], ['total_units', 'Total units planned'],
                  ['towers_count', 'Towers count'], ['floors_each_tower', 'Floors per tower'],
                  ['config_range', 'Configuration range'], ['clubhouse', 'Clubhouse'],
                  ['parking', 'Parking'], ['nearby_access', 'Nearby access'],
                  ['contact_phone', 'Contact phone'], ['contact_email', 'Contact email'],
                  ['expected_completion_date', 'Expected completion'], ['possession_date', 'Possession date'],
                  ['website', 'Website'], ['open_space_pct', 'Open space %'],
                ].map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label>{l}</Label>
                    <Input
                      value={(project as Record<string, unknown>)[k] != null ? String((project as Record<string, unknown>)[k]) : ''}
                      onChange={e => setProject(p => ({ ...p, [k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Textarea rows={2} value={project.address ?? ''} onChange={e => setProject(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Office address</Label>
                  <Textarea rows={2} value={project.office_address ?? ''} onChange={e => setProject(p => ({ ...p, office_address: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Overview</Label>
                <Textarea rows={3} value={project.overview ?? ''} onChange={e => setProject(p => ({ ...p, overview: e.target.value }))} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Water sources (comma separated)</Label>
                  <Input value={(project.water_sources || []).join(', ')}
                    onChange={e => setProject(p => ({ ...p, water_sources: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Utilities (comma separated)</Label>
                  <Input value={(project.utilities || []).join(', ')}
                    onChange={e => setProject(p => ({ ...p, utilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
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
                    {towers.map(t => (
                      <div key={t} className="rounded-md border px-2.5 py-1.5 flex items-center gap-2">
                        <span className="text-sm font-medium">{t}</span>
                        <Badge variant="secondary" className="text-[10px]">{configsLinkedTo(t)} config(s)</Badge>
                      </div>
                    ))}
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
                      {fieldsFor(propertyType).map(([k, l]) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-xs">{l}</Label>
                          <Input className="h-8 text-sm"
                            value={data[k] != null ? String(data[k]) : ''}
                            onChange={e => updateConfig(c.id, { [k]: e.target.value })} />
                        </div>
                      ))}
                    </div>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Media & floor plans</CardTitle>
                <Button size="sm" onClick={addMedia}><Plus className="h-4 w-4 mr-1" />Add item</Button>
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
                    return (
                      <div key={m.id} className="rounded-md border p-3 space-y-2">
                        <div className="aspect-video bg-muted rounded flex items-center justify-center text-muted-foreground">
                          {isImg ? <ImageIcon className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                        </div>
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
                        <div className="flex justify-between text-xs text-muted-foreground">
                          {m.confidence != null && <span>conf {(Number(m.confidence) * 100).toFixed(0)}%</span>}
                          <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => removeMedia(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
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
                <CardTitle className="text-sm">Amenities, proximity & approved banks</CardTitle>
                <Button size="sm" onClick={saveReview} disabled={savingReview}>
                  {savingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Amenities (comma separated)</Label>
                <Textarea rows={2} value={amenities} onChange={e => setAmenities(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Approved banks (comma separated)</Label>
                <Input value={banks} onChange={e => setBanks(e.target.value)} />
              </div>
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
                <Button onClick={finalImport} disabled={!canImport || importing}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isGlobal ? 'Push to Terrisage' : 'Confirm and import to CRM'}
                </Button>
                {!canImport && validation.missing.length === 0 && configs.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Add at least one configuration before import.</p>
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
