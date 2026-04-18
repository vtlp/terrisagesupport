import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, PlayCircle, Users, UserPlus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, capRes] = await Promise.all([
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
    ]);
    if (reqRes.error) toast.error(reqRes.error.message);
    setRows((reqRes.data ?? []) as SeatRequest[]);
    setCapacity((capRes.data ?? null) as Capacity | null);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

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

  const purchased = capacity?.seats_purchased ?? 0;
  const used = capacity?.seats_used ?? activeSeatsUsed;
  const available = Math.max(0, purchased - used);
  const pendingRequested = rows
    .filter(r => r.status === 'PENDING' || r.status === 'APPROVED')
    .reduce((acc, r) => acc + r.requested_seats, 0);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Capacity summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seat capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CapacityStat icon={<Users className="h-4 w-4 text-primary" />} label="Allocated" value={purchased} hint="Seats purchased on plan" />
            <CapacityStat icon={<Check className="h-4 w-4 text-success" />} label="In use" value={used} hint="Active team members" />
            <CapacityStat icon={<UserPlus className="h-4 w-4 text-accent" />} label="Available" value={available} hint="Free seats remaining" />
            <CapacityStat icon={<Clock className="h-4 w-4 text-warning" />} label="Requested" value={pendingRequested} hint="Pending / approved requests" />
          </div>
          {used > purchased && purchased > 0 && (
            <p className="mt-3 text-xs text-destructive">
              Over capacity: {used - purchased} seat{used - purchased === 1 ? '' : 's'} in use beyond what is allocated.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Requests list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seat requests ({rows.length})</CardTitle>
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
