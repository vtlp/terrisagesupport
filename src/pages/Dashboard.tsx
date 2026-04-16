import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhoneCall, Building2, AlertTriangle, BookOpen, Users, ArrowRight, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { isToday, isThisWeek, format } from 'date-fns';

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center py-1">
      <div className={`text-xl sm:text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}

interface CalEvent {
  id: string; title: string; scheduled_at: string;
  event_type: string; related_entity_type: string | null; related_entity_id: string | null;
  created_by: string | null;
}

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

export default function Dashboard() {
  const { currentUser, isAdmin } = useUser();
  const navigate = useNavigate();
  const [calendarScope, setCalendarScope] = useState<'my' | 'all'>('my');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [counts, setCounts] = useState({
    enqTotal: 0, enqNewToday: 0, enqContacted: 0, enqConverted: 0, enqNotContacted: 0,
    accLive: 0, accOnboarding: 0, accStalled: 0, accDeactivated: 0,
    enqAttention: 0, accAttention: 0,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

      const [enq, acc, ev] = await Promise.all([
        supabase.from('enquiries').select('id, stage, created_at'),
        supabase.from('accounts').select('id, status'),
        supabase.from('calendar_events').select('id, title, scheduled_at, event_type, related_entity_type, related_entity_id, created_by'),
      ]);
      if (!active) return;
      const enqs = enq.data ?? [];
      const accs = acc.data ?? [];
      setCounts({
        enqTotal: enqs.length,
        enqNewToday: enqs.filter(e => new Date(e.created_at) >= todayStart).length,
        enqContacted: enqs.filter(e => e.stage !== 'NEW_ENQUIRY').length,
        enqConverted: enqs.filter(e => e.stage === 'ACCOUNT_CREATED').length,
        enqNotContacted: enqs.filter(e => e.stage === 'NEW_ENQUIRY').length,
        accLive: accs.filter(a => a.status === 'LIVE').length,
        accOnboarding: accs.filter(a => a.status === 'ONBOARDING_IN_PROGRESS').length,
        accStalled: accs.filter(a => a.status === 'STALLED_ONBOARDING').length,
        accDeactivated: accs.filter(a => a.status === 'DEACTIVATED').length,
        accAttention: accs.filter(a => a.status === 'STALLED_ONBOARDING').length,
        enqAttention: enqs.filter(e => e.stage === 'NEW_ENQUIRY' && e.created_at < twoDaysAgo).length,
      });
      setEvents((ev.data ?? []) as CalEvent[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const upcoming = events.filter(e => new Date(e.scheduled_at) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const filteredEvents = calendarScope === 'my'
    ? upcoming.filter(e => e.created_by === currentUser.user_id)
    : upcoming;
  const todayEvents = filteredEvents
    .filter(e => isToday(new Date(e.scheduled_at)))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const thisWeekEvents = filteredEvents
    .filter(e => isThisWeek(new Date(e.scheduled_at), { weekStartsOn: 1 }) && !isToday(new Date(e.scheduled_at)))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const entityLink = (t: string | null, id: string | null) => {
    if (!t || !id) return '#';
    if (t === 'ENQUIRY') return `/enquiries/${id}`;
    if (t === 'ACCOUNT') return `/accounts/${id}`;
    if (t === 'TICKET') return `/tickets/${id}`;
    return '#';
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Terrisage Support Operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/enquiries"><Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <PhoneCall className="h-4 w-4 text-primary" /> Enquiries <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat value={counts.enqTotal} label="Total" />
              <Stat value={counts.enqNewToday} label="New Today" />
              <Stat value={counts.enqContacted} label="Contacted" />
              <Stat value={counts.enqConverted} label="Converted" color="text-primary" />
              <Stat value={counts.enqNotContacted} label="Not Contacted" color="text-destructive" />
            </div>
          </CardContent>
        </Card></Link>

        <Link to="/accounts"><Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" /> Onboarding Pipeline <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat value={counts.accLive} label="Live" color="text-primary" />
              <Stat value={counts.accOnboarding} label="Onboarding" />
              <Stat value={counts.accStalled} label="Stalled" color="text-warning" />
              <Stat value={counts.accDeactivated} label="Deactivated" color="text-muted-foreground" />
            </div>
          </CardContent>
        </Card></Link>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" /> Calendar Events
            </CardTitle>
            <div className="flex gap-1">
              <Button variant={calendarScope === 'my' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCalendarScope('my')}>My Events</Button>
              <Button variant={calendarScope === 'all' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCalendarScope('all')}>All Team</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <Tabs defaultValue="today">
            <TabsList className="mb-3">
              <TabsTrigger value="today">Today ({todayEvents.length})</TabsTrigger>
              <TabsTrigger value="week">This Week ({thisWeekEvents.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              {todayEvents.length === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">No events today.</p>
                : <div className="divide-y divide-border">
                  {todayEvents.map(e => (
                    <Link key={e.id} to={entityLink(e.related_entity_type, e.related_entity_id)} className="block">
                      <div className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'HH:mm')}</p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2">
                          <Badge className={`text-[10px] ${eventTypeColors[e.event_type] ?? 'bg-muted'}`}>{e.event_type}</Badge>
                          {e.related_entity_type && <Badge className={`text-[10px] ${entityColors[e.related_entity_type] ?? ''}`}>{e.related_entity_type}</Badge>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>}
            </TabsContent>
            <TabsContent value="week">
              {thisWeekEvents.length === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">No more events this week.</p>
                : <div className="divide-y divide-border">
                  {thisWeekEvents.map(e => (
                    <Link key={e.id} to={entityLink(e.related_entity_type, e.related_entity_id)} className="block">
                      <div className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'EEE dd MMM, HH:mm')}</p>
                        </div>
                        <Badge className={`text-[10px] ${eventTypeColors[e.event_type] ?? 'bg-muted'}`}>{e.event_type}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm border-warning/20 cursor-pointer hover:shadow-md" onClick={() => navigate('/accounts?status=STALLED_ONBOARDING')}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Accounts Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-warning">{counts.accAttention}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Stalled onboarding</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20 cursor-pointer hover:shadow-md" onClick={() => navigate('/enquiries')}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Enquiries Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-destructive">{counts.enqAttention}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">New & uncontacted &gt;2d</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Team Active
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold">—</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Coming soon</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary" /> Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <Link to="/knowledge"><Button variant="outline" size="sm" className="text-xs">Browse articles & files</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
