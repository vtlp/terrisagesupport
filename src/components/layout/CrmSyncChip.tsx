// Header chip showing the freshness of the most recent CRM seat-usage snapshot
// across all LIVE accounts. Green <1h, amber <24h, red ≥24h or never.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Health = 'GREEN' | 'AMBER' | 'RED';

const COLOR: Record<Health, string> = {
  GREEN: 'bg-success/15 text-success border-success/30',
  AMBER: 'bg-warning/15 text-warning border-warning/30',
  RED: 'bg-destructive/15 text-destructive border-destructive/30',
};

const LABEL: Record<Health, string> = {
  GREEN: 'CRM live',
  AMBER: 'CRM stale',
  RED: 'CRM offline',
};

export function CrmSyncChip() {
  const [health, setHealth] = useState<Health>('GREEN');
  const [latest, setLatest] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [staleCount, setStaleCount] = useState(0);

  const load = useCallback(async () => {
    const [{ count: live }, { data: snaps }] = await Promise.all([
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'LIVE'),
      supabase.from('seat_usage_snapshots').select('account_id, reported_at').order('reported_at', { ascending: false }),
    ]);
    setLiveCount(live ?? 0);

    const now = Date.now();
    const latestByAccount = new Map<string, string>();
    (snaps ?? []).forEach(s => {
      if (!latestByAccount.has(s.account_id)) latestByAccount.set(s.account_id, s.reported_at);
    });

    let mostRecent: number | null = null;
    let stale = 0;
    let oldest24Plus = false;
    latestByAccount.forEach(ts => {
      const t = new Date(ts).getTime();
      if (mostRecent === null || t > mostRecent) mostRecent = t;
      const ageH = (now - t) / 3_600_000;
      if (ageH >= 1) stale += 1;
      if (ageH >= 24) oldest24Plus = true;
    });
    setStaleCount(stale);
    setLatest(mostRecent ? new Date(mostRecent).toISOString() : null);

    if ((live ?? 0) === 0) {
      setHealth('GREEN');
      return;
    }
    if (mostRecent === null) {
      setHealth('RED');
      return;
    }
    const ageH = (now - mostRecent) / 3_600_000;
    if (ageH < 1 && !oldest24Plus) setHealth('GREEN');
    else if (ageH < 24 && !oldest24Plus) setHealth('AMBER');
    else setHealth('RED');
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('crm-sync-chip')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_usage_snapshots' }, load)
      .subscribe();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [load]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 hidden md:inline-flex border ${COLOR[health]}`}>
            <Activity className="h-3 w-3" />
            {LABEL[health]}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-0.5">
            <div className="font-medium">CRM seat-usage sync</div>
            <div>Live accounts: {liveCount}</div>
            <div>Stale (&gt;1h): {staleCount}</div>
            <div>Last report: {latest ? formatDistanceToNow(new Date(latest), { addSuffix: true }) : 'never'}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
