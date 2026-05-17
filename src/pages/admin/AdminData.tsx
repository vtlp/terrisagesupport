import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectImportWorkspace } from '@/components/account/imports/ProjectImportWorkspace';
import {
  ImportJob, STATUS_LABEL, STATUS_TONE, ImportStatus, PropertyType, PROPERTY_TYPE_LABEL,
} from '@/components/account/imports/shared';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

function projectNameFor(j: ImportJob): string {
  const ed = (j.extracted_data ?? {}) as { projectData?: { project_name?: string } };
  const ri = (j.representative_input ?? {}) as { project_name?: string };
  return ed.projectData?.project_name?.trim() || ri.project_name?.trim() || j.label || `Job ${j.id.slice(0, 8)}`;
}

export default function AdminData() {
  const { currentUser } = useUser();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<PropertyType>('APARTMENT');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .is('account_id', null)
      .eq('kind', 'PROJECT')
      .order('updated_at', { ascending: false });
    if (error) toast.error(error.message);
    setJobs((data ?? []) as ImportJob[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('admin-data-imports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'import_jobs' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // Resume polling Terrisage for any IMPORTING jobs whenever we land on the list,
  // so rows self-heal to IMPORTED/FAILED even if the user navigated away mid-push.
  const pollingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const candidates = jobs.filter(j => {
      const s = (j.summary ?? {}) as { ingestJobId?: string };
      return j.status === 'IMPORTING' && !!s.ingestJobId && !pollingRef.current.has(j.id);
    });
    candidates.forEach(j => {
      pollingRef.current.add(j.id);
      (async () => {
        const start = Date.now();
        const maxMs = 5 * 60 * 1000;
        let interval = 5000;
        try {
          while (Date.now() - start < maxMs) {
            await new Promise(r => setTimeout(r, interval));
            if (Date.now() - start > 2 * 60 * 1000) interval = 15000;
            const { data: poll } = await supabase.functions.invoke('terrisage-project-push', { body: { action: 'poll', jobId: j.id } });
            const p = poll as { ok?: boolean; status?: string; data?: { projectId?: string; failureCode?: string; message?: string } } | null;
            if (!p?.ok) continue;
            if (p.status === 'SUCCEEDED') {
              await supabase.from('import_jobs').update({ status: 'IMPORTED', imported_at: new Date().toISOString() }).eq('id', j.id);
              await supabase.from('import_activity').insert([{
                job_id: j.id, event: 'import_completed',
                detail: { source: 'terrisage', projectId: p.data?.projectId ?? null, message: 'Terrisage accepted project' } as never,
              }]);
              toast.success(`${j.label ?? 'Project'}: Terrisage accepted`);
              load();
              return;
            }
            if (p.status === 'FAILED') {
              const shortMsg = (p.data?.message ?? '').toString().split('\n')[0].slice(0, 200);
              const code = p.data?.failureCode ?? 'FAILED';
              await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', j.id);
              await supabase.from('import_activity').insert([{
                job_id: j.id, event: 'import_failed',
                detail: { source: 'terrisage', code, message: shortMsg } as never,
              }]);
              toast.error(`${j.label ?? 'Project'}: ${code}${shortMsg ? ` - ${shortMsg}` : ''}`);
              load();
              return;
            }
          }
        } finally {
          pollingRef.current.delete(j.id);
        }
      })();
    });
  }, [jobs, load]);

  const selected = jobs.find(j => j.id === selectedId) ?? null;

  const createJob = async () => {
    if (!newLabel.trim()) { toast.error('Add a label so you can find it later'); return; }
    setCreating(true);
    const { data, error } = await supabase.from('import_jobs').insert([{
      account_id: null,
      kind: 'PROJECT',
      property_type: newType,
      label: newLabel.trim(),
      status: 'DRAFT',
      created_by: currentUser?.user_id ?? null,
    }]).select('*').single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setCreateOpen(false);
    setNewLabel('');
    setNewType('APARTMENT');
    setJobs(j => [data as ImportJob, ...j]);
    setSelectedId((data as ImportJob).id);
  };

  const refreshSelected = async () => {
    if (!selectedId) return;
    const { data } = await supabase.from('import_jobs').select('*').eq('id', selectedId).maybeSingle();
    if (data) setJobs(j => j.map(x => x.id === data.id ? data as ImportJob : x));
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Data</h1>
        <p className="text-sm text-muted-foreground">
          Global import flows that bypass the CRM and push directly into Terrisage entities.
        </p>
      </div>

      <Tabs defaultValue="project-import">
        <TabsList>
          <TabsTrigger value="project-import">Project import</TabsTrigger>
        </TabsList>

        <TabsContent value="project-import" className="space-y-4">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
                </Button>
                <Badge variant="outline">Pushes to Terrisage on import</Badge>
              </div>
              <ProjectImportWorkspace job={selected} onChange={refreshSelected} />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Project import jobs</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload brochures, extract fields, review, then push as a standalone Terrisage project.
                    </p>
                  </div>
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New import</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New project import</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Label</Label>
                          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Skyline Heights, Madhapur" />
                        </div>
                        <div className="space-y-1">
                          <Label>Property type</Label>
                          <Select value={newType} onValueChange={v => setNewType(v as PropertyType)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="APARTMENT">{PROPERTY_TYPE_LABEL.APARTMENT}</SelectItem>
                              <SelectItem value="VILLA">{PROPERTY_TYPE_LABEL.VILLA}</SelectItem>
                              <SelectItem value="PLOT">{PROPERTY_TYPE_LABEL.PLOT}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={createJob} disabled={creating}>
                          {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No global project imports yet. Click "New import" to start one.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {jobs.map(j => {
                      const name = projectNameFor(j);
                      return (
                        <div key={j.id} className="w-full p-3 flex items-center justify-between gap-3 hover:bg-muted/50">
                          <button onClick={() => setSelectedId(j.id)} className="text-left min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {PROPERTY_TYPE_LABEL[(j.property_type ?? 'APARTMENT') as PropertyType]} ·
                              {' '}{j.source_files_count} file(s) · updated {formatDate(j.updated_at)}
                              {j.label && j.label !== name ? ` · ${j.label}` : ''}
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-[10px] ${STATUS_TONE[j.status as ImportStatus]}`}>
                              {STATUS_LABEL[j.status as ImportStatus]}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
