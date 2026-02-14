import { Link } from 'react-router-dom';
import {
  PhoneCall,
  Building2,
  Ticket,
  AlertTriangle,
  BookOpen,
  Target,
  Users,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

/* ─── Stat cell ─── */
function Stat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="text-center py-1">
      <div className={`text-xl sm:text-2xl font-bold ${color ?? 'text-foreground'}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { isAdmin } = useUser();

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
  const urgentHigh = seedTickets.filter(t =>
    t.priority === TicketPriority.P1 || t.priority === TicketPriority.P2
  ).length;

  // ── Attention items ──
  const accountsAttention = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Terrisage Support Operations
        </p>
      </div>

      {/* ─── Top 3 Buckets ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Enquiries */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <PhoneCall className="h-4 w-4 text-primary" />
              Enquiries
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

        {/* Onboarding Pipeline */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Onboarding Pipeline
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

        {/* Tickets */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Ticket className="h-4 w-4 text-primary" />
              Tickets & Issues
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
      </div>

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Q1 Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Builders</span>
                  <span className="font-semibold">8 / 15</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agencies</span>
                  <span className="font-semibold">12 / 35</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Monthly Active Users
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">142</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-warning/20">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Accounts Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-warning">{accountsAttention.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
              Stalled onboarding or overdue
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              Enquiries Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-destructive">{enquiriesAttention.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
              Not contacted or follow-up overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Knowledge Base Quick Links ─── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kbQuickLinks.map(link => (
              <Link key={link.bucket} to="/knowledge" className="group block">
                <div className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/40 transition-all duration-200">
                  <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                    {link.label}
                  </div>
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
