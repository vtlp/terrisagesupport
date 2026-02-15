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
import { Plus, Pencil, ExternalLink } from 'lucide-react';
import { seedContent, getCampaignName, seedCampaigns, seedSocialAccounts } from '@/data/marketingSeedData';
import { getUserName } from '@/data/seedData';
import { type ContentEntry, type SocialAccount, ContentType, ContentChannel, ContentStatus, MetricSource, SyncStatus } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<ContentStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-warning/15 text-warning',
  PUBLISHED: 'bg-success/15 text-success',
  PAUSED: 'bg-info/15 text-info',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

const syncStatusColor: Record<SyncStatus, string> = {
  CONNECTED: 'bg-success/15 text-success',
  NOT_CONNECTED: 'bg-muted text-muted-foreground',
  NEEDS_REAUTH: 'bg-destructive/15 text-destructive',
};

export default function MktSocialTab() {
  const [entries, setEntries] = useState<ContentEntry[]>(seedContent);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [metricsDrawerOpen, setMetricsDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ContentEntry | null>(null);
  const [form, setForm] = useState<Partial<ContentEntry>>({});
  const [metricsEntry, setMetricsEntry] = useState<ContentEntry | null>(null);
  const [metricsForm, setMetricsForm] = useState<Partial<ContentEntry>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ content_type: ContentType.POST, channel: ContentChannel.LINKEDIN, title: '', publish_date: '', owner_user_id: 'U001', status: ContentStatus.DRAFT, linked_campaign_id: null, city: '', notes: '', metric_source: MetricSource.MANUAL });
    setDrawerOpen(true);
  };
  const openEdit = (e: ContentEntry) => { setEditing(e); setForm({ ...e }); setDrawerOpen(true); };
  const openMetrics = (e: ContentEntry) => { setMetricsEntry(e); setMetricsForm({ ...e }); setMetricsDrawerOpen(true); };

  const handleSave = () => {
    if (!form.title?.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    if (editing) {
      setEntries(prev => prev.map(e => e.content_id === editing.content_id ? { ...e, ...form } as ContentEntry : e));
      toast({ title: 'Content entry updated' });
    } else {
      const ne: ContentEntry = {
        content_id: `CNT${String(entries.length + 1).padStart(3, '0')}`,
        content_type: form.content_type || ContentType.POST, channel: form.channel || ContentChannel.LINKEDIN,
        title: form.title || '', publish_date: form.publish_date || '', owner_user_id: form.owner_user_id || 'U001',
        status: form.status || ContentStatus.DRAFT, linked_campaign_id: form.linked_campaign_id || null,
        city: form.city || '', asset_links: [], notes: form.notes || '', metric_source: MetricSource.MANUAL,
        impressions: null, reach: null, clicks: null, engagement_total: null, likes: null, comments: null,
        shares: null, saves: null, video_views: null, avg_watch_time_seconds: null, follower_delta: null,
        last_synced_at: null, created_at: new Date().toISOString(),
      };
      setEntries(prev => [ne, ...prev]);
      toast({ title: 'Content entry created' });
    }
    setDrawerOpen(false);
  };

  const handleSaveMetrics = () => {
    if (!metricsEntry) return;
    setEntries(prev => prev.map(e => e.content_id === metricsEntry.content_id ? { ...e, ...metricsForm, metric_source: MetricSource.MANUAL } as ContentEntry : e));
    toast({ title: 'Metrics updated' });
    setMetricsDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Social Accounts */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">Social Accounts</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {seedSocialAccounts.map(sa => (
            <Card key={sa.account_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-xs">{sa.platform}</Badge>
                  <span className={`pill ${syncStatusColor[sa.status]}`}>{sa.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{sa.handle}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {sa.last_sync_at ? `Last sync: ${new Date(sa.last_sync_at).toLocaleDateString()}` : 'Not synced'}
                </p>
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7">
                  <ExternalLink className="h-3 w-3 mr-1" />{sa.status === SyncStatus.CONNECTED ? 'Manage' : 'Connect via Sync'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Content Calendar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Content Calendar</h3>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />New Entry</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Publish Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Metric Source</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead className="w-20"></TableHead>
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
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${e.metric_source === MetricSource.SYNCED ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {e.metric_source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{e.impressions?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{e.reach?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{e.clicks?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{e.engagement_total?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell onClick={ev => ev.stopPropagation()} className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {e.status === ContentStatus.PUBLISHED && (
                        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => openMetrics(e)}>Metrics</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && <TableRow><TableCell colSpan={13} className="text-center py-12 text-muted-foreground">No content entries yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Drawer */}
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
              <div><Label className="text-xs">Platform</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Campaign</Label>
                <Select value={form.linked_campaign_id || 'none'} onValueChange={v => setForm(f => ({ ...f, linked_campaign_id: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="none">None</SelectItem>
                    {seedCampaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">City</Label><Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Caption / Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Quick Add Metrics Drawer */}
      <Sheet open={metricsDrawerOpen} onOpenChange={setMetricsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-card">
          <SheetHeader>
            <SheetTitle>Quick Add Metrics</SheetTitle>
            <p className="text-xs text-muted-foreground">{metricsEntry?.title}</p>
          </SheetHeader>
          <div className="space-y-3 mt-6">
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground mb-2">Manual Entry</Badge>
            {[
              { label: 'Impressions', key: 'impressions' },
              { label: 'Reach', key: 'reach' },
              { label: 'Clicks', key: 'clicks' },
              { label: 'Engagement Total', key: 'engagement_total' },
              { label: 'Likes', key: 'likes' },
              { label: 'Comments', key: 'comments' },
              { label: 'Shares', key: 'shares' },
              { label: 'Saves', key: 'saves' },
              { label: 'Video Views', key: 'video_views' },
              { label: 'Avg Watch Time (sec)', key: 'avg_watch_time_seconds' },
              { label: 'Follower Delta', key: 'follower_delta' },
            ].map(f => (
              <div key={f.key} className="grid grid-cols-2 items-center gap-2">
                <Label className="text-xs">{f.label}</Label>
                <Input type="number" className="h-8" value={(metricsForm as any)[f.key] ?? ''} onChange={e => setMetricsForm(mf => ({ ...mf, [f.key]: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            ))}
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setMetricsDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMetrics}>Save Metrics</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
