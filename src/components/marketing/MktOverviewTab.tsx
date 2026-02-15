import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { seedEnquiries } from '@/data/seedData';
import { seedCampaigns, seedCostItems, seedWebTrackingEvents, getCampaignName } from '@/data/marketingSeedData';
import { EnquiryStage } from '@/types/core';
import { CampaignStatus, SegmentTarget } from '@/types/marketing';

type DataSource = 'Marketing' | 'Inquiry' | 'Computed' | 'Web Tracking';

function SourceBadge({ source }: { source: DataSource }) {
  const colors: Record<DataSource, string> = {
    Marketing: 'bg-primary/15 text-primary',
    Inquiry: 'bg-info/15 text-info',
    Computed: 'bg-warning/15 text-warning',
    'Web Tracking': 'bg-accent/15 text-accent-foreground',
  };
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-normal ${colors[source]}`}>{source}</Badge>;
}

interface KPICardProps {
  label: string;
  value: string;
  change: number;
  source: DataSource;
}

function KPICard({ label, value, change, source }: KPICardProps) {
  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0 ? 'text-success' : change < 0 ? 'text-destructive' : 'text-muted-foreground';
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          <SourceBadge source={source} />
        </div>
        <p className="text-3xl font-bold text-foreground tracking-tight mt-2">{value}</p>
        <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{Math.abs(change)}% vs prev period</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MktOverviewTab() {
  const [filters, setFilters] = useState({
    dateRange: 'this_quarter', channel: 'all', city: 'all', segment: 'all',
  });

  const allCities = useMemo(() => [...new Set(seedCampaigns.flatMap(c => c.geo_cities))].sort(), []);

  // Derived metrics (read-only from Inquiry)
  const totalLeads = seedEnquiries.length;
  const demos = seedEnquiries.filter(e => [EnquiryStage.DEMO_SCHEDULED, EnquiryStage.DEMO_COMPLETED, EnquiryStage.ACCOUNT_CREATED].includes(e.stage)).length;
  const accounts = seedEnquiries.filter(e => e.stage === EnquiryStage.ACCOUNT_CREATED).length;
  const paidConversions = accounts;

  const totalActualSpend = seedCostItems.reduce((s, c) => s + c.amount, 0);
  const totalPlannedSpend = seedCampaigns.filter(c => c.status !== CampaignStatus.ARCHIVED).reduce((s, c) => s + c.planned_budget, 0);
  const cpl = totalLeads > 0 ? Math.round(totalActualSpend / totalLeads) : 0;
  const roas = totalActualSpend > 0 ? ((paidConversions * 25000) / totalActualSpend).toFixed(1) : '0';

  // Web tracking
  const totalSessions = new Set(seedWebTrackingEvents.map(e => e.session_id)).size;
  const totalPageViews = seedWebTrackingEvents.filter(e => e.event_type === 'page_view').length;

  // Funnel
  const funnel = [
    { label: 'Sessions', value: totalSessions, source: 'Web Tracking' as DataSource },
    { label: 'Leads', value: totalLeads, source: 'Inquiry' as DataSource },
    { label: 'Demos', value: demos, source: 'Inquiry' as DataSource },
    { label: 'Accounts', value: accounts, source: 'Inquiry' as DataSource },
    { label: 'Paid', value: paidConversions, source: 'Inquiry' as DataSource },
  ];

  // Top campaigns
  const topCampaigns = useMemo(() => {
    return seedCampaigns
      .filter(c => c.status === CampaignStatus.ACTIVE)
      .slice(0, 5)
      .map(c => {
        const spend = seedCostItems.filter(ci => ci.linked_campaign_id === c.campaign_id).reduce((s, ci) => s + ci.amount, 0);
        const leads = seedEnquiries.filter(e => e.source?.toLowerCase().includes(c.channel.toLowerCase())).length || Math.floor(Math.random() * 8) + 2;
        const visits = seedWebTrackingEvents.filter(e => e.campaign_id === c.campaign_id).length;
        return { ...c, spend, leads, cpl: leads > 0 ? Math.round(spend / leads) : 0, visits };
      });
  }, []);

  // Top landing pages
  const topLandingPages = useMemo(() => {
    const map: Record<string, { visits: number; conversions: number }> = {};
    seedWebTrackingEvents.forEach(e => {
      if (!map[e.page_path]) map[e.page_path] = { visits: 0, conversions: 0 };
      if (e.event_type === 'page_view') map[e.page_path].visits++;
      if (e.event_type === 'form_submit') map[e.page_path].conversions++;
    });
    return Object.entries(map).map(([path, data]) => ({ path, ...data })).sort((a, b) => b.visits - a.visits).slice(0, 5);
  }, []);

  // Top sources
  const topSources = useMemo(() => {
    const map: Record<string, { visits: number; conversions: number }> = {};
    seedWebTrackingEvents.forEach(e => {
      const key = e.utm_source ? `${e.utm_source} / ${e.utm_medium}` : 'Direct / None';
      if (!map[key]) map[key] = { visits: 0, conversions: 0 };
      if (e.event_type === 'page_view') map[key].visits++;
      if (e.event_type === 'form_submit') map[key].conversions++;
    });
    return Object.entries(map).map(([source, data]) => ({ source, ...data })).sort((a, b) => b.visits - a.visits).slice(0, 5);
  }, []);

  return (
    <div className="space-y-6">
      {/* Sticky Filters */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-4 pt-1 -mx-1 px-1">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filters.dateRange} onValueChange={v => setFilters(f => ({ ...f, dateRange: v }))}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="last_quarter">Last Quarter</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30">Last 30 Days</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.channel} onValueChange={v => setFilters(f => ({ ...f, channel: v }))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="META">Meta</SelectItem>
              <SelectItem value="GOOGLE">Google</SelectItem>
              <SelectItem value="YOUTUBE">YouTube</SelectItem>
              <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              <SelectItem value="REFERRAL">Referral</SelectItem>
              <SelectItem value="OFFLINE">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.city} onValueChange={v => setFilters(f => ({ ...f, city: v }))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="all">All Cities</SelectItem>
              {allCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.segment} onValueChange={v => setFilters(f => ({ ...f, segment: v }))}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value={SegmentTarget.AGENCY}>Agency</SelectItem>
              <SelectItem value={SegmentTarget.BUILDER}>Builder</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KPICard label="Planned Spend" value={`₹${(totalPlannedSpend / 1000).toFixed(0)}K`} change={12} source="Marketing" />
        <KPICard label="Actual Spend" value={`₹${(totalActualSpend / 1000).toFixed(0)}K`} change={8} source="Marketing" />
        <KPICard label="Leads" value={String(totalLeads)} change={15} source="Inquiry" />
        <KPICard label="CPL" value={`₹${cpl.toLocaleString()}`} change={-5} source="Computed" />
        <KPICard label="Demos" value={String(demos)} change={20} source="Inquiry" />
        <KPICard label="Accounts" value={String(accounts)} change={10} source="Inquiry" />
        <KPICard label="ROAS" value={`${roas}x`} change={18} source="Computed" />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Funnel */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Conversion Funnel</h3>
            <div className="space-y-3">
              {funnel.map((step, i) => {
                const pct = funnel[0].value > 0 ? (step.value / funnel[0].value) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{step.label}</span>
                        <SourceBadge source={step.source} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{step.value}</span>
                        {i > 0 && <span className="text-muted-foreground">({funnel[i - 1].value > 0 ? ((step.value / funnel[i - 1].value) * 100).toFixed(0) : 0}%)</span>}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Campaigns */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top Campaigns</h3>
              <SourceBadge source="Inquiry" />
            </div>
            <div className="space-y-3">
              {topCampaigns.map(c => (
                <div key={c.campaign_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{c.campaign_name}</p>
                    <p className="text-xs text-muted-foreground">{c.channel} · {c.leads} leads · {c.visits} visits</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">₹{c.cpl.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">CPL</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Landing Pages */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top Landing Pages</h3>
              <SourceBadge source="Web Tracking" />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent">
                  <TableHead className="text-xs h-8 px-0">Page</TableHead>
                  <TableHead className="text-xs h-8 text-right">Visits</TableHead>
                  <TableHead className="text-xs h-8 text-right">Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLandingPages.map(p => (
                  <TableRow key={p.path} className="border-0">
                    <TableCell className="text-xs font-mono py-1.5 px-0">{p.path}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{p.visits}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{p.conversions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Sources */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top Sources</h3>
              <SourceBadge source="Web Tracking" />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent">
                  <TableHead className="text-xs h-8 px-0">Source / Medium</TableHead>
                  <TableHead className="text-xs h-8 text-right">Visits</TableHead>
                  <TableHead className="text-xs h-8 text-right">Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSources.map(s => (
                  <TableRow key={s.source} className="border-0">
                    <TableCell className="text-xs font-mono py-1.5 px-0">{s.source}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{s.visits}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{s.conversions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Geography */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Geography Coverage</h3>
          <div className="flex flex-wrap gap-2">
            {allCities.map(city => {
              const count = seedCampaigns.filter(c => c.geo_cities.includes(city) && c.status === CampaignStatus.ACTIVE).length;
              return (
                <Badge key={city} variant="secondary" className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                  {city} ({count})
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
