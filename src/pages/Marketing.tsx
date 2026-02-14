import { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Target, Users, Phone, Megaphone, DollarSign, MapPin, Search,
  TrendingUp, Award, UserPlus, PhoneCall, Database, Calendar, CreditCard,
} from 'lucide-react';
import { seedMarketingLogs } from '@/data/seedData';
import { MarketingObjectType, MarketingCostType, TenancyType } from '@/types/core';

const objectTypeLabel: Record<MarketingObjectType, string> = {
  [MarketingObjectType.REFERRAL]: 'Referral',
  [MarketingObjectType.CONTACT]: 'Contact',
  [MarketingObjectType.CHAMPION]: 'Champion',
  [MarketingObjectType.COLD_CALL_LEAD]: 'Cold Call Lead',
  [MarketingObjectType.LEAD_SOURCE_REPOSITORY_ITEM]: 'Lead Source',
  [MarketingObjectType.EVENT]: 'Event',
  [MarketingObjectType.COST_ITEM]: 'Cost Item',
};

const objectTypeIcon: Record<MarketingObjectType, React.ElementType> = {
  [MarketingObjectType.REFERRAL]: UserPlus,
  [MarketingObjectType.CONTACT]: Users,
  [MarketingObjectType.CHAMPION]: Award,
  [MarketingObjectType.COLD_CALL_LEAD]: PhoneCall,
  [MarketingObjectType.LEAD_SOURCE_REPOSITORY_ITEM]: Database,
  [MarketingObjectType.EVENT]: Calendar,
  [MarketingObjectType.COST_ITEM]: CreditCard,
};

export default function Marketing() {
  const { isAdmin } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [geoFilter, setGeoFilter] = useState('');
  const [search, setSearch] = useState('');

  if (!isAdmin) return <Navigate to="/" replace />;

  // Targets (editable in a real app — static for demo)
  const targets = {
    agency: { q1: 20, q2: 30, q3: 35, q4: 40, current: 8 },
    builder: { q1: 10, q2: 15, q3: 20, q4: 25, current: 4 },
  };

  // Compute stats from seed data
  const totalCost = seedMarketingLogs
    .filter(l => l.cost_amount)
    .reduce((s, l) => s + (l.cost_amount ?? 0), 0);
  const onlineCost = seedMarketingLogs
    .filter(l => l.cost_type === MarketingCostType.ONLINE)
    .reduce((s, l) => s + (l.cost_amount ?? 0), 0);
  const offlineCost = seedMarketingLogs
    .filter(l => l.cost_type === MarketingCostType.OFFLINE)
    .reduce((s, l) => s + (l.cost_amount ?? 0), 0);

  const countByType = (type: MarketingObjectType) =>
    seedMarketingLogs.filter(l => l.object_type === type).length;

  // All unique cities
  const allCities = [...new Set(seedMarketingLogs.flatMap(l => l.city_geo_tags))].filter(Boolean).sort();

  // Filtered logs
  const filteredLogs = seedMarketingLogs.filter(l => {
    if (typeFilter !== 'all' && l.object_type !== typeFilter) return false;
    if (geoFilter && !l.city_geo_tags.includes(geoFilter)) return false;
    if (search) {
      const s = search.toLowerCase();
      const payloadStr = JSON.stringify(l.object_payload).toLowerCase();
      return payloadStr.includes(s) || l.notes.toLowerCase().includes(s);
    }
    return true;
  });

  const getPayloadSummary = (log: typeof seedMarketingLogs[0]) => {
    const p = log.object_payload as Record<string, unknown>;
    switch (log.object_type) {
      case MarketingObjectType.REFERRAL:
        return `${p.referrer_name} → ${p.referred_company}`;
      case MarketingObjectType.CHAMPION:
        return `${p.name} (${p.company}) — Reach: ${p.reach}`;
      case MarketingObjectType.CONTACT:
        return `${p.name}, ${p.title} at ${p.company}`;
      case MarketingObjectType.COLD_CALL_LEAD:
        return `${p.company} — ${p.contact}`;
      case MarketingObjectType.EVENT:
        return `${p.event_name} @ ${p.location} (${p.date})`;
      case MarketingObjectType.LEAD_SOURCE_REPOSITORY_ITEM:
        return `${p.source} — ${p.category}`;
      case MarketingObjectType.COST_ITEM:
        return `${p.campaign}${p.platform ? ` (${p.platform})` : ''}`;
      default:
        return JSON.stringify(p);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
          <p className="text-muted-foreground">Strategy, targets, activity logging & cost tracking</p>
        </div>
        <Badge variant="outline" className="text-xs">Admin Only</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview"><Target className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="activity"><Megaphone className="h-4 w-4 mr-1" />Activity Log</TabsTrigger>
          <TabsTrigger value="costs"><DollarSign className="h-4 w-4 mr-1" />Costs</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quarterly Targets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />Agency / Brokerage Targets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {(['q1', 'q2', 'q3', 'q4'] as const).map(q => (
                    <div key={q} className="bg-muted rounded p-2">
                      <p className="text-muted-foreground uppercase text-xs">{q}</p>
                      <p className="text-lg font-bold text-foreground">{targets.agency[q]}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Current Q1 progress:</span>
                  <span className="font-semibold text-foreground">{targets.agency.current}/{targets.agency.q1}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 ml-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${(targets.agency.current / targets.agency.q1) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent" />Builder / Developer Targets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {(['q1', 'q2', 'q3', 'q4'] as const).map(q => (
                    <div key={q} className="bg-muted rounded p-2">
                      <p className="text-muted-foreground uppercase text-xs">{q}</p>
                      <p className="text-lg font-bold text-foreground">{targets.builder[q]}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <span className="text-sm text-muted-foreground">Current Q1 progress:</span>
                  <span className="font-semibold text-foreground">{targets.builder.current}/{targets.builder.q1}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 ml-2">
                    <div
                      className="bg-accent rounded-full h-2 transition-all"
                      style={{ width: `${(targets.builder.current / targets.builder.q1) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.values(MarketingObjectType).map(type => {
              const Icon = objectTypeIcon[type];
              return (
                <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setTypeFilter(type); setActiveTab('activity'); }}>
                  <CardContent className="p-3 text-center">
                    <Icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-bold text-foreground">{countByType(type)}</p>
                    <p className="text-xs text-muted-foreground">{objectTypeLabel[type]}s</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cost Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold text-foreground">₹{totalCost.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-info">₹{onlineCost.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-warning">₹{offlineCost.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Geo Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />Geography Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {allCities.map(city => {
                  const count = seedMarketingLogs.filter(l => l.city_geo_tags.includes(city)).length;
                  return (
                    <Badge key={city} variant="secondary" className="cursor-pointer"
                      onClick={() => { setGeoFilter(city); setActiveTab('activity'); }}>
                      {city} ({count})
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Activity Log Tab ─── */}
        <TabsContent value="activity" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search activities…" className="pl-9"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">All Types</SelectItem>
                {Object.values(MarketingObjectType).map(t => (
                  <SelectItem key={t} value={t}>{objectTypeLabel[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={geoFilter || 'all'} onValueChange={v => setGeoFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">All Cities</SelectItem>
                {allCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {(typeFilter !== 'all' || geoFilter || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setTypeFilter('all'); setGeoFilter(''); setSearch(''); }}>
                Clear filters
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Geo</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const Icon = objectTypeIcon[log.object_type];
                    return (
                      <TableRow key={log.log_id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">{objectTypeLabel[log.object_type]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[250px] truncate">
                          {getPayloadSummary(log)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.city_geo_tags.map(c => (
                              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.tenancy_type_target === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency'
                            : log.tenancy_type_target === TenancyType.BUILDER_DEVELOPER ? 'Builder'
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {log.cost_amount ? `₹${log.cost_amount.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.notes}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredLogs.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No activities match your filters.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Costs Tab ─── */}
        <TabsContent value="costs" className="space-y-4">
          {(() => {
            const costItems = seedMarketingLogs.filter(l => l.cost_amount && l.cost_amount > 0);
            const onlineItems = costItems.filter(l => l.cost_type === MarketingCostType.ONLINE);
            const offlineItems = costItems.filter(l => l.cost_type === MarketingCostType.OFFLINE);
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Online Spend</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {onlineItems.map(item => (
                        <div key={item.log_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div>
                            <p className="text-sm font-medium">{getPayloadSummary(item)}</p>
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          </div>
                          <span className="font-semibold text-sm text-info">₹{item.cost_amount?.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="pt-2 flex justify-between font-semibold text-sm border-t border-border">
                        <span>Total Online</span>
                        <span className="text-info">₹{onlineCost.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Offline Spend</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {offlineItems.map(item => (
                        <div key={item.log_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div>
                            <p className="text-sm font-medium">{getPayloadSummary(item)}</p>
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          </div>
                          <span className="font-semibold text-sm text-warning">₹{item.cost_amount?.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="pt-2 flex justify-between font-semibold text-sm border-t border-border">
                        <span>Total Offline</span>
                        <span className="text-warning">₹{offlineCost.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
