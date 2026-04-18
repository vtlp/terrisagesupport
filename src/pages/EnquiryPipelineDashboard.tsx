import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { seedEnquiries, seedCalendarEvents, seedAccounts, getUserName } from '@/data/seedData';
import { EntityType, CalendarEventStatus, EnquiryStage } from '@/types/core';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon, TrendingUp, Users, Phone, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const stageLabels: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'New',
  [EnquiryStage.CONTACTED]: 'Contacted',
  [EnquiryStage.DEMO_SCHEDULED]: 'Demo Sched.',
  [EnquiryStage.DEMO_COMPLETED]: 'Demo Done',
  [EnquiryStage.PAYMENT_LINK_SENT]: 'Payment Sent',
  [EnquiryStage.ONBOARDING_PACK_SENT]: 'Onboarding Sent',
  [EnquiryStage.ACCOUNT_CREATED]: 'Converted',
};

const stageColors: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'bg-muted text-muted-foreground',
  [EnquiryStage.CONTACTED]: 'bg-info/15 text-info',
  [EnquiryStage.DEMO_SCHEDULED]: 'bg-primary/15 text-primary',
  [EnquiryStage.DEMO_COMPLETED]: 'bg-accent/20 text-accent-foreground',
  [EnquiryStage.PAYMENT_LINK_SENT]: 'bg-warning/15 text-warning',
  [EnquiryStage.ONBOARDING_PACK_SENT]: 'bg-warning/15 text-warning',
  [EnquiryStage.ACCOUNT_CREATED]: 'bg-success/15 text-success',
};

export default function EnquiryPipelineDashboard() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // All calendar events for this month
  const monthEvents = useMemo(() => {
    return seedCalendarEvents.filter(e => {
      const d = new Date(e.scheduled_at);
      const matchMonth = d >= monthStart && d <= monthEnd;
      const matchEntity = entityFilter === 'all' || e.entity_type === entityFilter;
      return matchMonth && matchEntity;
    });
  }, [currentMonth, entityFilter]);

  const getEventsForDay = (day: Date) =>
    monthEvents.filter(e => isSameDay(new Date(e.scheduled_at), day));

  // Pipeline funnel
  const funnel = useMemo(() => {
    return Object.values(EnquiryStage).map(stage => ({
      stage,
      count: seedEnquiries.filter(e => e.stage === stage).length,
    }));
  }, []);

  const totalEnquiries = seedEnquiries.length;
  const totalUpcoming = seedCalendarEvents.filter(e => e.status === CalendarEventStatus.UPCOMING).length;
  const totalCompleted = seedCalendarEvents.filter(e => e.status === CalendarEventStatus.COMPLETED).length;
  const conversionRate = Math.round((funnel.find(f => f.stage === EnquiryStage.ACCOUNT_CREATED)?.count ?? 0) / totalEnquiries * 100);

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
                  <SelectItem value={EntityType.ENQUIRY}>Enquiries</SelectItem>
                  <SelectItem value={EntityType.ACCOUNT}>Accounts</SelectItem>
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
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Leading blanks */}
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
                        key={e.event_id}
                        className={`rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-80 ${
                          e.status === CalendarEventStatus.COMPLETED ? 'bg-success/15 text-success' :
                          e.status === CalendarEventStatus.CANCELLED ? 'bg-destructive/15 text-destructive' :
                          'bg-primary/15 text-primary'
                        }`}
                        title={e.title}
                        onClick={() => {
                          if (e.entity_type === EntityType.ENQUIRY) navigate(`/enquiries/${e.entity_id}`);
                          else if (e.entity_type === EntityType.ACCOUNT) navigate(`/accounts/${e.entity_id}`);
                        }}
                      >
                        {e.title.substring(0, 15)}...
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
            {seedCalendarEvents
              .filter(e => e.status === CalendarEventStatus.UPCOMING)
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              .slice(0, 10)
              .map(e => (
                <div
                  key={e.event_id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70"
                  onClick={() => {
                    if (e.entity_type === EntityType.ENQUIRY) navigate(`/enquiries/${e.entity_id}`);
                    else if (e.entity_type === EntityType.ACCOUNT) navigate(`/accounts/${e.entity_id}`);
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(e.scheduled_at), 'dd MMM yyyy, HH:mm')}</span>
                      <Badge variant="outline" className="text-xs">{e.entity_type}</Badge>
                      <span>{getUserName(e.created_by_user_id)}</span>
                    </div>
                  </div>
                  <Badge className="bg-primary/15 text-primary text-xs">{e.status}</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
