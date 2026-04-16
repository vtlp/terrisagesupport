import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
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
  created_by: string | null;
}
interface Profile { id: string; full_name: string; }

export default function CalendarPage() {
  const { currentUser, isAdmin } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>(currentUser.user_id || 'all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const days = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('calendar_events').select('*')
        .gte('scheduled_at', monthStart.toISOString())
        .lte('scheduled_at', monthEnd.toISOString()),
      supabase.from('profiles').select('id, full_name').eq('is_active', true),
    ]);
    setEvents((e ?? []) as CalEvent[]);
    setProfiles((p ?? []) as Profile[]);
    setLoading(false);
  }, [monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => events.filter(e => {
    const matchEntity = entityFilter === 'all' || e.related_entity_type === entityFilter;
    const matchTeam = teamFilter === 'all' || e.created_by === teamFilter;
    const matchType = eventTypeFilter === 'all' || e.event_type === eventTypeFilter;
    return matchEntity && matchTeam && matchType;
  }), [events, entityFilter, teamFilter, eventTypeFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()), [filtered]);

  const getEventsForDay = (day: Date) => filtered.filter(e => isSameDay(new Date(e.scheduled_at), day));

  const entityLink = (t: string | null, id: string | null) => {
    if (!t || !id) return '#';
    if (t === 'ENQUIRY') return `/enquiries/${id}`;
    if (t === 'ACCOUNT') return `/accounts/${id}`;
    if (t === 'TICKET') return `/tickets/${id}`;
    return '#';
  };

  const userName = (id: string | null) => id ? (profiles.find(p => p.id === id)?.full_name ?? '—') : '—';

  const handleCreateEvent = async (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    const eventTypeMap: Record<string, string> = {
      DEMO: 'DEMO', FOLLOW_UP: 'FOLLOW_UP', CALL_BACK: 'CALL_BACK',
      CHECK_IN: 'CHECK_IN', ONBOARDING: 'ONBOARDING', GENERAL: 'OTHER',
    };
    const { error } = await supabase.from('calendar_events').insert({
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      notes: data.notes || null,
      event_type: (eventTypeMap[data.event_type] ?? 'OTHER') as 'OTHER',
      created_by: currentUser.user_id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Event "${data.title}" created`);
    setShowCreateDialog(false);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage all scheduled events</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" /> Create Event</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Events Calendar</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="ENQUIRY">Enquiries</SelectItem>
                  <SelectItem value="ACCOUNT">Accounts</SelectItem>
                  <SelectItem value="TICKET">Tickets</SelectItem>
                </SelectContent>
              </Select>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.keys(eventTypeLabels).map(t => <SelectItem key={t} value={t}>{eventTypeLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {!isAdmin && currentUser.user_id && (
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentUser.user_id}>My Calendar</SelectItem>
                    <SelectItem value="all">All Team</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`b-${i}`} className="h-20 md:h-24" />)}
                {days.map(day => {
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div key={day.toISOString()} className={`h-20 md:h-24 border rounded-md p-1 text-xs overflow-hidden ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <div className={`font-medium mb-0.5 ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
                      <div className="space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map(e => (
                          <Link key={e.id} to={entityLink(e.related_entity_type, e.related_entity_id)}
                            className={`block rounded px-1 py-0.5 truncate hover:opacity-80 ${eventTypeColors[e.event_type] ?? 'bg-primary/15 text-primary'}`}
                            title={e.title}>{e.title.substring(0, 15)}…</Link>
                        ))}
                        {dayEvents.length > 2 && <div className="text-muted-foreground">+{dayEvents.length - 2} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Events This Month ({sorted.length})</CardTitle></CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No events this month.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map(e => (
                <Link key={e.id} to={entityLink(e.related_entity_type, e.related_entity_id)} className="block">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{format(new Date(e.scheduled_at), 'EEE dd MMM, HH:mm')}</span>
                        <span>•</span><span>{userName(e.created_by)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={`text-[10px] ${eventTypeColors[e.event_type] ?? ''}`}>{eventTypeLabels[e.event_type] ?? e.event_type}</Badge>
                      {e.related_entity_type && <Badge className={`text-[10px] ${entityColors[e.related_entity_type] ?? ''}`}>{e.related_entity_type}</Badge>}
                    </div>
                  </div>
                </Link>
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
    </div>
  );
}
