import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, PlayCircle, Users, UserPlus, Clock, Smartphone, Plus } from 'lucide-react';
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

interface Props { accountId: string; activeSeatsUsed: number; onboardingPayload?: unknown; }

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

export function SeatsAndRequestsTab({ accountId, activeSeatsUsed, onboardingPayload }: Props) {
  const [rows, setRows] = useState<SeatRequest[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [mockOpen, setMockOpen] = useState(false);
  const [mockSeats, setMockSeats] = useState('');
  const [mockEmail, setMockEmail] = useState('');
  const [mockReason, setMockReason] = useState('');
  const [submittingMock, setSubmittingMock] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Seats added and request fulfilled');
    load();
  };

  const submitMockRequest = async () => {
    const additional = parseInt(mockSeats, 10);
    if (!Number.isInteger(additional) || additional < 1) { toast.error('Enter a valid number'); return; }
    setSubmittingMock(true);
    const { error } = await supabase.from('seat_requests').insert({
      account_id: accountId, requested_seats: additional,
      requested_by_email: mockEmail.trim() || null,
      reason: mockReason.trim() || `Requested via Terrisage app — +${additional} additional seats`,
    });
    setSubmittingMock(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mock request submitted');
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
          {lastSync && (
            <Badge variant="outline" className="text-[10px]">
              CRM synced {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Members from CRM (dummy data — Terrisage CRM not connected yet) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Members from Terrisage CRM</CardTitle>
          <Badge variant="outline" className="text-[10px] border-warning/40 bg-warning/10 text-warning">
            Dummy data · CRM not connected
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: 'Aarav Sharma', email: 'aarav@example.in', phone: '+91 98765 43210', role: 'Super User', status: 'ACTIVE', permissions: [] },
              { name: 'Priya Iyer', email: 'priya@example.in', phone: '+91 98123 45678', role: 'Manager', status: 'ACTIVE', permissions: ['Org-wide access'] },
              { name: 'Rohan Mehta', email: 'rohan@example.in', phone: '+91 99887 76655', role: 'Agent', status: 'INVITED', permissions: ['Agent networks'] },
            ].map((m, idx) => {
              const isSuper = m.role === 'Super User';
              return (
                <div key={idx} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{m.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {m.email} · {m.phone}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Badge className={`text-[10px] ${isSuper ? 'bg-success/15 text-success border-success/30' : 'bg-primary/10 text-primary border-primary/30'}`}>
                        Role: {m.role}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${m.status === 'ACTIVE' ? 'bg-accent/10 text-accent-foreground border-accent/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                        Status: {m.status}
                      </Badge>
                      {m.permissions.length > 0 ? (
                        m.permissions.map((p, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-accent/30 bg-accent/10 text-accent-foreground">
                            Permission: {p}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-success/30 bg-success/10 text-success">
                          All permissions
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Members from onboarding submission (no status — onboarding form does not capture it) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Members from onboarding ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No team members captured in the onboarding submission.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m, idx) => {
                const perms = getMemberPermissions(m);
                const phone = m.mobile ? `${m.mobileCode ?? ''} ${m.mobile}`.trim() : '';
                return (
                  <div key={m.id ?? `${m.email ?? 'member'}-${idx}`} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{m.fullName || '—'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m.email || '—'}
                        {phone && <> · {phone}</>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {m.role && (
                          <Badge className="text-[10px] border-primary/30 bg-primary/10 text-primary">
                            Role: {m.role}
                          </Badge>
                        )}
                        {perms.length > 0 ? (
                          perms.map((p, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-accent/30 bg-accent/10 text-accent-foreground">
                              Permission: {p}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-success/30 bg-success/10 text-success">
                            All permissions
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seat requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Seat requests ({rows.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setMockOpen(true)}>
            <Smartphone className="h-4 w-4 mr-1" /> Mock request from Terrisage app
          </Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No seat requests yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">+{r.requested_seats} seats</span>
                      <Badge className={`text-[10px] ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                      {r.requested_by_email && <span className="text-xs text-muted-foreground">by {r.requested_by_email}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                      {r.reason && <> · {r.reason}</>}
                    </div>
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
          )}
        </CardContent>
      </Card>

      {/* Mock request dialog */}
      <Dialog open={mockOpen} onOpenChange={setMockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more seats</DialogTitle>
            <DialogDescription>Current allocation: {purchased} seats.</DialogDescription>
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
