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
import { Plus, Pencil } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { seedCostItems, seedCampaigns, getCampaignName } from '@/data/marketingSeedData';
import { seedEnquiries } from '@/data/seedData';
import { type CostItem, CostType, CampaignChannel } from '@/types/marketing';
import { EnquiryStage } from '@/types/core';
import { toast } from '@/hooks/use-toast';

const typeLabel: Record<CostType, string> = {
  ONLINE: 'Online', OFFLINE: 'Offline', TOOLING: 'Tooling',
  AGENCY: 'Agency', CREATIVE: 'Creative', EVENT: 'Event',
};

export default function MktCostsTab() {
  const [items, setItems] = useState<CostItem[]>(seedCostItems);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CostItem | null>(null);
  const [form, setForm] = useState<Partial<CostItem>>({});

  const totalSpend = items.reduce((s, i) => s + i.amount, 0);
  const totalPlanned = seedCampaigns.reduce((s, c) => s + c.planned_budget, 0);
  const totalLeads = seedEnquiries.length;
  const totalAccounts = seedEnquiries.filter(e => e.stage === EnquiryStage.ACCOUNT_CREATED).length;
  const cpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;
  const cpa = totalAccounts > 0 ? Math.round(totalSpend / totalAccounts) : 0;

  // Spend by channel chart data
  const spendByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => {
      const ch = i.channel || 'Other';
      map[ch] = (map[ch] || 0) + i.amount;
    });
    return Object.entries(map).map(([name, amount]) => ({ name, amount }));
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm({ date: '', type: CostType.ONLINE, channel: null, linked_campaign_id: null, vendor: '', amount: 0, notes: '' });
    setDrawerOpen(true);
  };
  const openEdit = (i: CostItem) => { setEditing(i); setForm({ ...i }); setDrawerOpen(true); };

  const handleSave = () => {
    if (!form.vendor?.trim()) { toast({ title: 'Vendor is required', variant: 'destructive' }); return; }
    if (editing) {
      setItems(prev => prev.map(i => i.cost_item_id === editing.cost_item_id ? { ...i, ...form } as CostItem : i));
      toast({ title: 'Cost item updated' });
    } else {
      const nc: CostItem = {
        cost_item_id: `CST${String(items.length + 1).padStart(3, '0')}`,
        date: form.date || '', type: form.type || CostType.ONLINE,
        channel: form.channel || null, linked_campaign_id: form.linked_campaign_id || null,
        vendor: form.vendor || '', amount: form.amount || 0, notes: form.notes || '',
        attachment_url: null, created_at: new Date().toISOString(),
      };
      setItems(prev => [nc, ...prev]);
      toast({ title: 'Cost item added' });
    }
    setDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Analytics summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Spend</p><p className="text-2xl font-bold text-foreground">₹{(totalSpend / 1000).toFixed(0)}K</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Planned Budget</p><p className="text-2xl font-bold text-foreground">₹{(totalPlanned / 1000).toFixed(0)}K</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Variance</p><p className={`text-2xl font-bold ${totalSpend <= totalPlanned ? 'text-success' : 'text-destructive'}`}>₹{((totalPlanned - totalSpend) / 1000).toFixed(0)}K</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">CPL</p><p className="text-2xl font-bold text-foreground">₹{cpl.toLocaleString()}</p><p className="text-[10px] text-muted-foreground italic">Source: Inquiry</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">CPA</p><p className="text-2xl font-bold text-foreground">₹{cpa.toLocaleString()}</p><p className="text-[10px] text-muted-foreground italic">Source: Inquiry</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">ROAS</p><p className="text-2xl font-bold text-foreground">{totalSpend > 0 ? ((totalAccounts * 25000) / totalSpend).toFixed(1) : '0'}x</p><p className="text-[10px] text-muted-foreground italic">Estimated</p></CardContent></Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Spend by Channel</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendByChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Cost Ledger</h3>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />Add Cost</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.cost_item_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(i)}>
                  <TableCell className="text-xs">{i.date}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{typeLabel[i.type]}</Badge></TableCell>
                  <TableCell className="text-xs">{i.channel || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getCampaignName(i.linked_campaign_id)}</TableCell>
                  <TableCell className="text-sm font-medium">{i.vendor}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">₹{i.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{i.notes}</TableCell>
                  <TableCell onClick={ev => ev.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
          <SheetHeader><SheetTitle>{editing ? 'Edit Cost Item' : 'Add Cost Item'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label className="text-xs">Vendor</Label><Input value={form.vendor || ''} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label className="text-xs">Amount (₹)</Label><Input type="number" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label>
                <Select value={form.type || ''} onValueChange={v => setForm(f => ({ ...f, type: v as CostType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(CostType).map(t => <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Channel</Label>
                <Select value={form.channel || 'none'} onValueChange={v => setForm(f => ({ ...f, channel: v === 'none' ? null : v as CampaignChannel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="none">None</SelectItem>
                    {Object.values(CampaignChannel).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Campaign</Label>
              <Select value={form.linked_campaign_id || 'none'} onValueChange={v => setForm(f => ({ ...f, linked_campaign_id: v === 'none' ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="none">None</SelectItem>
                  {seedCampaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
