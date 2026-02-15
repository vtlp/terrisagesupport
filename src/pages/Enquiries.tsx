import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { seedEnquiries, seedCalendarEvents, seedNotes, getUserName } from '@/data/seedData';
import { EnquiryStage, EnquirySource, EnquiryOutcome, TenancyType, CalendarEventStatus, EntityType } from '@/types/core';
import { CreateEnquiryDialog } from '@/components/shared/CreateEnquiryDialog';
import { format, isToday } from 'date-fns';

const stageColors: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'bg-muted text-muted-foreground',
  [EnquiryStage.CONTACTED]: 'bg-info/15 text-info',
  [EnquiryStage.DEMO_SCHEDULED]: 'bg-primary/15 text-primary',
  [EnquiryStage.DEMO_COMPLETED]: 'bg-accent/20 text-accent-foreground',
  [EnquiryStage.ACCOUNT_CREATED]: 'bg-success/15 text-success',
};

const stageLabels: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'New',
  [EnquiryStage.CONTACTED]: 'Contacted',
  [EnquiryStage.DEMO_SCHEDULED]: 'Demo Scheduled',
  [EnquiryStage.DEMO_COMPLETED]: 'Demo Completed',
  [EnquiryStage.ACCOUNT_CREATED]: 'Account Created',
};

const sourceLabels: Record<EnquirySource, string> = {
  [EnquirySource.CALL_DIRECT]: 'Direct Call',
  [EnquirySource.LANDING_PAGE]: 'Landing Page',
  [EnquirySource.META_ADS]: 'Meta Ads',
  [EnquirySource.CHAMPION_PARTNER]: 'Champion Partner',
  [EnquirySource.CP_REQUEST_PROJECTS]: 'CP Request',
};

const outcomeLabels: Record<EnquiryOutcome, string> = {
  [EnquiryOutcome.INTERESTED]: 'Interested',
  [EnquiryOutcome.CALL_LATER]: 'Call Later',
  [EnquiryOutcome.SCHEDULE_DEMO]: 'Schedule Demo',
  [EnquiryOutcome.NOT_INTERESTED]: 'Not Interested',
  [EnquiryOutcome.WRONG_OR_BOUNCED_NUMBER]: 'Wrong Number',
};

export default function Enquiries() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [tenancyFilter, setTenancyFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  // Read URL query params for pre-filtering
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'follow_up_needed') {
      setStageFilter(EnquiryStage.NEW_ENQUIRY);
    }
  }, [searchParams]);

  // Counters
  const total = seedEnquiries.length;
  const newToday = seedEnquiries.filter(e => isToday(new Date(e.created_at))).length;
  const contacted = seedEnquiries.filter(e => e.stage !== EnquiryStage.NEW_ENQUIRY).length;
  const converted = seedEnquiries.filter(e => e.stage === EnquiryStage.ACCOUNT_CREATED).length;
  const followUpNeeded = seedEnquiries.filter(e =>
    seedCalendarEvents.some(ce =>
      ce.entity_type === EntityType.ENQUIRY && ce.entity_id === e.enquiry_id && ce.status === CalendarEventStatus.UPCOMING
    )
  ).length;
  const notContacted = seedEnquiries.filter(e => e.stage === EnquiryStage.NEW_ENQUIRY).length;

  const filtered = seedEnquiries.filter(e => {
    const matchSearch = e.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      e.city.toLowerCase().includes(search.toLowerCase()) ||
      e.contact_phone.includes(search) ||
      e.company_name.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || e.stage === stageFilter;
    const matchTenancy = tenancyFilter === 'all' || e.tenancy_type === tenancyFilter;
    const matchSource = sourceFilter === 'all' || e.source === sourceFilter;
    const matchOutcome = outcomeFilter === 'all' || e.outcome === outcomeFilter;
    return matchSearch && matchStage && matchTenancy && matchSource && matchOutcome;
  });

  const getNextAction = (enquiryId: string) => {
    const event = seedCalendarEvents
      .filter(ce => ce.entity_type === EntityType.ENQUIRY && ce.entity_id === enquiryId && ce.status === CalendarEventStatus.UPCOMING)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
    return event;
  };

  const getNotesPreview = (noteIds: string[]) => {
    const notes = seedNotes.filter(n => noteIds.includes(n.note_id));
    if (notes.length === 0) return '—';
    return notes[notes.length - 1].note_text.slice(0, 80) + (notes[notes.length - 1].note_text.length > 80 ? '...' : '');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Enquiry Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Capture and convert leads into accounts</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Enquiry
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: total },
          { label: 'New Today', value: newToday },
          { label: 'Contacted', value: contacted },
          { label: 'Converted', value: converted, color: 'text-primary' },
          { label: 'Follow-up', value: followUpNeeded, color: 'text-warning' },
          { label: 'Not Contacted', value: notContacted, color: 'text-destructive' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-xl font-bold ${c.color ?? ''}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, city, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.values(EnquiryStage).map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tenancyFilter} onValueChange={setTenancyFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tenancy" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={TenancyType.AGENCY_BROKERAGE_CONSULTANCY}>Agency/Brokerage</SelectItem>
            <SelectItem value={TenancyType.BUILDER_DEVELOPER}>Builder/Developer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.values(EnquirySource).map(s => <SelectItem key={s} value={s}>{sourceLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {Object.values(EnquiryOutcome).map(o => <SelectItem key={o} value={o}>{outcomeLabels[o]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Next Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => {
                const nextAction = getNextAction(e.enquiry_id);
                return (
                  <TableRow key={e.enquiry_id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
                    <TableCell className="font-mono text-xs">{e.enquiry_id}</TableCell>
                    <TableCell className="font-medium">{e.contact_name}</TableCell>
                    <TableCell className="text-sm">{e.contact_phone}</TableCell>
                    <TableCell>{e.city}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sourceLabels[e.source]}</TableCell>
                    <TableCell><Badge className={stageColors[e.stage]}>{stageLabels[e.stage]}</Badge></TableCell>
                    <TableCell className="text-sm">{e.outcome ? outcomeLabels[e.outcome] : '—'}</TableCell>
                    <TableCell className="text-sm">{getUserName(e.assigned_to_user_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{getNotesPreview(e.notes_thread)}</TableCell>
                    <TableCell className="text-sm">
                      {nextAction ? (
                        <div>
                          <div className="text-xs">{nextAction.title}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(nextAction.scheduled_at), 'dd MMM, HH:mm')}</div>
                        </div>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(e => {
          const nextAction = getNextAction(e.enquiry_id);
          return (
            <Card key={e.enquiry_id} className="cursor-pointer" onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{e.contact_name}</div>
                    <div className="text-sm text-muted-foreground">{e.company_name}</div>
                  </div>
                  <Badge className={stageColors[e.stage]}>{stageLabels[e.stage]}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                  <span>{e.contact_phone}</span><span>•</span><span>{e.city}</span><span>•</span><span>{sourceLabels[e.source]}</span>
                </div>
                {e.outcome && <div className="text-xs mb-1">Outcome: {outcomeLabels[e.outcome]}</div>}
                {nextAction && (
                  <div className="text-xs bg-muted/50 rounded p-2">
                    Next: {nextAction.title} — {format(new Date(nextAction.scheduled_at), 'dd MMM')}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <CreateEnquiryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(enquiry) => {
          seedEnquiries.unshift(enquiry);
        }}
      />
    </div>
  );
}
