import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Target, Users, Megaphone, DollarSign, MapPin,
  TrendingUp, Award, UserPlus, Calendar, BarChart3, Plus, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLookup } from '@/hooks/useLookups';
import { useToast } from '@/hooks/use-toast';
import {
  fetchTargets, upsertTarget, fetchSettings, updateTotalSpendOverride,
  listRecords, deleteRecord, fetchGeographyCounts,
  type MarketingTarget, type MarketingCostItem, type TenancyTypeDb,
} from '@/lib/marketingApi';
import { MarketingTargetCard } from '@/components/marketing/MarketingTargetCard';
import { EditableNumber } from '@/components/marketing/EditableNumber';
import { AddSpendDialog } from '@/components/marketing/AddSpendDialog';
import { RecordsTab } from '@/components/marketing/RecordsTab';
import { EventsTab } from '@/components/marketing/EventsTab';

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

function currentQuarterKey(d = new Date()): 'q1' | 'q2' | 'q3' | 'q4' {
  const m = d.getMonth();
  if (m < 3) return 'q1';
  if (m < 6) return 'q2';
  if (m < 9) return 'q3';
  return 'q4';
}

interface EnquiryRow { stage: string; source: string | null; created_at: string }
interface AccountRow { status: string; tenancy_type: string; created_at: string }
interface TicketRow { status: string; priority: string }

export default function Marketing() {
  const { isAdmin } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const cities = useLookup('cities');

  // Live data state
  const year = new Date().getFullYear();
  const qKey = currentQuarterKey();
  const [targets, setTargets] = useState<MarketingTarget[]>([]);
  const [totalSpendOverride, setTotalSpendOverride] = useState(0);
  const [costItems, setCostItems] = useState<MarketingCostItem[]>([]);
  const [geoCounts, setGeoCounts] = useState<Record<string, number>>({});
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [spendDialog, setSpendDialog] = useState<null | 'ONLINE' | 'OFFLINE'>(null);

  if (!isAdmin) return <Navigate to="/" replace />;

  const reloadAll = async () => {
    const [t, s, ci, geo, enq, acc, tic] = await Promise.all([
      fetchTargets(year),
      fetchSettings(),
      listRecords<MarketingCostItem>('marketing_cost_items'),
      fetchGeographyCounts(),
      supabase.from('enquiries').select('stage,source,created_at'),
      supabase.from('accounts').select('status,tenancy_type,created_at'),
      supabase.from('tickets').select('status,priority'),
    ]);
    setTargets(t);
    setTotalSpendOverride(s?.total_spend_override ?? 0);
    setCostItems(ci);
    setGeoCounts(geo);
    setEnquiries((enq.data ?? []) as EnquiryRow[]);
    setAccounts((acc.data ?? []) as AccountRow[]);
    setTickets((tic.data ?? []) as TicketRow[]);
  };

  useEffect(() => { reloadAll(); }, []);

  // Targets
  const agencyTarget = useMemo(() => targets.find(t => t.tenancy_type === 'AGENCY_BROKERAGE_CONSULTANCY') ?? null, [targets]);
  const builderTarget = useMemo(() => targets.find(t => t.tenancy_type === 'BUILDER_DEVELOPER') ?? null, [targets]);

  const liveCountFor = (tenancy: TenancyTypeDb) => {
    const monthRanges = { q1: [0, 2], q2: [3, 5], q3: [6, 8], q4: [9, 11] }[qKey] as [number, number];
    return accounts.filter(a => {
      if (a.status !== 'LIVE' || a.tenancy_type !== tenancy) return false;
      const d = new Date(a.created_at);
      return d.getFullYear() === year && d.getMonth() >= monthRanges[0] && d.getMonth() <= monthRanges[1];
    }).length;
  };

  const handleSaveTarget = async (
    tenancy: TenancyTypeDb,
    patch: Partial<Pick<MarketingTarget, 'q1' | 'q2' | 'q3' | 'q4' | 'total_target'>>,
  ) => {
    try {
      const updated = await upsertTarget(year, tenancy, patch);
      setTargets(prev => {
        const idx = prev.findIndex(t => t.tenancy_type === tenancy);
        if (idx === -1) return [...prev, updated];
        const next = [...prev]; next[idx] = updated; return next;
      });
      toast({ title: 'Target updated' });
    } catch (e) {
      toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' });
    }
  };

  // Costs
  const onlineItems = useMemo(() => costItems.filter(c => c.cost_type === 'ONLINE'), [costItems]);
  const offlineItems = useMemo(() => costItems.filter(c => c.cost_type === 'OFFLINE'), [costItems]);
  const onlineTotal = onlineItems.reduce((s, c) => s + Number(c.amount), 0);
  const offlineTotal = offlineItems.reduce((s, c) => s + Number(c.amount), 0);

  const removeCostItem = async (id: string) => {
    if (!confirm('Delete this spend?')) return;
    try { await deleteRecord('marketing_cost_items', id); reloadAll(); toast({ title: 'Deleted' }); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  // Pipeline KPIs (live)
  const totalEnquiries = enquiries.length;
  const contactedCount = enquiries.filter(e => e.stage !== 'NEW_ENQUIRY').length;
  const demoSchedCount = enquiries.filter(e => ['DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PAYMENT_LINK_SENT', 'ONBOARDING_PACK_SENT', 'ACCOUNT_CREATED'].includes(e.stage)).length;
  const demoDoneCount = enquiries.filter(e => ['DEMO_COMPLETED', 'PAYMENT_LINK_SENT', 'ONBOARDING_PACK_SENT', 'ACCOUNT_CREATED'].includes(e.stage)).length;
  const convertedCount = enquiries.filter(e => e.stage === 'ACCOUNT_CREATED').length;
  const convRate = totalEnquiries > 0 ? ((convertedCount / totalEnquiries) * 100).toFixed(1) : '0.0';
  const openTickets = tickets.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const p1p2 = tickets.filter(t => t.priority === 'P1' || t.priority === 'P2').length;

  const funnelData = [
    { name: 'Total Enquiries', value: totalEnquiries, fill: 'hsl(var(--primary))' },
    { name: 'Contacted', value: contactedCount, fill: 'hsl(var(--info))' },
    { name: 'Demo Scheduled', value: demoSchedCount, fill: 'hsl(var(--warning))' },
    { name: 'Demo Completed', value: demoDoneCount, fill: 'hsl(var(--accent))' },
    { name: 'Converted', value: convertedCount, fill: 'hsl(var(--success))' },
  ];
  const sourceCounts: Record<string, number> = {};
  enquiries.forEach(e => { const k = e.source ?? 'UNKNOWN'; sourceCounts[k] = (sourceCounts[k] ?? 0) + 1; });
  const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

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
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview"><Target className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="pipeline"><BarChart3 className="h-4 w-4 mr-1" />Pipeline KPIs</TabsTrigger>
          <TabsTrigger value="activity"><Megaphone className="h-4 w-4 mr-1" />Activity Log</TabsTrigger>
          <TabsTrigger value="records"><UserPlus className="h-4 w-4 mr-1" />Referrals · Contacts · Champions</TabsTrigger>
          <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1" />Events</TabsTrigger>
          <TabsTrigger value="costs"><DollarSign className="h-4 w-4 mr-1" />Costs</TabsTrigger>
        </TabsList>

        {/* ─── Overview ─── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MarketingTargetCard
              title="Agency / Brokerage Targets" Icon={Users} accentClass="text-primary"
              tenancy="AGENCY_BROKERAGE_CONSULTANCY"
              target={agencyTarget}
              liveCount={liveCountFor('AGENCY_BROKERAGE_CONSULTANCY')}
              currentQuarterKey={qKey} isAdmin={isAdmin} onSave={handleSaveTarget}
            />
            <MarketingTargetCard
              title="Builder / Developer Targets" Icon={Target} accentClass="text-accent"
              tenancy="BUILDER_DEVELOPER"
              target={builderTarget}
              liveCount={liveCountFor('BUILDER_DEVELOPER')}
              currentQuarterKey={qKey} isAdmin={isAdmin} onSave={handleSaveTarget}
            />
          </div>

          {/* Activity summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('records')}>
              <CardContent className="p-3 text-center">
                <UserPlus className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold text-foreground">{geoCountSafe(0)}</p>
                <p className="text-xs text-muted-foreground">Referrals</p>
              </CardContent>
            </Card>
            <TileCount label="Contacts" Icon={Users} onClick={() => setActiveTab('records')} fetcher="marketing_contacts" />
            <TileCount label="Champions" Icon={Award} onClick={() => setActiveTab('records')} fetcher="marketing_champions" />
            <TileCount label="Events" Icon={Calendar} onClick={() => setActiveTab('events')} fetcher="marketing_events" />
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('costs')}>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold text-foreground">{costItems.length}</p>
                <p className="text-xs text-muted-foreground">Cost Items</p>
              </CardContent>
            </Card>
          </div>
          {/* Use referrals count via geoCounts placeholder fix: render proper tile */}

          {/* Cost Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Spend (manual)</p>
                <p className="text-2xl font-bold text-foreground">
                  <EditableNumber
                    value={totalSpendOverride}
                    disabled={!isAdmin}
                    prefix="₹"
                    onSave={async (n) => {
                      try { await updateTotalSpendOverride(n); setTotalSpendOverride(n); toast({ title: 'Total spend updated' }); }
                      catch (e) { toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }); }
                    }}
                  />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Online (sum of items)</p>
                <p className="text-2xl font-bold text-info">₹{onlineTotal.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Offline (sum of items)</p>
                <p className="text-2xl font-bold text-warning">₹{offlineTotal.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Geography Coverage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />Geography Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cities.length === 0 && <p className="text-sm text-muted-foreground">No cities configured. Add some in Lookup Management.</p>}
                {cities.map(city => {
                  const count = geoCounts[city.name.toLowerCase()] ?? 0;
                  return (
                    <Badge key={city.id} variant="secondary">
                      {city.name} ({count})
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Pipeline KPIs (live) ─── */}
        <TabsContent value="pipeline" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Enquiries</p><p className="text-2xl font-bold text-foreground">{totalEnquiries}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Converted</p><p className="text-2xl font-bold text-success">{convertedCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Conversion Rate</p><p className="text-2xl font-bold text-foreground">{convRate}%</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Open Tickets</p><p className="text-2xl font-bold text-foreground">{openTickets}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">P1/P2 Tickets</p><p className="text-2xl font-bold text-destructive">{p1p2}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Conversion Funnel</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funnelData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 text-right">{item.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                      <div className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${funnelData[0].value > 0 ? (item.value / funnelData[0].value) * 100 : 0}%`, backgroundColor: item.fill }}>
                        <span className="text-xs font-semibold text-primary-foreground">{item.value}</span>
                      </div>
                    </div>
                    {i > 0 && <span className="text-xs text-muted-foreground w-12">{funnelData[i - 1].value > 0 ? ((item.value / funnelData[i - 1].value) * 100).toFixed(0) : 0}%</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Enquiries by Source</CardTitle></CardHeader>
              <CardContent className="h-[250px]">
                {sourceData.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RPieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RPieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Operational KPIs</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Live Accounts', value: accounts.filter(a => a.status === 'LIVE').length },
                  { label: 'Onboarding', value: accounts.filter(a => a.status === 'ONBOARDING_IN_PROGRESS').length },
                  { label: 'Stalled', value: accounts.filter(a => a.status === 'STALLED_ONBOARDING').length, color: 'text-destructive' },
                  { label: 'Total Accounts', value: accounts.length },
                ].map(kpi => (
                  <div key={kpi.label} className="flex justify-between items-center py-1 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{kpi.label}</span>
                    <span className={`font-bold ${kpi.color ?? 'text-foreground'}`}>{kpi.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Activity Log (empty state) ─── */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Activity log mapping coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Records (Referrals · Contacts · Champions) ─── */}
        <TabsContent value="records">
          <RecordsTab isAdmin={isAdmin} />
        </TabsContent>

        {/* ─── Events ─── */}
        <TabsContent value="events">
          <EventsTab isAdmin={isAdmin} />
        </TabsContent>

        {/* ─── Costs ─── */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { type: 'ONLINE' as const, items: onlineItems, total: onlineTotal, label: 'Online Spend', accent: 'text-info' },
              { type: 'OFFLINE' as const, items: offlineItems, total: offlineTotal, label: 'Offline Spend', accent: 'text-warning' },
            ].map(card => (
              <Card key={card.type}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{card.label}</CardTitle>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setSpendDialog(card.type)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add spend
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {card.items.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No spends yet.</p>}
                  {card.items.map(item => (
                    <div key={item.id} className="flex items-start justify-between py-1.5 border-b border-border last:border-0 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        {(item.city || item.spend_date) && (
                          <p className="text-xs text-muted-foreground">
                            {item.city && <span>{item.city}</span>}
                            {item.city && item.spend_date && <span> · </span>}
                            {item.spend_date && <span>{new Date(item.spend_date).toLocaleDateString()}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`font-semibold text-sm ${card.accent}`}>₹{Number(item.amount).toLocaleString()}</span>
                        {isAdmin && (
                          <button onClick={() => removeCostItem(item.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-semibold text-sm border-t border-border">
                    <span>Total {card.type === 'ONLINE' ? 'Online' : 'Offline'}</span>
                    <span className={card.accent}>₹{card.total.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <AddSpendDialog
            open={spendDialog !== null}
            onOpenChange={(v) => { if (!v) setSpendDialog(null); }}
            defaultCostType={spendDialog ?? 'ONLINE'}
            onCreated={reloadAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  function geoCountSafe(_: number) { return 0; } // placeholder removed below
}

// Tile that fetches its own count for a given marketing table
function TileCount({ label, Icon, onClick, fetcher }: {
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
  fetcher: 'marketing_referrals' | 'marketing_contacts' | 'marketing_champions' | 'marketing_events';
}) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    supabase.from(fetcher as 'marketing_referrals').select('id', { count: 'exact', head: true })
      .then(({ count: c }) => setCount(c ?? 0));
  }, [fetcher]);
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-3 text-center">
        <Icon className="h-5 w-5 mx-auto mb-1 text-primary" />
        <p className="text-2xl font-bold text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
