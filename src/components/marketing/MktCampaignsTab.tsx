import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Search, Plus, Copy, MoreHorizontal, Eye, Pencil, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { seedCampaigns, seedCostItems, seedUTMBundles, seedWebTrackingEvents } from '@/data/marketingSeedData';
import { getUserName, seedEnquiries } from '@/data/seedData';
import { type Campaign, CampaignChannel, CampaignObjective, CampaignStatus, SegmentTarget } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

const channelLabel: Record<CampaignChannel, string> = {
  META: 'Meta', GOOGLE: 'Google', YOUTUBE: 'YouTube', LINKEDIN: 'LinkedIn', X: 'X',
  REDDIT: 'Reddit', WHATSAPP: 'WhatsApp', EMAIL: 'Email', REFERRAL: 'Referral', OFFLINE: 'Offline',
};
const objectiveLabel: Record<CampaignObjective, string> = {
  LEAD_GEN: 'Lead Gen', TRAFFIC: 'Traffic', RETARGETING: 'Retargeting', BRAND: 'Brand', EVENT: 'Event',
};
const statusColor: Record<CampaignStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-success/15 text-success',
  PAUSED: 'bg-warning/15 text-warning',
  COMPLETED: 'bg-primary/15 text-primary',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

function DataSyncBadge({ campaignId }: { campaignId: string }) {
  const hasLeads = seedEnquiries.some(e => e.source?.toLowerCase().includes('meta') || e.source?.toLowerCase().includes('google'));
  const hasCosts = seedCostItems.some(c => c.linked_campaign_id === campaignId);
  if (hasCosts && hasLeads) return <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-success/10 text-success border-success/30">Fully Synced</Badge>;
  if (hasCosts) return <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-info/10 text-info border-info/30">Spend Sync</Badge>;
  return <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-muted text-muted-foreground">Manual</Badge>;
}

export default function MktCampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(seedCampaigns);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<Partial<Campaign>>({});

  const filtered = campaigns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.campaign_name.toLowerCase().includes(s) || c.channel.toLowerCase().includes(s);
    }
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ campaign_name: '', channel: CampaignChannel.META, objective: CampaignObjective.LEAD_GEN, segment_target: SegmentTarget.BOTH, geo_cities: [], start_date: '', end_date: '', status: CampaignStatus.DRAFT, owner_user_id: 'U001', planned_budget: 0, notes: '' });
    setDrawerOpen(true);
  };
  const openEdit = (c: Campaign) => { setEditing(c); setForm({ ...c }); setDrawerOpen(true); };

  const handleSave = () => {
    if (!form.campaign_name?.trim()) { toast({ title: 'Campaign name is required', variant: 'destructive' }); return; }
    if (editing) {
      setCampaigns(prev => prev.map(c => c.campaign_id === editing.campaign_id ? { ...c, ...form, updated_at: new Date().toISOString() } as Campaign : c));
      toast({ title: 'Campaign updated' });
    } else {
      const newCampaign: Campaign = {
        campaign_id: `CMP${String(campaigns.length + 1).padStart(3, '0')}`, campaign_name: form.campaign_name || '', channel: form.channel || CampaignChannel.META,
        objective: form.objective || CampaignObjective.LEAD_GEN, segment_target: form.segment_target || SegmentTarget.BOTH, geo_cities: form.geo_cities || [],
        start_date: form.start_date || '', end_date: form.end_date || '', status: form.status || CampaignStatus.DRAFT, owner_user_id: form.owner_user_id || 'U001',
        planned_budget: form.planned_budget || 0, notes: form.notes || '', linked_assets: [], utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setCampaigns(prev => [newCampaign, ...prev]);
      toast({ title: 'Campaign created' });
    }
    setDrawerOpen(false);
  };

  const handleDuplicate = (c: Campaign) => {
    const dup: Campaign = { ...c, campaign_id: `CMP${String(campaigns.length + 1).padStart(3, '0')}`, campaign_name: `${c.campaign_name} (Copy)`, status: CampaignStatus.DRAFT, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setCampaigns(prev => [dup, ...prev]);
    toast({ title: 'Campaign duplicated' });
  };
  const handleArchive = (id: string) => {
    setCampaigns(prev => prev.map(c => c.campaign_id === id ? { ...c, status: CampaignStatus.ARCHIVED } : c));
    toast({ title: 'Campaign archived' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaigns…" className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="all">All Status</SelectItem>
              {Object.values(CampaignStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />New Campaign</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 bg-muted/30 min-w-[240px]">Campaign</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Objective</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sync</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right text-muted-foreground">Leads ℹ</TableHead>
                  <TableHead className="text-right text-muted-foreground">CPL ℹ</TableHead>
                  <TableHead className="text-right text-muted-foreground">Visits ℹ</TableHead>
                  <TableHead>UTM Links</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const spend = seedCostItems.filter(ci => ci.linked_campaign_id === c.campaign_id).reduce((s, ci) => s + ci.amount, 0);
                  const leads = Math.max(1, Math.floor(spend / 15000));
                  const cpl = leads > 0 ? Math.round(spend / leads) : 0;
                  const utmCount = seedUTMBundles.filter(u => u.campaign_id === c.campaign_id).length;
                  const visits = seedWebTrackingEvents.filter(e => e.campaign_id === c.campaign_id && e.event_type === 'page_view').length;
                  return (
                    <TableRow key={c.campaign_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(c)}>
                      <TableCell className="sticky left-0 bg-card font-medium">{c.campaign_name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{channelLabel[c.channel]}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{objectiveLabel[c.objective]}</TableCell>
                      <TableCell className="text-xs">{c.segment_target}</TableCell>
                      <TableCell><span className={`pill ${statusColor[c.status]}`}>{c.status}</span></TableCell>
                      <TableCell><DataSyncBadge campaignId={c.campaign_id} /></TableCell>
                      <TableCell className="text-xs">{getUserName(c.owner_user_id)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">₹{c.planned_budget.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">₹{spend.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{leads}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">₹{cpl.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{visits || '—'}</TableCell>
                      <TableCell className="text-xs text-primary font-medium">{utmCount || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{c.start_date} → {c.end_date}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card">
                            <DropdownMenuItem onClick={() => openEdit(c)}><Eye className="h-3.5 w-3.5 mr-2" />View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(c)}><Copy className="h-3.5 w-3.5 mr-2" />Duplicate</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleArchive(c.campaign_id)}><Archive className="h-3.5 w-3.5 mr-2" />Archive</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={15} className="text-center py-12 text-muted-foreground">No campaigns found</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
          <SheetHeader><SheetTitle>{editing ? 'Edit Campaign' : 'New Campaign'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label className="text-xs">Campaign Name</Label><Input value={form.campaign_name || ''} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Channel</Label>
                <Select value={form.channel || ''} onValueChange={v => setForm(f => ({ ...f, channel: v as CampaignChannel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(CampaignChannel).map(ch => <SelectItem key={ch} value={ch}>{channelLabel[ch]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Objective</Label>
                <Select value={form.objective || ''} onValueChange={v => setForm(f => ({ ...f, objective: v as CampaignObjective }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(CampaignObjective).map(o => <SelectItem key={o} value={o}>{objectiveLabel[o]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Segment</Label>
                <Select value={form.segment_target || ''} onValueChange={v => setForm(f => ({ ...f, segment_target: v as SegmentTarget }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(SegmentTarget).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status || ''} onValueChange={v => setForm(f => ({ ...f, status: v as CampaignStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(CampaignStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label className="text-xs">End Date</Label><Input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Planned Budget (₹)</Label><Input type="number" value={form.planned_budget || ''} onChange={e => setForm(f => ({ ...f, planned_budget: Number(e.target.value) }))} /></div>
            <div><Label className="text-xs">Cities (comma-separated)</Label><Input value={form.geo_cities?.join(', ') || ''} onChange={e => setForm(f => ({ ...f, geo_cities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} /></div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
            {editing && (editing.utm_campaign || editing.utm_source) && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-muted-foreground">UTM Bundle</p>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">Read-only</Badge>
                </div>
                <p className="text-xs text-foreground font-mono break-all">
                  utm_source={editing.utm_source}&utm_medium={editing.utm_medium}&utm_campaign={editing.utm_campaign}
                  {editing.utm_content && `&utm_content=${editing.utm_content}`}
                  {editing.utm_term && `&utm_term=${editing.utm_term}`}
                </p>
              </div>
            )}
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
