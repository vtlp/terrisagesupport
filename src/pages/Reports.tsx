import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { Download, TrendingUp, Activity, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line,
} from 'recharts';
import { AccountStatus, TenancyType } from '@/types/core';

// ── Types for live data ──────────────────────────
interface UsageRow {
  name: string;
  city: string;
  tenancy: string;
  status: string;
  dau: number;
  wau: number;
  mau: number;
  leadsCreated: number;
  followUps: number;
  conversions: number;
  tasksCompleted: number;
  sessions: number;
  lastActive: string;
  lastActiveAt: Date | null;
  inactivityDays: number;
  featureUsage: Record<string, number>;
  weeklySeries: { date: string; activeUsers: number; sessions: number }[];
}

const FEATURE_DEFS: { key: string; label: string }[] = [
  { key: 'enquiry_capture', label: 'Enquiry Capture' },
  { key: 'convert_to_lead', label: 'Convert to Lead Button' },
  { key: 'manual_leads', label: 'Creating Manual Leads' },
  { key: 'creating_tasks', label: 'Creating Tasks' },
  { key: 'task_types', label: 'Task Types Usage' },
  { key: 'channel_partner', label: 'Channel Partner Section' },
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))'];
const chartConfig = {
  value: { label: 'Count', color: 'hsl(var(--primary))' },
  adoption: { label: 'Adoption %', color: 'hsl(var(--primary))' },
  activeUsers: { label: 'Active Users', color: 'hsl(var(--primary))' },
  sessions: { label: 'Sessions', color: 'hsl(var(--info))' },
};

function relativeFromNow(d: Date | null): string {
  if (!d) return 'Never';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'Just now';
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isoWeekLabel(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  const monthShort = date.toLocaleString('en-GB', { month: 'short' });
  return `W${weekNo} ${monthShort}`;
}

export default function Reports() {
  const [tab, setTab] = useState('overview');
  const [tenancyFilter, setTenancyFilter] = useState<string>('all');
  const [usageData, setUsageData] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Fire fresh pull from Terrisage on every Reports open, then load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await supabase.functions.invoke('terrisage-usage-sync', { body: { days: 30 } });
      } catch (err) {
        console.warn('[reports] terrisage usage sync failed', err);
      }
      if (cancelled) return;
      await loadData();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: refresh when ingest pushes new snapshots.
  useEffect(() => {
    const channel = supabase
      .channel('reports-usage-snapshots')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'account_usage_snapshots' },
        () => { void loadData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceStr = since.toISOString().slice(0, 10);

    const [{ data: accounts }, { data: snaps }] = await Promise.all([
      supabase.from('accounts')
        .select('id, account_name, city, tenancy_type, status'),
      supabase.from('account_usage_snapshots')
        .select('account_id, snapshot_date, dau, wau, mau, sessions, leads_created, follow_ups, conversions, tasks_completed, last_active_at, feature_usage')
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true }),
    ]);

    const byAccount = new Map<string, typeof snaps>();
    for (const s of snaps ?? []) {
      const arr = byAccount.get(s.account_id) ?? [];
      arr.push(s);
      byAccount.set(s.account_id, arr);
    }

    const rows: UsageRow[] = (accounts ?? []).map((a) => {
      const series = byAccount.get(a.id) ?? [];
      const latest = series[series.length - 1];
      const last30 = series.slice(-30);

      const sumOf = (k: keyof typeof latest) =>
        last30.reduce((acc, s) => acc + (Number(s[k]) || 0), 0);

      const lastActiveAt = latest?.last_active_at ? new Date(latest.last_active_at) : null;
      const inactivityDays = lastActiveAt
        ? Math.max(0, Math.floor((Date.now() - lastActiveAt.getTime()) / 86_400_000))
        : 0;

      const weeklySeries = last30.map((s) => ({
        date: s.snapshot_date,
        activeUsers: Number(s.dau) || 0,
        sessions: Number(s.sessions) || 0,
      }));

      return {
        name: a.account_name,
        city: a.city ?? '—',
        tenancy: a.tenancy_type,
        status: a.status,
        dau: Number(latest?.dau) || 0,
        wau: Number(latest?.wau) || 0,
        mau: Number(latest?.mau) || 0,
        leadsCreated: sumOf('leads_created'),
        followUps: sumOf('follow_ups'),
        conversions: sumOf('conversions'),
        tasksCompleted: sumOf('tasks_completed'),
        sessions: sumOf('sessions'),
        lastActive: a.status === AccountStatus.DEACTIVATED ? 'Inactive' : relativeFromNow(lastActiveAt),
        lastActiveAt,
        inactivityDays: a.status === AccountStatus.DEACTIVATED ? Math.max(60, inactivityDays) : inactivityDays,
        featureUsage: (latest?.feature_usage as Record<string, number>) ?? {},
        weeklySeries,
      };
    });

    setUsageData(rows);
    setLoading(false);
  }

  const activeAccounts = useMemo(
    () => usageData.filter(a => a.status === AccountStatus.LIVE || a.status === AccountStatus.ONBOARDING_IN_PROGRESS),
    [usageData],
  );

  const filtered = useMemo(
    () => tenancyFilter === 'all' ? activeAccounts : activeAccounts.filter(a => a.tenancy === tenancyFilter),
    [activeAccounts, tenancyFilter],
  );

  const totalSessions = filtered.reduce((s, a) => s + a.sessions, 0);
  const avgDau = filtered.length ? Math.round(filtered.reduce((s, a) => s + a.dau, 0) / filtered.length) : 0;
  const inactiveAlerts = usageData.filter(a => a.inactivityDays > 7 && a.status !== AccountStatus.DEACTIVATED);

  // ── Derived: tenancy + city breakdowns ─────────
  const tenancyUsage = [
    { name: 'Agency', value: usageData.filter(a => a.tenancy === TenancyType.AGENCY_BROKERAGE_CONSULTANCY && a.status === AccountStatus.LIVE).length },
    { name: 'Builder', value: usageData.filter(a => a.tenancy === TenancyType.BUILDER_DEVELOPER && a.status === AccountStatus.LIVE).length },
  ];
  const cityUsageMap = new Map<string, number>();
  filtered.forEach(a => cityUsageMap.set(a.city, (cityUsageMap.get(a.city) ?? 0) + a.sessions));
  const cityUsage = [...cityUsageMap.entries()]
    .map(([city, sessions]) => ({ city, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  // ── Feature Adoption: average across filtered accounts ─
  const featureAdoption = FEATURE_DEFS.map(({ key, label }) => {
    const vals = filtered.map(a => Number(a.featureUsage[key]) || 0).filter(v => v > 0);
    const adoption = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    return { feature: label, adoption };
  });

  // ── Engagement weekly trend (rolled-up daily snapshots) ─
  const engagementTrend = useMemo(() => {
    const byWeek = new Map<string, { activeUsersSum: number; sessionsSum: number; count: number; sortKey: number }>();
    filtered.forEach(a => {
      a.weeklySeries.forEach(d => {
        const dt = new Date(d.date + 'T00:00:00Z');
        const day = dt.getUTCDay() || 7;
        const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate() - day + 1);
        const key = monday.toISOString().slice(0, 10);
        const label = isoWeekLabel(monday);
        const cur = byWeek.get(label) ?? { activeUsersSum: 0, sessionsSum: 0, count: 0, sortKey: monday.getTime() };
        cur.activeUsersSum += d.activeUsers;
        cur.sessionsSum += d.sessions;
        cur.count += 1;
        cur.sortKey = monday.getTime();
        byWeek.set(label, cur);
        // Use key only to dedupe weeks across years — discard
        void key;
      });
    });
    return [...byWeek.entries()]
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .slice(-6)
      .map(([week, v]) => ({
        week,
        activeUsers: Math.round(v.activeUsersSum / Math.max(1, v.count)),
        sessions: v.sessionsSum,
      }));
  }, [filtered]);

  // ── Export (CSV / XLSX) ────────────────────────
  function buildExportSheets() {
    const filterLabel = tenancyFilter === 'all' ? 'All' :
      tenancyFilter === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency' : 'Builder';

    const usageSheet = filtered.map(a => ({
      Account: a.name,
      City: a.city,
      Type: a.tenancy === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency' : 'Builder',
      Status: a.status,
      DAU: a.dau,
      WAU: a.wau,
      MAU: a.mau,
      'Sessions (30d)': a.sessions,
      'Leads (30d)': a.leadsCreated,
      'Follow-ups (30d)': a.followUps,
      'Conversions (30d)': a.conversions,
      'Tasks Completed (30d)': a.tasksCompleted,
      'Last Active': a.lastActive,
    }));

    const adoptionSheet = featureAdoption.map(f => ({
      Feature: f.feature,
      'Adoption %': f.adoption,
    }));

    const engagementSheet = engagementTrend.map(w => ({
      Week: w.week,
      'Active Users': w.activeUsers,
      Sessions: w.sessions,
    }));

    const alertsSheet = inactiveAlerts.map(a => ({
      Account: a.name,
      City: a.city,
      Type: a.tenancy === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency' : 'Builder',
      'Days Inactive': a.inactivityDays,
      'Last Active': a.lastActive,
    }));

    return { filterLabel, usageSheet, adoptionSheet, engagementSheet, alertsSheet };
  }

  function handleExportCSV() {
    const { filterLabel, usageSheet } = buildExportSheets();
    const ws = XLSX.utils.json_to_sheet(usageSheet);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `reports-${filterLabel.toLowerCase()}-${stamp}.csv`);
  }

  function handleExportXLSX() {
    const { filterLabel, usageSheet, adoptionSheet, engagementSheet, alertsSheet } = buildExportSheets();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usageSheet), 'Usage');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adoptionSheet), 'Feature Adoption');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(engagementSheet), 'Engagement');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alertsSheet), 'Alerts');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `reports-${filterLabel.toLowerCase()}-${stamp}.xlsx`);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">CRM client usage analytics &amp; engagement insights</p>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportXLSX}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>CSV (.csv)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                      {filtered.length === 0 && !loading && (
                        <tr><td colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                          No usage data yet. Awaiting Terrisage sync.
                        </td></tr>
                      )}
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
            <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Active Users &amp; Sessions</CardTitle></CardHeader>
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
                <p className="text-2xl font-bold text-foreground">
                  {(() => {
                    const dauSum = filtered.reduce((s, a) => s + a.dau, 0);
                    const wauSum = filtered.reduce((s, a) => s + a.wau, 0);
                    return wauSum > 0 ? `${Math.round((dauSum / wauSum) * 100)}%` : '0%';
                  })()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Stickiness metric</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">WAU/MAU Ratio</p>
                <p className="text-2xl font-bold text-foreground">
                  {(() => {
                    const wauSum = filtered.reduce((s, a) => s + a.wau, 0);
                    const mauSum = filtered.reduce((s, a) => s + a.mau, 0);
                    return mauSum > 0 ? `${Math.round((wauSum / mauSum) * 100)}%` : '0%';
                  })()}
                </p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
