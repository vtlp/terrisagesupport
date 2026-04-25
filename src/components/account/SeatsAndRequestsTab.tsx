import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, PlayCircle, Users, UserPlus, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

type SubmissionTeamMember = {
  id?: string;
  fullName?: string;
  email?: string;
  mobile?: string;
  mobileCode?: string;
  role?: string;
  orgWideAccess?: boolean;
  agentNetworksAccess?: boolean;
};

interface SeatRequest {
  id: string; account_id: string; requested_seats: number; requested_by_email: string | null;
  reason: string | null; status: Status; created_at: string; decided_at: string | null; fulfilled_at: string | null;
}

interface Capacity {
  seats_purchased: number | null;
  seats_used: number | null;
  seats_reserved: number | null;
  seats_available: number | null;
  last_crm_sync_at?: string | null;
}

const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-warning/15 text-warning',
  APPROVED: 'bg-primary/15 text-primary',
  REJECTED: 'bg-destructive/15 text-destructive',
  FULFILLED: 'bg-success/15 text-success',
};

interface Props { accountId: string; activeSeatsUsed: number; onboardingPayload?: unknown; tenantId?: string | null; }

function getTeamMembers(payload: unknown): SubmissionTeamMember[] {
  const members = (payload as { team?: { members?: SubmissionTeamMember[] } } | null)?.team?.members;
  return Array.isArray(members) ? members : [];
}

function getMemberPermissions(member: SubmissionTeamMember): string[] {
  const labels: string[] = [];
  if (member.orgWideAccess) labels.push('Org-wide access');
  if (member.agentNetworksAccess) labels.push('Agent networks');
  return labels;
}

export function SeatsAndRequestsTab({ accountId, activeSeatsUsed, onboardingPayload, tenantId }: Props) {
  const [rows, setRows] = useState<SeatRequest[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [crmLinked, setCrmLinked] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [mockOpen, setMockOpen] = useState(false);
  const [mockSeats, setMockSeats] = useState('');
  const [mockEmail, setMockEmail] = useState('');
  const [mockReason, setMockReason] = useState('');
  const [submittingMock, setSubmittingMock] = useState(false);

  const [memberPage, setMemberPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const PAGE_SIZE = 5;

  type CrmAgent = {
    id: string | null;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    permissions: string[];
  };
  const [crmAgents, setCrmAgents] = useState<CrmAgent[] | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const members = getTeamMembers(onboardingPayload);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, capRes] = await Promise.all([
      supabase.from('seat_requests').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('account_seat_capacity').select('seats_purchased, seats_used, seats_reserved, seats_available, last_crm_sync_at').eq('account_id', accountId).maybeSingle(),
    ]);
    if (reqRes.error) toast.error(reqRes.error.message);
    setRows((reqRes.data ?? []) as SeatRequest[]);
    setCapacity((capRes.data ?? null) as Capacity | null);
    setLoading(false);
  }, [accountId]);

  // Sync live seat capacity from Terrisage CRM if tenant_id is linked
  const syncFromCrm = useCallback(async () => {
    if (!tenantId) { setCrmLinked(false); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('terrisage-seat-sync', {
        body: { accountId },
      });
      if (error) { setCrmLinked(false); return; }
      const linked = Boolean((data as { linked?: boolean } | null)?.linked);
      setCrmLinked(linked);
      if (linked) {
        // Reload capacity from snapshot view
        const capRes = await supabase.from('account_seat_capacity')
          .select('seats_purchased, seats_used, seats_reserved, seats_available, last_crm_sync_at')
          .eq('account_id', accountId).maybeSingle();
        setCapacity((capRes.data ?? null) as Capacity | null);
      }
    } finally {
      setSyncing(false);
    }
  }, [accountId, tenantId]);

  const loadAgents = useCallback(async () => {
    if (!tenantId) { setCrmAgents(null); return; }
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const { data, error } = await supabase.functions.invoke('terrisage-tenant-agents', {
        body: { accountId },
      });
      if (error) { setAgentsError(error.message); setCrmAgents(null); return; }
      const d = data as { linked?: boolean; reason?: string; agents?: CrmAgent[] } | null;
      if (!d?.linked) { setAgentsError(d?.reason ?? 'Not linked'); setCrmAgents(null); return; }
      setCrmAgents(d.agents ?? []);
    } finally {
      setAgentsLoading(false);
    }
  }, [accountId, tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { syncFromCrm(); }, [syncFromCrm]);
  useEffect(() => { loadAgents(); }, [loadAgents]);

  const setStatus = async (id: string, status: Status) => {
    setBusyId(id);
    const { error } = await supabase.from('seat_requests').update({ status, decided_at: new Date().toISOString() }).eq('id', id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Request ${status.toLowerCase()}`);
    load();
  };

  const fulfil = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc('fulfil_seat_request', { _request_id: id });
    if (error) { setBusyId(null); toast.error(error.message); return; }
    toast.success('Seats added and request fulfilled');

    // Push the new absolute seat total to Terrisage (sync-down then push).
    try {
      const { data, error: syncErr } = await supabase.functions.invoke(
        'terrisage-seat-fulfil-sync',
        { body: { accountId, requestId: id } },
      );
      if (syncErr) {
        toast.warning(`Terrisage sync failed: ${syncErr.message}`);
      } else if (data && data.pushed === false) {
        toast.warning(`Seat allocation not synced (${data.reason ?? 'unknown'})`);
      } else {
        toast.success(`Terrisage updated: allocated = ${data?.afterAllocated ?? '?'}`);
      }
    } catch (e) {
      toast.warning(`Terrisage sync failed: ${String(e)}`);
    }

    setBusyId(null);
    load();
  };

  const submitMockRequest = async () => {
    const additional = parseInt(mockSeats, 10);
    if (!Number.isInteger(additional) || additional < 1) { toast.error('Enter a valid number'); return; }
    setSubmittingMock(true);
    const { error } = await supabase.from('seat_requests').insert({
      account_id: accountId, requested_seats: additional,
      requested_by_email: mockEmail.trim() || null,
      reason: mockReason.trim() || `Added by support on behalf of customer — +${additional} seats`,
      status: 'APPROVED',
      decided_at: new Date().toISOString(),
    });
    setSubmittingMock(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Seat request added & auto-approved');
    setMockOpen(false); setMockSeats(''); setMockEmail(''); setMockReason('');
    load();
  };

  const purchased = capacity?.seats_purchased ?? 0;
  const consumed = capacity?.seats_used ?? activeSeatsUsed;
  const reserved = capacity?.seats_reserved ?? 0;
  const available = capacity?.seats_available ?? Math.max(0, purchased - consumed - reserved);
  const pendingRequested = rows.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').reduce((acc, r) => acc + r.requested_seats, 0);
  
  const lastSync = capacity?.last_crm_sync_at;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Seat capacity</CardTitle>
          {crmLinked && lastSync ? (
            <Badge variant="outline" className="text-[10px]">
              CRM synced {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-warning/40 bg-warning/10 text-warning">
              {syncing ? 'Syncing…' : tenantId ? 'CRM unreachable' : 'Not linked to Terrisage'}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {crmLinked ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <CapacityStat icon={<Users className="h-4 w-4 text-primary" />} label="Allocated" value={purchased} hint="Seats purchased" />
                <CapacityStat icon={<Clock className="h-4 w-4 text-warning" />} label="Reserved" value={reserved} hint="Pending invites" />
                <CapacityStat icon={<Check className="h-4 w-4 text-success" />} label="Consumed" value={consumed} hint="In use this cycle" />
                <CapacityStat icon={<UserPlus className="h-4 w-4 text-accent" />} label="Available" value={available} hint="Free to invite" />
                <CapacityStat icon={<Plus className="h-4 w-4 text-warning" />} label="Requested" value={pendingRequested} hint="Pending requests" />
              </div>
              {consumed > purchased && purchased > 0 && (
                <p className="mt-3 text-xs text-destructive">
                  Over capacity: {consumed - purchased} seat(s) in use beyond allocation.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <CapacityStat icon={<Users className="h-4 w-4 text-primary" />} label="Allocated" value={purchased} hint="From onboarding form" />
                <CapacityStat icon={<Clock className="h-4 w-4 text-warning" />} label="Reserved" value={0} hint="Awaiting CRM sync" />
                <CapacityStat icon={<Check className="h-4 w-4 text-success" />} label="Consumed" value={0} hint="Awaiting CRM sync" />
                <CapacityStat icon={<UserPlus className="h-4 w-4 text-accent" />} label="Available" value={0} hint="Awaiting CRM sync" />
                <CapacityStat icon={<Plus className="h-4 w-4 text-warning" />} label="Requested" value={pendingRequested} hint="Pending requests" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Live consumed/reserved/available figures will appear once the account is linked to Terrisage CRM.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Members from Terrisage CRM (live) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Members from Terrisage CRM</CardTitle>
          <div className="flex items-center gap-2">
            {crmAgents !== null ? (
              <Badge variant="outline" className="text-[10px]">{crmAgents.length} member(s)</Badge>
            ) : agentsError ? (
              <Badge variant="outline" className="text-[10px] border-warning/40 bg-warning/10 text-warning">
                {agentsError}
              </Badge>
            ) : null}
            <Button size="sm" variant="outline" disabled={agentsLoading || !tenantId} onClick={loadAgents}>
              {agentsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {agentsLoading && crmAgents === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : crmAgents === null || crmAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {!tenantId ? 'Account not linked to Terrisage CRM.' : (crmAgents?.length === 0 ? 'No members returned by CRM.' : 'Members unavailable.')}
            </p>
          ) : (() => {
            const totalPages = Math.max(1, Math.ceil(crmAgents.length / PAGE_SIZE));
            const page = Math.min(memberPage, totalPages);
            const pageMembers = crmAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            return (
              <>
                <div className="space-y-1.5">
                  {pageMembers.map((m, idx) => {
                    const role = (m.role || '').toUpperCase();
                    const status = (m.status || '').toUpperCase();
                    const isSuper = role === 'SUPER_USER' || role === 'OWNER' || role === 'ADMIN';
                    const isActive = status === 'ACTIVE';
                    return (
                      <div key={m.id ?? idx} className="flex items-center justify-between border rounded px-3 py-2 gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{m.name || '—'}</span>
                            {m.email && <span className="text-xs text-muted-foreground truncate">{m.email}</span>}
                            {m.phone && <span className="text-xs text-muted-foreground">· {m.phone}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {m.role && (
                              <Badge className={`text-[10px] ${isSuper ? 'bg-success/15 text-success border-success/30' : 'bg-primary/10 text-primary border-primary/30'}`}>
                                {m.role}
                              </Badge>
                            )}
                            {m.status && (
                              <Badge variant="outline" className={`text-[10px] ${isActive ? 'bg-accent/10 text-accent-foreground border-accent/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                                {m.status}
                              </Badge>
                            )}
                            {m.permissions.length > 0 ? (
                              m.permissions.map((p, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] border-accent/30 bg-accent/10 text-accent-foreground">{p}</Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-muted bg-muted/30 text-muted-foreground">No extra permissions</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {crmAgents.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, crmAgents.length)} of {crmAgents.length}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setMemberPage(p => p - 1)}>Prev</Button>
                      <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setMemberPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Seat requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Seat requests ({rows.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setMockOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add seat request
          </Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No seat requests yet.</p>
          ) : (() => {
            const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
            const page = Math.min(requestPage, totalPages);
            const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            return (
              <>
                <div className="space-y-1.5">
                  {pageRows.map(r => (
                    <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2 gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">+{r.requested_seats} seats</span>
                          <Badge className={`text-[10px] ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                          {r.requested_by_email && <span className="text-xs text-muted-foreground truncate">by {r.requested_by_email}</span>}
                          <span className="text-xs text-muted-foreground">· {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}</span>
                        </div>
                        {r.reason && <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.reason}</div>}
                      </div>
                      <div className="flex gap-1">
                        {r.status === 'PENDING' && (
                          <>
                            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'APPROVED')}>
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'REJECTED')}>
                              <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                          <Button size="sm" disabled={busyId === r.id} onClick={() => fulfil(r.id)}>
                            {busyId === r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                            Fulfil
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {rows.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setRequestPage(p => p - 1)}>Prev</Button>
                      <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setRequestPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Add seat request dialog (manual entry by support — e.g. customer phoned in) */}
      <Dialog open={mockOpen} onOpenChange={setMockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add seat request</DialogTitle>
            <DialogDescription>
              Use this when a customer requests additional seats by phone or email. Requests sent from the Terrisage CRM app will appear here automatically.
              <br />Current allocation: {purchased} seats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mock-seats">Additional seats requested</Label>
              <Input id="mock-seats" type="number" min={1} value={mockSeats} onChange={e => setMockSeats(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-email">Requester email (optional)</Label>
              <Input id="mock-email" type="email" value={mockEmail} onChange={e => setMockEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-reason">Notes</Label>
              <Textarea id="mock-reason" rows={3} value={mockReason} onChange={e => setMockReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMockOpen(false)}>Cancel</Button>
            <Button onClick={submitMockRequest} disabled={submittingMock}>
              {submittingMock && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CapacityStat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}
