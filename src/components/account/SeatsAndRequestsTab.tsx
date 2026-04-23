import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Check, X, PlayCircle, Users, UserPlus, Clock, Smartphone,
  Settings2, RefreshCw, Activity, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AdjustSeatsDialog } from './AdjustSeatsDialog';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

interface SeatRequest {
  id: string;
  account_id: string;
  requested_seats: number;
  requested_by_email: string | null;
  reason: string | null;
  status: Status;
  created_at: string;
  decided_at: string | null;
  fulfilled_at: string | null;
}

interface Capacity {
  seats_purchased: number | null;
  seats_used: number | null;
  seats_available: number | null;
}

interface Snapshot {
  allocated: number;
  consumed: number;
  reserved: number;
  available: number;
  reported_at: string;
  source: string;
}

const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-warning/15 text-warning',
  APPROVED: 'bg-primary/15 text-primary',
  REJECTED: 'bg-destructive/15 text-destructive',
  FULFILLED: 'bg-success/15 text-success',
};

interface Props {
  accountId: string;
  /** total active seats used, passed in from parent so the parent stays the source of truth */
  activeSeatsUsed: number;
}

export function SeatsAndRequestsTab({ accountId, activeSeatsUsed }: Props) {
  const [rows, setRows] = useState<SeatRequest[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mockOpen, setMockOpen] = useState(false);
  const [mockSeats, setMockSeats] = useState<string>('');
  const [mockEmail, setMockEmail] = useState<string>('');
  const [mockReason, setMockReason] = useState<string>('');
  const [submittingMock, setSubmittingMock] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, capRes, snapRes] = await Promise.all([
      supabase
        .from('seat_requests')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('account_seat_capacity')
        .select('seats_purchased, seats_used, seats_available')
        .eq('account_id', accountId)
        .maybeSingle(),
      supabase
        .from('seat_usage_snapshots')
        .select('allocated, consumed, reserved, available, reported_at, source')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);
    if (reqRes.error) toast.error(reqRes.error.message);
    setRows((reqRes.data ?? []) as SeatRequest[]);
    setCapacity((capRes.data ?? null) as Capacity | null);
    setSnapshot((snapRes.data ?? null) as Snapshot | null);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when CRM pushes a new snapshot or seats change
  useEffect(() => {
    const channel = supabase
      .channel(`seats-${accountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_usage_snapshots', filter: `account_id=eq.${accountId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_change_events', filter: `account_id=eq.${accountId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_requests', filter: `account_id=eq.${accountId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accountId, load]);

  const setStatus = async (id: string, status: Status) => {
    setBusyId(id);
    const { error } = await supabase.from('seat_requests')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', id);
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
    if (!Number.isInteger(additional) || additional < 1) {
      toast.error('Enter a valid number of additional seats');
      return;
    }
    setSubmittingMock(true);
    const { error } = await supabase.from('seat_requests').insert({
      account_id: accountId,
      requested_seats: additional,
      requested_by_email: mockEmail.trim() || null,
      reason: mockReason.trim() || `Requested via Terrisage app — +${additional} additional seats`,
    });
    setSubmittingMock(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mock request submitted from Terrisage app');
    setMockOpen(false);
    setMockSeats(''); setMockEmail(''); setMockReason('');
    load();
  };

  const purchased = capacity?.seats_purchased ?? 0;
  // Prefer CRM-reported "consumed" as in-use; fall back to console's computed used
  const inUse = snapshot?.consumed ?? capacity?.seats_used ?? activeSeatsUsed;
  const available = Math.max(0, purchased - inUse);
  const pendingRequested = rows
    .filter(r => r.status === 'PENDING' || r.status === 'APPROVED')
    .reduce((acc, r) => acc + r.requested_seats, 0);

  const reportedAt = snapshot?.reported_at ? new Date(snapshot.reported_at) : null;
  const ageMs = reportedAt ? Date.now() - reportedAt.getTime() : null;
  let syncTone: 'success' | 'warning' | 'destructive' | 'muted' = 'muted';
  if (ageMs !== null) {
    if (ageMs < 60 * 60 * 1000) syncTone = 'success';
    else if (ageMs < 24 * 60 * 60 * 1000) syncTone = 'warning';
    else syncTone = 'destructive';
  }
  const syncToneClass: Record<typeof syncTone, string> = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    destructive: 'bg-destructive/15 text-destructive',
    muted: 'bg-muted text-muted-foreground',
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Capacity summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Seat capacity</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] gap-1 ${syncToneClass[syncTone]}`}>
                <Activity className="h-3 w-3" />
                {reportedAt
                  ? `CRM sync · ${formatDistanceToNow(reportedAt, { addSuffix: true })}`
                  : 'CRM has not reported yet'}
              </Badge>
              {snapshot?.source && reportedAt && (
                <span className="text-[11px] text-muted-foreground">source: {snapshot.source}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
            <Button size="sm" onClick={() => setAdjustOpen(true)}><Settings2 className="h-3.5 w-3.5 mr-1" />Adjust seats</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CapacityStat icon={<Users className="h-4 w-4 text-primary" />} label="Allocated" value={purchased} hint="Seats purchased on plan" />
            <CapacityStat icon={<Check className="h-4 w-4 text-success" />} label="In use (CRM)" value={inUse} hint={snapshot ? 'Reported by CRM' : 'Console-computed (no CRM data yet)'} />
            <CapacityStat icon={<UserPlus className="h-4 w-4 text-accent" />} label="Available" value={available} hint="Free seats remaining" />
            <CapacityStat icon={<Clock className="h-4 w-4 text-warning" />} label="Requested" value={pendingRequested} hint="Pending / approved requests" />
          </div>
          {snapshot && snapshot.reserved > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">CRM also reports {snapshot.reserved} reserved seat(s).</p>
          )}
          {inUse > purchased && purchased > 0 && (
            <p className="mt-3 text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Over capacity: {inUse - purchased} seat{inUse - purchased === 1 ? '' : 's'} in use beyond what is allocated.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Requests list */}
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
      <AdjustSeatsDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        accountId={accountId}
        currentSeats={purchased}
        inUseSeats={inUse}
        onApplied={load}
      />

      {/* Mock Terrisage app request dialog */}
      <Dialog open={mockOpen} onOpenChange={setMockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more seats</DialogTitle>
            <DialogDescription>
              Current allocation: {capacity?.seats_purchased ?? 0} seats. Enter how many additional seats are needed — these will be added to the allocation once approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mock-seats">Additional seats requested</Label>
              <Input id="mock-seats" type="number" min={1} placeholder="e.g. 5" value={mockSeats} onChange={e => setMockSeats(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-email">Requester email (optional)</Label>
              <Input id="mock-email" type="email" placeholder="owner@example.com" value={mockEmail} onChange={e => setMockEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mock-reason">Notes</Label>
              <Textarea id="mock-reason" rows={3} placeholder="Share the names of new members or any additional context." value={mockReason} onChange={e => setMockReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMockOpen(false)}>Cancel</Button>
            <Button onClick={submitMockRequest} disabled={submittingMock}>
              {submittingMock && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit request
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
