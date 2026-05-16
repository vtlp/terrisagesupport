import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Building2, Home, UserPlus, Search, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useUser } from '@/context/UserContext';
import {
  ImportJob, ImportKind, ImportStatus, KIND_LABEL, STATUS_LABEL, STATUS_TONE,
  PROPERTY_TYPE_LABEL, PropertyType, logActivity,
} from './imports/shared';
import { ProjectImportWorkspace } from './imports/ProjectImportWorkspace';
import { LeadImportWorkspace } from './imports/LeadImportWorkspace';
import { SecondaryImportWorkspace } from './imports/SecondaryImportWorkspace';

type Tenancy = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';

interface Props {
  accountId: string;
  tenancyType?: Tenancy;
}

const KIND_TILES: Array<{ kind: ImportKind; icon: typeof Building2; title: string; blurb: string }> = [
  { kind: 'PROJECT', icon: Building2, title: 'Project import', blurb: 'Upload brochures and project details. Run extraction, review, then import to CRM.' },
  { kind: 'SECONDARY_PROPERTY', icon: Home, title: 'Secondary market property import', blurb: 'Bulk import resale and rental property listings from CSV or XLSX.' },
  { kind: 'LEAD', icon: UserPlus, title: 'Lead import', blurb: 'Import leads with phone-based deduplication and quick validation.' },
];

export function ImportsTab({ accountId, tenancyType }: Props) {
  const { currentUser, isAdmin } = useUser();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteJob = async (jobId: string) => {
    setDeleting(true);
    try {
      // Remove uploaded files from storage first
      const { data: files } = await supabase.from('import_files').select('storage_path').eq('job_id', jobId);
      if (files && files.length) {
        const paths = files.map(f => f.storage_path).filter(Boolean) as string[];
        if (paths.length) await supabase.storage.from('import-files').remove(paths);
      }
      // Delete dependent rows then the job (no FK cascade in schema)
      await Promise.all([
        supabase.from('import_record_rows').delete().eq('job_id', jobId),
        supabase.from('import_files').delete().eq('job_id', jobId),
        supabase.from('import_activity').delete().eq('job_id', jobId),
        supabase.from('import_project_configs').delete().eq('job_id', jobId),
        supabase.from('import_project_media').delete().eq('job_id', jobId),
      ]);
      const { error } = await supabase.from('import_jobs').delete().eq('id', jobId);
      if (error) throw error;
      toast.success('Import deleted');
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<ImportKind>('PROJECT');
  const [createPropType, setCreatePropType] = useState<PropertyType>('APARTMENT');
  const [createLabel, setCreateLabel] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // Filters
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | ImportKind>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ImportStatus>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setJobs((data ?? []) as ImportJob[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const allowedKinds = useMemo<ImportKind[]>(() => {
    if (tenancyType === 'AGENCY_BROKERAGE_CONSULTANCY') return ['PROJECT', 'SECONDARY_PROPERTY', 'LEAD'];
    if (tenancyType === 'BUILDER_DEVELOPER') return ['PROJECT', 'LEAD'];
    return ['PROJECT', 'SECONDARY_PROPERTY', 'LEAD'];
  }, [tenancyType]);

  const projectNameFor = (j: ImportJob): string => {
    const ed = (j.extracted_data ?? {}) as { projectData?: { project_name?: string } };
    const ri = (j.representative_input ?? {}) as { project_name?: string };
    return ed.projectData?.project_name?.trim() || ri.project_name?.trim() || '';
  };

  const filtered = useMemo(() => jobs.filter(j => {
    if (kindFilter !== 'ALL' && j.kind !== kindFilter) return false;
    if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
    if (q) {
      const ql = q.toLowerCase();
      const name = projectNameFor(j).toLowerCase();
      if (!(j.label?.toLowerCase().includes(ql) || j.id.startsWith(q) || name.includes(ql))) return false;
    }
    return true;
  }), [jobs, kindFilter, statusFilter, q]);

  const startCreate = (kind: ImportKind) => {
    setCreateKind(kind);
    setCreatePropType('APARTMENT');
    setCreateLabel('');
    setCreateNotes('');
    setCreateOpen(true);
  };

  const createJob = async () => {
    setBusy(true);
    const { data, error } = await supabase.from('import_jobs').insert({
      account_id: accountId,
      kind: createKind,
      property_type: createKind === 'PROJECT' ? createPropType : null,
      label: createLabel || null,
      notes: createNotes || null,
      status: 'DRAFT',
      created_by: currentUser?.user_id ?? null,
    }).select('*').single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logActivity(supabase, data.id, 'job_created', { kind: createKind, property_type: createPropType }, currentUser?.user_id);
    toast.success('Import created');
    setCreateOpen(false);
    setOpenId(data.id);
    load();
  };

  const openJob = jobs.find(j => j.id === openId);
  if (openId && openJob) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => { setOpenId(null); load(); }} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to imports
        </Button>
        {openJob.kind === 'PROJECT' && (
          <ProjectImportWorkspace job={openJob} onChange={load} />
        )}
        {openJob.kind === 'LEAD' && (
          <LeadImportWorkspace job={openJob} onChange={load} />
        )}
        {openJob.kind === 'SECONDARY_PROPERTY' && (
          <SecondaryImportWorkspace job={openJob} onChange={load} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imports</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload files, review extracted or mapped data, validate it, and import it into CRM entities.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : jobs.length === 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {KIND_TILES.filter(t => allowedKinds.includes(t.kind)).map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.kind}
                    onClick={() => startCreate(t.kind)}
                    className="text-left rounded-lg border p-4 hover:border-primary hover:shadow-sm transition-all bg-card"
                  >
                    <Icon className="h-6 w-6 text-primary mb-2" />
                    <div className="font-medium text-sm">{t.title}</div>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">{t.blurb}</p>
                    <span className="text-xs text-primary font-medium">Start import →</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8 h-9" placeholder="Search label or ID" value={q} onChange={e => setQ(e.target.value)} />
                </div>
                <Select value={kindFilter} onValueChange={v => setKindFilter(v as 'ALL' | ImportKind)}>
                  <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All types</SelectItem>
                    {allowedKinds.map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'ALL' | ImportStatus)}>
                  <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    {(Object.keys(STATUS_LABEL) as ImportStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex gap-2">
                  {allowedKinds.map(k => (
                    <Button key={k} size="sm" variant={k === 'PROJECT' ? 'default' : 'outline'} onClick={() => startCreate(k)}>
                      <Plus className="h-4 w-4 mr-1" /> {KIND_LABEL[k]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Label</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Files</th>
                      <th className="text-left px-3 py-2">Records</th>
                      <th className="text-left px-3 py-2">Created</th>
                      <th className="text-left px-3 py-2">Updated</th>
                      <th className="text-left px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(j => (
                      <tr key={j.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">{j.id.slice(0, 8)}</td>
                        <td className="px-3 py-2">
                          {KIND_LABEL[j.kind as ImportKind]}
                          {j.property_type && <span className="text-xs text-muted-foreground ml-1">({PROPERTY_TYPE_LABEL[j.property_type as PropertyType]})</span>}
                        </td>
                        <td className="px-3 py-2">{j.label ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2">
                          <Badge className={`text-[10px] ${STATUS_TONE[j.status as ImportStatus]}`}>{STATUS_LABEL[j.status as ImportStatus]}</Badge>
                        </td>
                        <td className="px-3 py-2">{j.source_files_count}</td>
                        <td className="px-3 py-2">
                          {j.records_imported}/{j.records_total}
                          {j.records_failed > 0 && <span className="text-destructive ml-1">({j.records_failed} failed)</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{format(new Date(j.created_at), 'dd MMM, HH:mm')}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{format(new Date(j.updated_at), 'dd MMM, HH:mm')}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setOpenId(j.id)}>Open</Button>
                            {isAdmin && (
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(j.id)} title="Delete import">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={9} className="text-center text-sm text-muted-foreground py-6">No imports match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New {KIND_LABEL[createKind].toLowerCase()} import</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Import type</Label>
              <Select value={createKind} onValueChange={v => setCreateKind(v as ImportKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedKinds.map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {createKind === 'PROJECT' && (
              <div className="space-y-1.5">
                <Label>Property type</Label>
                <Select value={createPropType} onValueChange={v => setCreatePropType(v as PropertyType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APARTMENT">Apartment</SelectItem>
                    <SelectItem value="VILLA">Villa</SelectItem>
                    <SelectItem value="PLOT">Plot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input value={createLabel} onChange={e => setCreateLabel(e.target.value)} placeholder="e.g. Sample Greens batch 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createJob} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this import?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the import job, its uploaded files, parsed rows, and activity log.
              Records already pushed to Terrisage or your CRM are not removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteId) deleteJob(deleteId); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
