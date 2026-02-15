import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PhoneCall,
  Building2,
  Ticket,
  AlertTriangle,
  BookOpen,
  Target,
  Users,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  seedEnquiries,
  seedAccounts,
  seedTickets,
  seedCalendarEvents,
  seedKBItems,
} from '@/data/seedData';
import {
  EnquiryStage,
  AccountStatus,
  TicketStatus,
  TicketPriority,
  CalendarEventStatus,
  KBBucket,
  EntityType,
} from '@/types/core';
import { useUser } from '@/context/UserContext';
import { isToday, isThisWeek, format } from 'date-fns';

/* ─── Stat cell ─── */
function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center py-1">
      <div className={`text-xl sm:text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}

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

export default function Dashboard() {
  const { currentUser, isAdmin } = useUser();
  const navigate = useNavigate();
  const [calendarScope, setCalendarScope] = useState<'my' | 'all'>('my');

  // ── Enquiry counters ──
  const totalEnquiries = seedEnquiries.length;
  const newToday = seedEnquiries.filter(e => isToday(new Date(e.created_at))).length;
  const contacted = seedEnquiries.filter(e => e.stage !== EnquiryStage.NEW_ENQUIRY).length;
  const converted = seedEnquiries.filter(e => e.stage === EnquiryStage.ACCOUNT_CREATED).length;
  const followUpNeeded = seedEnquiries.filter(e =>
    seedCalendarEvents.some(ce =>
      ce.entity_type === EntityType.ENQUIRY &&
      ce.entity_id === e.enquiry_id &&
      ce.status === CalendarEventStatus.UPCOMING
    )
  ).length;
  const notContacted = seedEnquiries.filter(e => e.stage === EnquiryStage.NEW_ENQUIRY).length;

  // ── Account counters ──
  const liveAccounts = seedAccounts.filter(a => a.status === AccountStatus.LIVE).length;
  const onboardingInProgress = seedAccounts.filter(a => a.status === AccountStatus.ONBOARDING_IN_PROGRESS).length;
  const stalledOnboarding = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length;
  const deactivated = seedAccounts.filter(a => a.status === AccountStatus.DEACTIVATED).length;

  // ── Ticket counters ──
  const openTickets = seedTickets.filter(t => t.status === TicketStatus.OPEN).length;
  const pendingTickets = seedTickets.filter(t => t.status === TicketStatus.PENDING_CUSTOMER || t.status === TicketStatus.PENDING_INTERNAL).length;
  const urgentHigh = seedTickets.filter(t => t.priority === TicketPriority.P1 || t.priority === TicketPriority.P2).length;

  // ── Attention items ──
  const accountsAttention = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING);
  const enquiriesAttention = seedEnquiries.filter(e =>
    e.stage === EnquiryStage.NEW_ENQUIRY &&
    new Date(e.created_at) < new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  );

  // ── Calendar Events ──
  const upcomingEvents = seedCalendarEvents.filter(e => e.status === CalendarEventStatus.UPCOMING);
  const filteredEvents = calendarScope === 'my'
    ? upcomingEvents.filter(e => e.created_by_user_id === currentUser.user_id)
    : upcomingEvents;

  const todayEvents = filteredEvents
    .filter(e => isToday(new Date(e.scheduled_at)))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const thisWeekEvents = filteredEvents
    .filter(e => isThisWeek(new Date(e.scheduled_at), { weekStartsOn: 1 }) && !isToday(new Date(e.scheduled_at)))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const getEntityLink = (entityType: EntityType, entityId: string) => {
    if (entityType === EntityType.ENQUIRY) return `/enquiries/${entityId}`;
    if (entityType === EntityType.ACCOUNT) return `/accounts/${entityId}`;
    if (entityType === EntityType.TICKET) return `/tickets/${entityId}`;
    return '#';
  };

  const kbQuickLinks = [
    { bucket: KBBucket.SALES_CONTENT, label: 'After-First-Call Scripts', count: seedKBItems.filter(k => k.bucket === KBBucket.SALES_CONTENT).length },
    { bucket: KBBucket.CHECKLISTS, label: 'Checklists', count: seedKBItems.filter(k => k.bucket === KBBucket.CHECKLISTS).length },
    { bucket: KBBucket.DEMO_TIPS, label: 'Demo Tips & Pitches', count: seedKBItems.filter(k => k.bucket === KBBucket.DEMO_TIPS).length },
    { bucket: KBBucket.ONBOARDING_PACKS, label: 'Onboarding Packs', count: seedKBItems.filter(k => k.bucket === KBBucket.ONBOARDING_PACKS).length },
  ];

  function EventRow({ event }: { event: typeof upcomingEvents[0] }) {
    return (
      <Link to={getEntityLink(event.entity_type, event.entity_id)} className="block">
        <div className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{event.title}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(event.scheduled_at), 'HH:mm')}</p>
          </div>
          <Badge className={`text-[10px] ml-2 ${entityTypeColors[event.entity_type]}`}>
            {entityTypeLabels[event.entity_type]}
          </Badge>
        </div>
      </Link>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Terrisage Support Operations</p>
      </div>

      {/* ─── Top 3 Buckets ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Enquiries */}
        <Link to="/enquiries" className="block">
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <PhoneCall className="h-4 w-4 text-primary" /> Enquiries
              <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat value={totalEnquiries} label="Total" />
              <Stat value={newToday} label="New Today" />
              <Stat value={contacted} label="Contacted" />
              <Stat value={converted} label="Converted" color="text-primary" />
              <Stat value={followUpNeeded} label="Follow-up" color="text-warning" />
              <Stat value={notContacted} label="Not Contacted" color="text-destructive" />
            </div>
          </CardContent>
        </Card>
        </Link>

        {/* Onboarding Pipeline */}
        <Link to="/accounts" className="block">
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" /> Onboarding Pipeline
              <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat value={liveAccounts} label="Live" color="text-primary" />
              <Stat value={onboardingInProgress} label="Onboarding" />
              <Stat value={stalledOnboarding} label="Stalled" color="text-warning" />
              <Stat value={deactivated} label="Deactivated" color="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        </Link>

        {/* Tickets */}
        <Link to="/tickets" className="block">
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Ticket className="h-4 w-4 text-primary" /> Tickets & Issues
              <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat value={openTickets} label="Open" />
              <Stat value={pendingTickets} label="Pending" />
              <Stat value={urgentHigh} label="Urgent/High" color="text-destructive" />
            </div>
          </CardContent>
        </Card>
        </Link>
      </div>

      {/* ─── Calendar Events Section ─── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" /> Calendar Events
            </CardTitle>
            <div className="flex gap-1">
              <Button variant={calendarScope === 'my' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCalendarScope('my')}>
                My Events
              </Button>
              <Button variant={calendarScope === 'all' ? 'default' : 'outline'} size="sm" className="text-xs h-7" onClick={() => setCalendarScope('all')}>
                All Team
              </Button>
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
              {todayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No events today.</p>
              ) : (
                <div className="divide-y divide-border">
                  {todayEvents.map(e => <EventRow key={e.event_id} event={e} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="week">
              {thisWeekEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No more events this week.</p>
              ) : (
                <div className="divide-y divide-border">
                  {thisWeekEvents.map(e => (
                    <Link key={e.event_id} to={getEntityLink(e.entity_type, e.entity_id)} className="block">
                      <div className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'EEE dd MMM, HH:mm')}</p>
                        </div>
                        <Badge className={`text-[10px] ml-2 ${entityTypeColors[e.entity_type]}`}>
                          {entityTypeLabels[e.entity_type]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Q1 Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Builders</span><span className="font-semibold">8 / 15</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Agencies</span><span className="font-semibold">12 / 35</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Monthly Active Users
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">142</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-warning/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/accounts?status=STALLED_ONBOARDING')}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Accounts Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-warning">{accountsAttention.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Stalled onboarding or overdue</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/enquiries?status=follow_up_needed')}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Enquiries Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-destructive">{enquiriesAttention.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Not contacted or follow-up overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Knowledge Base Quick Links ─── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary" /> Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kbQuickLinks.map(link => (
              <Link key={link.bucket} to="/knowledge" className="group block">
                <div className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/40 transition-all duration-200">
                  <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{link.label}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">{link.count} items</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
