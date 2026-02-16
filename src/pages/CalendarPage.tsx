import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { seedCalendarEvents, seedUsers, getUserName } from '@/data/seedData';
import { EntityType, CalendarEventStatus, CalendarEventType } from '@/types/core';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { toast } from 'sonner';

const entityTypeLabels: Record<string, string> = {
  [EntityType.ENQUIRY]: 'Enquiry',
  [EntityType.ACCOUNT]: 'Account',
  [EntityType.TICKET]: 'Ticket',
};

const entityTypeColors: Record<string, string> = {
  [EntityType.ENQUIRY]: 'bg-primary/15 text-primary',
  [EntityType.ACCOUNT]: 'bg-success/15 text-success',
  [EntityType.TICKET]: 'bg-warning/15 text-warning',
};

const eventTypeLabels: Record<CalendarEventType, string> = {
  [CalendarEventType.DEMO]: 'Demo',
  [CalendarEventType.FOLLOW_UP]: 'Follow-up',
  [CalendarEventType.CALL_BACK]: 'Call Back',
  [CalendarEventType.CHECK_IN]: 'Check-in',
  [CalendarEventType.ONBOARDING]: 'Onboarding',
  [CalendarEventType.GENERAL]: 'General',
};

const eventTypeColors: Record<CalendarEventType, string> = {
  [CalendarEventType.DEMO]: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  [CalendarEventType.FOLLOW_UP]: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  [CalendarEventType.CALL_BACK]: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  [CalendarEventType.CHECK_IN]: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  [CalendarEventType.ONBOARDING]: 'bg-green-500/15 text-green-600 dark:text-green-400',
  [CalendarEventType.GENERAL]: 'bg-muted text-muted-foreground',
};

const ENTITY_FILTERS = [
  { value: 'all', label: 'All Sources' },
  { value: EntityType.ENQUIRY, label: 'Enquiries' },
  { value: EntityType.ACCOUNT, label: 'Accounts' },
  { value: EntityType.TICKET, label: 'Tickets' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Others' },
];

const EVENT_TYPE_FILTERS = [
  { value: 'all', label: 'All Types' },
  ...Object.values(CalendarEventType).map(t => ({ value: t, label: eventTypeLabels[t] })),
];

export default function CalendarPage() {
  const { currentUser, isAdmin } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>(currentUser.user_id);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filterEvents = useMemo(() => {
    return seedCalendarEvents.filter(e => {
      const d = new Date(e.scheduled_at);
      const matchMonth = d >= monthStart && d <= monthEnd;
      const matchEntity = entityFilter === 'all' || e.entity_type === entityFilter;
      const matchTeam = teamFilter === 'all' || e.created_by_user_id === teamFilter;
      const matchEventType = eventTypeFilter === 'all' || e.event_type === eventTypeFilter;
      return matchMonth && matchEntity && matchTeam && matchEventType;
    });
  }, [currentMonth, entityFilter, teamFilter, eventTypeFilter]);

  const allMonthEvents = useMemo(() => {
    return [...filterEvents].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [filterEvents]);

  const getEventsForDay = (day: Date) =>
    filterEvents.filter(e => isSameDay(new Date(e.scheduled_at), day));

  const getEntityLink = (entityType: EntityType, entityId: string) => {
    if (entityType === EntityType.ENQUIRY) return `/enquiries/${entityId}`;
    if (entityType === EntityType.ACCOUNT) return `/accounts/${entityId}`;
    if (entityType === EntityType.TICKET) return `/tickets/${entityId}`;
    return '#';
  };

  const handleCreateEvent = (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    seedCalendarEvents.push({
      event_id: `CE_CAL_${Date.now()}`,
      entity_type: EntityType.ENQUIRY,
      entity_id: '',
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      created_by_user_id: currentUser.user_id,
      notes: data.notes || undefined,
      status: CalendarEventStatus.UPCOMING,
      event_type: data.event_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    toast.success(`Event "${data.title}" created`);
    setShowCreateDialog(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage all scheduled events</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Event
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Events Calendar
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_FILTERS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_FILTERS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {seedUsers.filter(u => u.is_active).map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isAdmin && (
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentUser.user_id}>My Calendar</SelectItem>
                    <SelectItem value="all">All Team</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`blank-${i}`} className="h-20 md:h-24" />
            ))}
            {days.map(day => {
              const dayEvents = getEventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`h-20 md:h-24 border rounded-md p-1 text-xs overflow-hidden ${
                    isToday(day) ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className={`font-medium mb-0.5 ${isToday(day) ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 2).map(e => (
                      <Link
                        key={e.event_id}
                        to={e.entity_id ? getEntityLink(e.entity_type, e.entity_id) : '#'}
                        className={`block rounded px-1 py-0.5 truncate hover:opacity-80 ${
                          eventTypeColors[e.event_type] ?? 'bg-primary/15 text-primary'
                        }`}
                        title={`${e.title} (${eventTypeLabels[e.event_type]})`}
                      >
                        {e.title.substring(0, 15)}…
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-muted-foreground">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* List View */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Events This Month ({allMonthEvents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {allMonthEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No events this month.</p>
          ) : (
            <div className="space-y-2">
              {allMonthEvents.map(e => (
                <Link key={e.event_id} to={e.entity_id ? getEntityLink(e.entity_type, e.entity_id) : '#'} className="block">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{format(new Date(e.scheduled_at), 'EEE dd MMM, HH:mm')}</span>
                        <span>•</span>
                        <span>{getUserName(e.created_by_user_id)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={`text-[10px] ${eventTypeColors[e.event_type] ?? 'bg-muted text-muted-foreground'}`}>
                        {eventTypeLabels[e.event_type] ?? 'General'}
                      </Badge>
                      <Badge className={`text-[10px] ${entityTypeColors[e.entity_type] ?? 'bg-muted text-muted-foreground'}`}>
                        {entityTypeLabels[e.entity_type] ?? 'Other'}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${
                        e.status === CalendarEventStatus.UPCOMING ? 'border-primary text-primary' :
                        e.status === CalendarEventStatus.COMPLETED ? 'border-success text-success' :
                        'border-muted-foreground text-muted-foreground'
                      }`}>{e.status}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>Schedule a new event on the calendar</DialogDescription>
          </DialogHeader>
          <CalendarEventForm
            onSubmit={handleCreateEvent}
            onCancel={() => setShowCreateDialog(false)}
            defaultEventType={CalendarEventType.GENERAL}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
