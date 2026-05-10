import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, Phone, Mail, ExternalLink, MapPin, User, Inbox, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useUser } from '@/context/UserContext';
import {
  type ProjectRequest, type ProjectRequestStatus,
  STATUS_LABEL, STATUS_TONE,
  approveRequest, rejectRequest, cancelRequest, startImportFromRequest,
} from '@/lib/projectRequestsApi';

interface Props { accountId: string; }

export function ProjectRequestsTab({ accountId }: Props) {
  const { currentUser } = useUser();
  const [rows, setRows] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectRequestStatus>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [rejectFor, setRejectFor] = useState<ProjectRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('project_requests')
      .select('*').eq('account_id', accountId).order('requested_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as ProjectRequest[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`pr-${accountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests', filter: `account_id=eq.${accountId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [accountId, load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!(r.project_name.toLowerCase().includes(t)
        || (r.location ?? '').toLowerCase().includes(t)
        || (r.representative_name ?? '').toLowerCase().includes(t))) return false;
    }
    return true;
  }), [rows, q, statusFilter]);

  const grouped = useMemo(() => {
    const order: ProjectRequestStatus[] = ['PENDING_REVIEW', 'APPROVED', 'IMPORT_IN_PROGRESS', 'LIVE', 'REJECTED', 'CANCELLED'];
    return order.map(s => ({ status: s, items: filtered.filter(r => r.status === s) })).filter(g => g.items.length > 0);
  }, [filtered]);

  const onApprove = async (r: ProjectRequest) => {
    setBusyId(r.id);
    try { await approveRequest(r, currentUser?.user_id ?? null); toast.success('Request approved'); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const onConfirmReject = async () => {
    if (!rejectFor) return;
    setBusyId(rejectFor.id);
    try {
      await rejectRequest(rejectFor, rejectReason.trim() || 'No reason provided', currentUser?.user_id ?? null);
      toast.success('Request rejected'); setRejectFor(null); setRejectReason(''); await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const onStartImport = async (r: ProjectRequest) => {
    setBusyId(r.id);
    try {
      const jobId = await startImportFromRequest(r, currentUser?.user_id ?? null);
      toast.success('Import job created. Open the Imports tab to continue.');
      await load();
      // Hint where to go
      console.log('[ProjectRequests] Started import job', jobId);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const onCancel = async (r: ProjectRequest) => {
    if (!confirm('Cancel this project request?')) return;
    setBusyId(r.id);
    try { await cancelRequest(r, currentUser?.user_id ?? null); toast.success('Request cancelled'); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('terrisage-project-requests-pull');
      if (error) throw error;
      const d = (data ?? {}) as { fetched?: number; upserted?: number; skipped?: number };
      toast.success(`Synced from Terrisage: ${d.upserted ?? 0} updated, ${d.skipped ?? 0} skipped`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSyncing(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Project requests</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Project onboarding requests submitted by the client from their CRM after going live.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="h-8">
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Sync from Terrisage
              </Button>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-7 h-8 w-56" placeholder="Search project, location, rep" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'ALL' | ProjectRequestStatus)}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {(Object.keys(STATUS_LABEL) as ProjectRequestStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {rows.length === 0 ? 'No project requests yet.' : 'No requests match the current filters.'}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(g => (
                <div key={g.status}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={STATUS_TONE[g.status]}>{STATUS_LABEL[g.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{g.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {g.items.map(r => (
                      <RequestRow
                        key={r.id} r={r} busy={busyId === r.id}
                        onApprove={() => onApprove(r)}
                        onReject={() => { setRejectFor(r); setRejectReason(''); }}
                        onStartImport={() => onStartImport(r)}
                        onCancel={() => onCancel(r)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectFor} onOpenChange={o => { if (!o) setRejectFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject project request</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{rejectFor?.project_name}</p>
            <Textarea rows={4} placeholder="Reason (visible to the client CRM)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirmReject} disabled={busyId === rejectFor?.id}>
              {busyId === rejectFor?.id && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestRow({ r, busy, onApprove, onReject, onStartImport, onCancel }: {
  r: ProjectRequest; busy: boolean;
  onApprove: () => void; onReject: () => void; onStartImport: () => void; onCancel: () => void;
}) {
  const isFinal = r.status === 'LIVE' || r.status === 'REJECTED' || r.status === 'CANCELLED';

  return (
    <div className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="font-medium text-sm">{r.project_name}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {r.location && (<span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.location}{r.city ? `, ${r.city}` : ''}</span>)}
            {r.representative_name && (<span className="flex items-center gap-1"><User className="h-3 w-3" />{r.representative_name}</span>)}
            {r.representative_phone && (
              <a href={`tel:${r.representative_phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" />{r.representative_phone}</a>
            )}
            {r.representative_email && (
              <a href={`mailto:${r.representative_email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="h-3 w-3" />{r.representative_email}</a>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Requested {format(new Date(r.requested_at), 'dd MMM yyyy, HH:mm')}</span>
            {r.external_request_id && (
              <span title={r.external_request_id}>· CRM ref {r.external_request_id.slice(0, 12)}</span>
            )}
            {r.requested_by_tenant_id && (
              <span title={r.requested_by_tenant_id}>· Tenant {r.requested_by_tenant_id.slice(0, 8)}</span>
            )}
            {r.terrisage_status && r.terrisage_status !== r.status?.replace('_REVIEW','') && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">CRM: {r.terrisage_status}</Badge>
            )}
            {r.last_synced_at && (
              <span>· Synced {format(new Date(r.last_synced_at), 'dd MMM HH:mm')}</span>
            )}
          </div>
          {r.rejection_reason && r.status === 'REJECTED' && (
            <div className="text-xs text-destructive mt-1">Reason: {r.rejection_reason}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r.status === 'PENDING_REVIEW' && (
            <>
              <Button size="sm" onClick={onApprove} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Approve</Button>
              <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>Reject</Button>
            </>
          )}
          {r.status === 'APPROVED' && (
            <Button size="sm" onClick={onStartImport} disabled={busy}>
              {busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Start import
            </Button>
          )}
          {r.status === 'IMPORT_IN_PROGRESS' && r.import_job_id && (
            <Button size="sm" variant="outline" asChild>
              <a href={`?tab=imports#${r.import_job_id}`}><ExternalLink className="h-3 w-3 mr-1" />Open import</a>
            </Button>
          )}
          {r.status === 'LIVE' && (
            <Badge variant="outline" className={STATUS_TONE.LIVE}>Project live</Badge>
          )}
          {!isFinal && r.status !== 'IMPORT_IN_PROGRESS' && (
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          )}
        </div>
      </div>
    </div>
  );
}
