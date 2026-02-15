import { useState } from 'react';
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
import { seedOfflineActivities, getCampaignName, seedCampaigns } from '@/data/marketingSeedData';
import { getUserName } from '@/data/seedData';
import { type OfflineActivity, OfflineActivityType, SegmentTarget } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

const typeLabel: Record<OfflineActivityType, string> = {
  EVENT: 'Event', MEETUP: 'Meetup', ASSOCIATION_VISIT: 'Association Visit',
  PRINT: 'Print', COLD_CALL_DRIVE: 'Cold-Call Drive', PARTNER_PROGRAMME: 'Partner Programme',
};

export default function MktOfflineTab() {
  const [activities, setActivities] = useState<OfflineActivity[]>(seedOfflineActivities);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OfflineActivity | null>(null);
  const [form, setForm] = useState<Partial<OfflineActivity>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ type: OfflineActivityType.EVENT, title: '', city: '', start_date: '', end_date: '', target_segment: SegmentTarget.BOTH, linked_campaign_id: null, planned_cost: null, notes: '', owner_user_id: 'U001' });
    setDrawerOpen(true);
  };
  const openEdit = (a: OfflineActivity) => { setEditing(a); setForm({ ...a }); setDrawerOpen(true); };

  const handleSave = () => {
    if (!form.title?.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (editing) {
      setActivities(prev => prev.map(a => a.activity_id === editing.activity_id ? { ...a, ...form } as OfflineActivity : a));
      toast({ title: 'Activity updated' });
    } else {
      const na: OfflineActivity = {
        activity_id: `OFL${String(activities.length + 1).padStart(3, '0')}`,
        type: form.type || OfflineActivityType.EVENT,
        title: form.title || '', city: form.city || '',
        start_date: form.start_date || '', end_date: form.end_date || '',
        target_segment: form.target_segment || SegmentTarget.BOTH,
        linked_campaign_id: form.linked_campaign_id || null,
        planned_cost: form.planned_cost || null, notes: form.notes || '',
        owner_user_id: form.owner_user_id || 'U001',
        created_at: new Date().toISOString(),
      };
      setActivities(prev => [na, ...prev]);
      toast({ title: 'Activity created' });
    }
    setDrawerOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Offline Activities</h3>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />New Activity</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map(a => (
                <TableRow key={a.activity_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(a)}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{typeLabel[a.type]}</Badge></TableCell>
                  <TableCell className="text-xs">{a.city}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{a.start_date}{a.end_date !== a.start_date ? ` → ${a.end_date}` : ''}</TableCell>
                  <TableCell className="text-xs">{a.target_segment}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getCampaignName(a.linked_campaign_id)}</TableCell>
                  <TableCell className="text-right text-sm">{a.planned_cost ? `₹${a.planned_cost.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-xs">{getUserName(a.owner_user_id)}</TableCell>
                  <TableCell onClick={ev => ev.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {activities.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No offline activities yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
          <SheetHeader><SheetTitle>{editing ? 'Edit Activity' : 'New Activity'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label className="text-xs">Title</Label><Input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label>
                <Select value={form.type || ''} onValueChange={v => setForm(f => ({ ...f, type: v as OfflineActivityType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(OfflineActivityType).map(t => <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">City</Label><Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label className="text-xs">End Date</Label><Input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Segment</Label>
                <Select value={form.target_segment || ''} onValueChange={v => setForm(f => ({ ...f, target_segment: v as SegmentTarget }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(SegmentTarget).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Planned Cost (₹)</Label><Input type="number" value={form.planned_cost ?? ''} onChange={e => setForm(f => ({ ...f, planned_cost: e.target.value ? Number(e.target.value) : null }))} /></div>
            </div>
            <div><Label className="text-xs">Linked Campaign</Label>
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
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
