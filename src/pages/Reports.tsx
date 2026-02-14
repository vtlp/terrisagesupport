import { useState } from 'react';
import { Download, BarChart3, TrendingUp, PieChart, Users, Target, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RPieChart, Pie, Cell, ResponsiveContainer,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import { seedEnquiries, seedAccounts, seedTickets, seedMarketingLogs } from '@/data/seedData';
import {
  EnquiryStage, EnquirySource, TenancyType, AccountStatus,
  TicketStatus, TicketPriority, MarketingCostType,
} from '@/types/core';

// ── Computed Data ──────────────────────────────

// Enquiry funnel
const stageCounts = Object.values(EnquiryStage).map(stage => ({
  stage: stage.replace(/_/g, ' '),
  value: seedEnquiries.filter(e => e.stage === stage).length,
}));

const funnelData = [
  { name: 'Total Enquiries', value: seedEnquiries.length, fill: 'hsl(var(--primary))' },
  { name: 'Contacted', value: seedEnquiries.filter(e => e.stage !== EnquiryStage.NEW_ENQUIRY).length, fill: 'hsl(var(--info))' },
  { name: 'Demo Scheduled', value: seedEnquiries.filter(e => [EnquiryStage.DEMO_SCHEDULED, EnquiryStage.DEMO_COMPLETED, EnquiryStage.ACCOUNT_CREATED].includes(e.stage)).length, fill: 'hsl(var(--warning))' },
  { name: 'Demo Completed', value: seedEnquiries.filter(e => [EnquiryStage.DEMO_COMPLETED, EnquiryStage.ACCOUNT_CREATED].includes(e.stage)).length, fill: 'hsl(var(--accent))' },
  { name: 'Converted', value: seedEnquiries.filter(e => e.stage === EnquiryStage.ACCOUNT_CREATED).length, fill: 'hsl(var(--success))' },
];

// Source breakdown
const sourceData = Object.values(EnquirySource).map(src => ({
  name: src.replace(/_/g, ' '),
  value: seedEnquiries.filter(e => e.source === src).length,
}));

// Tenancy breakdown
const tenancyData = [
  { name: 'Agency/Brokerage', value: seedEnquiries.filter(e => e.tenancy_type === TenancyType.AGENCY_BROKERAGE_CONSULTANCY).length },
  { name: 'Builder/Developer', value: seedEnquiries.filter(e => e.tenancy_type === TenancyType.BUILDER_DEVELOPER).length },
  { name: 'Not Set', value: seedEnquiries.filter(e => !e.tenancy_type).length },
];

// Account status
const accountStatusData = Object.values(AccountStatus).map(s => ({
  name: s.replace(/_/g, ' '),
  value: seedAccounts.filter(a => a.status === s).length,
}));

// Ticket stats
const ticketStatusData = Object.values(TicketStatus).map(s => ({
  name: s.replace(/_/g, ' '),
  value: seedTickets.filter(t => t.status === s).length,
}));
const ticketPriorityData = Object.values(TicketPriority).map(p => ({
  name: p,
  value: seedTickets.filter(t => t.priority === p).length,
}));

// City distribution
const cityMap = new Map<string, number>();
seedEnquiries.forEach(e => cityMap.set(e.city, (cityMap.get(e.city) ?? 0) + 1));
const cityData = [...cityMap.entries()]
  .map(([city, count]) => ({ city, count }))
  .sort((a, b) => b.count - a.count);

// Marketing cost by type
const costByMonth = [
  { month: 'Jan', online: seedMarketingLogs.filter(l => l.cost_type === MarketingCostType.ONLINE && l.created_at.startsWith('2025-01')).reduce((s, l) => s + (l.cost_amount ?? 0), 0), offline: seedMarketingLogs.filter(l => l.cost_type === MarketingCostType.OFFLINE && l.created_at.startsWith('2025-01')).reduce((s, l) => s + (l.cost_amount ?? 0), 0) },
  { month: 'Feb', online: seedMarketingLogs.filter(l => l.cost_type === MarketingCostType.ONLINE && l.created_at.startsWith('2025-02')).reduce((s, l) => s + (l.cost_amount ?? 0), 0), offline: seedMarketingLogs.filter(l => l.cost_type === MarketingCostType.OFFLINE && l.created_at.startsWith('2025-02')).reduce((s, l) => s + (l.cost_amount ?? 0), 0) },
];

const PIE_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--warning))',
  'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
];

const chartConfig = {
  value: { label: 'Count', color: 'hsl(var(--primary))' },
  online: { label: 'Online', color: 'hsl(var(--info))' },
  offline: { label: 'Offline', color: 'hsl(var(--warning))' },
};

export default function Reports() {
  const [tab, setTab] = useState('pipeline');

  const converted = seedEnquiries.filter(e => e.stage === EnquiryStage.ACCOUNT_CREATED).length;
  const conversionRate = ((converted / seedEnquiries.length) * 100).toFixed(1);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Pipeline KPIs, conversion funnels & operational insights</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Total Enquiries</p>
          <p className="text-2xl font-bold text-foreground">{seedEnquiries.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Converted</p>
          <p className="text-2xl font-bold text-success">{converted}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Conversion Rate</p>
          <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Active Accounts</p>
          <p className="text-2xl font-bold text-foreground">{seedAccounts.filter(a => a.status === AccountStatus.LIVE).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Open Tickets</p>
          <p className="text-2xl font-bold text-foreground">{seedTickets.filter(t => ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(t.status)).length}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline"><TrendingUp className="h-4 w-4 mr-1" />Pipeline</TabsTrigger>
          <TabsTrigger value="accounts"><Users className="h-4 w-4 mr-1" />Accounts</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" />Tickets</TabsTrigger>
          <TabsTrigger value="geography"><Target className="h-4 w-4 mr-1" />Geography</TabsTrigger>
        </TabsList>

        {/* ─── Pipeline Tab ─── */}
        <TabsContent value="pipeline" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {funnelData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-32 text-right">{item.name}</span>
                      <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                          style={{
                            width: `${(item.value / funnelData[0].value) * 100}%`,
                            backgroundColor: item.fill,
                          }}
                        >
                          <span className="text-xs font-semibold text-primary-foreground">{item.value}</span>
                        </div>
                      </div>
                      {i > 0 && (
                        <span className="text-xs text-muted-foreground w-12">
                          {((item.value / funnelData[i - 1].value) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stage Distribution Bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Enquiries by Stage</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={stageCounts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Source Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Source</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tenancy Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Tenancy Type</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={tenancyData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {tenancyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Accounts Tab ─── */}
        <TabsContent value="accounts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Account Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={accountStatusData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Account KPIs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Total Accounts', value: seedAccounts.length },
                  { label: 'Live', value: seedAccounts.filter(a => a.status === AccountStatus.LIVE).length },
                  { label: 'Onboarding', value: seedAccounts.filter(a => a.status === AccountStatus.ONBOARDING_IN_PROGRESS).length },
                  { label: 'Stalled', value: seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length },
                  { label: 'Deactivated', value: seedAccounts.filter(a => a.status === AccountStatus.DEACTIVATED).length },
                ].map(kpi => (
                  <div key={kpi.label} className="flex justify-between items-center py-1 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{kpi.label}</span>
                    <span className="font-bold text-foreground">{kpi.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Marketing Cost Trend */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Marketing Spend by Month</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={costByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="online" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="offline" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tickets Tab ─── */}
        <TabsContent value="tickets" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tickets by Status</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={ticketStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tickets by Priority</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={ticketPriorityData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill="hsl(var(--destructive))" />
                      <Cell fill="hsl(var(--warning))" />
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--muted-foreground))" />
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ticket KPIs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold text-foreground">{seedTickets.length}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Resolved</p>
                    <p className="text-2xl font-bold text-success">
                      {seedTickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED).length}
                    </p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Urgent/High</p>
                    <p className="text-2xl font-bold text-destructive">
                      {seedTickets.filter(t => t.priority === TicketPriority.URGENT || t.priority === TicketPriority.HIGH).length}
                    </p>
                  </div>
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Resolution Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      {((seedTickets.filter(t => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED).length / seedTickets.length) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Geography Tab ─── */}
        <TabsContent value="geography" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Enquiries by City</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={cityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="city" type="category" width={100} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent nameKey="city" />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">City Heat Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cityData.map(({ city, count }) => {
                  const max = cityData[0].count;
                  const intensity = Math.max(0.2, count / max);
                  return (
                    <Badge key={city} variant="outline"
                      className="text-sm px-3 py-1.5"
                      style={{ backgroundColor: `hsl(var(--primary) / ${intensity})`, color: intensity > 0.5 ? 'hsl(var(--primary-foreground))' : undefined }}>
                      {city} — {count}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
