import { useCallback, useEffect, useState } from 'react';
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
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectImportWorkspace } from '@/components/account/imports/ProjectImportWorkspace';
import {
  ImportJob, STATUS_LABEL, STATUS_TONE, ImportStatus, PropertyType, PROPERTY_TYPE_LABEL,
} from '@/components/account/imports/shared';

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

function projectNameFor(j: ImportJob): string {
  const ed = (j.extracted_data ?? {}) as { projectData?: { project_name?: string } };
  const ri = (j.representative_input ?? {}) as { project_name?: string };
  return ed.projectData?.project_name?.trim() || ri.project_name?.trim() || j.label || `Job ${j.id.slice(0, 8)}`;
}

type _AccountLite = { id: string; account_name: string };

export default function AdminData() {
  const { currentUser } = useUser();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<PropertyType>('APARTMENT');

  const [linkOpenForJobId, setLinkOpenForJobId] = useState<string | null>(null);
  const [linkAccountId, setLinkAccountId] = useState<string>('');
  const [linkNotes, setLinkNotes] = useState<string>('');
  const [linking, setLinking] = useState(false);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);

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

  useEffect(() => {
    if (!linkOpenForJobId) return;
    supabase.from('accounts').select('id, account_name').order('account_name').then(({ data }) => {
      setAccounts((data ?? []) as AccountLite[]);
    });
  }, [linkOpenForJobId]);

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

  const submitLink = async () => {
    if (!linkOpenForJobId || !linkAccountId) { toast.error('Pick an account'); return; }
    setLinking(true);
    const { data, error } = await supabase.rpc('link_global_project_to_account' as never, {
      _global_job_id: linkOpenForJobId, _account_id: linkAccountId, _notes: linkNotes || null,
    } as never);
    setLinking(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Linked to tenant');
    setLinkOpenForJobId(null); setLinkAccountId(''); setLinkNotes('');
    void data;
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
                            <Button size="sm" variant="outline" onClick={() => { setLinkOpenForJobId(j.id); setLinkAccountId(''); setLinkNotes(''); }}>
                              <LinkIcon className="h-3 w-3 mr-1" />Link to tenant
                            </Button>
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

      <Dialog open={!!linkOpenForJobId} onOpenChange={(v) => !v && setLinkOpenForJobId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link project to a tenant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Account</Label>
              <Select value={linkAccountId || '__none__'} onValueChange={v => setLinkAccountId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input value={linkNotes} onChange={e => setLinkNotes(e.target.value)} placeholder="Why this tenant gets access" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOpenForJobId(null)}>Cancel</Button>
            <Button onClick={submitLink} disabled={linking || !linkAccountId}>
              {linking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
