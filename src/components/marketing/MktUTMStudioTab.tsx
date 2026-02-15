import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Link2, AlertTriangle, Plus } from 'lucide-react';
import { seedCampaigns, seedUTMBundles } from '@/data/marketingSeedData';
import { type UTMBundle } from '@/types/marketing';
import { toast } from '@/hooks/use-toast';

export default function MktUTMStudioTab() {
  const [bundles, setBundles] = useState<UTMBundle[]>(seedUTMBundles);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://terrisage.com/demo');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');

  // Naming rules
  const rules = [
    'Lowercase only, no spaces (use underscores)',
    'utm_source: platform name (meta, google, linkedin, email, whatsapp)',
    'utm_medium: traffic type (paid_social, search, display, organic, drip, partner)',
    'utm_campaign: descriptive slug (e.g. q1_agency_leadgen)',
    'utm_content: optional creative variant',
    'utm_term: optional keyword',
  ];

  const validate = (val: string) => /^[a-z0-9_]*$/.test(val);
  const hasError = !validate(utmSource) || !validate(utmMedium) || !validate(utmCampaign) || !validate(utmContent) || !validate(utmTerm);

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

  const handleGenerate = () => {
    if (!generatedUrl || hasError) {
      toast({ title: 'Fix validation errors before generating', variant: 'destructive' });
      return;
    }
    const newBundle: UTMBundle = {
      utm_id: `UTM${String(bundles.length + 1).padStart(3, '0')}`,
      campaign_id: selectedCampaign || '',
      base_url: baseUrl,
      utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign,
      utm_content: utmContent, utm_term: utmTerm,
      generated_url: generatedUrl,
      short_token: `tsg-${utmCampaign.slice(0, 5)}`,
      created_at: new Date().toISOString(),
    };
    setBundles(prev => [newBundle, ...prev]);
    toast({ title: 'UTM link generated and saved' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  // Auto-populate from campaign
  const handleCampaignSelect = (cid: string) => {
    setSelectedCampaign(cid);
    const c = seedCampaigns.find(c => c.campaign_id === cid);
    if (c) {
      setUtmSource(c.utm_source || c.channel.toLowerCase());
      setUtmMedium(c.utm_medium || '');
      setUtmCampaign(c.utm_campaign || c.campaign_name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'));
      setUtmContent(c.utm_content || '');
      setUtmTerm(c.utm_term || '');
    }
  };

  return (
    <div className="space-y-6">
      {/* Naming Rules */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">UTM Naming Convention</h3>
          <ul className="space-y-1">
            {rules.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>{r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Generator */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Link2 className="h-4 w-4" />UTM Link Generator
          </h3>
          <div>
            <Label className="text-xs">Campaign (auto-populate)</Label>
            <Select value={selectedCampaign} onValueChange={handleCampaignSelect}>
              <SelectTrigger><SelectValue placeholder="Select a campaign…" /></SelectTrigger>
              <SelectContent className="bg-card">
                {seedCampaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Base URL</Label>
            <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://terrisage.com/demo" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'utm_source *', value: utmSource, setter: setUtmSource },
              { label: 'utm_medium *', value: utmMedium, setter: setUtmMedium },
              { label: 'utm_campaign *', value: utmCampaign, setter: setUtmCampaign },
              { label: 'utm_content', value: utmContent, setter: setUtmContent },
              { label: 'utm_term', value: utmTerm, setter: setUtmTerm },
            ].map(field => (
              <div key={field.label}>
                <Label className="text-xs">{field.label}</Label>
                <Input
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  className={!validate(field.value) ? 'border-destructive' : ''}
                />
                {!validate(field.value) && (
                  <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />Lowercase, no spaces
                  </p>
                )}
              </div>
            ))}
          </div>
          {generatedUrl && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Generated URL</p>
              <p className="text-xs font-mono text-foreground break-all">{generatedUrl}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={!generatedUrl || hasError}>
              <Plus className="h-4 w-4 mr-1" />Save UTM Link
            </Button>
            {generatedUrl && (
              <Button variant="outline" onClick={() => copyToClipboard(generatedUrl)}>
                <Copy className="h-4 w-4 mr-1" />Copy URL
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saved UTM Links */}
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Saved UTM Links</h3>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Campaign</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead>Campaign Tag</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map(b => (
                <TableRow key={b.utm_id}>
                  <TableCell className="text-xs text-muted-foreground">{seedCampaigns.find(c => c.campaign_id === b.campaign_id)?.campaign_name || b.campaign_id}</TableCell>
                  <TableCell className="text-xs font-mono">{b.utm_source}</TableCell>
                  <TableCell className="text-xs font-mono">{b.utm_medium}</TableCell>
                  <TableCell className="text-xs font-mono">{b.utm_campaign}</TableCell>
                  <TableCell className="text-xs font-mono">{b.utm_content || '—'}</TableCell>
                  <TableCell className="text-xs font-mono text-primary">{b.short_token}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(b.generated_url)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {bundles.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No UTM links generated yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
