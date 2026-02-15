import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { seedWebTrackingEvents, getCampaignName } from '@/data/marketingSeedData';
import { Globe, Monitor, Smartphone, Tablet } from 'lucide-react';

function SourceBadge() {
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-accent/15 text-accent-foreground">Source: Web Tracking</Badge>;
}

export default function MktWebTrackingTab() {
  const events = seedWebTrackingEvents;

  const totalSessions = new Set(events.map(e => e.session_id)).size;
  const uniqueVisitors = new Set(events.map(e => e.visitor_id)).size;
  const totalPageViews = events.filter(e => e.event_type === 'page_view').length;
  const totalFormSubmits = events.filter(e => e.event_type === 'form_submit').length;
  const totalCtaClicks = events.filter(e => e.event_type === 'cta_click').length;

  // Top landing pages
  const topLandingPages = useMemo(() => {
    const map: Record<string, { visits: number; conversions: number; topCampaign: string | null }> = {};
    events.forEach(e => {
      if (!map[e.page_path]) map[e.page_path] = { visits: 0, conversions: 0, topCampaign: null };
      if (e.event_type === 'page_view') { map[e.page_path].visits++; if (e.campaign_id) map[e.page_path].topCampaign = e.campaign_id; }
      if (e.event_type === 'form_submit') map[e.page_path].conversions++;
    });
    return Object.entries(map).map(([path, d]) => ({ path, ...d })).sort((a, b) => b.visits - a.visits);
  }, []);

  // UTM breakdown
  const utmBreakdown = useMemo(() => {
    const map: Record<string, { visits: number; conversions: number }> = {};
    events.forEach(e => {
      const key = e.utm_source ? `${e.utm_source} / ${e.utm_medium} / ${e.utm_campaign}` : 'Direct';
      if (!map[key]) map[key] = { visits: 0, conversions: 0 };
      if (e.event_type === 'page_view') map[key].visits++;
      if (e.event_type === 'form_submit') map[key].conversions++;
    });
    return Object.entries(map).map(([key, d]) => ({ key, ...d })).sort((a, b) => b.visits - a.visits);
  }, []);

  // Device split
  const deviceSplit = useMemo(() => {
    const map: Record<string, number> = {};
    new Set(events.map(e => e.session_id)).forEach(sid => {
      const ev = events.find(e => e.session_id === sid);
      if (ev) map[ev.device] = (map[ev.device] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, []);

  // Geo split
  const geoSplit = useMemo(() => {
    const map: Record<string, number> = {};
    new Set(events.map(e => e.session_id)).forEach(sid => {
      const ev = events.find(e => e.session_id === sid);
      if (ev) map[ev.city || 'Unknown'] = (map[ev.city || 'Unknown'] || 0) + 1;
    });
    return Object.entries(map).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
  }, []);

  // Event breakdown
  const eventBreakdown = useMemo(() => [
    { name: 'Page Views', count: totalPageViews },
    { name: 'CTA Clicks', count: totalCtaClicks },
    { name: 'Form Submits', count: totalFormSubmits },
  ], [totalPageViews, totalCtaClicks, totalFormSubmits]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))'];
  const DeviceIcon = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sessions', value: totalSessions },
          { label: 'Unique Visitors', value: uniqueVisitors },
          { label: 'Page Views', value: totalPageViews },
          { label: 'Form Submits', value: totalFormSubmits },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{k.label}</span>
                <SourceBadge />
              </div>
              <p className="text-3xl font-bold text-foreground tracking-tight mt-2">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Landing Pages */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top Landing Pages</h3>
              <SourceBadge />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead>Top Campaign</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLandingPages.map(p => (
                  <TableRow key={p.path}>
                    <TableCell className="text-xs font-mono">{p.path}</TableCell>
                    <TableCell className="text-right text-sm">{p.visits}</TableCell>
                    <TableCell className="text-right text-sm">{p.conversions}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{getCampaignName(p.topCampaign)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* UTM Breakdown */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">UTM Breakdown</h3>
              <SourceBadge />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Source / Medium / Campaign</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utmBreakdown.map(u => (
                  <TableRow key={u.key}>
                    <TableCell className="text-xs font-mono">{u.key}</TableCell>
                    <TableCell className="text-right text-sm">{u.visits}</TableCell>
                    <TableCell className="text-right text-sm">{u.conversions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Device Split */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Device Split</h3>
            <div className="space-y-3">
              {deviceSplit.map(d => {
                const Icon = DeviceIcon[d.name as keyof typeof DeviceIcon] || Monitor;
                const pct = totalSessions > 0 ? ((d.value / totalSessions) * 100).toFixed(0) : 0;
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="capitalize">{d.name}</span>
                        <span className="font-semibold">{d.value} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Geo Split */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">City Split</h3>
            <div className="space-y-2">
              {geoSplit.map(g => (
                <div key={g.city} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-xs">{g.city}</span>
                  <Badge variant="secondary" className="text-xs">{g.count} sessions</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Event Breakdown */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Event Breakdown</h3>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={90} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
