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
  Calendar, BarChart3, Plus, Trash2, Handshake, FolderOpen, Wifi, WifiOff,
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
import { ContactsTab } from '@/components/marketing/ContactsTab';
import { ReferralManagementTab } from '@/components/marketing/ReferralManagementTab';
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
  const [spendDialogOpen, setSpendDialogOpen] = useState(false);
  const [editingSpend, setEditingSpend] = useState<MarketingCostItem | null>(null);

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

  const quarterRanges: Record<'q1' | 'q2' | 'q3' | 'q4', [number, number]> = {
    q1: [0, 2], q2: [3, 5], q3: [6, 8], q4: [9, 11],
  };
  const liveCountFor = (tenancy: TenancyTypeDb, qk: 'q1' | 'q2' | 'q3' | 'q4' = qKey) => {
    const [from, to] = quarterRanges[qk];
    return accounts.filter(a => {
      if (a.status !== 'LIVE' || a.tenancy_type !== tenancy) return false;
      const d = new Date(a.created_at);
      return d.getFullYear() === year && d.getMonth() >= from && d.getMonth() <= to;
    }).length;
  };
  const quarterlyAchievedFor = (tenancy: TenancyTypeDb) => ({
    q1: liveCountFor(tenancy, 'q1'),
    q2: liveCountFor(tenancy, 'q2'),
    q3: liveCountFor(tenancy, 'q3'),
    q4: liveCountFor(tenancy, 'q4'),
  });

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

  if (!isAdmin) return <Navigate to="/" replace />;

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
        <div className="-mx-4 md:mx-0 overflow-x-auto scrollbar-thin">
          <TabsList className="inline-flex w-max min-w-full justify-start gap-1 px-4 md:px-1 h-auto flex-nowrap">
            <TabsTrigger value="overview" className="whitespace-nowrap"><Target className="h-4 w-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="pipeline" className="whitespace-nowrap"><BarChart3 className="h-4 w-4 mr-1" />Pipeline KPIs</TabsTrigger>
            <TabsTrigger value="contacts" className="whitespace-nowrap"><Users className="h-4 w-4 mr-1" />Contacts</TabsTrigger>
            <TabsTrigger value="referrals" className="whitespace-nowrap"><Handshake className="h-4 w-4 mr-1" />Referrals</TabsTrigger>
            <TabsTrigger value="events" className="whitespace-nowrap"><Calendar className="h-4 w-4 mr-1" />Events</TabsTrigger>
            <TabsTrigger value="costs" className="whitespace-nowrap"><DollarSign className="h-4 w-4 mr-1" />Costs</TabsTrigger>
            <TabsTrigger value="assets" className="whitespace-nowrap"><FolderOpen className="h-4 w-4 mr-1" />Assets</TabsTrigger>
            <TabsTrigger value="activity" className="whitespace-nowrap"><Megaphone className="h-4 w-4 mr-1" />Activity</TabsTrigger>
          </TabsList>
        </div>

        {/* ─── Overview ─── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MarketingTargetCard
              title="Agency / Brokerage Targets" Icon={Users} accentClass="text-primary"
              tenancy="AGENCY_BROKERAGE_CONSULTANCY"
              target={agencyTarget}
              liveCount={liveCountFor('AGENCY_BROKERAGE_CONSULTANCY')}
              quarterlyAchieved={quarterlyAchievedFor('AGENCY_BROKERAGE_CONSULTANCY')}
              currentQuarterKey={qKey} isAdmin={isAdmin} onSave={handleSaveTarget}
            />
            <MarketingTargetCard
              title="Builder / Developer Targets" Icon={Target} accentClass="text-accent"
              tenancy="BUILDER_DEVELOPER"
              target={builderTarget}
              liveCount={liveCountFor('BUILDER_DEVELOPER')}
              quarterlyAchieved={quarterlyAchievedFor('BUILDER_DEVELOPER')}
              currentQuarterKey={qKey} isAdmin={isAdmin} onSave={handleSaveTarget}
            />
          </div>

          {/* Activity summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TileCount label="Contacts" Icon={Users} onClick={() => setActiveTab('contacts')} fetcher="marketing_contacts" />
            <TileCount label="Referrals" Icon={Handshake} onClick={() => setActiveTab('referrals')} fetcher="marketing_referral_records" />
            <TileCount label="Events" Icon={Calendar} onClick={() => setActiveTab('events')} fetcher="marketing_events" />
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('costs')}>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold text-foreground">{costItems.length}</p>
                <p className="text-xs text-muted-foreground">Cost Items</p>
              </CardContent>
            </Card>
          </div>

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
                {(() => {
                  const visible = cities
                    .map(c => ({ c, count: geoCounts[c.name.toLowerCase()] ?? 0 }))
                    .filter(x => x.count >= 1);
                  if (visible.length === 0) {
                    return <p className="text-sm text-muted-foreground">No marketing records tagged with a city yet.</p>;
                  }
                  return visible.map(({ c, count }) => (
                    <Badge key={c.id} variant="secondary">{c.name} ({count})</Badge>
                  ));
                })()}
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

        {/* ─── Contacts ─── */}
        <TabsContent value="contacts">
          <ContactsTab isAdmin={isAdmin} />
        </TabsContent>

        {/* ─── Referral Management ─── */}
        <TabsContent value="referrals">
          <ReferralManagementTab isAdmin={isAdmin} />
        </TabsContent>

        {/* ─── Events ─── */}
        <TabsContent value="events">
          <EventsTab isAdmin={isAdmin} />
        </TabsContent>

        {/* ─── Costs ─── */}
        <TabsContent value="costs" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Marketing Spend</h2>
              <p className="text-xs text-muted-foreground">Track spend by channel — online vs offline</p>
            </div>
            {isAdmin && (
              <Button onClick={() => { setEditingSpend(null); setSpendDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />Add spend
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { type: 'ONLINE' as const, items: onlineItems, total: onlineTotal, label: 'Online Spend', Icon: Wifi, accent: 'text-info', bar: 'bg-info' },
              { type: 'OFFLINE' as const, items: offlineItems, total: offlineTotal, label: 'Offline Spend', Icon: WifiOff, accent: 'text-warning', bar: 'bg-warning' },
            ].map(card => (
              <Card key={card.type} className="overflow-hidden">
                <CardHeader className="pb-3 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md bg-card border border-border ${card.accent}`}>
                        <card.Icon className="h-4 w-4" />
                      </span>
                      {card.label}
                      <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1.5 h-4">{card.items.length}</Badge>
                    </CardTitle>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className={`text-base font-bold ${card.accent}`}>₹{card.total.toLocaleString()}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {card.items.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No {card.label.toLowerCase()} logged yet.
                    </div>
                  )}
                  {card.items.map(item => (
                    <div
                      key={item.id}
                      className="rounded-md border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer group overflow-hidden"
                      onClick={() => { if (isAdmin) { setEditingSpend(item); setSpendDialogOpen(true); } }}
                    >
                      {/* Top: title + amount */}
                      <div className="flex items-start justify-between gap-3 px-3 pt-2.5">
                        <p className="font-medium text-sm text-foreground leading-tight flex-1 min-w-0 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-semibold text-sm ${card.accent}`}>₹{Number(item.amount).toLocaleString()}</span>
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeCostItem(item.id); }}
                              className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Structured info rows — always present for visual alignment */}
                      <div className="mt-2 mx-3 mb-3 rounded-md bg-muted/30 border border-border/60 divide-y divide-border/60 text-[11px]">
                        <div className="flex justify-between px-2 py-1">
                          <span className="text-muted-foreground">Spend date</span>
                          <span className="text-foreground">{item.spend_date ? new Date(item.spend_date).toLocaleDateString() : '—'}</span>
                        </div>
                        <div className="flex justify-between px-2 py-1">
                          <span className="text-muted-foreground">Description</span>
                          <span className="text-foreground text-right max-w-[60%] truncate">{item.description || '—'}</span>
                        </div>
                        <div className="flex justify-between px-2 py-1">
                          <span className="text-muted-foreground">Updated</span>
                          <span className="text-foreground">{new Date(item.updated_at ?? item.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="px-3 pb-3 -mt-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                          <p className="text-xs text-foreground whitespace-pre-wrap rounded-md bg-muted/30 border border-border/60 p-2">
                            {item.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <AddSpendDialog
            open={spendDialogOpen}
            onOpenChange={setSpendDialogOpen}
            existing={editingSpend}
            onSaved={reloadAll}
          />
        </TabsContent>

        {/* ─── Assets ─── */}
        <TabsContent value="assets">
          <Card>
            <CardContent className="p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-foreground font-medium">Marketing Assets</p>
              <p className="text-muted-foreground text-sm mt-1">This space is reserved for marketing assets — coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Activity Log (kept at the end) ─── */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Activity log mapping coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Tile that fetches its own count for a given marketing table
function TileCount({ label, Icon, onClick, fetcher }: {
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
  fetcher: 'marketing_contacts' | 'marketing_events' | 'marketing_referral_records';
}) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    supabase.from(fetcher).select('id', { count: 'exact', head: true })
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
