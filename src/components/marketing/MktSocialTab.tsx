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
import { seedContent, getCampaignName, seedCampaigns } from '@/data/marketingSeedData';
import { getUserName } from '@/data/seedData';
import { type ContentEntry, ContentType, ContentChannel, ContentStatus } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<ContentStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-warning/15 text-warning',
  PUBLISHED: 'bg-success/15 text-success',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

export default function MktSocialTab() {
  const [entries, setEntries] = useState<ContentEntry[]>(seedContent);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ContentEntry | null>(null);
  const [form, setForm] = useState<Partial<ContentEntry>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ content_type: ContentType.POST, channel: ContentChannel.LINKEDIN, title: '', publish_date: '', owner_user_id: 'U001', status: ContentStatus.DRAFT, linked_campaign_id: null, notes: '' });
    setDrawerOpen(true);
  };
  const openEdit = (e: ContentEntry) => { setEditing(e); setForm({ ...e }); setDrawerOpen(true); };

  const handleSave = () => {
    if (!form.title?.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (editing) {
      setEntries(prev => prev.map(e => e.content_id === editing.content_id ? { ...e, ...form } as ContentEntry : e));
      toast({ title: 'Content entry updated' });
    } else {
      const ne: ContentEntry = {
        content_id: `CNT${String(entries.length + 1).padStart(3, '0')}`,
        content_type: form.content_type || ContentType.POST,
        channel: form.channel || ContentChannel.LINKEDIN,
        title: form.title || '',
        publish_date: form.publish_date || '',
        owner_user_id: form.owner_user_id || 'U001',
        status: form.status || ContentStatus.DRAFT,
        linked_campaign_id: form.linked_campaign_id || null,
        asset_links: [], notes: form.notes || '',
        impressions: null, engagement: null, clicks: null,
        created_at: new Date().toISOString(),
      };
      setEntries(prev => [ne, ...prev]);
      toast({ title: 'Content entry created' });
    }
    setDrawerOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Content Calendar</h3>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />New Entry</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Publish Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.content_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(e)}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{e.content_type}</Badge></TableCell>
                  <TableCell className="text-xs">{e.channel}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.publish_date}</TableCell>
                  <TableCell><span className={`pill ${statusColor[e.status]}`}>{e.status}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getCampaignName(e.linked_campaign_id)}</TableCell>
                  <TableCell className="text-xs">{getUserName(e.owner_user_id)}</TableCell>
                  <TableCell className="text-right text-sm">{e.impressions?.toLocaleString() ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">{e.engagement?.toLocaleString() ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">{e.clicks?.toLocaleString() ?? '—'}</TableCell>
                  <TableCell onClick={ev => ev.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No content entries yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
          <SheetHeader><SheetTitle>{editing ? 'Edit Content' : 'New Content'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label className="text-xs">Title</Label><Input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label>
                <Select value={form.content_type || ''} onValueChange={v => setForm(f => ({ ...f, content_type: v as ContentType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(ContentType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Channel</Label>
                <Select value={form.channel || ''} onValueChange={v => setForm(f => ({ ...f, channel: v as ContentChannel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(ContentChannel).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Publish Date</Label><Input type="date" value={form.publish_date || ''} onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} /></div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status || ''} onValueChange={v => setForm(f => ({ ...f, status: v as ContentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(ContentStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
