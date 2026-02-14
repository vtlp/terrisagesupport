import { useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, Users, Activity, BarChart3, Zap, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  ResponsiveContainer,
} from 'recharts';
import { seedAccounts, seedCRMUsage, seedTickets } from '@/data/seedData';
import { AccountStatus, TenancyType, TicketStatus, TicketPriority } from '@/types/core';

const chartConfig = {
  value: { label: 'Count', color: 'hsl(var(--primary))' },
  logins: { label: 'Logins', color: 'hsl(var(--primary))' },
  leads_created: { label: 'Leads Created', color: 'hsl(var(--info))' },
  tasks_completed: { label: 'Tasks Done', color: 'hsl(var(--success))' },
  projects_actions: { label: 'Projects', color: 'hsl(var(--warning))' },
  dau: { label: 'DAU', color: 'hsl(var(--primary))' },
  wau: { label: 'WAU', color: 'hsl(var(--info))' },
  mau: { label: 'MAU', color: 'hsl(var(--accent))' },
};

export default function Reports() {
  const [tab, setTab] = useState('usage');
  const [periodFilter, setPeriodFilter] = useState('2025-02');

  const liveAccounts = seedAccounts.filter(a => a.status === AccountStatus.LIVE);

  // ── Usage patterns ──
  const usageForPeriod = useMemo(() =>
    seedCRMUsage.filter(u => u.period === periodFilter), [periodFilter]
  );

  const usageByAccount = useMemo(() =>
    usageForPeriod.map(u => {
      const acc = seedAccounts.find(a => a.account_id === u.account_id);
      return { ...u, name: acc?.account_name ?? u.account_id };
    }).sort((a, b) => b.logins - a.logins),
    [usageForPeriod]
  );

  // ── Feature usage aggregates ──
  const featureTotals = useMemo(() => {
    const data = usageForPeriod;
    return {
      totalLeadsCreated: data.reduce((s, u) => s + u.leads_created, 0),
      totalLeadsUpdated: data.reduce((s, u) => s + u.leads_updated, 0),
      totalProjectActions: data.reduce((s, u) => s + u.projects_actions, 0),
      totalTasksCreated: data.reduce((s, u) => s + u.tasks_created, 0),
      totalTasksCompleted: data.reduce((s, u) => s + u.tasks_completed, 0),
      totalLogins: data.reduce((s, u) => s + u.logins, 0),
      avgDAU: data.length ? Math.round(data.reduce((s, u) => s + u.dau, 0) / data.length) : 0,
      avgWAU: data.length ? Math.round(data.reduce((s, u) => s + u.wau, 0) / data.length) : 0,
      avgMAU: data.length ? Math.round(data.reduce((s, u) => s + u.mau, 0) / data.length) : 0,
    };
  }, [usageForPeriod]);

  // ── Engagement ──
  const inactiveAccounts = useMemo(() =>
    usageForPeriod.filter(u => u.inactivity_streak_days > 0).map(u => {
      const acc = seedAccounts.find(a => a.account_id === u.account_id);
      return { name: acc?.account_name ?? u.account_id, streak: u.inactivity_streak_days, logins: u.logins };
    }),
    [usageForPeriod]
  );

  // ── Segmented insights ──
  const segmented = useMemo(() => {
    const builders = usageForPeriod.filter(u => {
      const acc = seedAccounts.find(a => a.account_id === u.account_id);
      return acc?.tenancy_type === TenancyType.BUILDER_DEVELOPER;
    });
    const agencies = usageForPeriod.filter(u => {
      const acc = seedAccounts.find(a => a.account_id === u.account_id);
      return acc?.tenancy_type === TenancyType.AGENCY_BROKERAGE_CONSULTANCY;
    });
    const avg = (arr: typeof builders, key: keyof typeof builders[0]) =>
      arr.length ? Math.round(arr.reduce((s, u) => s + (u[key] as number), 0) / arr.length) : 0;
    return [
      { segment: 'Builder / Developer', accounts: builders.length, avgDAU: avg(builders, 'dau'), avgLogins: avg(builders, 'logins'), avgLeads: avg(builders, 'leads_created'), avgProjects: avg(builders, 'projects_actions') },
      { segment: 'Agency / Brokerage', accounts: agencies.length, avgDAU: avg(agencies, 'dau'), avgLogins: avg(agencies, 'logins'), avgLeads: avg(agencies, 'leads_created'), avgProjects: avg(agencies, 'projects_actions') },
    ];
  }, [usageForPeriod]);

  // ── City breakdown ──
  const cityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    liveAccounts.forEach(a => map.set(a.city, (map.get(a.city) ?? 0) + 1));
    return [...map.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
  }, []);

  // ── DAU/WAU/MAU trend (all periods) ──
  const trendData = useMemo(() => {
    const periods = [...new Set(seedCRMUsage.map(u => u.period))].sort();
    return periods.map(p => {
      const data = seedCRMUsage.filter(u => u.period === p);
      return {
        period: p,
        dau: Math.round(data.reduce((s, u) => s + u.dau, 0) / (data.length || 1)),
        wau: Math.round(data.reduce((s, u) => s + u.wau, 0) / (data.length || 1)),
        mau: Math.round(data.reduce((s, u) => s + u.mau, 0) / (data.length || 1)),
      };
    });
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Account Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">CRM usage, engagement, and performance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-01">January 2025</SelectItem>
              <SelectItem value="2025-02">February 2025</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Live Accounts</p>
          <p className="text-2xl font-bold text-foreground">{liveAccounts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Avg DAU</p>
          <p className="text-2xl font-bold text-primary">{featureTotals.avgDAU}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Logins</p>
          <p className="text-2xl font-bold text-foreground">{featureTotals.totalLogins}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Leads Created</p>
          <p className="text-2xl font-bold text-info">{featureTotals.totalLeadsCreated}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Tasks Completed</p>
          <p className="text-2xl font-bold text-success">{featureTotals.totalTasksCompleted}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="usage"><Activity className="h-4 w-4 mr-1" />Usage</TabsTrigger>
          <TabsTrigger value="features"><Zap className="h-4 w-4 mr-1" />Features</TabsTrigger>
          <TabsTrigger value="engagement"><TrendingDown className="h-4 w-4 mr-1" />Engagement</TabsTrigger>
          <TabsTrigger value="segments"><Users className="h-4 w-4 mr-1" />Segments</TabsTrigger>
        </TabsList>

        {/* ─── Usage Tab ─── */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DAU/WAU/MAU Trend */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">DAU / WAU / MAU Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="dau" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="wau" stroke="hsl(var(--info))" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="mau" stroke="hsl(var(--accent))" strokeWidth={2} dot />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Logins by Account */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Logins by Account</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={usageByAccount} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="logins" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Features Tab ─── */}
        <TabsContent value="features" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Feature Usage by Account</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={usageByAccount}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="leads_created" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tasks_completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="projects_actions" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Feature Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Leads created', value: featureTotals.totalLeadsCreated, color: 'text-info' },
                  { label: 'Leads updated', value: featureTotals.totalLeadsUpdated },
                  { label: 'Project actions', value: featureTotals.totalProjectActions, color: 'text-warning' },
                  { label: 'Tasks created', value: featureTotals.totalTasksCreated },
                  { label: 'Tasks completed', value: featureTotals.totalTasksCompleted, color: 'text-success' },
                ].map(kpi => (
                  <div key={kpi.label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{kpi.label}</span>
                    <span className={`font-bold ${kpi.color ?? 'text-foreground'}`}>{kpi.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Engagement Tab ─── */}
        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Inactivity Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inactiveAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">All accounts active this period</p>
                ) : (
                  <div className="space-y-2">
                    {inactiveAccounts.map(a => (
                      <div key={a.name} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.logins} logins this period</p>
                        </div>
                        <Badge variant="outline" className="text-destructive border-destructive/30">
                          {a.streak}d inactive
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Accounts by City
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cityBreakdown.map(({ city, count }) => (
                    <div key={city} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{city}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Segments Tab ─── */}
        <TabsContent value="segments" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Builder vs Agency Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Segment</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Accounts</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Avg DAU</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Avg Logins</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Avg Leads</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Avg Projects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmented.map(s => (
                      <tr key={s.segment} className="border-b border-border last:border-0">
                        <td className="py-3 font-medium text-foreground">{s.segment}</td>
                        <td className="text-right py-3 text-foreground">{s.accounts}</td>
                        <td className="text-right py-3 text-primary font-semibold">{s.avgDAU}</td>
                        <td className="text-right py-3 text-foreground">{s.avgLogins}</td>
                        <td className="text-right py-3 text-info">{s.avgLeads}</td>
                        <td className="text-right py-3 text-warning">{s.avgProjects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Segment Usage Comparison</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={segmented}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="segment" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="avgDAU" name="Avg DAU" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgLogins" name="Avg Logins" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgLeads" name="Avg Leads" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
