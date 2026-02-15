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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Link2, AlertTriangle, Copy, Settings, BookOpen } from 'lucide-react';
import { seedCampaigns, seedUTMBundles, seedLandingPages, utmContextDefaults } from '@/data/marketingSeedData';
import { getUserName } from '@/data/seedData';
import { type UTMBundle, type LandingPage, UTMContext, LandingPageCategory } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

const utmContextLabel: Record<UTMContext, string> = {
  META_PAID: 'Meta Paid', META_ORGANIC: 'Meta Organic', YOUTUBE_ORGANIC: 'YouTube Organic',
  YOUTUBE_ADS: 'YouTube Ads', LINKEDIN_PAID: 'LinkedIn Paid', GOOGLE_SEARCH: 'Google Search',
  GOOGLE_DISPLAY: 'Google Display', EMAIL: 'Email', WHATSAPP: 'WhatsApp',
  OFFLINE_QR: 'Offline QR', REFERRAL: 'Referral',
};

const categoryLabel: Record<LandingPageCategory, string> = {
  DEMO: 'Demo', PRICING: 'Pricing', BLOG: 'Blog', WEBINAR: 'Webinar', CONTACT: 'Contact', OTHER: 'Other',
};

export default function MktUTMStudioTab() {
  const [bundles, setBundles] = useState<UTMBundle[]>(seedUTMBundles);
  const [landingPages, setLandingPages] = useState<LandingPage[]>(seedLandingPages);
  const [activePanel, setActivePanel] = useState('generator');

  // Generator state
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedContext, setSelectedContext] = useState<UTMContext | ''>('');
  const [selectedLandingPage, setSelectedLandingPage] = useState('');
  const [linkName, setLinkName] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');

  // Landing page form
  const [lpDrawerOpen, setLpDrawerOpen] = useState(false);
  const [lpForm, setLpForm] = useState<Partial<LandingPage>>({});

  const allowedSources = ['meta', 'google', 'youtube', 'linkedin', 'email', 'whatsapp', 'offline', 'referral', 'reddit', 'x'];
  const allowedMediums = ['paid_social', 'social', 'search', 'display', 'paid_video', 'video', 'email', 'newsletter', 'messaging', 'drip', 'partner', 'qr', 'event', 'organic'];

  const validate = (val: string) => /^[a-z0-9_]*$/.test(val);
  const hasError = !validate(utmSource) || !validate(utmMedium) || !validate(utmCampaign) || !validate(utmContent) || !validate(utmTerm);

  const baseUrl = useMemo(() => {
    const lp = landingPages.find(p => p.landing_page_id === selectedLandingPage);
    return lp?.url || '';
  }, [selectedLandingPage, landingPages]);

  const generatedUrl = useMemo(() => {
    if (!baseUrl || !utmSource || !utmMedium || !utmCampaign) return '';
    const params = new URLSearchParams();
    params.set('utm_source', utmSource);
    params.set('utm_medium', utmMedium);
    params.set('utm_campaign', utmCampaign);
    if (utmContent) params.set('utm_content', utmContent);
    if (utmTerm) params.set('utm_term', utmTerm);
    return `${baseUrl}?${params.toString()}`;
  }, [baseUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm]);

  const handleContextSelect = (ctx: UTMContext) => {
    setSelectedContext(ctx);
    const defaults = utmContextDefaults[ctx];
    setUtmSource(defaults.source);
    setUtmMedium(defaults.medium);
  };

  const handleCampaignSelect = (cid: string) => {
    setSelectedCampaign(cid);
    const c = seedCampaigns.find(c => c.campaign_id === cid);
    if (c) {
      setUtmCampaign(c.utm_campaign || c.campaign_name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
      if (c.utm_content) setUtmContent(c.utm_content);
      if (c.utm_term) setUtmTerm(c.utm_term);
    }
  };

  const handleGenerate = () => {
    if (!generatedUrl || hasError || !selectedCampaign || !linkName.trim()) {
      toast({ title: 'Fill required fields and fix errors', variant: 'destructive' }); return;
    }
    const newBundle: UTMBundle = {
      utm_id: `UTM${String(bundles.length + 1).padStart(3, '0')}`, campaign_id: selectedCampaign,
      link_name: linkName, landing_page_id: selectedLandingPage, base_url: baseUrl,
      utm_context: selectedContext, utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign,
      utm_content: utmContent, utm_term: utmTerm, generated_url: generatedUrl,
      short_token: `tsg-${utmCampaign.slice(0, 5)}`, status: 'active', created_by: 'U001', created_at: new Date().toISOString(),
    };
    setBundles(prev => [newBundle, ...prev]);
    toast({ title: 'UTM link saved' });
    setLinkName('');
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: 'Copied' }); };

  const handleSaveLandingPage = () => {
    if (!lpForm.name?.trim() || !lpForm.url?.trim()) { toast({ title: 'Name and URL required', variant: 'destructive' }); return; }
    const nlp: LandingPage = {
      landing_page_id: `LP${String(landingPages.length + 1).padStart(3, '0')}`,
      name: lpForm.name || '', url: lpForm.url || '',
      category: lpForm.category || LandingPageCategory.OTHER, active: true,
      created_at: new Date().toISOString(),
    };
    setLandingPages(prev => [...prev, nlp]);
    toast({ title: 'Landing page added' });
    setLpDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activePanel} onValueChange={setActivePanel}>
        <TabsList className="bg-muted/50 p-1 h-auto gap-0.5">
          <TabsTrigger value="generator" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Link2 className="h-3.5 w-3.5" />Link Generator
          </TabsTrigger>
          <TabsTrigger value="standards" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Settings className="h-3.5 w-3.5" />UTM Standards
          </TabsTrigger>
          <TabsTrigger value="pages" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <BookOpen className="h-3.5 w-3.5" />Landing Pages
          </TabsTrigger>
        </TabsList>

        {/* Generator Panel */}
        <TabsContent value="generator" className="space-y-6">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Link2 className="h-4 w-4" />Generate Tracking Link
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Campaign *</Label>
                  <Select value={selectedCampaign} onValueChange={handleCampaignSelect}>
                    <SelectTrigger><SelectValue placeholder="Select campaign…" /></SelectTrigger>
                    <SelectContent className="bg-card">{seedCampaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Channel Context</Label>
                  <Select value={selectedContext} onValueChange={v => handleContextSelect(v as UTMContext)}>
                    <SelectTrigger><SelectValue placeholder="Select context…" /></SelectTrigger>
                    <SelectContent className="bg-card">{Object.values(UTMContext).map(c => <SelectItem key={c} value={c}>{utmContextLabel[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Landing Page *</Label>
                  <Select value={selectedLandingPage} onValueChange={setSelectedLandingPage}>
                    <SelectTrigger><SelectValue placeholder="Select page…" /></SelectTrigger>
                    <SelectContent className="bg-card">{landingPages.filter(p => p.active).map(p => <SelectItem key={p.landing_page_id} value={p.landing_page_id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Link Name *</Label>
                  <Input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="e.g. Meta CTA v2" />
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'utm_source *', value: utmSource, setter: setUtmSource, suggestions: allowedSources },
                  { label: 'utm_medium *', value: utmMedium, setter: setUtmMedium, suggestions: allowedMediums },
                  { label: 'utm_campaign *', value: utmCampaign, setter: setUtmCampaign, suggestions: [] },
                  { label: 'utm_content', value: utmContent, setter: setUtmContent, suggestions: [] },
                  { label: 'utm_term', value: utmTerm, setter: setUtmTerm, suggestions: [] },
                ].map(field => (
                  <div key={field.label}>
                    <Label className="text-xs">{field.label}</Label>
                    <Input value={field.value} onChange={e => field.setter(e.target.value.toLowerCase().replace(/ /g, '_'))} className={!validate(field.value) ? 'border-destructive' : ''} />
                    {!validate(field.value) && <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Lowercase, no spaces</p>}
                  </div>
                ))}
              </div>
              {generatedUrl && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Preview URL</p>
                  <p className="text-xs font-mono text-foreground break-all">{generatedUrl}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={!generatedUrl || hasError || !selectedCampaign || !linkName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />Save Link
                </Button>
                {generatedUrl && <Button variant="outline" onClick={() => copyToClipboard(generatedUrl)}><Copy className="h-4 w-4 mr-1" />Copy URL</Button>}
              </div>
            </CardContent>
          </Card>

          {/* Saved Links */}
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Saved Tracking Links</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Link Name</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Landing Page</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Medium</TableHead>
                    <TableHead>Campaign Tag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundles.map(b => (
                    <TableRow key={b.utm_id}>
                      <TableCell className="text-sm font-medium">{b.link_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{seedCampaigns.find(c => c.campaign_id === b.campaign_id)?.campaign_name || b.campaign_id}</TableCell>
                      <TableCell className="text-xs">{landingPages.find(p => p.landing_page_id === b.landing_page_id)?.name || b.base_url}</TableCell>
                      <TableCell className="text-xs font-mono">{b.utm_source}</TableCell>
                      <TableCell className="text-xs font-mono">{b.utm_medium}</TableCell>
                      <TableCell className="text-xs font-mono">{b.utm_campaign}</TableCell>
                      <TableCell><span className={`pill ${b.status === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{b.status}</span></TableCell>
                      <TableCell className="text-xs">{getUserName(b.created_by)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(b.generated_url)}><Copy className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {bundles.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No UTM links generated yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Standards Panel */}
        <TabsContent value="standards" className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">UTM Naming Rules</h3>
              <div className="space-y-3">
                {[
                  'All UTM values must be lowercase — auto-enforced on input',
                  'Spaces auto-convert to underscores',
                  'Max 50 characters per UTM parameter',
                  'utm_source: platform name (e.g. meta, google, linkedin)',
                  'utm_medium: traffic type (e.g. paid_social, search, display)',
                  'utm_campaign: descriptive slug matching campaign (e.g. q1_agency_leadgen)',
                  'utm_content: optional creative/CTA variant identifier',
                  'utm_term: optional keyword targeting term',
                ].map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>{r}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Channel Context Defaults</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Context</TableHead>
                    <TableHead>Default Source</TableHead>
                    <TableHead>Default Medium</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(utmContextDefaults).map(([ctx, defaults]) => (
                    <TableRow key={ctx}>
                      <TableCell className="text-sm font-medium">{utmContextLabel[ctx as UTMContext]}</TableCell>
                      <TableCell className="text-xs font-mono">{defaults.source}</TableCell>
                      <TableCell className="text-xs font-mono">{defaults.medium}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Allowed Values</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">utm_source</p>
                  <div className="flex flex-wrap gap-1">{allowedSources.map(s => <Badge key={s} variant="secondary" className="text-xs font-mono">{s}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">utm_medium</p>
                  <div className="flex flex-wrap gap-1">{allowedMediums.map(m => <Badge key={m} variant="secondary" className="text-xs font-mono">{m}</Badge>)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Landing Pages Panel */}
        <TabsContent value="pages" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Landing Page Library</h3>
            <Button size="sm" onClick={() => { setLpForm({ category: LandingPageCategory.OTHER }); setLpDrawerOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Add Page
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landingPages.map(p => (
                    <TableRow key={p.landing_page_id}>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{p.url}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{categoryLabel[p.category]}</Badge></TableCell>
                      <TableCell><span className={`pill ${p.active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{p.active ? 'Active' : 'Inactive'}</span></TableCell>
                      <TableCell className="text-xs text-primary">{bundles.filter(b => b.landing_page_id === p.landing_page_id).length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Landing Page Drawer */}
      <Sheet open={lpDrawerOpen} onOpenChange={setLpDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-card">
          <SheetHeader><SheetTitle>Add Landing Page</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label className="text-xs">Page Name</Label><Input value={lpForm.name || ''} onChange={e => setLpForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs">URL</Label><Input value={lpForm.url || ''} onChange={e => setLpForm(f => ({ ...f, url: e.target.value }))} placeholder="https://terrisage.com/..." /></div>
            <div><Label className="text-xs">Category</Label>
              <Select value={lpForm.category || ''} onValueChange={v => setLpForm(f => ({ ...f, category: v as LandingPageCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">{Object.values(LandingPageCategory).map(c => <SelectItem key={c} value={c}>{categoryLabel[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setLpDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLandingPage}>Add</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
