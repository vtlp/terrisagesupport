import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, RefreshCw, Activity, ArrowRightLeft, Pencil, MessageSquare, CalendarDays,
  Users, ListChecks, FileText, ArrowRight, ShieldCheck, Receipt, Upload, Ticket,
} from 'lucide-react';

type EventType = 'STAGE_CHANGE' | 'FIELD_EDIT' | 'NOTE' | 'CALENDAR_EVENT' | 'SEAT_CHANGE'
  | 'CHECKLIST' | 'SUBMISSION' | 'CONVERSION' | 'VERIFICATION' | 'INVOICE' | 'IMPORT' | 'TICKET';

interface LogRow {
  id: string;
  entity_type: string;
  entity_id: string;
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
  INVOICE: Receipt, IMPORT: Upload, TICKET: Ticket,
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
  TICKET: 'bg-primary/15 text-primary',
};

const labelMap: Record<EventType, string> = {
  STAGE_CHANGE: 'Stage', FIELD_EDIT: 'Edit', NOTE: 'Note',
  CALENDAR_EVENT: 'Calendar', SEAT_CHANGE: 'Seat', CHECKLIST: 'Checklist',
  SUBMISSION: 'Submission', CONVERSION: 'Conversion', VERIFICATION: 'Verification',
  INVOICE: 'Invoice', IMPORT: 'Import', TICKET: 'Ticket',
};

interface Props {
  entityType: 'ENQUIRY' | 'ACCOUNT' | 'TICKET';
  entityId: string;
  title?: string;
  /** Page size for the compact paginated view. */
  pageSize?: number;
  /** When true, NOTE/STAGE_CHANGE events are included (used for tickets). */
  includeAll?: boolean;
}

// Pretty-print FIELD_EDIT details: { fieldName: { from, to } | { from_len, to_len } }
function renderFieldEditDetails(details: Record<string, unknown>): string[] {
  const lines: string[] = [];
  Object.entries(details ?? {}).forEach(([field, value]) => {
    if (!value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    const label = field.replace(/_/g, ' ').replace(/\bid\b/i, 'ID');
    if ('from_len' in v || 'to_len' in v) {
      lines.push(`${label}: ${v.from_len ?? 0} → ${v.to_len ?? 0} chars`);
    } else if ('from' in v || 'to' in v) {
      const from = formatVal(v.from);
      const to = formatVal(v.to);
      lines.push(`${label}: ${from} → ${to}`);
    }
  });
  return lines;
}

function formatVal(val: unknown): string {
  if (val == null || val === '') return '∅';
  if (typeof val === 'string') {
    // Treat UUIDs / long IDs as truncated
    if (val.length === 36 && val.includes('-')) return val.slice(0, 8) + '…';
    return val.length > 40 ? val.slice(0, 40) + '…' : val;
  }
  return String(val);
}

export function ActivityTimeline({ entityType, entityId, title = 'Activity timeline', pageSize = 15, includeAll = false }: Props) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!includeAll) q = q.neq('event_type', 'NOTE');
    const { data: logs } = await q;
    const list = includeAll
      ? ((logs ?? []) as LogRow[])
      : ((logs ?? []) as LogRow[]).filter((row) => row.event_type !== 'STAGE_CHANGE');
    setRows(list);

    const actorIds = Array.from(new Set(list.map(r => r.actor_id).filter(Boolean) as string[]));
    if (actorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', actorIds);
      const map: Record<string, string> = {};
      (profs as Profile[] | null)?.forEach(p => { map[p.id] = p.full_name; });
      setProfiles(map);
    }
    setLoading(false);
  }, [entityType, entityId, includeAll]);

  useEffect(() => { load(); }, [load]);

  // Realtime: prepend new rows
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `entity_id=eq.${entityId}` },
        (payload) => {
          const row = payload.new as LogRow;
          if (row.entity_type !== entityType) return;
          if (!includeAll && (row.event_type === 'NOTE' || row.event_type === 'STAGE_CHANGE')) return;
          setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
          if (row.actor_id && !profiles[row.actor_id]) {
            supabase.from('profiles').select('id, full_name').eq('id', row.actor_id).maybeSingle()
              .then(({ data }) => {
                if (data) setProfiles((p) => ({ ...p, [data.id]: data.full_name }));
              });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entityType, entityId, profiles, includeAll]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> {title}
            <Badge variant="outline" className="text-[10px] ml-1">{rows.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => { setPage(0); load(); }} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
        ) : (
          <>
            <ol className="relative border-l border-border ml-2 space-y-3 max-h-[480px] overflow-y-auto pr-2">
              {visible.map(r => {
                const Icon = iconMap[r.event_type] ?? Activity;
                const editLines = r.event_type === 'FIELD_EDIT' ? renderFieldEditDetails(r.details ?? {}) : [];
                return (
                  <li key={r.id} className="ml-4">
                    <span className={`absolute -left-[10px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${colorMap[r.event_type]}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${colorMap[r.event_type]}`}>{labelMap[r.event_type]}</Badge>
                        <p className="text-[13px] leading-tight">{r.summary}</p>
                      </div>
                      {editLines.length > 0 && (
                        <ul className="mt-1 ml-1 text-[11px] text-muted-foreground space-y-0.5">
                          {editLines.map((l, i) => <li key={i} className="truncate">• {l}</li>)}
                        </ul>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.actor_id ? (profiles[r.actor_id] ?? 'Staff') : 'System'}
                        {' · '}{format(new Date(r.created_at), 'dd MMM, HH:mm')}
                        <span className="ml-1 opacity-70">({formatDistanceToNow(new Date(r.created_at), { addSuffix: true })})</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-muted-foreground">
                  Page {page + 1} of {totalPages} · {rows.length} entries
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
