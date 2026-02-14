import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  seedAccounts, seedNotes, seedTickets, seedDocuments, seedIngestionJobs,
  getCalendarEventsForEntity, getNextUpcomingEvent, seedCalendarEvents, getUserName,
} from '@/data/seedData';
import {
  EntityType, VerificationStatus, AccountStatus, CalendarEventStatus,
  TicketPriority, TicketStatus, ImportType, IngestionStatus, TenancyType,
} from '@/types/core';
import type { ChecklistItem, Account } from '@/types/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { format } from 'date-fns';
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Shield, ShieldCheck, ShieldX, ShieldAlert,
  Upload, FileSpreadsheet, ArrowRight, Plus, ExternalLink, Wifi, WifiOff,
  CalendarIcon, Ticket,
} from 'lucide-react';

const statusColors: Record<AccountStatus, string> = {
  [AccountStatus.LIVE]: 'bg-success/15 text-success',
  [AccountStatus.ONBOARDING_IN_PROGRESS]: 'bg-primary/15 text-primary',
  [AccountStatus.STALLED_ONBOARDING]: 'bg-destructive/15 text-destructive',
  [AccountStatus.DEACTIVATED]: 'bg-muted text-muted-foreground',
};

const verificationColors: Record<VerificationStatus, string> = {
  [VerificationStatus.NOT_STARTED]: 'bg-muted text-muted-foreground',
  [VerificationStatus.PENDING]: 'bg-warning/15 text-warning',
  [VerificationStatus.VERIFIED]: 'bg-success/15 text-success',
  [VerificationStatus.FAILED]: 'bg-destructive/15 text-destructive',
};

const verificationIcons: Record<VerificationStatus, React.ReactNode> = {
  [VerificationStatus.NOT_STARTED]: <Shield className="h-5 w-5 text-muted-foreground" />,
  [VerificationStatus.PENDING]: <ShieldAlert className="h-5 w-5 text-warning" />,
  [VerificationStatus.VERIFIED]: <ShieldCheck className="h-5 w-5 text-success" />,
  [VerificationStatus.FAILED]: <ShieldX className="h-5 w-5 text-destructive" />,
};

const ticketPriorityColors: Record<TicketPriority, string> = {
  [TicketPriority.P1]: 'bg-destructive/15 text-destructive',
  [TicketPriority.P2]: 'bg-warning/15 text-warning',
  [TicketPriority.P3]: 'bg-primary/15 text-primary',
  [TicketPriority.P4]: 'bg-muted text-muted-foreground',
};

const ticketStatusColors: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-primary/15 text-primary',
  [TicketStatus.PENDING_INTERNAL]: 'bg-info/15 text-info',
  [TicketStatus.PENDING_CUSTOMER]: 'bg-warning/15 text-warning',
  [TicketStatus.RESOLVED]: 'bg-success/15 text-success',
  [TicketStatus.CLOSED]: 'bg-muted text-muted-foreground',
};

const ingestionStatusColors: Record<IngestionStatus, string> = {
  [IngestionStatus.COMPLETED]: 'bg-success/15 text-success',
  [IngestionStatus.IN_PROGRESS]: 'bg-warning/15 text-warning',
  [IngestionStatus.FAILED]: 'bg-destructive/15 text-destructive',
};

// ── Data Ingestion Wizard ──────────────────────
function DataIngestionWizard({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [importType, setImportType] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const steps = ['Select Type', 'Upload File', 'Map Columns', 'Review', 'Run'];

  const defaultMappings: Record<string, string[]> = {
    [ImportType.LEADS]: ['Name', 'Phone', 'Email', 'City', 'Source'],
    [ImportType.PROJECTS]: ['Project Name', 'City', 'Total Units', 'Builder'],
    [ImportType.SECONDARY_LISTINGS]: ['Property', 'Area', 'Price', 'Owner'],
    [ImportType.ENQUIRIES]: ['Company', 'Contact', 'Phone', 'Source'],
  };

  const handleSimulateUpload = () => {
    setFileName(`${importType.toLowerCase()}_import_${Date.now()}.csv`);
    setStep(2);
  };

  const handleRunImport = () => {
    seedIngestionJobs.push({
      job_id: `JOB${Date.now()}`,
      account_id: accountId,
      import_type: importType as ImportType,
      file_names: [fileName],
      mapping_config: mapping,
      status: IngestionStatus.COMPLETED,
      imported_count: Math.floor(Math.random() * 200) + 50,
      error_count: Math.floor(Math.random() * 5),
      duplicate_count: Math.floor(Math.random() * 10),
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    setStep(4);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>New Data Import</span>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </CardTitle>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              <span className="text-xs text-muted-foreground hidden sm:inline">{s}</span>
              {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 && (
          <div className="space-y-3">
            <Label>Import Type</Label>
            <Select value={importType} onValueChange={setImportType}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {Object.values(ImportType).map(t => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setStep(1)} disabled={!importType}>Next</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="border border-dashed border-muted-foreground/30 rounded-md p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Drag & drop CSV/XLSX or click to browse</p>
              <Button size="sm" onClick={handleSimulateUpload}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Simulate File Upload
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm">File: <span className="font-medium">{fileName}</span></p>
            <Label>Column Mapping</Label>
            <div className="space-y-2">
              {(defaultMappings[importType] || []).map(col => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-sm w-32">{col}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder={`Map to ${col.toLowerCase()}...`}
                    defaultValue={col}
                    className="flex-1"
                    onChange={e => setMapping(prev => ({ ...prev, [col]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <Button onClick={() => setStep(3)}>Next — Review</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Type: </span>{importType.replace(/_/g, ' ')}</div>
              <div><span className="text-muted-foreground">File: </span>{fileName}</div>
              <div><span className="text-muted-foreground">Columns: </span>{(defaultMappings[importType] || []).join(', ')}</div>
            </div>
            <Button onClick={handleRunImport}>Run Import</Button>
          </div>
        )}

        {step === 4 && (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="text-sm font-medium">Import completed!</p>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────
export default function AccountDetail() {
  const { accountId } = useParams();
  const account = seedAccounts.find(a => a.account_id === accountId);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(account?.onboarding_checklist ?? []);
  const [panStatus, setPanStatus] = useState(account?.verification_pan_status ?? VerificationStatus.NOT_STARTED);
  const [idStatus, setIdStatus] = useState(account?.verification_identity_status ?? VerificationStatus.NOT_STARTED);
  const [accountStatus, setAccountStatus] = useState(account?.status ?? AccountStatus.ONBOARDING_IN_PROGRESS);
  const [integrations, setIntegrations] = useState(account?.integrations ?? {});
  const [showIngestionWizard, setShowIngestionWizard] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  if (!account) {
    return <div className="p-6 text-center text-muted-foreground">Account not found</div>;
  }

  const notes = seedNotes.filter(n => n.entity_type === EntityType.ACCOUNT && n.entity_id === account.account_id);
  const events = getCalendarEventsForEntity(EntityType.ACCOUNT, account.account_id);
  const nextEvent = getNextUpcomingEvent(EntityType.ACCOUNT, account.account_id);
  const tickets = seedTickets.filter(t => t.linked_entity_id === account.account_id);
  const documents = seedDocuments.filter(d => d.entity_id === account.account_id);
  const jobs = seedIngestionJobs.filter(j => j.account_id === account.account_id);
  const completedCount = checklist.filter(c => c.completed).length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? {
        ...item,
        completed: !item.completed,
        completed_at: !item.completed ? new Date().toISOString() : null,
        completed_by_user_id: !item.completed ? 'U001' : null,
      } : item
    ));
  };

  const handleAddNote = (text: string) => {
    seedNotes.push({
      note_id: `N${Date.now()}`,
      entity_type: EntityType.ACCOUNT,
      entity_id: account.account_id,
      note_text: text,
      created_by_user_id: 'U001',
      created_at: new Date().toISOString(),
    });
  };

  const handleCreateEvent = (data: { title: string; date: Date; time: string; notes: string }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    seedCalendarEvents.push({
      event_id: `CE${Date.now()}`,
      entity_type: EntityType.ACCOUNT,
      entity_id: account.account_id,
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      created_by_user_id: 'U001',
      notes: data.notes || undefined,
      status: CalendarEventStatus.UPCOMING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setShowEventForm(false);
  };

  const handleDocUpload = (fileName: string) => {
    seedDocuments.push({
      document_id: `DOC${Date.now()}`,
      entity_type: EntityType.ACCOUNT,
      entity_id: account.account_id,
      folder_path: '/Uploads',
      file_name: fileName,
      file_url: '#',
      uploaded_by_user_id: 'U001',
      created_at: new Date().toISOString(),
    });
  };

  const toggleIntegration = (key: 'meta' | 'google' | 'website') => {
    setIntegrations(prev => ({
      ...prev,
      [key]: {
        connected: !prev[key]?.connected,
        last_sync: new Date().toISOString(),
      },
    }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{account.account_name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{account.city}</span><span>•</span>
            <span>{account.tenancy_type === 'AGENCY_BROKERAGE_CONSULTANCY' ? 'Agency' : 'Builder'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={accountStatus} onValueChange={(v) => setAccountStatus(v as AccountStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AccountStatus).map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className={verificationColors[panStatus]}>PAN: {panStatus.replace(/_/g, ' ')}</Badge>
          <Badge className={verificationColors[idStatus]}>ID: {idStatus.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      {/* Next Action */}
      {nextEvent && (
        <Card className="border-primary/30">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Next Action:</span>
            <span className="text-sm">{nextEvent.title}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(nextEvent.scheduled_at), 'dd MMM yyyy, HH:mm')}</span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="ingestion">Data Ingestion</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="documents">Docs ({documents.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar ({events.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
        </TabsList>

        {/* 1. Overview — Rich Account Summary */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Account Summary Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {account.account_overview_text ? (
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{account.account_overview_text}</p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic mb-4">No description added yet.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium sm:ml-0 sm:block">{account.owner_name}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium sm:ml-0 sm:block">{account.owner_phone}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium sm:ml-0 sm:block">{account.owner_email}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span className="font-medium sm:ml-0 sm:block">{account.whatsapp_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Tenancy Type</span>
                  <span className="font-medium sm:ml-0 sm:block">{account.tenancy_type === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency / Brokerage' : 'Builder / Developer'}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">City</span>
                  <span className="font-medium sm:ml-0 sm:block">{account.city}</span>
                </div>
                {(account.overview_fields as Record<string, unknown>).team_size && (
                  <div className="flex justify-between sm:block">
                    <span className="text-muted-foreground">Team Size</span>
                    <span className="font-medium sm:ml-0 sm:block">{String((account.overview_fields as Record<string, unknown>).team_size)}</span>
                  </div>
                )}
                {(account.overview_fields as Record<string, unknown>).focus && (
                  <div className="flex justify-between sm:block">
                    <span className="text-muted-foreground">Focus Area</span>
                    <span className="font-medium sm:ml-0 sm:block">{String((account.overview_fields as Record<string, unknown>).focus)}</span>
                  </div>
                )}
                {(account.overview_fields as Record<string, unknown>).current_system && (
                  <div className="flex justify-between sm:block">
                    <span className="text-muted-foreground">Current System</span>
                    <span className="font-medium sm:ml-0 sm:block">{String((account.overview_fields as Record<string, unknown>).current_system)}</span>
                  </div>
                )}
                {(account.overview_fields as Record<string, unknown>).approx_onboarding_date && (
                  <div className="flex justify-between sm:block">
                    <span className="text-muted-foreground">Onboarding Date</span>
                    <span className="font-medium sm:ml-0 sm:block">{String((account.overview_fields as Record<string, unknown>).approx_onboarding_date)}</span>
                  </div>
                )}
                {Array.isArray((account.overview_fields as Record<string, unknown>).portals) && ((account.overview_fields as Record<string, unknown>).portals as string[]).length > 0 && (
                  <div className="flex justify-between sm:block">
                    <span className="text-muted-foreground">Portals in Use</span>
                    <span className="font-medium sm:ml-0 sm:block">{((account.overview_fields as Record<string, unknown>).portals as string[]).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between sm:block">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium sm:ml-0 sm:block">{format(new Date(account.created_at), 'dd MMM yyyy')}</span>
                </div>
                {account.created_from_enquiry_id && (
                  <div className="flex justify-between sm:block">
                    <span className="text-muted-foreground">From Enquiry</span>
                    <Link to={`/enquiries/${account.created_from_enquiry_id}`} className="text-primary hover:underline font-medium sm:block">
                      {account.created_from_enquiry_id}
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{progress}%</div>
                <div className="text-xs text-muted-foreground mt-1">Onboarding</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{tickets.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Tickets</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{jobs.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Imports</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{documents.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Documents</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Onboarding */}
        <TabsContent value="onboarding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Onboarding Checklist</span>
                <span className="text-sm font-normal text-muted-foreground">{completedCount}/{checklist.length} completed</span>
              </CardTitle>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {checklist.map(item => (
                  <button
                    key={item.id}
                    className="flex items-center gap-3 w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors"
                    onClick={() => toggleChecklistItem(item.id)}
                  >
                    {item.completed
                      ? <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      : <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    }
                    <span className={item.completed ? 'text-foreground line-through' : 'text-foreground'}>{item.label}</span>
                    {item.completed_at && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(item.completed_at), 'dd MMM')} • {getUserName(item.completed_by_user_id)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Verification */}
        <TabsContent value="verification" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">{verificationIcons[panStatus]} PAN Verification</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Badge className={verificationColors[panStatus]}>{panStatus.replace(/_/g, ' ')}</Badge>
                <div>
                  <Label className="text-sm">Update Status</Label>
                  <Select value={panStatus} onValueChange={(v) => setPanStatus(v as VerificationStatus)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(VerificationStatus).map(s => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2">{verificationIcons[idStatus]} Identity Verification</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Badge className={verificationColors[idStatus]}>{idStatus.replace(/_/g, ' ')}</Badge>
                <div>
                  <Label className="text-sm">Update Status</Label>
                  <Select value={idStatus} onValueChange={(v) => setIdStatus(v as VerificationStatus)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(VerificationStatus).map(s => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 4. Data Ingestion */}
        <TabsContent value="ingestion" className="mt-4 space-y-4">
          {!showIngestionWizard && (
            <Button onClick={() => setShowIngestionWizard(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Import
            </Button>
          )}
          {showIngestionWizard && (
            <DataIngestionWizard accountId={account.account_id} onClose={() => setShowIngestionWizard(false)} />
          )}

          {/* Job history */}
          <Card>
            <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No imports yet.</p>
              ) : (
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div key={job.job_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md text-sm">
                      <div className="space-y-0.5">
                        <div className="font-medium flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          {job.import_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.file_names.join(', ')} • {format(new Date(job.created_at), 'dd MMM yyyy')}
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <Badge className={ingestionStatusColors[job.status]}>{job.status}</Badge>
                        {job.status === IngestionStatus.COMPLETED && (
                          <div className="text-xs text-muted-foreground">
                            {job.imported_count} imported • {job.error_count} errors • {job.duplicate_count} dupes
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Integrations */}
        <TabsContent value="integrations" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {(['meta', 'google', 'website'] as const).map(key => {
              const connected = integrations[key]?.connected ?? false;
              const lastSync = (integrations[key] as { connected: boolean; last_sync?: string })?.last_sync;
              const labels = { meta: 'Meta (Facebook/Instagram)', google: 'Google Ads', website: 'Website Widget' };
              return (
                <Card key={key}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{labels[key]}</span>
                      {connected ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <Badge className={connected ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>
                      {connected ? 'Connected' : 'Not Connected'}
                    </Badge>
                    {lastSync && connected && (
                      <p className="text-xs text-muted-foreground">Last sync: {format(new Date(lastSync), 'dd MMM, HH:mm')}</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => toggleIntegration(key)}>
                      {connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 6. Notes */}
        <TabsContent value="notes" className="mt-4">
          <NotesPanel notes={notes} onAddNote={handleAddNote} />
        </TabsContent>

        {/* 7. Documents */}
        <TabsContent value="documents" className="mt-4">
          <AttachmentUploader
            attachments={documents.map(d => ({ file_name: d.file_name, file_url: d.file_url }))}
            onUpload={handleDocUpload}
          />
          {/* Folder grouping */}
          {documents.length > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">By Folder</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(
                  documents.reduce((acc, d) => {
                    (acc[d.folder_path] = acc[d.folder_path] || []).push(d);
                    return acc;
                  }, {} as Record<string, typeof documents>)
                ).map(([folder, docs]) => (
                  <div key={folder} className="mb-3">
                    <p className="text-sm font-medium text-muted-foreground mb-1">{folder}</p>
                    {docs.map(d => (
                      <div key={d.document_id} className="flex items-center gap-2 text-sm p-1.5 pl-4">
                        <FileSpreadsheet className="h-3 w-3 text-muted-foreground" />
                        <span>{d.file_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{format(new Date(d.created_at), 'dd MMM yyyy')}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 8. Calendar */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          {!showEventForm && (
            <Button onClick={() => setShowEventForm(true)}>
              <CalendarIcon className="h-4 w-4 mr-1" /> Schedule Event
            </Button>
          )}
          {showEventForm && (
            <Card>
              <CardContent className="p-4">
                <CalendarEventForm
                  onSubmit={handleCreateEvent}
                  onCancel={() => setShowEventForm(false)}
                  defaultTitle={`Follow-up — ${account.account_name}`}
                />
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {events.length === 0 && !showEventForm && (
              <p className="text-sm text-muted-foreground">No calendar events.</p>
            )}
            {[...events].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).map(e => (
              <Card key={e.event_id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.scheduled_at), 'dd MMM yyyy, HH:mm')} • {getUserName(e.created_by_user_id)}
                    </p>
                  </div>
                  <Badge variant="outline" className={
                    e.status === CalendarEventStatus.UPCOMING ? 'border-primary text-primary' :
                    e.status === CalendarEventStatus.COMPLETED ? 'border-success text-success' :
                    'border-muted-foreground text-muted-foreground'
                  }>{e.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 9. Tickets */}
        <TabsContent value="tickets" className="mt-4 space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked tickets.</p>
          ) : (
            tickets.map(t => (
              <Link key={t.ticket_id} to={`/tickets`}>
                <Card className="hover:bg-muted/50 transition-colors mb-3">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{t.subject}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{getUserName(t.assigned_to_user_id)}</span>
                          <span>•</span>
                          <span>{format(new Date(t.updated_at), 'dd MMM yyyy')}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Badge className={ticketPriorityColors[t.priority]}>{t.priority}</Badge>
                        <Badge className={ticketStatusColors[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
