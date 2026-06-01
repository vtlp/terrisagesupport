import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateEnquiryDialog } from '@/components/shared/CreateEnquiryDialog';

type Stage = 'NEW_ENQUIRY' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'DEMO_COMPLETED' | 'PAYMENT_LINK_SENT' | 'ONBOARDING_PACK_SENT' | 'ACCOUNT_CREATED' | 'LOST';
type Tenancy = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';

interface EnquiryRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  company_name: string | null;
  tenancy_type: Tenancy | null;
  source: string | null;
  stage: Stage;
  created_at: string;
}

const stageLabels: Record<Stage, string> = {
  NEW_ENQUIRY: 'New', CONTACTED: 'Contacted', DEMO_SCHEDULED: 'Demo Scheduled',
  DEMO_COMPLETED: 'Demo Completed', PAYMENT_LINK_SENT: 'Payment',
  ONBOARDING_PACK_SENT: 'Pack Sent',
  ACCOUNT_CREATED: 'Account Created', LOST: 'Lost',
};
const stageColors: Record<Stage, string> = {
  NEW_ENQUIRY: 'bg-muted text-muted-foreground',
  CONTACTED: 'bg-info/15 text-info',
  DEMO_SCHEDULED: 'bg-primary/15 text-primary',
  DEMO_COMPLETED: 'bg-accent/20 text-accent-foreground',
  PAYMENT_LINK_SENT: 'bg-warning/15 text-warning',
  ONBOARDING_PACK_SENT: 'bg-warning/15 text-warning',
  ACCOUNT_CREATED: 'bg-success/15 text-success',
  LOST: 'bg-destructive/15 text-destructive',
};

type SourceKind = 'terrisage_website' | 'terrisage_mobile' | 'other';
const classifySource = (source: string | null): SourceKind => {
  const s = (source ?? '').toLowerCase();
  if (s.includes('terrisage') && s.includes('mobile')) return 'terrisage_mobile';
  if (s === 'landing page' || s.includes('terrisage')) return 'terrisage_website';
  return 'other';
};
const getSourceBadge = (source: string | null): { label: string; cls: string } => {
  const kind = classifySource(source);
  if (kind === 'terrisage_website') return { label: 'Landing Page', cls: 'bg-primary/15 text-primary border-primary/20' };
  if (kind === 'terrisage_mobile') return { label: 'Terrisage Mobile', cls: 'bg-info/15 text-info border-info/20' };
  const label = (source ?? '').trim() || 'Unknown';
  return { label, cls: 'bg-muted text-muted-foreground border-border' };
};

const LAST_SEEN_KEY = 'enquiries:lastSeenAt';

export default function Enquiries() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EnquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [tenancyFilter, setTenancyFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | SourceKind | 'terrisage'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const lastSeenAtRef = useRef<Date>(
    new Date(localStorage.getItem(LAST_SEEN_KEY) ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('enquiries')
      .select('id, full_name, phone, email, city, company_name, tenancy_type, source, stage, created_at')
      .order('created_at', { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows((data ?? []) as EnquiryRow[]);
    setLoading(false);
  }, []);

  const syncFromTerrisage = useCallback(async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('terrisage-show-interests-pull', { body: {} });
    setSyncing(false);
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error ?? 'Sync failed');
      return;
    }
    setLastSyncAt(new Date());
    const { fetched = 0, inserted = 0, duplicates = 0 } = data as { fetched: number; inserted: number; duplicates: number };
    toast.success(`Synced ${fetched} leads — ${inserted} new, ${duplicates} already imported`);
    load();
  }, [load]);

  useEffect(() => {
    load();
    syncFromTerrisage();
    // Mark "seen" when leaving the page so the NEW badge resets next visit
    return () => { localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()); };
  }, [load, syncFromTerrisage]);

  const filtered = rows.filter(r => {
    const term = search.toLowerCase();
    const matchSearch = !term || r.full_name.toLowerCase().includes(term)
      || (r.city ?? '').toLowerCase().includes(term)
      || r.phone.includes(search)
      || (r.company_name ?? '').toLowerCase().includes(term);
    const matchStage = stageFilter === 'all' || r.stage === stageFilter;
    const matchTen = tenancyFilter === 'all' || r.tenancy_type === tenancyFilter;
    const kind = classifySource(r.source);
    const matchSource = sourceFilter === 'all'
      || (sourceFilter === 'terrisage' ? kind !== 'other' : kind === sourceFilter);
    return matchSearch && matchStage && matchTen && matchSource;
  });

  const total = rows.length;
  const terrisageCount = useMemo(() => rows.filter(r => classifySource(r.source) !== 'other').length, [rows]);
  const manualCount = total - terrisageCount;
  const newSinceLastVisit = useMemo(
    () => rows.filter(r => classifySource(r.source) !== 'other' && new Date(r.created_at) > lastSeenAtRef.current).length,
    [rows],
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Enquiry Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture and convert leads into accounts
            {lastSyncAt && <span className="ml-2">· Last Terrisage sync {formatDistanceToNow(lastSyncAt, { addSuffix: true })}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncFromTerrisage} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync from Terrisage
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Enquiry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total },
          { label: 'From Terrisage', value: terrisageCount, color: 'text-primary' },
          { label: 'Other sources', value: manualCount },
          { label: 'New since last visit', value: newSinceLastVisit, color: newSinceLastVisit > 0 ? 'text-success' : '' },
        ].map(c => (
          <Card key={c.label}><CardContent className="p-3 text-center">
            <div className={`text-xl font-bold ${c.color ?? ''}`}>{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, city, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="other">Other (WhatsApp, Referral, etc.)</SelectItem>
            <SelectItem value="terrisage">All Terrisage</SelectItem>
            <SelectItem value="terrisage_website">Terrisage Web - Landing Page</SelectItem>
            <SelectItem value="terrisage_mobile">Terrisage Mobile</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {(Object.keys(stageLabels) as Stage[]).map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tenancyFilter} onValueChange={setTenancyFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="AGENCY_BROKERAGE_CONSULTANCY">Agency / Brokerage</SelectItem>
            <SelectItem value="BUILDER_DEVELOPER">Builder / Developer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No enquiries match these filters.</CardContent></Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card><Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>City</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead><TableHead>Stage</TableHead><TableHead>Created</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const kind = classifySource(r.source);
                  const badge = getSourceBadge(r.source);
                  const isNew = kind !== 'other' && new Date(r.created_at) > lastSeenAtRef.current;
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/enquiries/${r.id}`)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isNew && <Sparkles className="h-3.5 w-3.5 text-success" aria-label="New since last visit" />}
                          <span>{r.full_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{r.company_name}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.phone}</TableCell>
                      <TableCell>{r.city ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${badge.cls}`}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.tenancy_type === 'BUILDER_DEVELOPER' ? 'Builder' : 'Agency'}</TableCell>
                      <TableCell><Badge className={stageColors[r.stage]}>{stageLabels[r.stage]}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd MMM, HH:mm')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></Card>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map(r => {
              const kind = classifySource(r.source);
              const badge = getSourceBadge(r.source);
              const isNew = kind !== 'other' && new Date(r.created_at) > lastSeenAtRef.current;
              return (
                <Card key={r.id} className="cursor-pointer" onClick={() => navigate(`/enquiries/${r.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {isNew && <Sparkles className="h-3.5 w-3.5 text-success" />}
                          {r.full_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.company_name}</div>
                      </div>
                      <Badge className={stageColors[r.stage]}>{stageLabels[r.stage]}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>{badge.label}</Badge>
                      <span>{r.phone}</span><span>•</span><span>{r.city ?? '—'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <CreateEnquiryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => load()}
      />
    </div>
  );
}
