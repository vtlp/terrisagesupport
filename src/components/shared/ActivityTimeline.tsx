import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Activity, ArrowRightLeft, Pencil, MessageSquare, CalendarDays, Users, ListChecks, FileText, ArrowRight, ShieldCheck, Receipt, Upload } from 'lucide-react';

type EventType = 'STAGE_CHANGE' | 'FIELD_EDIT' | 'NOTE' | 'CALENDAR_EVENT' | 'SEAT_CHANGE' | 'CHECKLIST' | 'SUBMISSION' | 'CONVERSION' | 'VERIFICATION' | 'INVOICE' | 'IMPORT';

interface LogRow {
  id: string;
  event_type: EventType;
  summary: string;
  details: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

interface Profile { id: string; full_name: string; }

const iconMap: Record<EventType, React.ComponentType<{ className?: string }>> = {
  STAGE_CHANGE: ArrowRightLeft, FIELD_EDIT: Pencil, NOTE: MessageSquare,
  CALENDAR_EVENT: CalendarDays, SEAT_CHANGE: Users, CHECKLIST: ListChecks,
  SUBMISSION: FileText, CONVERSION: ArrowRight, VERIFICATION: ShieldCheck,
  INVOICE: Receipt, IMPORT: Upload,
};

const colorMap: Record<EventType, string> = {
  STAGE_CHANGE: 'bg-primary/15 text-primary',
  FIELD_EDIT: 'bg-muted text-muted-foreground',
  NOTE: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  CALENDAR_EVENT: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  SEAT_CHANGE: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  CHECKLIST: 'bg-green-500/15 text-green-600 dark:text-green-400',
  SUBMISSION: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  CONVERSION: 'bg-success/15 text-success',
  VERIFICATION: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  INVOICE: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  IMPORT: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
};

const labelMap: Record<EventType, string> = {
  STAGE_CHANGE: 'Stage', FIELD_EDIT: 'Edit', NOTE: 'Note',
  CALENDAR_EVENT: 'Calendar', SEAT_CHANGE: 'Seat', CHECKLIST: 'Checklist',
  SUBMISSION: 'Submission', CONVERSION: 'Conversion', VERIFICATION: 'Verification',
  INVOICE: 'Invoice', IMPORT: 'Import',
};

interface Props {
  entityType: 'ENQUIRY' | 'ACCOUNT';
  entityId: string;
  title?: string;
  defaultLimit?: number;
}

export function ActivityTimeline({ entityType, entityId, title = 'Activity timeline', defaultLimit = 25 }: Props) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: logs } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .not('event_type', 'in', '(STAGE_CHANGE,NOTE)')
      .order('created_at', { ascending: false })
      .limit(200);
    const list = (logs ?? []) as LogRow[];
    setRows(list);

    const actorIds = Array.from(new Set(list.map(r => r.actor_id).filter(Boolean) as string[]));
    if (actorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', actorIds);
      const map: Record<string, string> = {};
      (profs as Profile[] | null)?.forEach(p => { map[p.id] = p.full_name; });
      setProfiles(map);
    }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const visible = showAll ? rows : rows.slice(0, defaultLimit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> {title}
            <Badge variant="outline" className="text-[10px] ml-1">{rows.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
        ) : (
          <>
            <ol className="relative border-l border-border ml-2 space-y-4">
              {visible.map(r => {
                const Icon = iconMap[r.event_type] ?? Activity;
                return (
                  <li key={r.id} className="ml-4">
                    <span className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${colorMap[r.event_type]}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${colorMap[r.event_type]}`}>{labelMap[r.event_type]}</Badge>
                        <p className="text-sm">{r.summary}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.actor_id ? (profiles[r.actor_id] ?? 'Staff') : 'System'} · {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                        <span className="ml-1">({formatDistanceToNow(new Date(r.created_at), { addSuffix: true })})</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {rows.length > defaultLimit && (
              <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setShowAll(s => !s)}>
                {showAll ? 'Show less' : `Show ${rows.length - defaultLimit} more`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
