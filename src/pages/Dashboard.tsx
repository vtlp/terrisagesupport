import { Link } from 'react-router-dom';
import {
  PhoneCall,
  Building2,
  Ticket,
  AlertTriangle,
  BookOpen,
  Target,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { isToday } from 'date-fns';

export default function Dashboard() {
  const { isAdmin } = useUser();

  // Enquiry counters
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

  // Account counters
  const liveAccounts = seedAccounts.filter(a => a.status === AccountStatus.LIVE).length;
  const onboardingInProgress = seedAccounts.filter(a => a.status === AccountStatus.ONBOARDING_IN_PROGRESS).length;
  const stalledOnboarding = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length;
  const deactivated = seedAccounts.filter(a => a.status === AccountStatus.DEACTIVATED).length;

  // Ticket counters
  const openTickets = seedTickets.filter(t => t.status === TicketStatus.NEW).length;
  const inProgressTickets = seedTickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length;
  const urgentHigh = seedTickets.filter(t =>
    t.priority === TicketPriority.URGENT || t.priority === TicketPriority.HIGH
  ).length;

  // Attention items
  const accountsAttention = seedAccounts.filter(a =>
    a.status === AccountStatus.STALLED_ONBOARDING
  );
  const enquiriesAttention = seedEnquiries.filter(e =>
    e.stage === EnquiryStage.NEW_ENQUIRY &&
    new Date(e.created_at) < new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  );

  const kbQuickLinks = [
    { bucket: KBBucket.SALES_CONTENT, label: 'After-First-Call Scripts', count: seedKBItems.filter(k => k.bucket === KBBucket.SALES_CONTENT).length },
    { bucket: KBBucket.CHECKLISTS, label: 'Checklists', count: seedKBItems.filter(k => k.bucket === KBBucket.CHECKLISTS).length },
    { bucket: KBBucket.DEMO_TIPS, label: 'Demo Tips & Pitches', count: seedKBItems.filter(k => k.bucket === KBBucket.DEMO_TIPS).length },
    { bucket: KBBucket.ONBOARDING_PACKS, label: 'Onboarding Packs', count: seedKBItems.filter(k => k.bucket === KBBucket.ONBOARDING_PACKS).length },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Terrisage Support Operations</p>
      </div>

      {/* 3 Top Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Enquiries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" />
              Enquiries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold">{totalEnquiries}</div><div className="text-xs text-muted-foreground">Total</div></div>
              <div><div className="text-2xl font-bold">{newToday}</div><div className="text-xs text-muted-foreground">New Today</div></div>
              <div><div className="text-2xl font-bold">{contacted}</div><div className="text-xs text-muted-foreground">Contacted</div></div>
              <div><div className="text-2xl font-bold text-primary">{converted}</div><div className="text-xs text-muted-foreground">Converted</div></div>
              <div><div className="text-2xl font-bold text-warning">{followUpNeeded}</div><div className="text-xs text-muted-foreground">Follow-up</div></div>
              <div><div className="text-2xl font-bold text-destructive">{notContacted}</div><div className="text-xs text-muted-foreground">Not Contacted</div></div>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Onboarding Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div><div className="text-2xl font-bold text-primary">{liveAccounts}</div><div className="text-xs text-muted-foreground">Live</div></div>
              <div><div className="text-2xl font-bold">{onboardingInProgress}</div><div className="text-xs text-muted-foreground">Onboarding</div></div>
              <div><div className="text-2xl font-bold text-warning">{stalledOnboarding}</div><div className="text-xs text-muted-foreground">Stalled</div></div>
              <div><div className="text-2xl font-bold text-muted-foreground">{deactivated}</div><div className="text-xs text-muted-foreground">Deactivated</div></div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              Tickets & Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold">{openTickets}</div><div className="text-xs text-muted-foreground">Open</div></div>
              <div><div className="text-2xl font-bold">{inProgressTickets}</div><div className="text-xs text-muted-foreground">In Progress</div></div>
              <div><div className="text-2xl font-bold text-destructive">{urgentHigh}</div><div className="text-xs text-muted-foreground">Urgent/High</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Q1 Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Builders</span><span className="font-medium">8 / 15</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Agencies</span><span className="font-medium">12 / 35</span></div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Monthly Active Users</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">142</div></CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Accounts Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{accountsAttention.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Stalled onboarding or overdue actions</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Enquiries Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{enquiriesAttention.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Not contacted or follow-up overdue</div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Base Quick Links */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kbQuickLinks.map(link => (
              <Link key={link.bucket} to="/knowledge" className="block">
                <div className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="font-medium text-sm">{link.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{link.count} items</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
