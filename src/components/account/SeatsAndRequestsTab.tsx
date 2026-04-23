import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, PlayCircle, Users, UserPlus, Clock, Smartphone, Crown, Plus, Minus, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';
type CrmState = 'INVITED' | 'ACTIVE' | 'TEMP_DEACTIVATED' | 'DELETION_REQUESTED' | 'DELETED';

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

interface Seat {
  id: string; full_name: string; email: string | null; role: string | null;
  crm_state: CrmState; is_superuser: boolean; last_active_at: string | null;
  invitation_expires_at: string | null; is_active: boolean;
}

const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-warning/15 text-warning',
  APPROVED: 'bg-primary/15 text-primary',
  REJECTED: 'bg-destructive/15 text-destructive',
  FULFILLED: 'bg-success/15 text-success',
};

const STATE_COLORS: Record<CrmState, string> = {
  INVITED: 'bg-warning/15 text-warning',
  ACTIVE: 'bg-success/15 text-success',
  TEMP_DEACTIVATED: 'bg-muted text-muted-foreground',
  DELETION_REQUESTED: 'bg-destructive/15 text-destructive',
  DELETED: 'bg-destructive/25 text-destructive',
};

interface Props { accountId: string; activeSeatsUsed: number; }

export function SeatsAndRequestsTab({ accountId, activeSeatsUsed }: Props) {
  const [rows, setRows] = useState<SeatRequest[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [mockOpen, setMockOpen] = useState(false);
  const [mockSeats, setMockSeats] = useState('');
  const [mockEmail, setMockEmail] = useState('');
  const [mockReason, setMockReason] = useState('');
  const [submittingMock, setSubmittingMock] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState('1');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [proration, setProration] = useState<{ amount: number; gst_amount: number; total: number; days_remaining: number; cycle_days: number } | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string>('');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferring, setTransferring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, capRes, seatsRes] = await Promise.all([
      supabase.from('seat_requests').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('account_seat_capacity').select('seats_purchased, seats_used, seats_reserved, seats_available, last_crm_sync_at').eq('account_id', accountId).maybeSingle(),
      supabase.from('account_seats').select('id, full_name, email, role, crm_state, is_superuser, last_active_at, invitation_expires_at, is_active').eq('account_id', accountId).order('is_superuser', { ascending: false }).order('full_name'),
    ]);
    if (reqRes.error) toast.error(reqRes.error.message);
    setRows((reqRes.data ?? []) as SeatRequest[]);
    setCapacity((capRes.data ?? null) as Capacity | null);
    setSeats((seatsRes.data ?? []) as Seat[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // Live proration preview
  useEffect(() => {
    if (!adjustOpen) { setProration(null); return; }
    const d = parseInt(adjustDelta, 10);
    if (!Number.isFinite(d) || d === 0) { setProration(null); return; }
    let cancel = false;
    supabase.rpc('compute_proration', { _account_id: accountId, _delta: d }).then(({ data }) => {
      if (!cancel && data) setProration(data as never);
    });
    return () => { cancel = true; };
  }, [accountId, adjustOpen, adjustDelta]);

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

  const applyAdjust = async () => {
    const d = parseInt(adjustDelta, 10);
    if (!Number.isFinite(d) || d === 0) { toast.error('Enter a non-zero delta'); return; }
    setAdjusting(true);
    const { error } = await supabase.rpc('apply_seat_delta', {
      _account_id: accountId, _delta: d, _reason: 'MANUAL', _notes: adjustNotes.trim() || null,
    });
    setAdjusting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(d > 0 ? `Added ${d} seats${proration?.total ? ` · ₹${proration.total} draft proration invoice created` : ''}` : `Removed ${Math.abs(d)} seats`);
    setAdjustOpen(false); setAdjustDelta('1'); setAdjustNotes('');
    load();
  };

  const initiateTransfer = async () => {
    if (!transferTo) { toast.error('Pick a new superuser'); return; }
    setTransferring(true);
    const { error } = await supabase.rpc('initiate_superuser_transfer', {
      _account_id: accountId, _from_seat_id: transferFrom || null, _to_seat_id: transferTo, _notes: null,
    });
    setTransferring(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Superuser transfer initiated · all support users notified');
    setTransferOpen(false); setTransferFrom(''); setTransferTo('');
    load();
  };

  const purchased = capacity?.seats_purchased ?? 0;
  const consumed = capacity?.seats_used ?? activeSeatsUsed;
  const reserved = capacity?.seats_reserved ?? 0;
  const available = capacity?.seats_available ?? Math.max(0, purchased - consumed - reserved);
  const pendingRequested = rows.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').reduce((acc, r) => acc + r.requested_seats, 0);
  const currentSuperuser = seats.find(s => s.is_superuser);
  const lastSync = capacity?.last_crm_sync_at;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Seat capacity</CardTitle>
          <div className="flex items-center gap-2">
            {lastSync && (
              <Badge variant="outline" className="text-[10px]">
                CRM synced {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
              <UserCog className="h-4 w-4 mr-1" /> Adjust seats
            </Button>
          </div>
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

      {/* Members roster */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Members ({seats.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setTransferFrom(currentSuperuser?.id ?? ''); setTransferOpen(true); }}>
            <ShieldCheck className="h-4 w-4 mr-1" /> Transfer superuser
          </Button>
        </CardHeader>
        <CardContent>
          {seats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No members yet.</p>
          ) : (
            <div className="space-y-2">
              {seats.map(s => (
                <div key={s.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.is_superuser && <Crown className="h-3.5 w-3.5 text-warning" />}
                      <span className="font-medium text-sm">{s.full_name}</span>
                      <Badge className={`text-[10px] ${STATE_COLORS[s.crm_state]}`}>{s.crm_state.replace('_', ' ')}</Badge>
                      {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.email ?? '—'}
                      {s.last_active_at && <> · last active {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}</>}
                      {s.invitation_expires_at && s.crm_state === 'INVITED' && (
                        <> · invite expires {format(new Date(s.invitation_expires_at), 'dd MMM')}</>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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

      {/* Adjust seats dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust seat allocation</DialogTitle>
            <DialogDescription>
              Current allocation: {purchased} seats. Positive delta mid-cycle drafts a prorated invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Delta (+/−)</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setAdjustDelta(String((parseInt(adjustDelta, 10) || 0) - 1))}><Minus className="h-4 w-4" /></Button>
                <Input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} className="text-center" />
                <Button variant="outline" size="icon" onClick={() => setAdjustDelta(String((parseInt(adjustDelta, 10) || 0) + 1))}><Plus className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">New total will be {Math.max(0, purchased + (parseInt(adjustDelta, 10) || 0))} seats.</p>
            </div>
            {proration && (parseInt(adjustDelta, 10) || 0) > 0 && proration.total > 0 && (
              <div className="rounded border p-3 bg-muted/30 text-xs space-y-1">
                <div className="font-medium text-sm">Prorated charge preview</div>
                <div>Days remaining: {proration.days_remaining} / {proration.cycle_days}</div>
                <div>Subtotal: ₹{proration.amount.toLocaleString('en-IN')}</div>
                <div>GST: ₹{proration.gst_amount.toLocaleString('en-IN')}</div>
                <div className="font-semibold text-primary">Total draft invoice: ₹{proration.total.toLocaleString('en-IN')}</div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={applyAdjust} disabled={adjusting}>
              {adjusting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Superuser transfer */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer superuser</DialogTitle>
            <DialogDescription>
              All support users will be notified and a follow-up calendar event will be created on each support user's calendar for tomorrow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Current superuser</Label>
              <Select value={transferFrom} onValueChange={setTransferFrom}>
                <SelectTrigger><SelectValue placeholder="None set" /></SelectTrigger>
                <SelectContent>
                  {seats.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}{s.is_superuser ? ' ★' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New superuser *</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger><SelectValue placeholder="Pick a member" /></SelectTrigger>
                <SelectContent>
                  {seats.filter(s => s.id !== transferFrom).map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={initiateTransfer} disabled={transferring || !transferTo}>
              {transferring && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Initiate transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
