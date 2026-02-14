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

/* ─── Metric row ─── */
function MetricRow({ items }: { items: { label: string; value: number; color?: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map(m => (
        <div key={m.label} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{m.label}</span>
          <span className={`text-sm font-semibold tabular-nums ${m.color ?? 'text-foreground'}`}>{m.value}</span>
        </div>
      ))}
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
  const openTickets = seedTickets.filter(t => t.status === TicketStatus.NEW).length;
  const inProgressTickets = seedTickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length;
  const waitingClient = seedTickets.filter(t => t.status === TicketStatus.WAITING_ON_CLIENT).length;
  const urgentHigh = seedTickets.filter(t =>
    t.priority === TicketPriority.URGENT || t.priority === TicketPriority.HIGH
  ).length;

  // ── Attention items ──
  const accountsAttention = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length;
  const enquiriesAttention = seedEnquiries.filter(e =>
    e.stage === EnquiryStage.NEW_ENQUIRY &&
    new Date(e.created_at) < new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  ).length;

  const kbQuickLinks = [
    { bucket: KBBucket.SALES_CONTENT, label: 'After-First-Call Scripts', count: seedKBItems.filter(k => k.bucket === KBBucket.SALES_CONTENT).length },
    { bucket: KBBucket.CHECKLISTS, label: 'Checklists', count: seedKBItems.filter(k => k.bucket === KBBucket.CHECKLISTS).length },
    { bucket: KBBucket.DEMO_TIPS, label: 'Demo Tips & Pitches', count: seedKBItems.filter(k => k.bucket === KBBucket.DEMO_TIPS).length },
    { bucket: KBBucket.ONBOARDING_PACKS, label: 'Onboarding Packs', count: seedKBItems.filter(k => k.bucket === KBBucket.ONBOARDING_PACKS).length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Terrisage Support Operations
        </p>
      </div>

      {/* ─── Three Buckets ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Enquiries */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <PhoneCall className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Enquiries</span>
          </div>
          <MetricRow items={[
            { label: 'Total', value: totalEnquiries },
            { label: 'New today', value: newToday },
            { label: 'Contacted', value: contacted },
            { label: 'Converted', value: converted, color: 'text-primary' },
            { label: 'Follow-up needed', value: followUpNeeded, color: 'text-warning' },
            { label: 'Not contacted', value: notContacted, color: 'text-destructive' },
          ]} />
        </div>

        {/* Onboarding */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Onboarding Pipeline</span>
          </div>
          <MetricRow items={[
            { label: 'Onboarding in progress', value: onboardingInProgress },
            { label: 'Live', value: liveAccounts, color: 'text-primary' },
            { label: 'Stalled', value: stalledOnboarding, color: 'text-warning' },
            { label: 'Deactivated', value: deactivated },
          ]} />
        </div>

        {/* Tickets */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <Ticket className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Tickets</span>
          </div>
          <MetricRow items={[
            { label: 'Open', value: openTickets },
            { label: 'In progress', value: inProgressTickets },
            { label: 'Pending customer', value: waitingClient },
            { label: 'Urgent / High', value: urgentHigh, color: 'text-destructive' },
          ]} />
        </div>
      </div>

      {/* ─── Attention + KPI Strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Q1 Targets</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Builders</span>
                <span className="font-semibold text-foreground">8 / 15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agencies</span>
                <span className="font-semibold text-foreground">12 / 35</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Monthly Active Users</span>
          </div>
          <div className="text-2xl font-bold text-foreground">142</div>
        </div>

        <div className="rounded-xl border border-warning/20 bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs font-medium text-muted-foreground">Accounts needing attention</span>
          </div>
          <div className="text-2xl font-bold text-warning">{accountsAttention}</div>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Stalled onboarding</p>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-medium text-muted-foreground">Enquiries needing attention</span>
          </div>
          <div className="text-2xl font-bold text-destructive">{enquiriesAttention}</div>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Not contacted in 48h+</p>
        </div>
      </div>

      {/* ─── Knowledge Base Quick Links ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Knowledge Base</span>
        </div>
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
      </div>
    </div>
  );
}
