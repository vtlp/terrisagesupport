import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  seedAccounts, seedNotes, seedTickets, seedDocuments, seedIngestionJobs,
  getCalendarEventsForEntity, getNextUpcomingEvent, seedCalendarEvents, getUserName,
  seedSeatRequests, seedCRMUsage, seedChecklistTemplates, createGoLiveEvent,
} from '@/data/seedData';
import {
  EntityType, VerificationStatus, AccountStatus, CalendarEventStatus,
  TicketPriority, TicketStatus, ImportType, IngestionStatus,
  SeatRequestUrgency, TenancyType,
} from '@/types/core';
import type { ChecklistItem, Account, SeatRequest, SupportTicket, KBChecklistTemplate, AccountChecklistInstance } from '@/types/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Shield, ShieldCheck, ShieldX, ShieldAlert,
  Upload, FileSpreadsheet, ArrowRight, Plus, ExternalLink, Wifi, WifiOff,
  CalendarIcon, Ticket, Download, UserPlus, RefreshCw, Info,
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
  [TicketPriority.LOW]: 'bg-muted text-muted-foreground',
  [TicketPriority.MEDIUM]: 'bg-primary/15 text-primary',
  [TicketPriority.HIGH]: 'bg-warning/15 text-warning',
  [TicketPriority.URGENT]: 'bg-destructive/15 text-destructive',
};

const ticketStatusColors: Record<TicketStatus, string> = {
  [TicketStatus.NEW]: 'bg-primary/15 text-primary',
  [TicketStatus.IN_PROGRESS]: 'bg-warning/15 text-warning',
  [TicketStatus.WAITING_ON_CLIENT]: 'bg-muted text-muted-foreground',
  [TicketStatus.RESOLVED]: 'bg-success/15 text-success',
  [TicketStatus.CLOSED]: 'bg-muted text-muted-foreground',
};

const ingestionStatusColors: Record<IngestionStatus, string> = {
  [IngestionStatus.COMPLETED]: 'bg-success/15 text-success',
  [IngestionStatus.IN_PROGRESS]: 'bg-warning/15 text-warning',
  [IngestionStatus.FAILED]: 'bg-destructive/15 text-destructive',
};

// ── Tenancy-Aware Data Ingestion Wizard ──────────
function DataIngestionWizard({ accountId, tenancyType, onClose }: { accountId: string; tenancyType: TenancyType; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [importType, setImportType] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [depthConfirmed, setDepthConfirmed] = useState(false);

  const isBuilder = tenancyType === TenancyType.BUILDER_DEVELOPER;

  const steps = importType === ImportType.PROJECTS
    ? ['Select Type', 'Confirm Depth', 'Upload File', 'Map Columns', 'Review', 'Run']
    : ['Select Type', 'Upload File', 'Map Columns', 'Review', 'Run'];

  // Tenancy-aware mappings
  const builderProjectMappings = [
    { field: 'Project Name', required: true },
    { field: 'City', required: true },
    { field: 'RERA Number', required: false },
    { field: 'Tower/Block', required: true },
    { field: 'Floor', required: true },
    { field: 'Unit Number', required: true },
    { field: 'Configuration', required: false },
    { field: 'Unit Status', required: true },
    { field: 'Pricing', required: false },
    { field: 'Availability', required: true },
  ];

  const agencyProjectMappings = [
    { field: 'Project Name', required: true },
    { field: 'City', required: true },
    { field: 'Locality', required: false },
    { field: 'Builder Name', required: false },
    { field: 'Configuration Tags', required: false },
    { field: 'Status', required: false },
  ];

  const defaultMappings: Record<string, { field: string; required: boolean }[]> = {
    [ImportType.LEADS]: [
      { field: 'Name', required: true },
      { field: 'Phone', required: true },
      { field: 'Email', required: false },
      { field: 'City', required: true },
      { field: 'Source', required: false },
    ],
    [ImportType.PROJECTS]: isBuilder ? builderProjectMappings : agencyProjectMappings,
    [ImportType.SECONDARY_LISTINGS]: [
      { field: 'Property', required: true },
      { field: 'Area', required: true },
      { field: 'Price', required: true },
      { field: 'Owner', required: false },
      { field: 'Bedrooms', required: false },
    ],
    [ImportType.ENQUIRIES]: [
      { field: 'Company', required: true },
      { field: 'Contact', required: true },
      { field: 'Phone', required: true },
      { field: 'Source', required: false },
    ],
  };

  const currentMappingFields = defaultMappings[importType] || [];
  const requiredFields = currentMappingFields.filter(m => m.required);
  const missingRequired = requiredFields.filter(m => !mapping[m.field]?.trim());

  const handleSimulateUpload = () => {
    setFileName(`${importType.toLowerCase()}_import_${Date.now()}.csv`);
    // Pre-fill mapping defaults
    const defaults: Record<string, string> = {};
    currentMappingFields.forEach(m => { defaults[m.field] = m.field; });
    setMapping(defaults);
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
  };

  // Determine which logical step we're on for rendering
  const needsDepthStep = importType === ImportType.PROJECTS;
  const getLogicalStep = () => {
    if (!needsDepthStep && step >= 1) return step + 1; // skip depth step
    return step;
  };
  const logicalStep = getLogicalStep();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>New Data Import</span>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </CardTitle>
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
        {/* Step 0: Select Type */}
        {step === 0 && (
          <div className="space-y-3">
            <Label>Import Type</Label>
            <Select value={importType} onValueChange={v => { setImportType(v); setDepthConfirmed(false); }}>
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

        {/* Step 1 for PROJECTS: Depth confirmation */}
        {step === 1 && needsDepthStep && (
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Tenancy Type: {isBuilder ? 'Builder / Developer' : 'Agency / Broker'}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Confirm the project structure depth for this import. Required mapping fields will adjust based on tenancy type.
              </p>

              {isBuilder ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Builder project mapping depth:</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">Project</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px]">Phases / Towers</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px]">Units</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>• Inventory status mapping (available / hold / booked)</p>
                    <p>• Booking-related fields if present</p>
                    <p>• Unit configuration and pricing</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Agency project mapping (lightweight):</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>• Project reference metadata + tags</p>
                    <p>• Locality and configuration info</p>
                    <p>• No deep tower/unit structure required</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)}>Back</Button>
              <Button size="sm" onClick={() => { setDepthConfirmed(true); setStep(2); }}>
                Confirm & Continue
              </Button>
            </div>
          </div>
        )}

        {/* Upload step */}
        {((step === 1 && !needsDepthStep) || (step === 2 && needsDepthStep)) && (
          <div className="space-y-3">
            <div className="border border-dashed border-muted-foreground/30 rounded-md p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Drag & drop CSV/XLSX or click to browse</p>
              <Button size="sm" onClick={() => { handleSimulateUpload(); setStep(needsDepthStep ? 3 : 2); }}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Simulate File Upload
              </Button>
            </div>
          </div>
        )}

        {/* Mapping step */}
        {((step === 2 && !needsDepthStep) || (step === 3 && needsDepthStep)) && (
          <div className="space-y-3">
            <p className="text-sm">File: <span className="font-medium">{fileName}</span></p>
            <Label>Column Mapping</Label>
            <div className="space-y-2">
              {currentMappingFields.map(m => (
                <div key={m.field} className="flex items-center gap-3">
                  <span className="text-sm w-36 flex items-center gap-1">
                    {m.field}
                    {m.required && <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/30 text-destructive">Required</Badge>}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder={`Map to ${m.field.toLowerCase()}...`}
                    defaultValue={mapping[m.field] || m.field}
                    className="flex-1"
                    onChange={e => setMapping(prev => ({ ...prev, [m.field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Missing required fields: {missingRequired.map(m => m.field).join(', ')}
              </p>
            )}
            <Button onClick={() => setStep(needsDepthStep ? 4 : 3)} disabled={missingRequired.length > 0}>
              Next — Review
            </Button>
          </div>
        )}

        {/* Review step */}
        {((step === 3 && !needsDepthStep) || (step === 4 && needsDepthStep)) && (
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Type: </span>{importType.replace(/_/g, ' ')}</div>
              <div><span className="text-muted-foreground">Tenancy: </span>{isBuilder ? 'Builder/Developer' : 'Agency/Broker'}</div>
              <div><span className="text-muted-foreground">File: </span>{fileName}</div>
              <div><span className="text-muted-foreground">Mapped columns: </span>{Object.keys(mapping).length}</div>
            </div>
            <Button onClick={() => { handleRunImport(); setStep(needsDepthStep ? 5 : 4); }}>Run Import</Button>
          </div>
        )}

        {/* Done step */}
        {((step === 4 && !needsDepthStep) || (step === 5 && needsDepthStep)) && (
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

  // ── Checklist template sync ──
  const linkedTemplate = account?.checklist_template_id
    ? seedChecklistTemplates.find(t => t.id === account.checklist_template_id)
    : null;

  const buildChecklistFromTemplate = (tmpl: KBChecklistTemplate): AccountChecklistInstance => ({
    account_id: account?.account_id ?? '',
    template_id: tmpl.id,
    template_version: tmpl.version,
    items: tmpl.items.map(ti => ({
      item_id: ti.id,
      label: ti.label,
      status: 'not_started' as const,
      completed_at: null,
      completed_by_user_id: null,
    })),
    template_updated: false,
  });

  // Merge existing checklist items with template
  const buildInitialInstance = (): AccountChecklistInstance | null => {
    if (!linkedTemplate || !account) return null;
    const existingChecklist = account.onboarding_checklist;
    return {
      account_id: account.account_id,
      template_id: linkedTemplate.id,
      template_version: linkedTemplate.version,
      items: linkedTemplate.items.map(ti => {
        // Try to match by label from existing checklist
        const existing = existingChecklist.find(c => c.label === ti.label || c.id === ti.id);
        return {
          item_id: ti.id,
          label: ti.label,
          status: existing?.completed ? 'done' as const : 'not_started' as const,
          completed_at: existing?.completed_at ?? null,
          completed_by_user_id: existing?.completed_by_user_id ?? null,
        };
      }),
      // Simulate template_updated if versions differ
      template_updated: false,
    };
  };

  const [checklistInstance, setChecklistInstance] = useState<AccountChecklistInstance | null>(null);
  const [panStatus, setPanStatus] = useState(account?.verification_pan_status ?? VerificationStatus.NOT_STARTED);
  const [idStatus, setIdStatus] = useState(account?.verification_identity_status ?? VerificationStatus.NOT_STARTED);
  const [accountStatus, setAccountStatus] = useState(account?.status ?? AccountStatus.ONBOARDING_IN_PROGRESS);
  const [integrations, setIntegrations] = useState(account?.integrations ?? {});
  const [showIngestionWizard, setShowIngestionWizard] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showSeatRequest, setShowSeatRequest] = useState(false);
  const [seatForm, setSeatForm] = useState({ seats: 1, reason: '', urgency: SeatRequestUrgency.NORMAL, notes: '' });
  const [exportHistory, setExportHistory] = useState<{ type: string; format: string; date: string }[]>([]);

  // Initialize checklist instance
  useEffect(() => {
    if (account && linkedTemplate) {
      setChecklistInstance(buildInitialInstance());
    }
  }, [account?.account_id]);

  if (!account) {
    return <div className="p-6 text-center text-muted-foreground">Account not found</div>;
  }

  const notes = seedNotes.filter(n => n.entity_type === EntityType.ACCOUNT && n.entity_id === account.account_id);
  const events = getCalendarEventsForEntity(EntityType.ACCOUNT, account.account_id);
  const nextEvent = getNextUpcomingEvent(EntityType.ACCOUNT, account.account_id);
  const tickets = seedTickets.filter(t => t.linked_entity_id === account.account_id);
  const documents = seedDocuments.filter(d => d.entity_id === account.account_id);
  const jobs = seedIngestionJobs.filter(j => j.account_id === account.account_id);

  const completedCount = checklistInstance?.items.filter(i => i.status === 'done').length ?? 0;
  const totalItems = checklistInstance?.items.length ?? 0;
  const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const toggleChecklistItem = (itemId: string) => {
    setChecklistInstance(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.item_id === itemId ? {
            ...item,
            status: item.status === 'done' ? 'not_started' : 'done',
            completed_at: item.status !== 'done' ? new Date().toISOString() : null,
            completed_by_user_id: item.status !== 'done' ? 'U001' : null,
          } : item
        ),
      };
    });
  };

  const handleApplyTemplateUpdates = () => {
    if (!linkedTemplate || !checklistInstance) return;
    const existingItems = checklistInstance.items;
    const updatedItems = linkedTemplate.items.map(ti => {
      const existing = existingItems.find(i => i.item_id === ti.id);
      if (existing) return { ...existing, label: ti.label }; // Update label but keep status
      return { item_id: ti.id, label: ti.label, status: 'not_started' as const, completed_at: null, completed_by_user_id: null };
    });
    // Keep completed items that were removed from template (mark as archived)
    const removedItems = existingItems
      .filter(i => !linkedTemplate.items.find(ti => ti.id === i.item_id))
      .filter(i => i.status === 'done')
      .map(i => ({ ...i, status: 'archived' as 'not_started' | 'in_progress' | 'done' | 'blocked' | 'archived' }));

    setChecklistInstance({
      ...checklistInstance,
      template_version: linkedTemplate.version,
      items: [...updatedItems, ...removedItems],
      template_updated: false,
    });
    toast.success('Template updates applied. Completed items preserved.');
  };

  // ── Go-live automation ──
  const handleStatusChange = (newStatus: AccountStatus) => {
    const prevStatus = accountStatus;
    setAccountStatus(newStatus);

    if (newStatus === AccountStatus.LIVE && prevStatus !== AccountStatus.LIVE) {
      const liveDate = new Date().toISOString();
      const event = createGoLiveEvent(account.account_id, liveDate);
      if (event) {
        seedCalendarEvents.push(event);
        seedNotes.push({
          note_id: `N_GL_${Date.now()}`,
          entity_type: EntityType.ACCOUNT,
          entity_id: account.account_id,
          note_text: `🎉 Account marked as LIVE. 7-day go-live check-in scheduled for ${format(new Date(event.scheduled_at), 'dd MMM yyyy')}.`,
          created_by_user_id: 'U001',
          created_at: new Date().toISOString(),
        });
        toast.success('Account is now LIVE! 7-day check-in event created automatically.');
      } else {
        toast.info('Account marked as LIVE. Check-in event already exists.');
      }
    }
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

  // Simulate template_updated flag for demo purposes
  const templateNeedsUpdate = linkedTemplate && checklistInstance
    && checklistInstance.template_version < linkedTemplate.version;

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
          <Select value={accountStatus} onValueChange={(v) => handleStatusChange(v as AccountStatus)}>
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
          <TabsTrigger value="ingestion">Data (Import/Export)</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="documents">Docs ({documents.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar ({events.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
        </TabsList>

        {/* 1. Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Account Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Owner: </span>{account.owner_name}</div>
                <div><span className="text-muted-foreground">Phone: </span>{account.owner_phone}</div>
                <div><span className="text-muted-foreground">Email: </span>{account.owner_email}</div>
                <div><span className="text-muted-foreground">Created: </span>{format(new Date(account.created_at), 'dd MMM yyyy')}</div>
                {account.live_date && (
                  <div><span className="text-muted-foreground">Live since: </span>{format(new Date(account.live_date), 'dd MMM yyyy')}</div>
                )}
                {account.created_from_enquiry_id && (
                  <div>
                    <span className="text-muted-foreground">From Enquiry: </span>
                    <Link to={`/enquiries/${account.created_from_enquiry_id}`} className="text-primary hover:underline">
                      {account.created_from_enquiry_id}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center p-3 bg-muted/50 rounded-md">
                  <div className="text-lg font-bold">{progress}%</div>
                  <div className="text-xs text-muted-foreground">Onboarding</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-md">
                  <div className="text-lg font-bold">{tickets.length}</div>
                  <div className="text-xs text-muted-foreground">Tickets</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-md">
                  <div className="text-lg font-bold">{jobs.length}</div>
                  <div className="text-xs text-muted-foreground">Imports</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-md">
                  <div className="text-lg font-bold">{documents.length}</div>
                  <div className="text-xs text-muted-foreground">Documents</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Onboarding — Template-linked */}
        <TabsContent value="onboarding" className="mt-4 space-y-4">
          {/* Template info */}
          {linkedTemplate && (
            <Card className="border-primary/20">
              <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Template: </span>
                  <span className="font-medium">{linkedTemplate.name}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">v{linkedTemplate.version}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Source: Knowledge Base › Checklists
                </span>
              </CardContent>
            </Card>
          )}

          {/* Template updated banner */}
          {templateNeedsUpdate && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Template updated</p>
                    <p className="text-xs text-muted-foreground">
                      A newer version (v{linkedTemplate?.version}) is available. Your instance is on v{checklistInstance?.template_version}.
                      Applying will add new items and preserve completed ones.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleApplyTemplateUpdates}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Apply Updates
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Onboarding Checklist</span>
                <span className="text-sm font-normal text-muted-foreground">{completedCount}/{totalItems} completed</span>
              </CardTitle>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </CardHeader>
            <CardContent>
              {checklistInstance ? (
                <div className="space-y-2">
                  {checklistInstance.items.map(item => {
                    const templateItem = linkedTemplate?.items.find(ti => ti.id === item.item_id);
                    const isDone = item.status === 'done';
                    const isArchived = item.status === 'archived';

                    return (
                      <div key={item.item_id} className={`flex items-start gap-3 p-2 rounded-md transition-colors ${isArchived ? 'opacity-50' : 'hover:bg-muted/50'}`}>
                        <button
                          className="mt-0.5 flex-shrink-0"
                          onClick={() => !isArchived && toggleChecklistItem(item.item_id)}
                          disabled={isArchived}
                        >
                          {isDone
                            ? <CheckCircle2 className="h-5 w-5 text-primary" />
                            : isArchived
                              ? <Circle className="h-5 w-5 text-muted-foreground/50" />
                              : <Circle className="h-5 w-5 text-muted-foreground" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${isDone ? 'line-through text-muted-foreground' : isArchived ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                            {item.label}
                          </span>
                          {isArchived && <Badge variant="outline" className="ml-2 text-[9px]">Archived</Badge>}
                          {templateItem?.guidance_text && (
                            <p className="text-xs text-muted-foreground mt-0.5">{templateItem.guidance_text}</p>
                          )}
                        </div>
                        {item.completed_at && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(item.completed_at), 'dd MMM')} • {getUserName(item.completed_by_user_id)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No checklist template linked to this account.</p>
                  <p className="text-xs mt-1">Assign a template from Knowledge Base › Checklists.</p>
                </div>
              )}
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

        {/* 4. Data (Import/Export) — merged tab */}
        <TabsContent value="ingestion" className="mt-4 space-y-4">
          {/* Import section */}
          <h3 className="text-sm font-semibold text-foreground">Import Data</h3>
          {!showIngestionWizard && (
            <Button onClick={() => setShowIngestionWizard(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Import
            </Button>
          )}
          {showIngestionWizard && (
            <DataIngestionWizard
              accountId={account.account_id}
              tenancyType={account.tenancy_type}
              onClose={() => setShowIngestionWizard(false)}
            />
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

          {/* Export section */}
          <h3 className="text-sm font-semibold text-foreground mt-6">Export Data</h3>
          <Card>
            <CardContent className="p-4 space-y-3">
              {[
                { type: 'Account Profile', desc: 'Overview, contacts, status', formats: ['JSON', 'PDF'] },
                { type: 'Linked Enquiries', desc: 'Enquiries that led to this account', formats: ['CSV', 'JSON'] },
                { type: 'Support Tickets', desc: 'All tickets for this account', formats: ['CSV', 'JSON'] },
                { type: 'Notes & Timeline', desc: 'Full notes history and events', formats: ['PDF', 'JSON'] },
                { type: 'Usage Analytics', desc: 'CRM usage snapshots', formats: ['CSV'] },
              ].map(exp => (
                <div key={exp.type} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{exp.type}</p>
                    <p className="text-xs text-muted-foreground">{exp.desc}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {exp.formats.map(fmt => (
                      <Button key={fmt} variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => {
                          setExportHistory(prev => [{ type: exp.type, format: fmt, date: new Date().toISOString() }, ...prev]);
                          toast.success(`${exp.type} exported as ${fmt}`);
                        }}>
                        <Download className="h-3 w-3 mr-1" />{fmt}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {exportHistory.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Export History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {exportHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <span className="text-foreground">{h.type} ({h.format})</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(h.date), 'dd MMM, HH:mm')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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

        {/* 6. Requests (Seat Request) */}
        <TabsContent value="requests" className="mt-4 space-y-4">
          <Button onClick={() => setShowSeatRequest(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Request Additional Seats
          </Button>

          {seedSeatRequests.filter(sr => sr.account_id === account.account_id).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Seat Request History</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {seedSeatRequests.filter(sr => sr.account_id === account.account_id).map(sr => (
                  <div key={sr.id} className="p-3 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">+{sr.seats_requested} seats</span>
                      <Badge variant="outline" className={sr.urgency === SeatRequestUrgency.URGENT ? 'text-destructive border-destructive/30' : ''}>
                        {sr.urgency}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{sr.reason}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Ticket: {sr.ticket_id}</span>
                      <span>Event: {sr.event_id}</span>
                      <span>{format(new Date(sr.created_at), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Dialog open={showSeatRequest} onOpenChange={setShowSeatRequest}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Request Additional Seats</DialogTitle>
                <DialogDescription>This will create a support ticket (due in 3 days) and a check-up calendar event (in 2 days).</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Seats requested</Label>
                  <Input type="number" min={1} value={seatForm.seats} onChange={e => setSeatForm(p => ({ ...p, seats: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <Input value={seatForm.reason} onChange={e => setSeatForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Team expansion for new project" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Urgency</Label>
                  <Select value={seatForm.urgency} onValueChange={v => setSeatForm(p => ({ ...p, urgency: v as SeatRequestUrgency }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SeatRequestUrgency.NORMAL}>Normal</SelectItem>
                      <SelectItem value={SeatRequestUrgency.URGENT}>Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input value={seatForm.notes} onChange={e => setSeatForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional details..." />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowSeatRequest(false)}>Cancel</Button>
                  <Button size="sm" disabled={!seatForm.reason.trim()} onClick={() => {
                    const ticketId = `TKT_${Date.now()}`;
                    const eventId = `CE_SR_${Date.now()}`;
                    const now = new Date();
                    const dueDate = new Date(now); dueDate.setDate(dueDate.getDate() + 3);
                    const checkDate = new Date(now); checkDate.setDate(checkDate.getDate() + 2);

                    const newTicket: SupportTicket = {
                      ticket_id: ticketId,
                      linked_entity_type: EntityType.ACCOUNT,
                      linked_entity_id: account.account_id,
                      subject: `Seat increase request — ${account.account_name}`,
                      description: `Request for ${seatForm.seats} additional seats. Reason: ${seatForm.reason}`,
                      tags: ['seats', 'billing'],
                      market_field: account.city,
                      priority: seatForm.urgency === SeatRequestUrgency.URGENT ? TicketPriority.HIGH : TicketPriority.MEDIUM,
                      status: TicketStatus.NEW,
                      assigned_to_user_id: 'UDEV',
                      attachments: [],
                      notes_thread: [],
                      due_at: dueDate.toISOString(),
                      created_at: now.toISOString(),
                      updated_at: now.toISOString(),
                    };
                    seedTickets.push(newTicket);

                    seedCalendarEvents.push({
                      event_id: eventId,
                      entity_type: EntityType.ACCOUNT,
                      entity_id: account.account_id,
                      title: `Check seat increase progress — ${account.account_name}`,
                      scheduled_at: checkDate.toISOString(),
                      created_by_user_id: 'U001',
                      notes: `Follow up on seat request: +${seatForm.seats} seats`,
                      status: CalendarEventStatus.UPCOMING,
                      created_at: now.toISOString(),
                      updated_at: now.toISOString(),
                    });

                    seedSeatRequests.push({
                      id: `SR_${Date.now()}`,
                      account_id: account.account_id,
                      seats_requested: seatForm.seats,
                      reason: seatForm.reason,
                      urgency: seatForm.urgency,
                      requested_by_user_id: 'U001',
                      notes: seatForm.notes,
                      ticket_id: ticketId,
                      event_id: eventId,
                      created_at: now.toISOString(),
                    });

                    seedNotes.push({
                      note_id: `N_SR_${Date.now()}`,
                      entity_type: EntityType.ACCOUNT,
                      entity_id: account.account_id,
                      note_text: `Seat request submitted: +${seatForm.seats} seats. Ticket created: ${ticketId}. Due in 3 days.`,
                      created_by_user_id: 'U001',
                      created_at: now.toISOString(),
                    });

                    toast.success(`Seat request submitted. Ticket ${ticketId} created, due in 3 days.`);
                    setSeatForm({ seats: 1, reason: '', urgency: SeatRequestUrgency.NORMAL, notes: '' });
                    setShowSeatRequest(false);
                  }}>
                    Submit Request
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* 7. Notes */}
        <TabsContent value="notes" className="mt-4">
          <NotesPanel notes={notes} onAddNote={handleAddNote} />
        </TabsContent>

        {/* 8. Documents */}
        <TabsContent value="documents" className="mt-4">
          <AttachmentUploader
            attachments={documents.map(d => ({ file_name: d.file_name, file_url: d.file_url }))}
            onUpload={handleDocUpload}
          />
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

        {/* 9. Calendar */}
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
                    {e.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{e.notes}</p>}
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

        {/* 10. Tickets */}
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
                          {t.due_at && (
                            <>
                              <span>•</span>
                              <span className="text-warning">Due: {format(new Date(t.due_at), 'dd MMM')}</span>
                            </>
                          )}
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
