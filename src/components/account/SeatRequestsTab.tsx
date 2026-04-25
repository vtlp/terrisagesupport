import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, PlayCircle } from 'lucide-react';
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

const STATUS_COLORS: Record<Status, string> = {
  PENDING: 'bg-primary/15 text-primary',
  APPROVED: 'bg-success/15 text-success',
  REJECTED: 'bg-destructive/15 text-destructive',
  FULFILLED: 'bg-success/15 text-success',
};

export function SeatRequestsTab({ accountId }: { accountId: string }) {
  const [rows, setRows] = useState<SeatRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('seat_requests')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as SeatRequest[]);
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
    if (error) { setBusyId(null); toast.error(error.message); return; }
    toast.success('Seats added and request fulfilled');

    // Best-effort: push updated billing cycle metadata to Terrisage CRM.
    try {
      const { data, error: cycleErr } = await supabase.functions.invoke(
        'terrisage-seat-cycle-sync',
        { body: { accountId } },
      );
      if (cycleErr) {
        toast.warning(`Seat cycle not synced to Terrisage: ${cycleErr.message}`);
      } else if (data && data.pushed === false) {
        toast.warning(`Seat cycle not synced to Terrisage (${data.reason ?? 'unknown'})`);
      }
    } catch (e) {
      toast.warning(`Seat cycle sync failed: ${String(e)}`);
    }

    setBusyId(null);
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
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
  );
}
