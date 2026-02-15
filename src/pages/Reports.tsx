import { useState } from 'react';
import { Download, BarChart3, TrendingUp, Users, Activity, Zap, Clock, AlertTriangle } from 'lucide-react';
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
  PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line,
} from 'recharts';
import { seedAccounts } from '@/data/seedData';
import { AccountStatus, TenancyType } from '@/types/core';

// ── CRM Client Usage Analytics ─────────────────

// Simulated usage data per account
const usageData = seedAccounts.map(a => ({
  name: a.account_name,
  city: a.city,
  tenancy: a.tenancy_type,
  status: a.status,
  dau: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 12) + 3 : a.status === AccountStatus.ONBOARDING_IN_PROGRESS ? Math.floor(Math.random() * 5) + 1 : 0,
  wau: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 25) + 10 : a.status === AccountStatus.ONBOARDING_IN_PROGRESS ? Math.floor(Math.random() * 10) + 2 : 0,
  mau: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 40) + 15 : a.status === AccountStatus.ONBOARDING_IN_PROGRESS ? Math.floor(Math.random() * 20) + 5 : 0,
  leadsCreated: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 200) + 30 : Math.floor(Math.random() * 20),
  followUps: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 150) + 20 : Math.floor(Math.random() * 10),
  conversions: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 30) + 5 : 0,
  tasksCompleted: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 80) + 10 : Math.floor(Math.random() * 5),
  lastActive: a.status === AccountStatus.DEACTIVATED ? 'Inactive' : `${Math.floor(Math.random() * 48) + 1}h ago`,
  inactivityDays: a.status === AccountStatus.DEACTIVATED ? 60 + Math.floor(Math.random() * 60) : a.status === AccountStatus.STALLED_ONBOARDING ? 7 + Math.floor(Math.random() * 14) : 0,
  sessions: a.status === AccountStatus.LIVE ? Math.floor(Math.random() * 200) + 50 : Math.floor(Math.random() * 30),
}));

const activeAccounts = usageData.filter(a => a.status === AccountStatus.LIVE || a.status === AccountStatus.ONBOARDING_IN_PROGRESS);

// Feature adoption data
const featureAdoption = [
  { feature: 'Enquiry Capture', adoption: 92 },
  { feature: 'Convert to Lead Button', adoption: 78 },
  { feature: 'Creating Manual Leads', adoption: 65 },
  { feature: 'Creating Tasks', adoption: 58 },
  { feature: 'Task Types Usage', adoption: 42 },
  { feature: 'Channel Partner Section', adoption: 35 },
];

// Engagement trend (weekly)
const engagementTrend = [
  { week: 'W1 Jan', activeUsers: 28, sessions: 340 },
  { week: 'W2 Jan', activeUsers: 32, sessions: 420 },
  { week: 'W3 Jan', activeUsers: 35, sessions: 450 },
  { week: 'W4 Jan', activeUsers: 38, sessions: 510 },
  { week: 'W1 Feb', activeUsers: 42, sessions: 580 },
  { week: 'W2 Feb', activeUsers: 45, sessions: 620 },
];

// Tenancy breakdown
const tenancyUsage = [
  { name: 'Agency', value: usageData.filter(a => a.tenancy === TenancyType.AGENCY_BROKERAGE_CONSULTANCY && a.status === AccountStatus.LIVE).length },
  { name: 'Builder', value: usageData.filter(a => a.tenancy === TenancyType.BUILDER_DEVELOPER && a.status === AccountStatus.LIVE).length },
];

// City usage
const cityUsageMap = new Map<string, number>();
activeAccounts.forEach(a => cityUsageMap.set(a.city, (cityUsageMap.get(a.city) ?? 0) + a.sessions));
const cityUsage = [...cityUsageMap.entries()].map(([city, sessions]) => ({ city, sessions })).sort((a, b) => b.sessions - a.sessions);

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))'];
const chartConfig = {
  value: { label: 'Count', color: 'hsl(var(--primary))' },
  adoption: { label: 'Adoption %', color: 'hsl(var(--primary))' },
  activeUsers: { label: 'Active Users', color: 'hsl(var(--primary))' },
  sessions: { label: 'Sessions', color: 'hsl(var(--info))' },
};

export default function Reports() {
  const [tab, setTab] = useState('overview');
  const [tenancyFilter, setTenancyFilter] = useState<string>('all');

  const filtered = tenancyFilter === 'all' ? activeAccounts : activeAccounts.filter(a => a.tenancy === tenancyFilter);
  const totalSessions = filtered.reduce((s, a) => s + a.sessions, 0);
  const avgDau = filtered.length ? Math.round(filtered.reduce((s, a) => s + a.dau, 0) / filtered.length) : 0;
  const inactiveAlerts = usageData.filter(a => a.inactivityDays > 7 && a.status !== AccountStatus.DEACTIVATED);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">CRM client usage analytics & engagement insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={tenancyFilter} onValueChange={setTenancyFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={TenancyType.AGENCY_BROKERAGE_CONSULTANCY}>Agency</SelectItem>
              <SelectItem value={TenancyType.BUILDER_DEVELOPER}>Builder</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Active Accounts</p>
          <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Avg DAU / Account</p>
          <p className="text-2xl font-bold text-primary">{avgDau}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Total Sessions</p>
          <p className="text-2xl font-bold text-foreground">{totalSessions.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Total Leads Created</p>
          <p className="text-2xl font-bold text-success">{filtered.reduce((s, a) => s + a.leadsCreated, 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Inactivity Alerts</p>
          <p className="text-2xl font-bold text-destructive">{inactiveAlerts.length}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview"><Activity className="h-4 w-4 mr-1" />Usage</TabsTrigger>
          <TabsTrigger value="adoption"><Zap className="h-4 w-4 mr-1" />Feature Adoption</TabsTrigger>
          <TabsTrigger value="engagement"><TrendingUp className="h-4 w-4 mr-1" />Engagement</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 mr-1" />Alerts</TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Account Usage Table */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Account Usage Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-3 font-medium text-muted-foreground">Account</th>
                        <th className="py-2 px-3 font-medium text-muted-foreground">City</th>
                        <th className="py-2 px-3 font-medium text-muted-foreground text-right">DAU</th>
                        <th className="py-2 px-3 font-medium text-muted-foreground text-right">WAU</th>
                        <th className="py-2 px-3 font-medium text-muted-foreground text-right">Leads</th>
                        <th className="py-2 px-3 font-medium text-muted-foreground text-right">Conversions</th>
                        <th className="py-2 px-3 font-medium text-muted-foreground">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(a => (
                        <tr key={a.name} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-3 font-medium truncate max-w-[180px]">{a.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{a.city}</td>
                          <td className="py-2 px-3 text-right">{a.dau}</td>
                          <td className="py-2 px-3 text-right">{a.wau}</td>
                          <td className="py-2 px-3 text-right">{a.leadsCreated}</td>
                          <td className="py-2 px-3 text-right">{a.conversions}</td>
                          <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{a.lastActive}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* By Tenancy Pie */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Live Accounts by Type</CardTitle></CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={tenancyUsage} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {tenancyUsage.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By City */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Sessions by City</CardTitle></CardHeader>
              <CardContent className="h-[250px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={cityUsage} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="city" type="category" width={100} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent nameKey="city" />} />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Feature Adoption */}
        <TabsContent value="adoption" className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Feature Adoption Rates</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {featureAdoption.map(f => (
                  <div key={f.feature} className="flex items-center gap-3">
                    <span className="text-sm w-32 text-right text-muted-foreground">{f.feature}</span>
                    <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                      <div className="h-full rounded-full transition-all flex items-center justify-end pr-2 bg-primary" style={{ width: `${f.adoption}%` }}>
                        <span className="text-xs font-semibold text-primary-foreground">{f.adoption}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Feature Activity Funnel</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Leads Created', total: filtered.reduce((s, a) => s + a.leadsCreated, 0), color: 'text-primary' },
                  { label: 'Follow-ups Logged', total: filtered.reduce((s, a) => s + a.followUps, 0), color: 'text-info' },
                  { label: 'Tasks Completed', total: filtered.reduce((s, a) => s + a.tasksCompleted, 0), color: 'text-warning' },
                  { label: 'Conversions', total: filtered.reduce((s, a) => s + a.conversions, 0), color: 'text-success' },
                ].map(item => (
                  <div key={item.label} className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Trend */}
        <TabsContent value="engagement" className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Active Users & Sessions</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <LineChart data={engagementTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="activeUsers" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="sessions" stroke="hsl(var(--info))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">DAU/WAU Ratio</p>
                <p className="text-2xl font-bold text-foreground">{filtered.length ? ((filtered.reduce((s, a) => s + a.dau, 0) / filtered.reduce((s, a) => s + a.wau, 0)) * 100).toFixed(0) : 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">Stickiness metric</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">WAU/MAU Ratio</p>
                <p className="text-2xl font-bold text-foreground">{filtered.length ? ((filtered.reduce((s, a) => s + a.wau, 0) / filtered.reduce((s, a) => s + a.mau, 0)) * 100).toFixed(0) : 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">Weekly engagement</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Avg Sessions / Account</p>
                <p className="text-2xl font-bold text-foreground">{filtered.length ? Math.round(totalSessions / filtered.length) : 0}</p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Inactivity Alerts</CardTitle></CardHeader>
            <CardContent>
              {inactiveAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No inactivity alerts — all accounts are engaged!</p>
              ) : (
                <div className="space-y-2">
                  {inactiveAlerts.map(a => (
                    <div key={a.name} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.city} • {a.tenancy === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency' : 'Builder'}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-destructive/15 text-destructive">{a.inactivityDays}d inactive</Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">Last: {a.lastActive}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-warning" /> Low Engagement</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeAccounts.filter(a => a.dau < 3 && a.status === AccountStatus.LIVE).map(a => (
                  <div key={a.name} className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.city}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-warning">{a.dau} DAU</p>
                      <p className="text-xs text-muted-foreground">{a.sessions} sessions</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
