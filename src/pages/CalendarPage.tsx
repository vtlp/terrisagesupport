import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday,
  addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus, Loader2, RefreshCw } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { EventDetailDialog, EventRow } from '@/components/shared/EventDetailDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/types/core';

const eventTypeLabels: Record<string, string> = {
  DEMO: 'Demo', FOLLOW_UP: 'Follow-up', CALL_BACK: 'Call Back',
  CHECK_IN: 'Check-in', ONBOARDING: 'Onboarding', OTHER: 'Other',
};
const eventTypeColors: Record<string, string> = {
  DEMO: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  FOLLOW_UP: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  CALL_BACK: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  CHECK_IN: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  ONBOARDING: 'bg-green-500/15 text-green-600 dark:text-green-400',
  OTHER: 'bg-muted text-muted-foreground',
};
const entityColors: Record<string, string> = {
  ENQUIRY: 'bg-primary/15 text-primary',
  ACCOUNT: 'bg-success/15 text-success',
  TICKET: 'bg-warning/15 text-warning',
};

interface CalEvent {
  id: string; title: string; scheduled_at: string;
  event_type: string; status: string; notes: string | null;
  related_entity_type: string | null; related_entity_id: string | null;
  created_by: string | null; assigned_to: string | null;
}
interface Profile { id: string; full_name: string; }
type ViewMode = 'week' | 'month';

export default function CalendarPage() {
  const { currentUser, isAdmin } = useUser();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>(currentUser.user_id || 'all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [dayDrillDown, setDayDrillDown] = useState<Date | null>(null);

  // Compute the visible range based on view mode
  const { rangeStart, rangeEnd, days, headerLabel } = useMemo(() => {
    if (viewMode === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return {
        rangeStart: s, rangeEnd: e,
        days: eachDayOfInterval({ start: s, end: e }),
        headerLabel: `${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')}`,
      };
    }
    const s = startOfMonth(cursor);
    const e = endOfMonth(cursor);
    return { rangeStart: s, rangeEnd: e, days: eachDayOfInterval({ start: s, end: e }), headerLabel: format(cursor, 'MMMM yyyy') };
  }, [cursor, viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('calendar_events').select('*')
        .gte('scheduled_at', rangeStart.toISOString())
        .lte('scheduled_at', rangeEnd.toISOString()),
      supabase.from('profiles').select('id, full_name').eq('is_active', true),
    ]);
    setEvents((e ?? []) as CalEvent[]);
    setProfiles((p ?? []) as Profile[]);
    setLoading(false);
  }, [rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => events.filter(e => {
    const matchEntity = entityFilter === 'all' || e.related_entity_type === entityFilter;
    const owner = e.assigned_to ?? e.created_by;
    const matchTeam = teamFilter === 'all' || owner === teamFilter;
    const matchType = eventTypeFilter === 'all' || e.event_type === eventTypeFilter;
    return matchEntity && matchTeam && matchType;
  }), [events, entityFilter, teamFilter, eventTypeFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()), [filtered]);

  const getEventsForDay = (day: Date) => filtered
    .filter(e => isSameDay(new Date(e.scheduled_at), day))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const userName = (id: string | null) => id ? (profiles.find(p => p.id === id)?.full_name ?? '—') : '—';

  const goPrev = () => setCursor(c => viewMode === 'week' ? subWeeks(c, 1) : subMonths(c, 1));
  const goNext = () => setCursor(c => viewMode === 'week' ? addWeeks(c, 1) : addMonths(c, 1));

  const handleCreateEvent = async (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType; related_entity_type: 'ENQUIRY' | 'ACCOUNT' | ''; related_entity_id: string | null; assigned_to: string | null }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    const eventTypeMap: Record<string, string> = {
      DEMO: 'DEMO', FOLLOW_UP: 'FOLLOW_UP', CALL_BACK: 'CALL_BACK',
      CHECK_IN: 'CHECK_IN', ONBOARDING: 'ONBOARDING', GENERAL: 'OTHER',
    };
    const { data: created, error } = await supabase.from('calendar_events').insert({
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      notes: data.notes || null,
      event_type: (eventTypeMap[data.event_type] ?? 'OTHER') as 'OTHER',
      created_by: currentUser.user_id,
      assigned_to: data.assigned_to ?? currentUser.user_id,
      related_entity_type: data.related_entity_type || null,
      related_entity_id: data.related_entity_id || null,
    }).select('id').maybeSingle();
    if (error) { toast.error(error.message); return; }
    toast.success(`Event "${data.title}" created`);
    setShowCreateDialog(false);
    if (created?.id) {
      supabase.functions.invoke('sync-calendar-event', { body: { event_id: created.id } })
        .then(({ data: r, error: e }) => {
          const code = (r as { code?: string })?.code;
          if (e || (r as { error?: string })?.error) {
            if (code !== 'NOT_CONNECTED') console.warn('Auto-sync failed', e ?? r);
          }
        });
    }
    load();
  };

  const syncAll = async () => {
    if (filtered.length === 0) { toast.info('No events to sync'); return; }
    toast.loading(`Syncing ${filtered.length} events…`, { id: 'sync-all' });
    let ok = 0, fail = 0;
    for (const ev of filtered) {
      const { data, error } = await supabase.functions.invoke('sync-calendar-event', { body: { event_id: ev.id } });
      if (error || (data as { error?: string })?.error) fail++; else ok++;
    }
    toast.success(`Synced ${ok} • Failed ${fail}`, { id: 'sync-all' });
  };

  const syncToGoogle = async (eventId: string, title: string) => {
    toast.loading('Syncing to Google Calendar…', { id: `sync-${eventId}` });
    const { data, error } = await supabase.functions.invoke('sync-calendar-event', { body: { event_id: eventId } });
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string; code?: string })?.error ?? error?.message ?? 'Sync failed';
      const code = (data as { code?: string })?.code;
      toast.error(code === 'NOT_CONNECTED' ? 'Connect Google Calendar from Settings first.' : msg, { id: `sync-${eventId}` });
      return;
    }
    toast.success(`"${title}" synced to Google Calendar`, { id: `sync-${eventId}` });
  };

  const drillDownEvents = dayDrillDown ? getEventsForDay(dayDrillDown) : [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage all scheduled events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={syncAll}><RefreshCw className="h-4 w-4 mr-1" /> Sync all to Google</Button>
          <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" /> Create Event</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Events Calendar</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View mode toggle */}
              <div className="inline-flex rounded-md border border-border p-0.5">
                {(['week', 'month'] as const).map(m => (
                  <Button key={m} size="sm" variant={viewMode === m ? 'default' : 'ghost'}
                    className="h-7 px-2 text-xs capitalize" onClick={() => setViewMode(m)}>{m}</Button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCursor(new Date())}>Jump to today</Button>

              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="ENQUIRY">Enquiries</SelectItem>
                  <SelectItem value="ACCOUNT">Accounts</SelectItem>
                  <SelectItem value="TICKET">Tickets</SelectItem>
                </SelectContent>
              </Select>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.keys(eventTypeLabels).map(t => <SelectItem key={t} value={t}>{eventTypeLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {!isAdmin && currentUser.user_id && (
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentUser.user_id}>My Calendar</SelectItem>
                    <SelectItem value="all">All Team</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium min-w-[180px] text-center">{headerLabel}</span>
                <Button variant="ghost" size="icon" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            <>
              {viewMode === 'month' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: (rangeStart.getDay() + 6) % 7 }).map((_, i) => <div key={`b-${i}`} className="h-24 md:h-28" />)}
                    {days.map(day => {
                      const dayEvents = getEventsForDay(day);
                      const hasEvents = dayEvents.length > 0;
                      return (
                        <button type="button" key={day.toISOString()}
                          onClick={() => { if (hasEvents) setDayDrillDown(day); }}
                          className={`h-24 md:h-28 border rounded-md p-1 text-xs overflow-hidden text-left transition-colors ${hasEvents ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default'} ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <div className={`font-medium mb-0.5 ${isToday(day) ? 'text-primary' : ''}`}>
                            {format(day, 'd')}
                          </div>
                          <div className="space-y-0.5 overflow-hidden">
                            {dayEvents.slice(0, 2).map(e => (
                              <span key={e.id}
                                className={`block w-full text-left rounded px-1 py-0.5 truncate ${eventTypeColors[e.event_type] ?? 'bg-primary/15 text-primary'}`}
                                title={e.title}>{e.title.length > 15 ? `${e.title.substring(0, 15)}…` : e.title}</span>
                            ))}
                            {dayEvents.length > 2 && (
                              <span className="text-[11px] text-primary block">
                                +{dayEvents.length - 2} more
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {viewMode === 'week' && (
                <div className="grid grid-cols-7 gap-2">
                  {days.map(day => {
                    const dayEvents = getEventsForDay(day);
                    const hasEvents = dayEvents.length > 0;
                    return (
                      <div key={day.toISOString()} className={`min-h-[200px] border rounded-md p-2 ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <button
                          onClick={() => { if (hasEvents) setDayDrillDown(day); }}
                          disabled={!hasEvents}
                          className={`text-xs font-semibold ${hasEvents ? 'hover:underline cursor-pointer' : 'cursor-default'} ${isToday(day) ? 'text-primary' : ''}`}>
                          {format(day, 'EEE d')}
                        </button>
                        <div className="mt-2 space-y-1">
                          {dayEvents.length === 0 && <p className="text-[11px] text-muted-foreground">—</p>}
                          {dayEvents.map(e => (
                            <button key={e.id} onClick={() => setOpenEvent(e as EventRow)}
                              className={`block w-full text-left rounded px-1.5 py-1 text-[11px] hover:opacity-80 ${eventTypeColors[e.event_type] ?? 'bg-primary/15 text-primary'}`}
                              title={e.title}>
                              <div className="font-medium truncate">{format(new Date(e.scheduled_at), 'HH:mm')} {e.title}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Events in view ({sorted.length})</CardTitle></CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No events in this range.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 gap-2">
                  <button onClick={() => setOpenEvent(e as EventRow)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{format(new Date(e.scheduled_at), 'EEE dd MMM, HH:mm')}</span>
                      <span>•</span><span>{userName(e.assigned_to ?? e.created_by)}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${eventTypeColors[e.event_type] ?? ''}`}>{eventTypeLabels[e.event_type] ?? e.event_type}</Badge>
                    {e.related_entity_type && <Badge className={`text-[10px] ${entityColors[e.related_entity_type] ?? ''}`}>{e.related_entity_type}</Badge>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Sync to Google Calendar" onClick={(ev) => { ev.preventDefault(); syncToGoogle(e.id, e.title); }}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>Schedule a new event on the calendar</DialogDescription>
          </DialogHeader>
          <CalendarEventForm onSubmit={handleCreateEvent} onCancel={() => setShowCreateDialog(false)} defaultEventType={CalendarEventType.GENERAL} />
        </DialogContent>
      </Dialog>

      {/* Day drill-down dialog */}
      <Dialog open={!!dayDrillDown} onOpenChange={(v) => { if (!v) setDayDrillDown(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dayDrillDown ? format(dayDrillDown, 'EEEE, dd MMM yyyy') : ''}</DialogTitle>
            <DialogDescription>{drillDownEvents.length} event{drillDownEvents.length === 1 ? '' : 's'} scheduled</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {drillDownEvents.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No events on this day.</p>}
            {drillDownEvents.map(e => (
              <button key={e.id} onClick={() => { setDayDrillDown(null); setOpenEvent(e as EventRow); }}
                className="w-full text-left flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted/70">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{format(new Date(e.scheduled_at), 'HH:mm')}</span>
                    <span>•</span><span>{userName(e.assigned_to ?? e.created_by)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${eventTypeColors[e.event_type] ?? ''}`}>{eventTypeLabels[e.event_type] ?? e.event_type}</Badge>
                  {e.related_entity_type && <Badge className={`text-[10px] ${entityColors[e.related_entity_type] ?? ''}`}>{e.related_entity_type}</Badge>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <EventDetailDialog
        event={openEvent}
        ownerName={userName(openEvent?.assigned_to ?? openEvent?.created_by ?? null)}
        teamMembers={profiles}
        open={!!openEvent}
        onOpenChange={(v) => { if (!v) setOpenEvent(null); }}
        onChanged={load}
      />
    </div>
  );
}
