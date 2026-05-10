import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export type UpyardStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface UpyardSnapshot {
  status?: UpyardStatus;
  totalRows?: number;
  rowsProcessed?: number;
  inserted?: number;
  failureCode?: string;
  errorDetails?: unknown;
  duplicates?: unknown;
  reportJson?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

const TONE: Record<UpyardStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  RUNNING: 'bg-primary/15 text-primary',
  SUCCEEDED: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/15 text-destructive',
};

interface Props {
  tenantId: string;
  upyardJobId: string;
  /** When true, keep polling until terminal. */
  active: boolean;
  onTerminal?: (snap: UpyardSnapshot) => void;
}

export function UpyardJobProgress({ tenantId, upyardJobId, active, onTerminal }: Props) {
  const [snap, setSnap] = useState<UpyardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const firedRef = useRef(false);

  const poll = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('terrisage-onboarding-import?action=status', {
      body: { tenantId, upyardJobId },
    });
    setLoading(false);
    const p = (data?.payload ?? {}) as UpyardSnapshot;
    setSnap(p);
    if ((p.status === 'SUCCEEDED' || p.status === 'FAILED') && !firedRef.current) {
      firedRef.current = true;
      onTerminal?.(p);
    }
    return p;
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled) return;
      const p = await poll();
      const terminal = p.status === 'SUCCEEDED' || p.status === 'FAILED';
      if (!terminal && active && !cancelled) timer = setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, upyardJobId, active]);

  const status: UpyardStatus = snap?.status ?? 'PENDING';
  const total = snap?.totalRows ?? 0;
  const processed = snap?.rowsProcessed ?? (status === 'SUCCEEDED' ? total : 0);
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100))
    : status === 'SUCCEEDED' ? 100 : status === 'RUNNING' ? 35 : 5;

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm">
            {status === 'SUCCEEDED' ? <CheckCircle2 className="h-4 w-4 text-success" />
              : status === 'FAILED' ? <XCircle className="h-4 w-4 text-destructive" />
              : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <span className="font-medium">UpYard import</span>
            <Badge className={`text-[10px] ${TONE[status]}`}>{status}</Badge>
            <span className="text-xs text-muted-foreground font-mono">{upyardJobId.slice(0, 8)}</span>
          </div>
          <Button size="sm" variant="outline" onClick={poll} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="space-y-1">
          <Progress value={pct} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {total > 0
                ? `${processed} of ${total} rows`
                : status === 'PENDING' ? 'Waiting for worker...'
                : status === 'RUNNING' ? 'Validating and inserting...'
                : status === 'SUCCEEDED' ? 'Completed' : 'Failed'}
            </span>
            <span>{pct}%</span>
          </div>
        </div>

        {status === 'SUCCEEDED' && (
          <div className="text-xs text-success">
            Inserted {snap?.inserted ?? 0} record{(snap?.inserted ?? 0) === 1 ? '' : 's'}.
          </div>
        )}

        {status === 'FAILED' && (
          <div className="text-xs space-y-1">
            <div className="text-destructive font-medium">
              {snap?.failureCode ?? 'Import failed'}
            </div>
            {snap?.errorDetails ? (
              <pre className="bg-destructive/5 border border-destructive/20 rounded p-2 max-h-40 overflow-auto text-[11px]">
                {JSON.stringify(snap.errorDetails, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
