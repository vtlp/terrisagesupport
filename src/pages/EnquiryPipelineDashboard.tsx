import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon, TrendingUp, Phone, Target, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Stage = 'NEW_ENQUIRY' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'DEMO_COMPLETED' | 'PAYMENT_LINK_SENT' | 'ONBOARDING_PACK_SENT' | 'ACCOUNT_CREATED' | 'LOST';
type EventStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

interface EnquiryRow { id: string; stage: Stage; created_at: string; }
interface EventRow {
  id: string;
  title: string;
  scheduled_at: string;
  event_type: string;
  status: EventStatus;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  assigned_to: string | null;
}

const stageOrder: Stage[] = ['NEW_ENQUIRY', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PAYMENT_LINK_SENT', 'ONBOARDING_PACK_SENT', 'ACCOUNT_CREATED'];

const stageLabels: Record<Stage, string> = {
  NEW_ENQUIRY: 'New', CONTACTED: 'Contacted', DEMO_SCHEDULED: 'Demo Sched.',
  DEMO_COMPLETED: 'Demo Done', PAYMENT_LINK_SENT: 'Payment',
  ONBOARDING_PACK_SENT: 'Onboarding Sent', ACCOUNT_CREATED: 'Converted',
  LOST: 'Lost',
};

const stageColors: Record<Stage, string> = {
  NEW_ENQUIRY: 'bg-muted text-muted-foreground',
  CONTACTED: 'bg-info/15 text-info',
  DEMO_SCHEDULED: 'bg-primary/15 text-primary',
  DEMO_COMPLETED: 'bg-accent/20 text-accent-foreground',
  PAYMENT_LINK_SENT: 'bg-warning/15 text-warning',
  ONBOARDING_PACK_SENT: 'bg-warning/15 text-warning',
  ACCOUNT_CREATED: 'bg-success/15 text-success',
  LOST: 'bg-destructive/15 text-destructive',
};

export default function EnquiryPipelineDashboard() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: enq, error: e1 }, { data: ev, error: e2 }, { data: profs }] = await Promise.all([
        supabase.from('enquiries').select('id, stage, created_at'),
        supabase.from('calendar_events').select('id, title, scheduled_at, event_type, status, related_entity_type, related_entity_id, created_by, assigned_to'),
        supabase.from('profiles').select('id, full_name'),
      ]);
      if (cancelled) return;
      if (e1) toast.error(e1.message);
      if (e2) toast.error(e2.message);
      setEnquiries((enq ?? []) as EnquiryRow[]);
      setEvents((ev ?? []) as EventRow[]);
      setProfileMap(new Map((profs ?? []).map(p => [p.id, p.full_name])));
      setLoading(false);
    };
    load();
    const ch = supabase.channel('pipeline-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const monthEvents = useMemo(() => {
    return events.filter(e => {
      const d = new Date(e.scheduled_at);
      const matchMonth = d >= monthStart && d <= monthEnd;
      const matchEntity = entityFilter === 'all' || (e.related_entity_type ?? '').toUpperCase() === entityFilter;
      return matchMonth && matchEntity;
    });
  }, [events, monthStart, monthEnd, entityFilter]);

  const getEventsForDay = (day: Date) =>
    monthEvents.filter(e => isSameDay(new Date(e.scheduled_at), day));

  const funnel = useMemo(() => {
    return stageOrder.map(stage => ({
      stage,
      count: enquiries.filter(e => e.stage === stage).length,
    }));
  }, [enquiries]);

  const totalEnquiries = enquiries.length;
  const totalUpcoming = events.filter(e => e.status === 'SCHEDULED' && new Date(e.scheduled_at) >= new Date()).length;
  const totalCompleted = events.filter(e => e.status === 'COMPLETED').length;
  const converted = funnel.find(f => f.stage === 'ACCOUNT_CREATED')?.count ?? 0;
  const conversionRate = totalEnquiries > 0 ? Math.round((converted / totalEnquiries) * 100) : 0;

  const navigateForEvent = (e: EventRow) => {
    const t = (e.related_entity_type ?? '').toUpperCase();
    if (!e.related_entity_id) return;
    if (t === 'ENQUIRY') navigate(`/enquiries/${e.related_entity_id}`);
    else if (t === 'ACCOUNT') navigate(`/accounts/${e.related_entity_id}`);
    else if (t === 'TICKET') navigate(`/tickets/${e.related_entity_id}`);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Calendar, funnel metrics, and upcoming actions</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold">{totalEnquiries}</div>
            <div className="text-xs text-muted-foreground">Total Enquiries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <div className="text-xs text-muted-foreground">Conversion Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarIcon className="h-5 w-5 mx-auto text-warning mb-1" />
            <div className="text-2xl font-bold">{totalUpcoming}</div>
            <div className="text-xs text-muted-foreground">Upcoming Events</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 mx-auto text-info mb-1" />
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <div className="text-xs text-muted-foreground">Completed Events</div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2">
            {funnel.map((f, i) => (
              <div key={f.stage} className="flex-1 relative">
                <div className={`rounded-lg p-3 text-center ${stageColors[f.stage]}`}>
                  <div className="text-2xl font-bold">{f.count}</div>
                  <div className="text-xs font-medium">{stageLabels[f.stage]}</div>
                </div>
                {i < funnel.length - 1 && (
                  <div className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Events Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="ENQUIRY">Enquiries</SelectItem>
                  <SelectItem value="ACCOUNT">Accounts</SelectItem>
                  <SelectItem value="TICKET">Tickets</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
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
                      <div
                        key={e.id}
                        className={`rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-80 ${
                          e.status === 'COMPLETED' ? 'bg-success/15 text-success' :
                          e.status === 'CANCELLED' || e.status === 'NO_SHOW' ? 'bg-destructive/15 text-destructive' :
                          'bg-primary/15 text-primary'
                        }`}
                        title={e.title}
                        onClick={() => navigateForEvent(e)}
                      >
                        {e.title.length > 15 ? `${e.title.substring(0, 15)}...` : e.title}
                      </div>
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

      {/* Upcoming Events List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events
              .filter(e => e.status === 'SCHEDULED' && new Date(e.scheduled_at) >= new Date())
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              .slice(0, 10)
              .map(e => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70"
                  onClick={() => navigateForEvent(e)}
                >
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(e.scheduled_at), 'dd MMM yyyy, HH:mm')}</span>
                      {e.related_entity_type && (
                        <Badge variant="outline" className="text-xs">{e.related_entity_type}</Badge>
                      )}
                      <span>{e.created_by ? (profileMap.get(e.created_by) ?? 'User') : 'Unassigned'}</span>
                    </div>
                  </div>
                  <Badge className="bg-primary/15 text-primary text-xs">{e.status}</Badge>
                </div>
              ))}
            {events.filter(e => e.status === 'SCHEDULED' && new Date(e.scheduled_at) >= new Date()).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming events.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
