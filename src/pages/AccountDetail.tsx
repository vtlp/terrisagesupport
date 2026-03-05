import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  seedAccounts, seedNotes, seedTickets, seedDocuments, seedIngestionJobs,
  getCalendarEventsForEntity, getNextUpcomingEvent, seedCalendarEvents, getUserName, seedEnquiries,
} from '@/data/seedData';
import {
  EntityType, VerificationStatus, AccountStatus, CalendarEventStatus, CalendarEventType,
  TicketPriority, TicketStatus, ImportType, IngestionStatus, TenancyType,
  TicketType, TicketCategory, TimelineEventType,
} from '@/types/core';
import type { ChecklistItem, Account, SupportTicket, AccountSeat } from '@/types/core';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import {
  CheckCircle2, Circle, Clock, Shield, ShieldCheck, ShieldX, ShieldAlert,
  Upload, FileSpreadsheet, ArrowRight, Plus, Wifi, WifiOff,
  CalendarIcon, Ticket, Pencil, Save, X, Phone, Mail, User, Building2, MapPin,
  Download, Send, AlertTriangle, MoreHorizontal, UserX, UserCheck, Trash2, Users,
  Copy, FileText,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// ── Color Maps ────────────────────────────────
const statusColors: Record<AccountStatus, string> = {
  [AccountStatus.LIVE]: 'bg-success/15 text-success',
  [AccountStatus.ONBOARDING_IN_PROGRESS]: 'bg-primary/15 text-primary',
  [AccountStatus.STALLED_ONBOARDING]: 'bg-destructive/15 text-destructive',
  [AccountStatus.DEACTIVATED]: 'bg-muted text-muted-foreground',
};
const statusLabels: Record<AccountStatus, string> = {
  [AccountStatus.LIVE]: 'Live',
  [AccountStatus.ONBOARDING_IN_PROGRESS]: 'Onboarding',
  [AccountStatus.STALLED_ONBOARDING]: 'Stalled',
  [AccountStatus.DEACTIVATED]: 'Deactivated',
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
  [TicketStatus.PENDING_INTERNAL]: 'bg-primary/10 text-primary',
  [TicketStatus.PENDING_CUSTOMER]: 'bg-warning/15 text-warning',
  [TicketStatus.RESOLVED]: 'bg-success/15 text-success',
  [TicketStatus.CLOSED]: 'bg-muted text-muted-foreground',
};
const ingestionStatusColors: Record<IngestionStatus, string> = {
  [IngestionStatus.COMPLETED]: 'bg-success/15 text-success',
  [IngestionStatus.IN_PROGRESS]: 'bg-warning/15 text-warning',
  [IngestionStatus.FAILED]: 'bg-destructive/15 text-destructive',
};
const tenancyLabels: Record<TenancyType, string> = {
  [TenancyType.AGENCY_BROKERAGE_CONSULTANCY]: 'Agency / Brokerage',
  [TenancyType.BUILDER_DEVELOPER]: 'Builder / Developer',
};

// ── Editable Field Row ─────────────────────────
function FieldRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      {icon && <span className="mt-0.5 text-muted-foreground flex-shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

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
  const handleSimulateUpload = () => { setFileName(`${importType.toLowerCase()}_import_${Date.now()}.csv`); setStep(2); };
  const handleRunImport = () => {
    seedIngestionJobs.push({
      job_id: `JOB${Date.now()}`, account_id: accountId, import_type: importType as ImportType,
      file_names: [fileName], mapping_config: mapping, status: IngestionStatus.COMPLETED,
      imported_count: Math.floor(Math.random() * 200) + 50, error_count: Math.floor(Math.random() * 5),
      duplicate_count: Math.floor(Math.random() * 10), created_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    });
    setStep(4);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>New Data Import</span>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardTitle>
        <div className="flex items-center gap-1 mt-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
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
              <SelectContent>{Object.values(ImportType).map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => setStep(1)} disabled={!importType}>Next</Button>
          </div>
        )}
        {step === 1 && (
          <div className="border border-dashed border-muted-foreground/30 rounded-md p-6 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Drag & drop CSV/XLSX or click to browse</p>
            <Button size="sm" onClick={handleSimulateUpload}><FileSpreadsheet className="h-4 w-4 mr-1" /> Simulate Upload</Button>
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
                  <Input placeholder={`Map to ${col.toLowerCase()}...`} defaultValue={col} className="flex-1"
                    onChange={e => setMapping(prev => ({ ...prev, [col]: e.target.value }))} />
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

// Custom integration type
interface CustomIntegration {
  id: string;
  name: string;
  apiKey: string;
  endpoint: string;
  description: string;
  connected: boolean;
}

const PORTAL_INTEGRATIONS = ['MagicBricks', '99acres', 'Housing.com', 'NoBroker', 'Square Yards', 'CommonFloor'];

// ── Main Component ─────────────────────────────
export default function AccountDetail() {
  const { accountId } = useParams();
  const account = seedAccounts.find(a => a.account_id === accountId);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(account?.onboarding_checklist ?? []);
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItem[] | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [panStatus, setPanStatus] = useState(account?.verification_pan_status ?? VerificationStatus.NOT_STARTED);
  const [idStatus, setIdStatus] = useState(account?.verification_identity_status ?? VerificationStatus.NOT_STARTED);
  const [accountStatus, setAccountStatus] = useState(account?.status ?? AccountStatus.ONBOARDING_IN_PROGRESS);
  const [integrations, setIntegrations] = useState(account?.integrations ?? {});
  const [showIngestionWizard, setShowIngestionWizard] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showSeatRequest, setShowSeatRequest] = useState(false);
  const [seatCount, setSeatCount] = useState('');
  const [seatReason, setSeatReason] = useState('');
  const [seatUrgency, setSeatUrgency] = useState<'normal' | 'urgent'>('normal');

  // Editable overview fields
  const [editingOverview, setEditingOverview] = useState(false);
  const [accountName, setAccountName] = useState(account?.account_name ?? '');
  const [ownerName, setOwnerName] = useState(account?.owner_name ?? '');
  const [ownerPhone, setOwnerPhone] = useState(account?.owner_phone ?? '');
  const [ownerEmail, setOwnerEmail] = useState(account?.owner_email ?? '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(account?.whatsapp_enabled ?? false);
  const [city, setCity] = useState(account?.city ?? '');
  const [overviewText, setOverviewText] = useState(account?.account_overview_text ?? '');
  const [tenancyType, setTenancyType] = useState<TenancyType>(account?.tenancy_type ?? TenancyType.AGENCY_BROKERAGE_CONSULTANCY);

  // Verification note dialog
  const [verificationNoteDialog, setVerificationNoteDialog] = useState(false);
  const [verificationNoteText, setVerificationNoteText] = useState('');
  const [pendingVerification, setPendingVerification] = useState<{ type: 'pan' | 'id'; value: VerificationStatus } | null>(null);

  // Export CSV dialog
  const [exportDialog, setExportDialog] = useState(false);
  const [exportType, setExportType] = useState('all');

  // Custom integrations
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>(
    PORTAL_INTEGRATIONS.map((name, i) => ({
      id: `INT_${i}`,
      name,
      apiKey: '',
      endpoint: '',
      description: `${name} portal integration`,
      connected: false,
    }))
  );
  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [newIntName, setNewIntName] = useState('');
  const [newIntApiKey, setNewIntApiKey] = useState('');
  const [newIntEndpoint, setNewIntEndpoint] = useState('');
  const [newIntDescription, setNewIntDescription] = useState('');

  // Note refresh
  const [noteRefresh, setNoteRefresh] = useState(0);

  // Seats state
  const [seats, setSeats] = useState<AccountSeat[]>(account?.seats ?? []);
  const [showAddSeat, setShowAddSeat] = useState(false);
  const [newSeatName, setNewSeatName] = useState('');
  const [newSeatEmail, setNewSeatEmail] = useState('');
  const [newSeatPhone, setNewSeatPhone] = useState('');
  const [newSeatRole, setNewSeatRole] = useState('Agent');
  const [newSeatPermissions, setNewSeatPermissions] = useState<string[]>([]);

  // Edit seat state
  const [editingSeat, setEditingSeat] = useState<AccountSeat | null>(null);
  const [editSeatName, setEditSeatName] = useState('');
  const [editSeatEmail, setEditSeatEmail] = useState('');
  const [editSeatPhone, setEditSeatPhone] = useState('');
  const [editSeatRole, setEditSeatRole] = useState('Agent');
  const [editSeatPermissions, setEditSeatPermissions] = useState<string[]>([]);

  // Remove seat confirmation
  const [removingSeatId, setRemovingSeatId] = useState<string | null>(null);

  const activeSeats = seats.filter(s => s.is_active);
  const hasSuperUser = seats.some(s => s.role === 'Super User' && s.is_active);
  const isBuilder = tenancyType === TenancyType.BUILDER_DEVELOPER;

  const handleAddSeat = () => {
    if (!newSeatName) { toast.error('Name is required'); return; }
    const newSeat: AccountSeat = {
      seat_id: `SEAT_${account.account_id}_${Date.now()}`,
      account_id: account.account_id,
      name: newSeatName,
      email: newSeatEmail,
      phone: newSeatPhone,
      role: newSeatRole,
      permissions: newSeatRole === 'Agent' ? newSeatPermissions : [],
      is_active: true,
      onboarded: false,
      onboarded_at: null,
      created_at: new Date().toISOString(),
    };
    setSeats(prev => [...prev, newSeat]);
    setNewSeatName(''); setNewSeatEmail(''); setNewSeatPhone(''); setNewSeatRole('Agent'); setNewSeatPermissions([]);
    setShowAddSeat(false);
    toast.success(`Seat added for ${newSeat.name}`);
  };

  const toggleSeatOnboarded = (seatId: string) => {
    setSeats(prev => prev.map(s => s.seat_id === seatId ? {
      ...s,
      onboarded: !s.onboarded,
      onboarded_at: !s.onboarded ? new Date().toISOString() : null,
    } : s));
  };

  const deactivateSeat = (seatId: string) => {
    setSeats(prev => prev.map(s => s.seat_id === seatId ? { ...s, is_active: false } : s));
    toast.success('Seat deactivated');
  };

  const reactivateSeat = (seatId: string) => {
    setSeats(prev => prev.map(s => s.seat_id === seatId ? { ...s, is_active: true } : s));
    toast.success('Seat reactivated');
  };

  const removeSeat = (seatId: string) => {
    setSeats(prev => prev.filter(s => s.seat_id !== seatId));
    setRemovingSeatId(null);
    toast.success('Seat removed');
  };

  const openEditSeat = (seat: AccountSeat) => {
    setEditingSeat(seat);
    setEditSeatName(seat.name);
    setEditSeatEmail(seat.email);
    setEditSeatPhone(seat.phone);
    setEditSeatRole(seat.role);
    setEditSeatPermissions(seat.permissions);
  };

  const handleEditSeat = () => {
    if (!editingSeat || !editSeatName) { toast.error('Name is required'); return; }
    setSeats(prev => prev.map(s => s.seat_id === editingSeat.seat_id ? {
      ...s,
      name: editSeatName,
      email: editSeatEmail,
      phone: editSeatPhone,
      role: editSeatRole,
      permissions: editSeatRole === 'Agent' ? editSeatPermissions : [],
    } : s));
    setEditingSeat(null);
    toast.success('Seat updated');
  };

  const editHasSuperUser = seats.some(s => s.role === 'Super User' && s.is_active && s.seat_id !== editingSeat?.seat_id);

  // Billing state
  type BillingCycle = 'quarterly' | 'half_yearly' | 'annual';
  interface PaymentEntry {
    id: string;
    date: string;
    amount: number;
    invoiceNumber: string;
    status: 'paid' | 'pending' | 'overdue';
    receiptFileName?: string;
    remarks?: string;
  }
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [perSeatPrice, setPerSeatPrice] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [billingStartDate, setBillingStartDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [billingRemarks, setBillingRemarks] = useState('');
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newPaymentInvoice, setNewPaymentInvoice] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [newPaymentRemarks, setNewPaymentRemarks] = useState('');
  const [newPaymentReceipt, setNewPaymentReceipt] = useState('');

  // Invoice state
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const billingCycleLabels: Record<BillingCycle, string> = {
    quarterly: 'Quarterly (every 4 months)',
    half_yearly: 'Half-Yearly (every 6 months)',
    annual: 'Annual (single payment)',
  };
  const billingCycleMonths: Record<BillingCycle, number> = { quarterly: 4, half_yearly: 6, annual: 12 };

  const nextPaymentDue = billingStartDate
    ? format(new Date(new Date(billingStartDate).setMonth(new Date(billingStartDate).getMonth() + billingCycleMonths[billingCycle])), 'dd MMM yyyy')
    : '—';

  const handleAddPayment = () => {
    if (!newPaymentAmount || !newPaymentDate) { toast.error('Amount and date are required'); return; }
    setPayments(prev => [...prev, {
      id: `PAY_${Date.now()}`, date: newPaymentDate, amount: parseFloat(newPaymentAmount),
      invoiceNumber: newPaymentInvoice, status: newPaymentStatus, remarks: newPaymentRemarks,
      receiptFileName: newPaymentReceipt || undefined,
    }]);
    setNewPaymentAmount(''); setNewPaymentInvoice(''); setNewPaymentRemarks(''); setNewPaymentReceipt('');
    setShowAddPayment(false);
    toast.success('Payment entry added');
  };

  if (!account) {
    return <div className="p-6 text-center text-muted-foreground">Account not found</div>;
  }

  // Source enquiry for carry-over fields
  const sourceEnquiry = account.created_from_enquiry_id
    ? seedEnquiries.find(e => e.enquiry_id === account.created_from_enquiry_id)
    : null;

  // ── Go-Live Automation ─────────────────────
  const handleStatusChange = (newStatus: AccountStatus) => {
    const prevStatus = accountStatus;
    setAccountStatus(newStatus);

    if (newStatus === AccountStatus.LIVE && prevStatus !== AccountStatus.LIVE) {
      const existing = seedCalendarEvents.find(e =>
        e.entity_type === EntityType.ACCOUNT && e.entity_id === account.account_id && e.title.includes('7-day go-live checkup')
      );
      if (!existing) {
        const checkupDate = new Date();
        checkupDate.setDate(checkupDate.getDate() + 7);
        checkupDate.setHours(10, 0, 0, 0);
        seedCalendarEvents.push({
          event_id: `CE_GL_${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
          title: `7-day go-live checkup — ${account.account_name}`, scheduled_at: checkupDate.toISOString(),
          created_by_user_id: 'U001', notes: 'Auto-generated: verify account health, usage, and satisfaction after go-live.',
          status: CalendarEventStatus.UPCOMING, event_type: CalendarEventType.ONBOARDING, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        seedNotes.push({
          note_id: `N_GL_${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
          note_text: `[System] Account marked LIVE. 7-day go-live checkup event auto-created for ${format(checkupDate, 'dd MMM yyyy')}.`,
          created_by_user_id: 'U001', created_at: new Date().toISOString(),
        });
        toast.success('🎉 Account is now LIVE! 7-day go-live checkup event created.');
      } else {
        toast.success('Account status changed to LIVE.');
      }
    }
  };

  // ── Verification with mandatory note ───────
  const handleVerificationChange = (type: 'pan' | 'id', value: VerificationStatus) => {
    setPendingVerification({ type, value });
    setVerificationNoteText('');
    setVerificationNoteDialog(true);
  };

  const confirmVerificationChange = () => {
    if (!verificationNoteText.trim()) {
      toast.error('A note is required when changing verification status');
      return;
    }
    if (!pendingVerification) return;
    const prefix = pendingVerification.type === 'pan' ? 'PAN Verification' : 'Identity Verification';
    if (pendingVerification.type === 'pan') setPanStatus(pendingVerification.value);
    else setIdStatus(pendingVerification.value);

    seedNotes.push({
      note_id: `N_VER_${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
      note_text: `[${prefix}] Status changed to ${pendingVerification.value.replace(/_/g, ' ')}: ${verificationNoteText.trim()}`,
      created_by_user_id: 'U001', created_at: new Date().toISOString(),
    });
    setNoteRefresh(prev => prev + 1);
    toast.success(`${prefix} status updated`);
    setVerificationNoteDialog(false);
    setPendingVerification(null);
  };

  // ── Seat Request Workflow ──────────────────
  const handleSeatRequest = () => {
    if (!seatCount || !seatReason.trim()) {
      toast.error('Please fill in seat count and reason');
      return;
    }
    const priority = seatUrgency === 'urgent' ? TicketPriority.P1 : TicketPriority.P2;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const ticketId = `TKT_SR_${Date.now()}`;
    const newTicket: SupportTicket = {
      ticket_id: ticketId, subject: `Seat expansion request — ${account.account_name} (+${seatCount} seats)`,
      description: seatReason, status: TicketStatus.OPEN, priority, type: TicketType.TASK, category: TicketCategory.BILLING_PLAN,
      account_id: account.account_id, requester_name: ownerName, requester_email: ownerEmail, assigned_to_user_id: 'U001',
      queue: 'Seat Requests', tags: ['seat-expansion'],
      sla_first_response: new Date(Date.now() + 4 * 3600000).toISOString(), sla_resolution: dueDate.toISOString(),
      first_response_at: null, resolved_at: null,
      timeline: [{ id: `TL_${ticketId}_1`, type: TimelineEventType.SYSTEM, content: `Seat expansion request created: +${seatCount} seats`, user_id: null, created_at: new Date().toISOString() }],
      attachments: [], notes_thread: [], linked_entity_type: EntityType.ACCOUNT, linked_entity_id: account.account_id,
      market_field: city, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    seedTickets.unshift(newTicket);
    seedCalendarEvents.push({
      event_id: `CE_SR_${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
      title: `Seat request follow-up — ${account.account_name}`, scheduled_at: dueDate.toISOString(),
      created_by_user_id: 'U001', notes: `Follow up on seat expansion request (+${seatCount} seats). Ticket: ${ticketId}`,
      status: CalendarEventStatus.UPCOMING, event_type: CalendarEventType.FOLLOW_UP, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    seedNotes.push({
      note_id: `N_SR_${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
      note_text: `[System] Seat expansion request created: +${seatCount} seats. Ticket ${ticketId} assigned to queue "Seat Requests". Due: ${format(dueDate, 'dd MMM yyyy')}.`,
      created_by_user_id: 'U001', created_at: new Date().toISOString(),
    });
    setShowSeatRequest(false); setSeatCount(''); setSeatReason(''); setSeatUrgency('normal');
    toast.success(`Seat request created! Ticket ${ticketId} + follow-up event in 3 days.`);
  };

  // ── Export helpers ──────────────────────────
  const handleExport = (type: string) => {
    toast.success(`Exporting ${type}... (simulated)`);
    setExportDialog(false);
  };

  // ── Custom Integration ─────────────────────
  const handleAddIntegration = () => {
    if (!newIntName.trim()) { toast.error('Integration name required'); return; }
    setCustomIntegrations(prev => [...prev, {
      id: `INT_${Date.now()}`,
      name: newIntName.trim(),
      apiKey: newIntApiKey,
      endpoint: newIntEndpoint,
      description: newIntDescription,
      connected: false,
    }]);
    setNewIntName(''); setNewIntApiKey(''); setNewIntEndpoint(''); setNewIntDescription('');
    setShowAddIntegration(false);
    toast.success('Integration added');
  };

  const toggleCustomIntegration = (id: string) => {
    setCustomIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i));
  };

  const notes = seedNotes.filter(n => n.entity_type === EntityType.ACCOUNT && n.entity_id === account.account_id);
  void noteRefresh;
  const events = getCalendarEventsForEntity(EntityType.ACCOUNT, account.account_id);
  const nextEvent = getNextUpcomingEvent(EntityType.ACCOUNT, account.account_id);
  const tickets = seedTickets.filter(t => t.account_id === account.account_id || t.linked_entity_id === account.account_id);
  const documents = seedDocuments.filter(d => d.entity_id === account.account_id);
  const jobs = seedIngestionJobs.filter(j => j.account_id === account.account_id);
  const displayChecklist = draftChecklist ?? checklist;
  const completedCount = displayChecklist.filter(c => c.completed).length;
  const progress = displayChecklist.length > 0 ? Math.round((completedCount / displayChecklist.length) * 100) : 0;
  const isDirty = draftChecklist !== null;

  const toggleChecklistItem = (id: string) => {
    setDraftChecklist(prev => {
      const base = prev ?? checklist;
      return base.map(item =>
        item.id === id ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : null, completed_by_user_id: !item.completed ? 'U001' : null } : item
      );
    });
  };

  const saveChecklist = () => {
    if (draftChecklist) {
      setChecklist(draftChecklist);
      setDraftChecklist(null);
      toast.success('Onboarding checklist updated');
    }
  };

  const cancelChecklist = () => {
    setDraftChecklist(null);
  };

  const handleTabChange = (value: string) => {
    if (isDirty && activeTab === 'onboarding') {
      setPendingTab(value);
      setShowDiscardDialog(true);
    } else {
      setActiveTab(value);
    }
  };

  const confirmDiscard = () => {
    setDraftChecklist(null);
    setShowDiscardDialog(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleAddNote = (text: string) => {
    seedNotes.push({ note_id: `N${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id, note_text: text, created_by_user_id: 'U001', created_at: new Date().toISOString() });
    setNoteRefresh(prev => prev + 1);
  };

  const handleCreateEvent = (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    seedCalendarEvents.push({
      event_id: `CE${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
      title: data.title, scheduled_at: scheduled.toISOString(), created_by_user_id: 'U001',
      notes: data.notes || undefined, status: CalendarEventStatus.UPCOMING, event_type: data.event_type,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    setShowEventForm(false);
  };

  const handleDocUpload = (fileName: string) => {
    seedDocuments.push({
      document_id: `DOC${Date.now()}`, entity_type: EntityType.ACCOUNT, entity_id: account.account_id,
      folder_path: '/Uploads', file_name: fileName, file_url: '#', uploaded_by_user_id: 'U001', created_at: new Date().toISOString(),
    });
  };

  const toggleIntegration = (key: 'meta' | 'google' | 'website') => {
    setIntegrations(prev => ({ ...prev, [key]: { connected: !prev[key]?.connected, last_sync: new Date().toISOString() } }));
  };

  const handleSaveOverview = () => {
    setEditingOverview(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Unsaved Changes Discard Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={v => { if (!v) { setShowDiscardDialog(false); setPendingTab(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Onboarding Changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved onboarding checklist changes. Discard them and switch tabs?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDiscardDialog(false); setPendingTab(null); }}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Discard & Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Note Dialog */}
      <Dialog open={verificationNoteDialog} onOpenChange={v => { if (!v) { setVerificationNoteDialog(false); setPendingVerification(null); } }}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Verification Status Change</DialogTitle>
            <DialogDescription>
              A note is required when changing {pendingVerification?.type === 'pan' ? 'PAN' : 'Identity'} verification status to {pendingVerification?.value.replace(/_/g, ' ')}.
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Add your note..." value={verificationNoteText} onChange={e => setVerificationNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVerificationNoteDialog(false); setPendingVerification(null); }}>Cancel</Button>
            <Button onClick={confirmVerificationChange}>Save & Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export CSV Dialog */}
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Export CSV</DialogTitle>
            <DialogDescription>Choose what to export</DialogDescription>
          </DialogHeader>
          <RadioGroup value={exportType} onValueChange={setExportType} className="space-y-2">
            {[
              { value: 'leads', label: 'Leads Only' },
              { value: 'properties', label: 'Properties Only' },
              { value: 'enquiries', label: 'Enquiries Only' },
              { value: 'all', label: 'All' },
            ].map(opt => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={opt.value} />
                <Label htmlFor={opt.value}>{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialog(false)}>Cancel</Button>
            <Button onClick={() => handleExport(exportType)}>Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Integration Dialog */}
      <Dialog open={showAddIntegration} onOpenChange={setShowAddIntegration}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Add Integration</DialogTitle>
            <DialogDescription>Connect a new portal or service</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Integration Name *</Label>
              <Input value={newIntName} onChange={e => setNewIntName(e.target.value)} placeholder="e.g. MagicBricks API" />
            </div>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input value={newIntApiKey} onChange={e => setNewIntApiKey(e.target.value)} placeholder="API key..." type="password" />
            </div>
            <div className="space-y-1">
              <Label>Endpoint URL</Label>
              <Input value={newIntEndpoint} onChange={e => setNewIntEndpoint(e.target.value)} placeholder="https://api.example.com/v1" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={newIntDescription} onChange={e => setNewIntDescription(e.target.value)} placeholder="What does this integration do?" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIntegration(false)}>Cancel</Button>
            <Button onClick={handleAddIntegration}>Add Integration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Header ────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {editingOverview ? (
              <Input
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="text-xl md:text-2xl font-bold border-transparent bg-transparent px-0 h-auto focus-visible:border-input focus-visible:bg-background focus-visible:px-3"
              />
            ) : (
              <h1 className="text-xl md:text-2xl font-bold text-foreground">{account.account_name}</h1>
            )}
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
              <MapPin className="h-3.5 w-3.5" /><span>{city}</span>
              <span className="text-border">•</span>
              <Building2 className="h-3.5 w-3.5" /><span>{tenancyLabels[tenancyType]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={accountStatus} onValueChange={(v) => handleStatusChange(v as AccountStatus)}>
              <SelectTrigger className="w-[160px] h-9">
                <Badge className={`${statusColors[accountStatus]} text-xs`}>{statusLabels[accountStatus]}</Badge>
              </SelectTrigger>
              <SelectContent>
                {Object.values(AccountStatus).map(s => (
                  <SelectItem key={s} value={s}>
                    <Badge className={`${statusColors[s]} text-xs`}>{statusLabels[s]}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={verificationColors[panStatus]}>PAN: {panStatus.replace(/_/g, ' ')}</Badge>
            <Badge className={verificationColors[idStatus]}>ID: {idStatus.replace(/_/g, ' ')}</Badge>
          </div>
        </div>

        {nextEvent && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <Clock className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-medium text-foreground">{nextEvent.title}</span>
            <span className="text-muted-foreground text-xs ml-auto">{format(new Date(nextEvent.scheduled_at), 'dd MMM yyyy, HH:mm')}</span>
          </div>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap gap-0.5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="seats">Seats ({activeSeats.length})</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="ingestion">Data</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="documents">Docs ({documents.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar ({events.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
        </TabsList>

        {/* ═══ 1. OVERVIEW ═══ */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Account Summary
                  {!editingOverview ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditingOverview(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={handleSaveOverview}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingOverview(false)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <FieldRow label="Owner Name" icon={<User className="h-4 w-4" />}>
                  {editingOverview ? <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} className="h-8 text-sm" /> : ownerName || '—'}
                </FieldRow>
                <FieldRow label="Phone" icon={<Phone className="h-4 w-4" />}>
                  {editingOverview ? <Input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="h-8 text-sm" /> : ownerPhone || '—'}
                </FieldRow>
                <FieldRow label="Email" icon={<Mail className="h-4 w-4" />}>
                  {editingOverview ? <Input value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="h-8 text-sm" /> : (
                    ownerEmail ? <a href={`mailto:${ownerEmail}`} className="text-primary hover:underline">{ownerEmail}</a> : '—'
                  )}
                </FieldRow>
                <FieldRow label="WhatsApp Enabled">
                  <div className="flex items-center gap-2">
                    <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} disabled={!editingOverview} />
                    <span className="text-xs text-muted-foreground">{whatsappEnabled ? 'Yes' : 'No'}</span>
                  </div>
                </FieldRow>
                <FieldRow label="City" icon={<MapPin className="h-4 w-4" />}>
                  {editingOverview ? <Input value={city} onChange={e => setCity(e.target.value)} className="h-8 text-sm" /> : city || '—'}
                </FieldRow>
                <FieldRow label="Tenancy Type" icon={<Building2 className="h-4 w-4" />}>
                  {editingOverview ? (
                    <Select value={tenancyType} onValueChange={v => setTenancyType(v as TenancyType)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(TenancyType).map(t => <SelectItem key={t} value={t}>{tenancyLabels[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : tenancyLabels[tenancyType]}
                </FieldRow>
                {account.created_from_enquiry_id && (
                  <FieldRow label="Created from Enquiry">
                    <Link to={`/enquiries/${account.created_from_enquiry_id}`} className="text-primary hover:underline text-xs">
                      {account.created_from_enquiry_id}
                    </Link>
                  </FieldRow>
                )}
                <FieldRow label="Created">
                  {format(new Date(account.created_at), 'dd MMM yyyy')}
                </FieldRow>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Onboarding', value: `${progress}%`, color: progress === 100 ? 'text-success' : '' },
                    { label: 'Active Seats', value: activeSeats.length, color: 'text-primary' },
                    { label: 'Tickets', value: tickets.length },
                    { label: 'Documents', value: documents.length },
                  ].map(s => (
                    <div key={s.label} className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className={`text-lg font-bold ${s.color ?? ''}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Status Controls</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Account Status</Label>
                    <Select value={accountStatus} onValueChange={v => handleStatusChange(v as AccountStatus)}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(AccountStatus).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">PAN Verification</Label>
                    <Select value={panStatus} onValueChange={v => handleVerificationChange('pan', v as VerificationStatus)}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(VerificationStatus).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ID Verification</Label>
                    <Select value={idStatus} onValueChange={v => handleVerificationChange('id', v as VerificationStatus)}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(VerificationStatus).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* About */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">About / Description</CardTitle></CardHeader>
            <CardContent>
              {editingOverview ? (
                <Textarea value={overviewText} onChange={e => setOverviewText(e.target.value)} placeholder="Account overview..." rows={4} />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {overviewText || 'No description added yet. Click Edit above to add account context.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* From Enquiry Section */}
          {sourceEnquiry && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">From Enquiry</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Team Size (Estimate)</span>
                    <span>{sourceEnquiry.team_size_estimate ?? '—'}</span>
                    <span className="text-xs text-muted-foreground ml-2">· Actual seats: <span className="font-medium text-primary">{activeSeats.length} active</span></span>
                  </div>
                  <div><span className="text-xs text-muted-foreground block">Focus Area</span>{sourceEnquiry.focus_area.join(', ') || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Sales Focus</span>{sourceEnquiry.sales_focus.map(s => s.replace(/_/g, ' ')).join(', ') || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Property Types</span>{sourceEnquiry.primary_property_types.join(', ') || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Current System</span>{sourceEnquiry.current_system_text || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Portals</span>{sourceEnquiry.portals_in_use.join(', ') || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Onboarding Date</span>{sourceEnquiry.approx_onboarding_date || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Phone</span>{sourceEnquiry.contact_phone || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Email</span>{sourceEnquiry.contact_email || '—'}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ 2. ONBOARDING ═══ */}
        <TabsContent value="onboarding" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Onboarding Checklist</span>
                <span className="text-sm font-normal text-muted-foreground">{completedCount}/{displayChecklist.length} completed</span>
              </CardTitle>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {displayChecklist.map(item => {
                  const original = checklist.find(c => c.id === item.id);
                  const isChanged = isDirty && original && original.completed !== item.completed;
                  return (
                    <button key={item.id} className={`flex items-center gap-3 w-full text-left p-2.5 rounded-md hover:bg-muted/50 transition-colors ${isChanged ? 'bg-warning/10 ring-1 ring-warning/30' : ''}`} onClick={() => toggleChecklistItem(item.id)}>
                      {item.completed ? <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                      <span className={item.completed ? 'text-foreground line-through opacity-70' : 'text-foreground'}>{item.label}</span>
                      {isChanged && <Badge variant="outline" className="ml-2 text-[10px] bg-warning/10 text-warning border-warning/30">changed</Badge>}
                      {item.completed_at && !isChanged && <span className="text-xs text-muted-foreground ml-auto">{format(new Date(item.completed_at), 'dd MMM')} • {getUserName(item.completed_by_user_id)}</span>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Save / Cancel bar */}
          {isDirty && (
            <div className="sticky bottom-0 z-10 bg-background border border-border rounded-lg p-3 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="font-medium">You have unsaved checklist changes</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={cancelChecklist}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveChecklist}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* Seat Onboarding Status */}
          {activeSeats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Seat Onboarding Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Progress value={activeSeats.length > 0 ? (activeSeats.filter(s => s.onboarded).length / activeSeats.length) * 100 : 0} className="h-2 flex-1" />
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    {activeSeats.filter(s => s.onboarded).length} / {activeSeats.length} onboarded
                  </span>
                </div>
                <div className="space-y-1.5">
                  {activeSeats.map(seat => (
                    <div key={seat.seat_id} className="flex items-center gap-2 text-sm">
                      {seat.onboarded ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" /> : <Circle className="h-4 w-4 text-warning flex-shrink-0" />}
                      <span className={seat.onboarded ? 'text-muted-foreground' : 'text-foreground'}>{seat.name}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">{seat.role}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ SEATS ═══ */}
        <TabsContent value="seats" className="mt-4 space-y-4">
          {/* Enquiry estimate banner */}
          {sourceEnquiry && sourceEnquiry.team_size_estimate && (
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
              <span>Estimated team size from enquiry: <span className="font-semibold">{sourceEnquiry.team_size_estimate}</span>. Add the actual users below.</span>
            </div>
          )}
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Active Seats', value: activeSeats.length, color: 'text-primary' },
              { label: 'Onboarded', value: activeSeats.filter(s => s.onboarded).length, color: 'text-success' },
              { label: 'Pending', value: activeSeats.filter(s => !s.onboarded).length, color: 'text-warning' },
              { label: 'Deactivated', value: seats.filter(s => !s.is_active).length, color: 'text-muted-foreground' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color ?? ''}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>User Seats</span>
                <Button size="sm" onClick={() => setShowAddSeat(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Seat</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {seats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No seats added yet. Click "Add Seat" to register users for onboarding.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Permissions</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground hidden md:table-cell">Onboarded</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {seats.map(seat => (
                        <tr key={seat.seat_id} className={`border-b border-border/50 hover:bg-muted/30 ${!seat.is_active ? 'opacity-50' : ''}`}>
                          <td className="py-2.5 px-2 font-medium">
                            {seat.name}
                            {!seat.is_active && <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 text-muted-foreground">Inactive</Badge>}
                          </td>
                          <td className="py-2.5 px-2 text-muted-foreground">{seat.email || '—'}</td>
                          <td className="py-2.5 px-2 text-muted-foreground hidden sm:table-cell">{seat.phone || '—'}</td>
                          <td className="py-2.5 px-2"><Badge variant="outline" className="text-xs">{seat.role}</Badge></td>
                          <td className="py-2.5 px-2">
                            {seat.role === 'Super User' || seat.role === 'Admin' ? (
                              <span className="text-xs text-muted-foreground italic">Full access</span>
                            ) : seat.permissions && seat.permissions.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {seat.permissions.map(p => (
                                  <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {p === 'org_wide_access' ? 'Org-wide' : p === 'agent_network_access' ? 'Agent Network' : p === 'publish_access' ? 'Publish' : p}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            {seat.is_active ? (
                              <Badge
                                className={`text-xs cursor-pointer ${seat.onboarded ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}
                                onClick={() => toggleSeatOnboarded(seat.seat_id)}
                              >
                                {seat.onboarded ? 'Onboarded' : 'Pending'}
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-muted text-muted-foreground">Deactivated</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-xs text-muted-foreground hidden md:table-cell">
                            {seat.onboarded_at ? format(new Date(seat.onboarded_at), 'dd MMM yyyy') : '—'}
                          </td>
                          <td className="py-2.5 px-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditSeat(seat)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {seat.is_active ? (
                                  <DropdownMenuItem onClick={() => deactivateSeat(seat.seat_id)} className="text-warning">
                                    <UserX className="h-3.5 w-3.5 mr-2" /> Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => reactivateSeat(seat.seat_id)} className="text-success">
                                    <UserCheck className="h-3.5 w-3.5 mr-2" /> Reactivate
                                  </DropdownMenuItem>
                                )}
                                {!seat.onboarded && (
                                  <DropdownMenuItem onClick={() => setRemovingSeatId(seat.seat_id)} className="text-destructive">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remove Seat Confirmation Dialog */}
        <Dialog open={!!removingSeatId} onOpenChange={v => { if (!v) setRemovingSeatId(null); }}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Remove Seat</DialogTitle>
              <DialogDescription>This will permanently remove this seat. This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemovingSeatId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => removingSeatId && removeSeat(removingSeatId)}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Seat Dialog */}
        <Dialog open={!!editingSeat} onOpenChange={v => { if (!v) setEditingSeat(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Seat</DialogTitle>
              <DialogDescription>Update seat details and permissions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={editSeatName} onChange={e => setEditSeatName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={editSeatEmail} onChange={e => setEditSeatEmail(e.target.value)} placeholder="email@example.com" type="email" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={editSeatPhone} onChange={e => setEditSeatPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={editSeatRole} onValueChange={v => { setEditSeatRole(v); if (v !== 'Agent') setEditSeatPermissions([]); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super User" disabled={editHasSuperUser}>
                      Super User {editHasSuperUser ? '(already assigned)' : ''}
                    </SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editSeatRole === 'Agent' && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label className="text-xs font-medium text-muted-foreground">Permissions</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={editSeatPermissions.includes('org_wide_access')}
                        onCheckedChange={checked => {
                          setEditSeatPermissions(prev => checked ? [...prev, 'org_wide_access'] : prev.filter(p => p !== 'org_wide_access'));
                        }}
                      />
                      Organization-wide Access
                    </label>
                    {!isBuilder && (
                      <>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={editSeatPermissions.includes('agent_network_access')}
                            onCheckedChange={checked => {
                              setEditSeatPermissions(prev => checked ? [...prev, 'agent_network_access'] : prev.filter(p => p !== 'agent_network_access'));
                            }}
                          />
                          Agent Network Access
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={editSeatPermissions.includes('publish_access')}
                            onCheckedChange={checked => {
                              setEditSeatPermissions(prev => checked ? [...prev, 'publish_access'] : prev.filter(p => p !== 'publish_access'));
                            }}
                          />
                          Publish Access
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSeat(null)}>Cancel</Button>
              <Button onClick={handleEditSeat}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Seat Dialog */}
        <Dialog open={showAddSeat} onOpenChange={setShowAddSeat}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Seat</DialogTitle>
              <DialogDescription>Register a user for onboarding on this account.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={newSeatName} onChange={e => setNewSeatName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={newSeatEmail} onChange={e => setNewSeatEmail(e.target.value)} placeholder="email@example.com" type="email" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={newSeatPhone} onChange={e => setNewSeatPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={newSeatRole} onValueChange={v => { setNewSeatRole(v); if (v !== 'Agent') setNewSeatPermissions([]); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super User" disabled={hasSuperUser}>
                      Super User {hasSuperUser ? '(already assigned)' : ''}
                    </SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newSeatRole === 'Agent' && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label className="text-xs font-medium text-muted-foreground">Permissions</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={newSeatPermissions.includes('org_wide_access')}
                        onCheckedChange={checked => {
                          setNewSeatPermissions(prev => checked ? [...prev, 'org_wide_access'] : prev.filter(p => p !== 'org_wide_access'));
                        }}
                      />
                      Organization-wide Access
                    </label>
                    {!isBuilder && (
                      <>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newSeatPermissions.includes('agent_network_access')}
                            onCheckedChange={checked => {
                              setNewSeatPermissions(prev => checked ? [...prev, 'agent_network_access'] : prev.filter(p => p !== 'agent_network_access'));
                            }}
                          />
                          Agent Network Access
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newSeatPermissions.includes('publish_access')}
                            onCheckedChange={checked => {
                              setNewSeatPermissions(prev => checked ? [...prev, 'publish_access'] : prev.filter(p => p !== 'publish_access'));
                            }}
                          />
                          Publish Access
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSeat(false)}>Cancel</Button>
              <Button onClick={handleAddSeat}>Add Seat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ 3. VERIFICATION ═══ */}
        <TabsContent value="verification" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {[{ label: 'PAN Verification', status: panStatus, type: 'pan' as const, icon: verificationIcons[panStatus] },
              { label: 'Identity Verification', status: idStatus, type: 'id' as const, icon: verificationIcons[idStatus] }].map(v => (
              <Card key={v.label}>
                <CardHeader><CardTitle className="text-base flex items-center gap-2">{v.icon} {v.label}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Badge className={verificationColors[v.status]}>{v.status.replace(/_/g, ' ')}</Badge>
                  <div>
                    <Label className="text-xs text-muted-foreground">Update Status</Label>
                    <Select value={v.status} onValueChange={val => handleVerificationChange(v.type, val as VerificationStatus)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(VerificationStatus).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Verification Notes */}
          <Card>
            <CardContent className="pt-6">
              <NotesPanel
                notes={notes.filter(n => n.note_text.includes('[PAN Verification]') || n.note_text.includes('[Identity Verification]'))}
                compact
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ 4. DATA INGESTION ═══ */}
        <TabsContent value="ingestion" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {!showIngestionWizard && <Button onClick={() => setShowIngestionWizard(true)}><Plus className="h-4 w-4 mr-1" /> New Import</Button>}
            <Button variant="outline" onClick={() => setExportDialog(true)}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            <Button variant="outline" onClick={() => handleExport('import-history')}><FileSpreadsheet className="h-4 w-4 mr-1" /> Export Import Log</Button>
          </div>
          {showIngestionWizard && <DataIngestionWizard accountId={account.account_id} onClose={() => setShowIngestionWizard(false)} />}
          <Card>
            <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
            <CardContent>
              {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No imports yet.</p> : (
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div key={job.job_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md text-sm">
                      <div className="space-y-0.5">
                        <div className="font-medium flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{job.import_type.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-muted-foreground">{job.file_names.join(', ')} • {format(new Date(job.created_at), 'dd MMM yyyy')}</div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <Badge className={ingestionStatusColors[job.status]}>{job.status}</Badge>
                        {job.status === IngestionStatus.COMPLETED && <div className="text-xs text-muted-foreground">{job.imported_count} imported • {job.error_count} errors</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ 5. INTEGRATIONS ═══ */}
        <TabsContent value="integrations" className="mt-4 space-y-4">
          {/* Built-in integrations */}
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
                    <Badge className={connected ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>{connected ? 'Connected' : 'Not Connected'}</Badge>
                    {lastSync && connected && <p className="text-xs text-muted-foreground">Last sync: {format(new Date(lastSync), 'dd MMM, HH:mm')}</p>}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => toggleIntegration(key)}>{connected ? 'Disconnect' : 'Connect'}</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Custom Portal Integrations */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Portal Integrations</h3>
            <Button size="sm" onClick={() => setShowAddIntegration(true)}><Plus className="h-3 w-3 mr-1" /> Add Integration</Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {customIntegrations.map(int => (
              <Card key={int.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{int.name}</span>
                    {int.connected ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <Badge className={int.connected ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>{int.connected ? 'Connected' : 'Not Connected'}</Badge>
                  {int.apiKey && (
                    <p className="text-xs text-muted-foreground font-mono">Key: ••••{int.apiKey.slice(-4) || '••••'}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{int.description}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => toggleCustomIntegration(int.id)}>
                    {int.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ 6. NOTES ═══ */}
        <TabsContent value="notes" className="mt-4"><NotesPanel notes={notes} onAddNote={handleAddNote} /></TabsContent>

        {/* ═══ 7. DOCUMENTS ═══ */}
        <TabsContent value="documents" className="mt-4">
          <AttachmentUploader attachments={documents.map(d => ({ file_name: d.file_name, file_url: d.file_url }))} onUpload={handleDocUpload} />
          {documents.length > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">By Folder</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(documents.reduce((acc, d) => { (acc[d.folder_path] = acc[d.folder_path] || []).push(d); return acc; }, {} as Record<string, typeof documents>)).map(([folder, docs]) => (
                  <div key={folder} className="mb-3">
                    <p className="text-sm font-medium text-muted-foreground mb-1">{folder}</p>
                    {docs.map(d => (
                      <div key={d.document_id} className="flex items-center gap-2 text-sm p-1.5 pl-4">
                        <FileSpreadsheet className="h-3 w-3 text-muted-foreground" /><span>{d.file_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{format(new Date(d.created_at), 'dd MMM yyyy')}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ 8. CALENDAR ═══ */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          {!showEventForm && <Button onClick={() => setShowEventForm(true)}><CalendarIcon className="h-4 w-4 mr-1" /> Schedule Event</Button>}
          {showEventForm && (
            <Card><CardContent className="p-4">
              <CalendarEventForm onSubmit={handleCreateEvent} onCancel={() => setShowEventForm(false)} defaultTitle={`Follow-up — ${account.account_name}`} defaultEventType={CalendarEventType.FOLLOW_UP} />
            </CardContent></Card>
          )}
          <div className="space-y-3">
            {events.length === 0 && !showEventForm && <p className="text-sm text-muted-foreground">No calendar events.</p>}
            {[...events].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).map(e => (
              <Card key={e.event_id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'dd MMM yyyy, HH:mm')} • {getUserName(e.created_by_user_id)}</p>
                  </div>
                  <Badge variant="outline" className={e.status === CalendarEventStatus.UPCOMING ? 'border-primary text-primary' : e.status === CalendarEventStatus.COMPLETED ? 'border-success text-success' : 'border-muted-foreground text-muted-foreground'}>{e.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ BILLING ═══ */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Payment Plan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={billingCycle} onValueChange={v => setBillingCycle(v as BillingCycle)}>
                  {(['quarterly', 'half_yearly', 'annual'] as BillingCycle[]).map(c => (
                    <div key={c} className="flex items-center space-x-2">
                      <RadioGroupItem value={c} id={`billing-${c}`} />
                      <Label htmlFor={`billing-${c}`} className="text-sm cursor-pointer">{billingCycleLabels[c]}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Billing Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Active Seats</Label>
                    <div className="text-sm font-bold pt-1 text-primary">{activeSeats.length}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total (incl. inactive)</Label>
                    <div className="text-sm font-medium pt-1 text-muted-foreground">{seats.length}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Per Seat Price (₹)</Label>
                    <Input value={perSeatPrice} onChange={e => setPerSeatPrice(e.target.value)} placeholder="e.g. 500" type="number" className="h-8" />
                  </div>
                  <div className="space-y-1 col-span-3">
                    <Label className="text-xs text-muted-foreground">Total Seat Cost (₹)</Label>
                    <div className="text-sm font-bold pt-1">{perSeatPrice ? `₹${(activeSeats.length * parseFloat(perSeatPrice || '0')).toLocaleString('en-IN')}` : '—'}</div>
                  </div>
                </div>
                <div className="border-t border-border/50 pt-3 mt-1" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Plan Amount (₹)</Label>
                    <Input value={planAmount} onChange={e => setPlanAmount(e.target.value)} placeholder="e.g. 50000" type="number" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Billing Start Date</Label>
                    <Input value={billingStartDate} onChange={e => setBillingStartDate(e.target.value)} type="date" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Next Payment Due</Label>
                    <div className="text-sm font-medium pt-1">{nextPaymentDue}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                    <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-001" className="h-8" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Remarks</Label>
                  <Textarea value={billingRemarks} onChange={e => setBillingRemarks(e.target.value)} placeholder="Additional billing notes..." rows={2} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Create Invoice Button */}
          <div className="flex gap-2">
            <Button onClick={() => setShowInvoicePreview(true)}>
              <FileText className="h-4 w-4 mr-1" /> Create Invoice
            </Button>
          </div>

          {/* Invoice Preview Dialog */}
          <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
            <DialogContent className="bg-card max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Invoice Preview</DialogTitle>
                <DialogDescription>Review and copy the invoice payload</DialogDescription>
              </DialogHeader>
              {(() => {
                const now = new Date();
                const invNum = `VTLP-INV-${format(now, 'yyyyMMdd')}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
                const dueDate = new Date(now);
                dueDate.setMonth(dueDate.getMonth() + billingCycleMonths[billingCycle]);
                const seatCost = activeSeats.length * parseFloat(perSeatPrice || '0');
                const plan = parseFloat(planAmount || '0');
                const subtotal = plan + seatCost;
                const gstRate = 0.18;
                const gstAmount = subtotal * gstRate;
                const grandTotal = subtotal + gstAmount;
                const inactiveCount = seats.length - activeSeats.length;

                const payload = {
                  invoice_number: invNum,
                  invoice_date: format(now, 'yyyy-MM-dd'),
                  due_date: format(dueDate, 'yyyy-MM-dd'),
                  from: {
                    company: 'VTLP Technologies Private Limited',
                    address: 'Hyderabad, Telangana, India',
                    gstin: 'XXXXXXXXXXXXXXXXX',
                  },
                  bill_to: {
                    account_name: accountName,
                    owner_name: ownerName,
                    city,
                    email: ownerEmail,
                    phone: ownerPhone,
                  },
                  line_items: [
                    { description: `SaaS Subscription - ${billingCycleLabels[billingCycle]}`, amount: plan },
                    { description: `Active Seats (${activeSeats.length} seats × ₹${perSeatPrice || '0'}/seat)`, amount: seatCost },
                  ],
                  subtotal,
                  gst_rate: '18%',
                  gst_amount: gstAmount,
                  grand_total: grandTotal,
                  billing_cycle: billingCycle,
                  remarks: `Total Seats: ${activeSeats.length} active, ${inactiveCount} inactive. ${billingRemarks}`.trim(),
                };

                console.log('[Invoice Payload]', payload);

                return (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="border-b border-border pb-3">
                      <h3 className="text-lg font-bold text-foreground">VTLP Technologies Private Limited</h3>
                      <p className="text-xs text-muted-foreground">Hyderabad, Telangana, India</p>
                    </div>

                    {/* Invoice Meta */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Invoice #:</span> <span className="font-medium">{invNum}</span></div>
                      <div><span className="text-muted-foreground">Date:</span> {format(now, 'dd MMM yyyy')}</div>
                      <div><span className="text-muted-foreground">Due Date:</span> {format(dueDate, 'dd MMM yyyy')}</div>
                      <div><span className="text-muted-foreground">Billing Cycle:</span> {billingCycleLabels[billingCycle]}</div>
                    </div>

                    {/* Bill To */}
                    <div className="border border-border rounded-md p-3">
                      <p className="text-xs text-muted-foreground font-medium mb-1">BILL TO</p>
                      <p className="text-sm font-semibold">{accountName}</p>
                      <p className="text-sm text-muted-foreground">{ownerName}</p>
                      <p className="text-xs text-muted-foreground">{city} · {ownerEmail} · {ownerPhone}</p>
                    </div>

                    {/* Line Items */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="py-2">SaaS Subscription — {billingCycleLabels[billingCycle]}</td>
                          <td className="py-2 text-right">{plan.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-2">Active Seats ({activeSeats.length} × ₹{perSeatPrice || '0'}/seat)</td>
                          <td className="py-2 text-right">{seatCost.toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-b border-border/50">
                          <td className="py-2 font-medium">Subtotal</td>
                          <td className="py-2 text-right font-medium">₹{subtotal.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-2 text-muted-foreground">GST (18%)</td>
                          <td className="py-2 text-right text-muted-foreground">₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-bold text-foreground">Grand Total</td>
                          <td className="py-2 text-right font-bold text-foreground">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <p className="text-xs text-muted-foreground">Total Seats: {activeSeats.length} active, {inactiveCount} inactive</p>

                    {/* JSON Payload */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View JSON Payload</summary>
                      <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto max-h-48 text-xs">{JSON.stringify(payload, null, 2)}</pre>
                    </details>

                    <DialogFooter className="flex gap-2">
                      <Button variant="outline" onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        toast.success('Invoice payload copied to clipboard');
                      }}>
                        <Copy className="h-4 w-4 mr-1" /> Copy Payload
                      </Button>
                      <Button onClick={() => {
                        toast.success('Invoice download initiated (simulated)');
                      }}>
                        <Download className="h-4 w-4 mr-1" /> Download Invoice
                      </Button>
                    </DialogFooter>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                Payment History
                <Button size="sm" onClick={() => setShowAddPayment(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Payment</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showAddPayment && (
                <Card className="mb-4 border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} type="number" placeholder="50000" className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input value={newPaymentDate} onChange={e => setNewPaymentDate(e.target.value)} type="date" className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Invoice No.</Label>
                        <Input value={newPaymentInvoice} onChange={e => setNewPaymentInvoice(e.target.value)} placeholder="INV-001" className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={newPaymentStatus} onValueChange={v => setNewPaymentStatus(v as 'paid' | 'pending')}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Remarks</Label>
                        <Input value={newPaymentRemarks} onChange={e => setNewPaymentRemarks(e.target.value)} placeholder="Payment notes..." className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Receipt (file name)</Label>
                        <Input value={newPaymentReceipt} onChange={e => setNewPaymentReceipt(e.target.value)} placeholder="receipt.pdf" className="h-8" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddPayment}>Save Payment</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddPayment(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {payments.length === 0 && !showAddPayment ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md text-sm">
                      <div className="space-y-0.5">
                        <div className="font-medium">₹{p.amount.toLocaleString('en-IN')}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(p.date), 'dd MMM yyyy')}
                          {p.invoiceNumber && ` · ${p.invoiceNumber}`}
                          {p.remarks && ` · ${p.remarks}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.receiptFileName && <Badge variant="outline" className="text-xs"><Download className="h-3 w-3 mr-1" />{p.receiptFileName}</Badge>}
                        <Badge className={p.status === 'paid' ? 'bg-success/15 text-success' : p.status === 'overdue' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ 9. TICKETS ═══ */}
        <TabsContent value="tickets" className="mt-4 space-y-3">
          {tickets.length === 0 ? <p className="text-sm text-muted-foreground">No linked tickets.</p> : (
            tickets.map(t => (
              <Link key={t.ticket_id} to="/tickets">
                <Card className="hover:bg-muted/50 transition-colors mb-3">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="font-medium text-sm truncate">{t.subject}</span></div>
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{getUserName(t.assigned_to_user_id)}</span><span>•</span><span>{format(new Date(t.updated_at), 'dd MMM yyyy')}</span>
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
