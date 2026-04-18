import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhoneCall, Building2, AlertTriangle, BookOpen, Users, ArrowRight, Calendar, Loader2, TrendingUp, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { isToday, isThisWeek, format } from 'date-fns';

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

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  to?: string;
}

function KpiTile({ icon: Icon, label, value, hint, tone = 'default', to }: KpiProps) {
  const toneMap = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  } as const;
  const ringMap = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  } as const;
  const inner = (
    <Card className={`shadow-sm h-full ${to ? 'hover:shadow-md hover:border-primary/30 transition-all cursor-pointer' : ''}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${ringMap[tone]}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          {to && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="mt-3">
          <div className={`text-3xl font-semibold tracking-tight ${toneMap[tone]}`}>{value}</div>
          <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
          {hint && <div className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

function MiniStat({ value, label, tone = 'default' }: { value: number; label: string; tone?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'muted' }) {
  const toneMap = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
  } as const;
  return (
    <div className="flex flex-col items-start py-1.5">
      <div className={`text-lg font-semibold tabular-nums ${toneMap[tone]}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

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

  const conversionRate = counts.enqTotal > 0 ? Math.round((counts.enqConverted / counts.enqTotal) * 100) : 0;
  const totalAttention = counts.enqAttention + counts.accAttention;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Terrisage Support Operations · {format(new Date(), 'EEEE, dd MMM yyyy')}</p>
        </div>
        {totalAttention > 0 && (
          <Badge variant="outline" className="border-warning/40 text-warning bg-warning/5 gap-1.5 py-1.5 px-3">
            <AlertTriangle className="h-3.5 w-3.5" />
            {totalAttention} item{totalAttention > 1 ? 's' : ''} need attention
          </Badge>
        )}
      </div>

      {/* Hero KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiTile icon={PhoneCall} label="Total enquiries" value={counts.enqTotal} hint={`+${counts.enqNewToday} today`} tone="primary" to="/enquiries" />
        <KpiTile icon={UserCheck} label="Converted to accounts" value={counts.enqConverted} hint={`${conversionRate}% conversion rate`} tone="success" to="/enquiries" />
        <KpiTile icon={Building2} label="Live accounts" value={counts.accLive} hint={`${counts.accOnboarding} onboarding`} tone="default" to="/accounts" />
        <KpiTile icon={AlertTriangle} label="Needs attention" value={totalAttention} hint="Stalled or uncontacted" tone={totalAttention > 0 ? 'warning' : 'default'} />
      </div>

      {/* Pipeline + Service grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline health */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Pipeline health
              </CardTitle>
              <Link to="/enquiries" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 pb-3 border-b border-border">
              <MiniStat value={counts.enqNewToday} label="New today" tone="primary" />
              <MiniStat value={counts.enqNotContacted} label="Not contacted" tone="destructive" />
              <MiniStat value={counts.enqContacted} label="In progress" />
              <MiniStat value={counts.enqConverted} label="Converted" tone="success" />
            </div>
            <div className="flex items-center justify-between pt-3 text-xs">
              <span className="text-muted-foreground">Conversion rate</span>
              <span className="font-semibold text-success">{conversionRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding pipeline */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Onboarding pipeline
              </CardTitle>
              <Link to="/accounts" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 pb-3 border-b border-border">
              <MiniStat value={counts.accLive} label="Live" tone="success" />
              <MiniStat value={counts.accOnboarding} label="Onboarding" tone="primary" />
              <MiniStat value={counts.accStalled} label="Stalled" tone="warning" />
              <MiniStat value={counts.accDeactivated} label="Deactivated" tone="muted" />
            </div>
            <div className="flex items-center justify-between pt-3 text-xs">
              <span className="text-muted-foreground">Stalled accounts</span>
              <button onClick={() => navigate('/accounts?status=STALLED_ONBOARDING')} className="font-semibold text-warning hover:underline">
                {counts.accStalled} review now
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attention / SLA strip */}
      {totalAttention > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {counts.enqAttention > 0 && (
            <button onClick={() => navigate('/enquiries')} className="text-left">
              <Card className="shadow-sm border-destructive/30 bg-destructive/5 hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{counts.enqAttention} enquiry{counts.enqAttention > 1 ? 'ies' : ''} uncontacted &gt;2 days</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Reach out before they go cold</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
          )}
          {counts.accAttention > 0 && (
            <button onClick={() => navigate('/accounts?status=STALLED_ONBOARDING')} className="text-left">
              <Card className="shadow-sm border-warning/30 bg-warning/5 hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{counts.accAttention} account{counts.accAttention > 1 ? 's' : ''} stalled in onboarding</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Unblock to move them live</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
          )}
        </div>
      )}

      {/* Today's actions — calendar */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Today's actions
            </CardTitle>
            <div className="flex gap-1">
              <Button variant={calendarScope === 'my' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCalendarScope('my')}>Mine</Button>
              <Button variant={calendarScope === 'all' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCalendarScope('all')}>Team</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="today">
            <TabsList className="mb-3">
              <TabsTrigger value="today">Today ({todayEvents.length})</TabsTrigger>
              <TabsTrigger value="week">This Week ({thisWeekEvents.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              {todayEvents.length === 0
                ? <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-success/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All clear for today.</p>
                  </div>
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
                ? <p className="text-sm text-muted-foreground py-6 text-center">No more events this week.</p>
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

      {/* Footer row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Knowledge Base</div>
                <div className="text-xs text-muted-foreground">Articles, packs & files</div>
              </div>
            </div>
            <Link to="/knowledge"><Button variant="outline" size="sm">Browse</Button></Link>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Team activity</div>
                  <div className="text-xs text-muted-foreground">Coming soon</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Soon</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
