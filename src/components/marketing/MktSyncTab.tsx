import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plug, AlertCircle, CheckCircle, RefreshCw, Settings, ArrowRight, TestTube2, Plus, Pencil } from 'lucide-react';
import { seedSyncConnectors, seedLeadSyncMappings, seedCampaigns } from '@/data/marketingSeedData';
import { type SyncConnector, type LeadSyncMapping, SyncStatus, SyncHealth, SegmentTarget } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

const statusColor: Record<SyncStatus, string> = {
  CONNECTED: 'bg-success/15 text-success',
  NOT_CONNECTED: 'bg-muted text-muted-foreground',
  NEEDS_REAUTH: 'bg-destructive/15 text-destructive',
};

const healthIcon: Record<SyncHealth, React.ElementType> = {
  OK: CheckCircle, WARNING: AlertCircle, ERROR: AlertCircle,
};
const healthColor: Record<SyncHealth, string> = {
  OK: 'text-success', WARNING: 'text-warning', ERROR: 'text-destructive',
};

export default function MktSyncTab() {
  const [connectors] = useState<SyncConnector[]>(seedSyncConnectors);
  const [mappings, setMappings] = useState<LeadSyncMapping[]>(seedLeadSyncMappings);
  const [activePanel, setActivePanel] = useState('connectors');
  const [mappingDrawerOpen, setMappingDrawerOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<LeadSyncMapping | null>(null);
  const [mappingForm, setMappingForm] = useState<Partial<LeadSyncMapping>>({});

  const openEditMapping = (m: LeadSyncMapping) => {
    setEditingMapping(m); setMappingForm({ ...m }); setMappingDrawerOpen(true);
  };

  const openCreateMapping = () => {
    setEditingMapping(null);
    setMappingForm({ source_name: '', connector_id: 'CONN001', default_campaign_id: null, default_city: '', default_segment: SegmentTarget.BOTH, assignment_rule: 'unassigned', field_mappings: [], active: true });
    setMappingDrawerOpen(true);
  };

  const handleSaveMapping = () => {
    if (!mappingForm.source_name?.trim()) { toast({ title: 'Source name required', variant: 'destructive' }); return; }
    if (editingMapping) {
      setMappings(prev => prev.map(m => m.mapping_id === editingMapping.mapping_id ? { ...m, ...mappingForm } as LeadSyncMapping : m));
      toast({ title: 'Mapping updated' });
    } else {
      const nm: LeadSyncMapping = {
        mapping_id: `LSM${String(mappings.length + 1).padStart(3, '0')}`,
        source_name: mappingForm.source_name || '', connector_id: mappingForm.connector_id || 'CONN001',
        default_campaign_id: mappingForm.default_campaign_id || null, default_city: mappingForm.default_city || '',
        default_segment: mappingForm.default_segment || SegmentTarget.BOTH,
        assignment_rule: mappingForm.assignment_rule || 'unassigned',
        field_mappings: mappingForm.field_mappings || [], active: true,
      };
      setMappings(prev => [...prev, nm]);
      toast({ title: 'Mapping created' });
    }
    setMappingDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activePanel} onValueChange={setActivePanel}>
        <TabsList className="bg-muted/50 p-1 h-auto gap-0.5">
          <TabsTrigger value="connectors" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Plug className="h-3.5 w-3.5" />Connectors
          </TabsTrigger>
          <TabsTrigger value="lead_sync" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Settings className="h-3.5 w-3.5" />Lead Sync Config
          </TabsTrigger>
        </TabsList>

        {/* Connectors Grid */}
        <TabsContent value="connectors" className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Available Connectors</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map(c => {
              const HealthIcon = healthIcon[c.health];
              return (
                <Card key={c.connector_id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{c.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                      </div>
                      <span className={`pill ${statusColor[c.status]}`}>{c.status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <HealthIcon className={`h-3.5 w-3.5 ${healthColor[c.health]}`} />
                      <span className="text-xs text-muted-foreground">Health: {c.health}</span>
                      {c.last_sync_at && <span className="text-xs text-muted-foreground">· Last: {new Date(c.last_sync_at).toLocaleDateString()}</span>}
                    </div>
                    <div className="mb-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">What syncs:</p>
                      <div className="flex flex-wrap gap-1">
                        {c.syncs.map(s => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                        <Badge variant="outline" className="text-[10px]">Phase {c.phase}</Badge>
                      </div>
                    </div>
                    <Button
                      variant={c.status === SyncStatus.CONNECTED ? 'outline' : 'default'}
                      size="sm" className="w-full text-xs"
                      onClick={() => toast({ title: c.status === SyncStatus.NOT_CONNECTED ? 'Connect flow will open (placeholder)' : 'Manage connector' })}
                    >
                      {c.status === SyncStatus.CONNECTED ? <><RefreshCw className="h-3 w-3 mr-1" />Reconnect</> :
                       c.status === SyncStatus.NEEDS_REAUTH ? <><AlertCircle className="h-3 w-3 mr-1" />Re-authorize</> :
                       <><Plug className="h-3 w-3 mr-1" />Connect</>}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Lead Sync Config */}
        <TabsContent value="lead_sync" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Lead Source Mappings</h3>
            <Button size="sm" onClick={openCreateMapping}><Plus className="h-4 w-4 mr-1" />Add Mapping</Button>
          </div>

          {/* Attribution rules */}
          <Card>
            <CardContent className="p-5">
              <h4 className="text-sm font-semibold text-foreground mb-3">Attribution Rules</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" /><span>If <code className="text-foreground bg-muted px-1 rounded">tracking_link_id</code> present → map to campaign_id via UTM Studio</span></div>
                <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" /><span>Else if <code className="text-foreground bg-muted px-1 rounded">utm_campaign</code> present → match to saved UTM bundle</span></div>
                <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" /><span>Else → allow manual campaign selection in Inquiry</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Mappings table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Source Name</TableHead>
                    <TableHead>Connector</TableHead>
                    <TableHead>Default Campaign</TableHead>
                    <TableHead>Default City</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map(m => (
                    <TableRow key={m.mapping_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEditMapping(m)}>
                      <TableCell className="font-medium text-sm">{m.source_name}</TableCell>
                      <TableCell className="text-xs">{connectors.find(c => c.connector_id === m.connector_id)?.name || m.connector_id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.default_campaign_id ? seedCampaigns.find(c => c.campaign_id === m.default_campaign_id)?.campaign_name : '—'}</TableCell>
                      <TableCell className="text-xs">{m.default_city || '—'}</TableCell>
                      <TableCell className="text-xs">{m.default_segment}</TableCell>
                      <TableCell className="text-xs">{m.assignment_rule.replace('_', ' ')}</TableCell>
                      <TableCell className="text-xs text-primary">{m.field_mappings.length} mapped</TableCell>
                      <TableCell><span className={`pill ${m.active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{m.active ? 'Active' : 'Paused'}</span></TableCell>
                      <TableCell onClick={ev => ev.stopPropagation()}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMapping(m)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {mappings.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No mappings configured</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Test Sync + Error Log */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 text-center">
                <TestTube2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <h4 className="text-sm font-semibold mb-1">Test Sync</h4>
                <p className="text-xs text-muted-foreground mb-3">Simulate a lead sync to verify mappings work correctly.</p>
                <Button size="sm" variant="outline" onClick={() => toast({ title: 'Test sync simulated — 1 lead processed successfully' })}>
                  <TestTube2 className="h-3.5 w-3.5 mr-1" />Run Test
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h4 className="text-sm font-semibold mb-3">Recent Sync Errors</h4>
                <div className="text-center py-6">
                  <CheckCircle className="h-8 w-8 mx-auto text-success mb-2" />
                  <p className="text-xs text-muted-foreground">No errors in the last 7 days</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Mapping Edit Drawer */}
      <Sheet open={mappingDrawerOpen} onOpenChange={setMappingDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
          <SheetHeader><SheetTitle>{editingMapping ? 'Edit Mapping' : 'New Mapping'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label className="text-xs">Source Name</Label><Input value={mappingForm.source_name || ''} onChange={e => setMappingForm(f => ({ ...f, source_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Connector</Label>
              <Select value={mappingForm.connector_id || ''} onValueChange={v => setMappingForm(f => ({ ...f, connector_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">{connectors.map(c => <SelectItem key={c.connector_id} value={c.connector_id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Default Campaign</Label>
              <Select value={mappingForm.default_campaign_id || 'none'} onValueChange={v => setMappingForm(f => ({ ...f, default_campaign_id: v === 'none' ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="none">None</SelectItem>
                  {seedCampaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Default City</Label><Input value={mappingForm.default_city || ''} onChange={e => setMappingForm(f => ({ ...f, default_city: e.target.value }))} /></div>
              <div><Label className="text-xs">Default Segment</Label>
                <Select value={mappingForm.default_segment || ''} onValueChange={v => setMappingForm(f => ({ ...f, default_segment: v as SegmentTarget }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card">{Object.values(SegmentTarget).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Assignment Rule</Label>
              <Select value={mappingForm.assignment_rule || 'unassigned'} onValueChange={v => setMappingForm(f => ({ ...f, assignment_rule: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assign_to_owner">Assign to Owner</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Field mappings display */}
            {editingMapping && editingMapping.field_mappings.length > 0 && (
              <div>
                <Label className="text-xs mb-2 block">Field Mappings</Label>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  {editingMapping.field_mappings.map((fm, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <code className="bg-background px-1.5 py-0.5 rounded">{fm.external}</code>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <code className="bg-background px-1.5 py-0.5 rounded">{fm.internal}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setMappingDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMapping}>{editingMapping ? 'Update' : 'Create'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
