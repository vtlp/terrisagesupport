import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { seedEnquiries, seedNotes, seedCalendarEvents, seedAccounts, seedUsers, getUserName, getCalendarEventsForEntity, getNextUpcomingEvent } from '@/data/seedData';
import {
  EnquiryStage, EnquiryOutcome, EnquirySource, TenancyType, FocusArea, SalesFocus,
  PrimaryPropertyType, NotInterestedReason, DemoOutcome, EntityType, CalendarEventStatus,
  CalendarEventType, AccountStatus, VerificationStatus, SubmissionStatus,
} from '@/types/core';
import type { Enquiry, Note, CalendarEvent, Account, OnboardingFormSubmission } from '@/types/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { AssignmentSelect } from '@/components/shared/AssignmentSelect';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { toast } from 'sonner';
import { OnboardingSubmissionCard } from '@/components/onboarding/OnboardingSubmissionCard';
import { format } from 'date-fns';
import { useUser } from '@/context/UserContext';
import {
  ArrowLeft, Phone, Mail, MessageSquare, Building2, MapPin, Users, Calendar,
  Send, UserCheck, ClipboardCheck, FileText, AlertTriangle, CheckCircle2, XCircle, Link2, Copy,
} from 'lucide-react';

const PORTAL_OPTIONS = ['MagicBricks', '99acres', 'Housing.com', 'NoBroker', 'Square Yards', 'CommonFloor', 'Other'];
const CURRENT_SYSTEM_OPTIONS = ['CRM', 'Spreadsheet', 'Other'];
import { getCityOptions } from '@/data/lookupData';
const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 India' },
  { code: '+1', label: '🇺🇸 +1 USA' },
  { code: '+44', label: '🇬🇧 +44 UK' },
  { code: '+971', label: '🇦🇪 +971 UAE' },
  { code: '+65', label: '🇸🇬 +65 Singapore' },
  { code: '+61', label: '🇦🇺 +61 Australia' },
];

const stageLabels: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'New Enquiry',
  [EnquiryStage.CONTACTED]: 'Contacted',
  [EnquiryStage.DEMO_SCHEDULED]: 'Demo Scheduled',
  [EnquiryStage.DEMO_COMPLETED]: 'Demo Completed',
  [EnquiryStage.ACCOUNT_CREATED]: 'Account Created',
};

const stageColors: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'bg-muted text-muted-foreground',
  [EnquiryStage.CONTACTED]: 'bg-info/15 text-info',
  [EnquiryStage.DEMO_SCHEDULED]: 'bg-primary/15 text-primary',
  [EnquiryStage.DEMO_COMPLETED]: 'bg-accent/20 text-accent-foreground',
  [EnquiryStage.ACCOUNT_CREATED]: 'bg-success/15 text-success',
};

const outcomeLabels: Record<EnquiryOutcome, string> = {
  [EnquiryOutcome.INTERESTED]: 'Interested',
  [EnquiryOutcome.CALL_LATER]: 'Call Later',
  [EnquiryOutcome.SCHEDULE_DEMO]: 'Schedule Demo',
  [EnquiryOutcome.NOT_INTERESTED]: 'Not Interested',
  [EnquiryOutcome.WRONG_OR_BOUNCED_NUMBER]: 'Wrong/Bounced Number',
};

const sourceLabels: Record<EnquirySource, string> = {
  [EnquirySource.CALL_DIRECT]: 'Direct Call',
  [EnquirySource.LANDING_PAGE]: 'Landing Page',
  [EnquirySource.META_ADS]: 'Meta Ads',
  [EnquirySource.CHAMPION_PARTNER]: 'Champion Partner',
  [EnquirySource.CP_REQUEST_PROJECTS]: 'CP Request',
};

const niReasonLabels: Record<NotInterestedReason, string> = {
  [NotInterestedReason.OTHER_CRM_IN_USE]: 'Other CRM in Use',
  [NotInterestedReason.NOT_RIGHT_PERSON]: 'Not Right Person',
  [NotInterestedReason.NOT_RIGHT_TIME]: 'Not Right Time',
  [NotInterestedReason.TOO_MANY_REQUIREMENTS]: 'Too Many Requirements',
  [NotInterestedReason.BUDGET_CONCERN]: 'Budget Concern',
  [NotInterestedReason.OTHER]: 'Other',
};

const demoOutcomeLabels: Record<DemoOutcome, string> = {
  [DemoOutcome.NO_SHOW]: 'No Show',
  [DemoOutcome.LIKED_WANT_ONBOARD_SOON]: 'Liked — Want to Onboard',
  [DemoOutcome.GHOSTED]: 'Ghosted',
};

export default function EnquiryDetail() {
  const { enquiryId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useUser();

  const initial = seedEnquiries.find(e => e.enquiry_id === enquiryId);
  const [enquiry, setEnquiry] = useState<Enquiry | undefined>(initial ? { ...initial } : undefined);

  // Dialogs
  const [showDemoSchedule, setShowDemoSchedule] = useState(false);
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showOnboardingPack, setShowOnboardingPack] = useState(false);
  const [showDemoOutcome, setShowDemoOutcome] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [pendingStage, setPendingStage] = useState<EnquiryStage | null>(null);
  const [stageOutcome, setStageOutcome] = useState<EnquiryOutcome | null>(null);
  const [stageNiReason, setStageNiReason] = useState<NotInterestedReason | null>(null);
  const [stageNiText, setStageNiText] = useState('');
  const [calendarFilter, setCalendarFilter] = useState<'my' | 'all'>('my');

  // Country codes
  const [phoneCC, setPhoneCC] = useState('+91');
  const [phoneAltCC, setPhoneAltCC] = useState('+91');
  const [consentGiven, setConsentGiven] = useState(false);

  // Current system
  const [currentSystemType, setCurrentSystemType] = useState<string>(() => {
    if (!initial) return 'Other';
    const text = initial.current_system_text.toLowerCase();
    if (text.includes('crm')) return 'CRM';
    if (text.includes('spreadsheet') || text.includes('excel') || text.includes('sheet')) return 'Spreadsheet';
    return 'Other';
  });

  if (!enquiry) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Enquiry not found.</p>
        <Button variant="link" onClick={() => navigate('/enquiries')}>← Back to Pipeline</Button>
      </div>
    );
  }

  const notes = seedNotes.filter(n => enquiry.notes_thread.includes(n.note_id));
  const allEntityEvents = getCalendarEventsForEntity(EntityType.ENQUIRY, enquiry.enquiry_id);
  const events = calendarFilter === 'my'
    ? allEntityEvents.filter(e => e.created_by_user_id === currentUser.user_id)
    : allEntityEvents;
  const nextEvent = getNextUpcomingEvent(EntityType.ENQUIRY, enquiry.enquiry_id);

  const update = (patch: Partial<Enquiry>) => setEnquiry(prev => prev ? { ...prev, ...patch, updated_at: new Date().toISOString() } : prev);

  // Business rules
  const canScheduleDemo = () => {
    const missing: string[] = [];
    if (!enquiry.tenancy_type) missing.push('Tenancy Type');
    if (!enquiry.team_size_estimate) missing.push('Team Size');
    if (!enquiry.contact_email) missing.push('Email');
    if (!enquiry.whatsapp_enabled && !enquiry.contact_phone) missing.push('Phone or WhatsApp');
    return missing;
  };

  const canConvert = () => {
    if (enquiry.stage !== EnquiryStage.DEMO_COMPLETED) return 'Demo must be completed first';
    if (!enquiry.onboarding_pack_sent) return 'Onboarding form must be sent first';
    if (!enquiry.onboarding_submission) return 'Onboarding form has not been submitted yet';
    if (enquiry.onboarding_submission.status !== SubmissionStatus.APPROVED) return 'Onboarding form must be reviewed and approved';
    return null;
  };

  const handleStageChange = (newStage: EnquiryStage) => {
    if (isConverted) return;
    const stageOrder = Object.values(EnquiryStage);
    const currentIdx = stageOrder.indexOf(enquiry.stage);
    const newIdx = stageOrder.indexOf(newStage);

    // Allow backward movement with confirmation
    if (newIdx < currentIdx) {
      setPendingStage(newStage);
      setShowRevertConfirm(true);
      return;
    }

    if (newIdx <= currentIdx) return;

    // Forward transitions
    if (newStage === EnquiryStage.CONTACTED) {
      setPendingStage(newStage);
      setStageOutcome(null);
      setStageNiReason(null);
      setStageNiText('');
      setShowStageModal(true);
    } else if (newStage === EnquiryStage.DEMO_SCHEDULED) {
      const missing = canScheduleDemo();
      if (missing.length > 0) {
        toast.error(`Prerequisites missing: ${missing.join(', ')}`);
        return;
      }
      setShowDemoSchedule(true);
    } else if (newStage === EnquiryStage.DEMO_COMPLETED) {
      setShowDemoOutcome(true);
    } else if (newStage === EnquiryStage.ACCOUNT_CREATED) {
      const err = canConvert();
      if (err) {
        toast.error(err);
        return;
      }
      setShowConvertDialog(true);
    } else {
      update({ stage: newStage });
    }
  };

  const handleRevertConfirm = () => {
    if (!pendingStage) return;
    // Log system note for revert
    const newNote: Note = {
      note_id: `N_RV_${Date.now()}`,
      entity_type: EntityType.ENQUIRY,
      entity_id: enquiry.enquiry_id,
      note_text: `[System] Stage reverted to "${stageLabels[pendingStage]}" by ${currentUser.full_name} at ${format(new Date(), 'dd MMM yyyy, HH:mm')}. Reason: damage control.`,
      created_by_user_id: currentUser.user_id,
      created_at: new Date().toISOString(),
    };
    seedNotes.push(newNote);
    update({ notes_thread: [...enquiry.notes_thread, newNote.note_id], stage: pendingStage });
    toast.warning(`Stage reverted to ${stageLabels[pendingStage]}`);
    setShowRevertConfirm(false);
    setPendingStage(null);
  };

  const handleStageModalConfirm = () => {
    if (pendingStage === EnquiryStage.CONTACTED) {
      if (!stageOutcome) {
        toast.error('Please select an outcome before proceeding');
        return;
      }
      if (stageOutcome === EnquiryOutcome.NOT_INTERESTED && !stageNiReason) {
        toast.error('Please select a reason for Not Interested');
        return;
      }
      update({
        stage: EnquiryStage.CONTACTED,
        outcome: stageOutcome,
        not_interested_reason: stageOutcome === EnquiryOutcome.NOT_INTERESTED ? stageNiReason : null,
        not_interested_text: stageOutcome === EnquiryOutcome.NOT_INTERESTED ? stageNiText : '',
      });
      // Timeline note for stage update
      const stageNote: Note = {
        note_id: `N_ST_${Date.now()}`,
        entity_type: EntityType.ENQUIRY,
        entity_id: enquiry.enquiry_id,
        note_text: `[System] Stage updated to "Contacted" by ${currentUser.full_name} at ${format(new Date(), 'dd MMM yyyy, HH:mm')}`,
        created_by_user_id: currentUser.user_id,
        created_at: new Date().toISOString(),
      };
      seedNotes.push(stageNote);
      update({ notes_thread: [...enquiry.notes_thread, stageNote.note_id] });
      toast.success('Stage updated to Contacted');

      // CALL_LATER triggers calendar event
      if (stageOutcome === EnquiryOutcome.CALL_LATER) {
        setShowStageModal(false);
        setPendingStage(null);
        setShowCalendarForm(true);
        return;
      }

      if (stageOutcome === EnquiryOutcome.SCHEDULE_DEMO) {
        const missing = canScheduleDemo();
        if (missing.length > 0) {
          toast.warning(`Fill prerequisites before scheduling: ${missing.join(', ')}`);
        }
      }
    }
    setShowStageModal(false);
    setPendingStage(null);
  };

  const handleOutcomeChange = (outcome: EnquiryOutcome) => {
    update({ outcome });
    if (outcome === EnquiryOutcome.CALL_LATER) {
      setShowCalendarForm(true);
      return;
    }
    if (outcome === EnquiryOutcome.INTERESTED) {
      toast.info('Consider creating a follow-up calendar event and sending WhatsApp content');
    }
    if (outcome === EnquiryOutcome.SCHEDULE_DEMO) {
      const missing = canScheduleDemo();
      if (missing.length > 0) {
        toast.warning(`Fill prerequisites before scheduling: ${missing.join(', ')}`);
      } else {
        setShowDemoSchedule(true);
      }
    }
    if (outcome === EnquiryOutcome.NOT_INTERESTED) {
      toast.info('Please select a reason and add a note');
    }
  };

  const handleDemoScheduled = (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    seedCalendarEvents.push({
      event_id: `CE_DEMO_${Date.now()}`,
      entity_type: EntityType.ENQUIRY,
      entity_id: enquiry.enquiry_id,
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      created_by_user_id: currentUser.user_id,
      notes: data.notes || undefined,
      status: CalendarEventStatus.UPCOMING,
      event_type: data.event_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    update({ stage: EnquiryStage.DEMO_SCHEDULED, outcome: EnquiryOutcome.SCHEDULE_DEMO, demo_event_id: 'CE_NEW' });
    toast.success(`Demo "${data.title}" scheduled for ${format(data.date, 'dd MMM yyyy')} at ${data.time}`);
    setShowDemoSchedule(false);
  };

  const handleDemoOutcome = (outcome: DemoOutcome) => {
    update({ stage: EnquiryStage.DEMO_COMPLETED, demo_outcome: outcome });
    if (outcome === DemoOutcome.NO_SHOW) {
      toast.warning('No show — schedule a follow-up event');
      setShowCalendarForm(true);
    } else if (outcome === DemoOutcome.LIKED_WANT_ONBOARD_SOON) {
      toast.success('Great! Capture onboarding date and send onboarding pack');
    } else if (outcome === DemoOutcome.GHOSTED) {
      toast.warning('Ghosted — create a follow-up event');
      setShowCalendarForm(true);
    }
    setShowDemoOutcome(false);
  };

  const getOnboardingFormUrl = (packType: string) => {
    const base = 'https://terrisage-agency-onboard.lovable.app/onboarding';
    const path = packType === 'PACK_BUILDER_01' ? 'builder' : 'agency';
    return `${base}/${path}?enquiry_id=${enquiry.enquiry_id}`;
  };

  const handleSendOnboardingPack = (packId: string) => {
    const formLink = getOnboardingFormUrl(packId);
    navigator.clipboard.writeText(formLink);
    update({ onboarding_pack_sent: true, onboarding_pack_id: packId, onboarding_form_link: formLink });
    // Log timeline note
    const linkNote: Note = {
      note_id: `N_LINK_${Date.now()}`,
      entity_type: EntityType.ENQUIRY,
      entity_id: enquiry.enquiry_id,
      note_text: `[System] Onboarding form link sent by ${currentUser.full_name}: ${formLink}`,
      created_by_user_id: currentUser.user_id,
      created_at: new Date().toISOString(),
    };
    seedNotes.push(linkNote);
    update({ notes_thread: [...enquiry.notes_thread, linkNote.note_id] });
    toast.success('Onboarding form link copied to clipboard');
    setShowOnboardingPack(false);
  };

  const handleApproveSubmission = () => {
    if (!enquiry.onboarding_submission) return;
    update({
      onboarding_submission: {
        ...enquiry.onboarding_submission,
        status: SubmissionStatus.APPROVED,
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: currentUser.user_id,
      },
    });
    toast.success('Onboarding form approved! You can now convert to account.');
  };

  const handleRejectSubmission = () => {
    if (!enquiry.onboarding_submission) return;
    update({
      onboarding_submission: {
        ...enquiry.onboarding_submission,
        status: SubmissionStatus.REJECTED,
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: currentUser.user_id,
      },
    });
    toast.warning('Onboarding form rejected. You can re-send the form link.');
  };

  const handleResendFormLink = () => {
    if (enquiry.onboarding_form_link) {
      navigator.clipboard.writeText(enquiry.onboarding_form_link);
      // Reset submission
      update({ onboarding_submission: null });
      toast.success('Form link copied. Submission reset for re-submission.');
    }
  };

  const handleConvertToAccount = () => {
    const sub = enquiry.onboarding_submission;
    const accountName = sub ? sub.company_name : enquiry.company_name;
    const ownerName = sub ? sub.owner_name : enquiry.contact_name;
    update({ stage: EnquiryStage.ACCOUNT_CREATED });
    toast.success(`Account "${accountName}" created from ${sub ? 'form submission' : 'enquiry'} data! Owner: ${ownerName}`);
    setShowConvertDialog(false);
  };

  const handleCalendarEventCreated = (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    seedCalendarEvents.push({
      event_id: `CE_${Date.now()}`,
      entity_type: EntityType.ENQUIRY,
      entity_id: enquiry.enquiry_id,
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      created_by_user_id: currentUser.user_id,
      notes: data.notes || undefined,
      status: CalendarEventStatus.UPCOMING,
      event_type: data.event_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    toast.success(`Calendar event "${data.title}" created`);
    setShowCalendarForm(false);
  };

  const handleAddNote = (text: string) => {
    const newNote: Note = {
      note_id: `N_${Date.now()}`,
      entity_type: EntityType.ENQUIRY,
      entity_id: enquiry.enquiry_id,
      note_text: text,
      created_by_user_id: currentUser.user_id,
      created_at: new Date().toISOString(),
    };
    seedNotes.push(newNote);
    update({ notes_thread: [...enquiry.notes_thread, newNote.note_id] });
    toast.success('Note added');
  };

  const isConverted = enquiry.stage === EnquiryStage.ACCOUNT_CREATED;

  const handleCurrentSystemChange = (val: string) => {
    setCurrentSystemType(val);
    if (val !== 'Other') {
      update({ current_system_text: val });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/enquiries')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <span className="text-xs text-muted-foreground font-mono">{enquiry.enquiry_id}</span>
      </div>

      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <Input
                    value={enquiry.company_name}
                    onChange={e => update({ company_name: e.target.value })}
                    disabled={isConverted}
                    className="text-xl font-semibold leading-none tracking-tight border-transparent bg-transparent px-0 h-auto focus-visible:border-input focus-visible:bg-background focus-visible:px-3"
                  />
                  <p className="text-sm text-muted-foreground mt-1">{sourceLabels[enquiry.source]}</p>
                </div>
                <Badge className={stageColors[enquiry.stage]}>{stageLabels[enquiry.stage]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Contact Name</Label>
                  <Input value={enquiry.contact_name} onChange={e => update({ contact_name: e.target.value })} disabled={isConverted} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </Label>
                  <div className="flex gap-1">
                    <Select value={phoneCC} onValueChange={setPhoneCC} disabled={isConverted}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map(cc => <SelectItem key={cc.code} value={cc.code}>{cc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={enquiry.contact_phone} onChange={e => update({ contact_phone: e.target.value })} disabled={isConverted} className="flex-1" />
                    <div className="flex items-center gap-1.5 px-2 border rounded-md">
                      <Switch checked={enquiry.whatsapp_enabled} onCheckedChange={v => update({ whatsapp_enabled: v })} disabled={isConverted} />
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Alt Phone</Label>
                  <div className="flex gap-1">
                    <Select value={phoneAltCC} onValueChange={setPhoneAltCC} disabled={isConverted}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map(cc => <SelectItem key={cc.code} value={cc.code}>{cc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={enquiry.contact_phone_alt} onChange={e => update({ contact_phone_alt: e.target.value })} disabled={isConverted} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                  <Input value={enquiry.contact_email} onChange={e => update({ contact_email: e.target.value })} disabled={isConverted} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> City</Label>
                  <Select value={enquiry.city} onValueChange={v => update({ city: v })} disabled={isConverted}>
                    <SelectTrigger><SelectValue placeholder="Select city…" /></SelectTrigger>
                    <SelectContent className="max-h-48">
                      {getCityOptions().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox checked={consentGiven} onCheckedChange={(v) => setConsentGiven(!!v)} disabled={isConverted} />
                <Label className="text-sm text-muted-foreground">Contact consent received</Label>
              </div>

              {/* Tenancy Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Tenancy Type</Label>
                  <Select value={enquiry.tenancy_type ?? 'none'} onValueChange={v => update({ tenancy_type: v === 'none' ? null : v as TenancyType })} disabled={isConverted}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Set</SelectItem>
                      <SelectItem value={TenancyType.AGENCY_BROKERAGE_CONSULTANCY}>Agency / Brokerage</SelectItem>
                      <SelectItem value={TenancyType.BUILDER_DEVELOPER}>Builder / Developer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Assigned To</Label>
                  <AssignmentSelect value={enquiry.assigned_to_user_id} onChange={v => { update({ assigned_to_user_id: v }); toast.success(`Assigned to ${getUserName(v)}`); }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tenancy-Dependent Fields */}
          {enquiry.tenancy_type && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {enquiry.tenancy_type === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency Details' : 'Builder Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Team Size</Label>
                    <Input type="number" value={enquiry.team_size_estimate ?? ''} onChange={e => update({ team_size_estimate: e.target.value ? parseInt(e.target.value) : null })} disabled={isConverted} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Current System</Label>
                    <div className="flex gap-2">
                      <Select value={currentSystemType} onValueChange={handleCurrentSystemChange} disabled={isConverted}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENT_SYSTEM_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {currentSystemType === 'Other' && (
                        <Input value={enquiry.current_system_text} onChange={e => update({ current_system_text: e.target.value })} disabled={isConverted} placeholder="Specify..." className="flex-1" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Focus Area */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Focus Area</Label>
                  <div className="flex gap-3">
                    {Object.values(FocusArea).map(fa => (
                      <label key={fa} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={enquiry.focus_area.includes(fa)}
                          onCheckedChange={(checked) => {
                            const arr = checked ? [...enquiry.focus_area, fa] : enquiry.focus_area.filter(f => f !== fa);
                            update({ focus_area: arr });
                          }}
                          disabled={isConverted}
                        />
                        {fa}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sales Focus */}
                {enquiry.focus_area.includes(FocusArea.SALES) && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sales Focus</Label>
                    <div className="flex flex-wrap gap-3">
                      {Object.values(SalesFocus).map(sf => (
                        <label key={sf} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={enquiry.sales_focus.includes(sf)}
                            onCheckedChange={(checked) => {
                              const arr = checked ? [...enquiry.sales_focus, sf] : enquiry.sales_focus.filter(f => f !== sf);
                              update({ sales_focus: arr });
                            }}
                            disabled={isConverted}
                          />
                          {sf.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Property Types */}
                {enquiry.sales_focus.some(sf => sf === SalesFocus.PRIMARY_ONLY || sf === SalesFocus.PRIMARY_AND_SECONDARY) && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Primary Property Types</Label>
                    <div className="flex flex-wrap gap-3">
                      {Object.values(PrimaryPropertyType).map(pt => (
                        <label key={pt} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={enquiry.primary_property_types.includes(pt)}
                            onCheckedChange={(checked) => {
                              const arr = checked ? [...enquiry.primary_property_types, pt] : enquiry.primary_property_types.filter(p => p !== pt);
                              update({ primary_property_types: arr });
                            }}
                            disabled={isConverted}
                          />
                          {pt}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Portals — Multi-select checkboxes */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Portals in Use</Label>
                  <div className="flex flex-wrap gap-3">
                    {PORTAL_OPTIONS.map(portal => (
                      <label key={portal} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={enquiry.portals_in_use.includes(portal)}
                          onCheckedChange={(checked) => {
                            const arr = checked
                              ? [...enquiry.portals_in_use, portal]
                              : enquiry.portals_in_use.filter(p => p !== portal);
                            update({ portals_in_use: arr });
                          }}
                          disabled={isConverted}
                        />
                        {portal}
                      </label>
                    ))}
                  </div>
                </div>

                {enquiry.approx_onboarding_date && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Approx. Onboarding Date</Label>
                    <p className="text-sm">{enquiry.approx_onboarding_date}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stage Stepper */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pipeline Stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {Object.values(EnquiryStage).map((s, i, arr) => {
                  const currentIdx = arr.indexOf(enquiry.stage);
                  const isPast = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  const isNext = i === currentIdx + 1;
                  const isClickable = (isNext || isPast) && !isConverted;
                  return (
                    <div key={s} className="flex items-center gap-1 flex-shrink-0">
                      <button
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          isCurrent ? 'bg-primary text-primary-foreground border-primary' :
                          isPast ? 'bg-success/15 text-success border-success/30' :
                          'bg-muted text-muted-foreground border-border'
                        } ${isClickable ? 'cursor-pointer hover:border-primary hover:text-primary' : 'cursor-default'}`}
                        onClick={() => isClickable && handleStageChange(s)}
                        disabled={!isClickable}
                      >
                        {isPast && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                        {stageLabels[s]}
                      </button>
                      {i < arr.length - 1 && <span className={`text-xs ${isPast ? 'text-success' : 'text-muted-foreground'}`}>→</span>}
                    </div>
                  );
                })}
              </div>

              {/* Current outcome display */}
              {enquiry.outcome && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-xs text-muted-foreground">
                    {enquiry.stage === EnquiryStage.CONTACTED ? 'Latest Contact Outcome:' : 'Outcome:'}
                  </Label>
                  <Badge variant="outline">{outcomeLabels[enquiry.outcome]}</Badge>
                  {enquiry.outcome === EnquiryOutcome.NOT_INTERESTED && enquiry.not_interested_reason && (
                    <Badge variant="outline" className="text-destructive border-destructive/30">{niReasonLabels[enquiry.not_interested_reason]}</Badge>
                  )}
                </div>
              )}

              {enquiry.demo_outcome && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Demo Outcome:</Label>
                  <Badge variant="outline">{demoOutcomeLabels[enquiry.demo_outcome]}</Badge>
                </div>
              )}

              {enquiry.onboarding_pack_sent && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Onboarding pack sent ({enquiry.onboarding_pack_id})</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="pt-6">
              <NotesPanel notes={notes} onAddNote={handleAddNote} />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Next Action */}
          {nextEvent && (
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" /> Next Action
                </h4>
                <p className="text-sm font-medium">{nextEvent.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(nextEvent.scheduled_at), 'dd MMM yyyy, HH:mm')}</p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!isConverted && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => setShowCalendarForm(true)}>
                  <Calendar className="h-4 w-4 mr-2" /> Create Calendar Event
                </Button>

                {(enquiry.stage === EnquiryStage.CONTACTED || enquiry.stage === EnquiryStage.NEW_ENQUIRY) && (
                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                    const missing = canScheduleDemo();
                    if (missing.length > 0) {
                      toast.error(`Fill prerequisites: ${missing.join(', ')}`);
                    } else {
                      setShowDemoSchedule(true);
                    }
                  }}>
                    <ClipboardCheck className="h-4 w-4 mr-2" /> Schedule Demo
                  </Button>
                )}

                {enquiry.stage === EnquiryStage.DEMO_SCHEDULED && (
                  <Button variant="outline" className="w-full justify-start" onClick={() => setShowDemoOutcome(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Record Demo Outcome
                  </Button>
                )}

                {(enquiry.stage === EnquiryStage.DEMO_COMPLETED || enquiry.stage === EnquiryStage.DEMO_SCHEDULED) && !enquiry.onboarding_pack_sent && (
                  <Button variant="outline" className="w-full justify-start" onClick={() => setShowOnboardingPack(true)}>
                    <Link2 className="h-4 w-4 mr-2" /> Send Onboarding Form Link
                  </Button>
                )}

                <Button
                  className="w-full justify-start"
                  disabled={!!canConvert()}
                  onClick={() => setShowConvertDialog(true)}
                  title={canConvert() ?? ''}
                >
                  <UserCheck className="h-4 w-4 mr-2" /> Convert to Account
                </Button>
                {canConvert() && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {canConvert()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Onboarding Submission Review */}
          {!isConverted && (
            <OnboardingSubmissionCard
              formLink={enquiry.onboarding_form_link}
              submission={enquiry.onboarding_submission}
              packSent={enquiry.onboarding_pack_sent}
              onApprove={handleApproveSubmission}
              onReject={handleRejectSubmission}
              onResendLink={handleResendFormLink}
            />
          )}

          {isConverted && (
            <Card className="border-success/30">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="font-medium text-success">Converted to Account</p>
                <p className="text-xs text-muted-foreground mt-1">{enquiry.company_name}</p>
              </CardContent>
            </Card>
          )}

          {/* Enquiry Calendar */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Enquiry Calendar</CardTitle>
                <div className="flex gap-1">
                  <Button variant={calendarFilter === 'my' ? 'default' : 'outline'} size="sm" className="text-xs h-6 px-2" onClick={() => setCalendarFilter('my')}>My</Button>
                  <Button variant={calendarFilter === 'all' ? 'default' : 'outline'} size="sm" className="text-xs h-6 px-2" onClick={() => setCalendarFilter('all')}>All</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.length === 0 && <p className="text-sm text-muted-foreground">No events.</p>}
              {events.map(e => (
                <div key={e.event_id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                  <div>
                    <p className="font-medium text-xs">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'dd MMM, HH:mm')}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{e.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardContent className="pt-6">
              <AttachmentUploader attachments={[]} onUpload={(name) => toast.success(`${name} uploaded`)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Demo Schedule Dialog */}
      <Dialog open={showDemoSchedule} onOpenChange={setShowDemoSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Demo</DialogTitle>
            <DialogDescription>Schedule a demo for {enquiry.company_name}</DialogDescription>
          </DialogHeader>
          <CalendarEventForm
            defaultTitle={`Demo — ${enquiry.company_name}`}
            defaultEventType={CalendarEventType.DEMO}
            onSubmit={handleDemoScheduled}
            onCancel={() => setShowDemoSchedule(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Calendar Event Dialog */}
      <Dialog open={showCalendarForm} onOpenChange={setShowCalendarForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Calendar Event</DialogTitle>
            <DialogDescription>Schedule a follow-up or next action</DialogDescription>
          </DialogHeader>
          <CalendarEventForm
            defaultTitle={`Call back — ${enquiry.company_name}`}
            defaultEventType={enquiry.outcome === EnquiryOutcome.CALL_LATER ? CalendarEventType.CALL_BACK : CalendarEventType.FOLLOW_UP}
            onSubmit={handleCalendarEventCreated}
            onCancel={() => setShowCalendarForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Demo Outcome Dialog */}
      <Dialog open={showDemoOutcome} onOpenChange={setShowDemoOutcome}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Demo Outcome</DialogTitle>
            <DialogDescription>What happened during the demo?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {Object.values(DemoOutcome).map(d => (
              <Button key={d} variant="outline" className="w-full justify-start" onClick={() => handleDemoOutcome(d)}>
                {d === DemoOutcome.NO_SHOW && <XCircle className="h-4 w-4 mr-2 text-destructive" />}
                {d === DemoOutcome.LIKED_WANT_ONBOARD_SOON && <CheckCircle2 className="h-4 w-4 mr-2 text-success" />}
                {d === DemoOutcome.GHOSTED && <AlertTriangle className="h-4 w-4 mr-2 text-warning" />}
                {demoOutcomeLabels[d]}
              </Button>
            ))}
          </div>
          {enquiry.demo_outcome === DemoOutcome.LIKED_WANT_ONBOARD_SOON && (
            <div className="space-y-2 mt-2">
              <Label className="text-xs">Approx. Onboarding Date</Label>
              <Input type="date" value={enquiry.approx_onboarding_date ?? ''} onChange={e => update({ approx_onboarding_date: e.target.value })} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Onboarding Pack Dialog */}
      <Dialog open={showOnboardingPack} onOpenChange={setShowOnboardingPack}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Onboarding Pack</DialogTitle>
            <DialogDescription>Choose a pack and copy content to send via email</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => handleSendOnboardingPack('PACK_AGENCY_01')}>
              <FileText className="h-4 w-4 mr-2" /> Agency Onboarding Pack
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => handleSendOnboardingPack('PACK_BUILDER_01')}>
              <FileText className="h-4 w-4 mr-2" /> Builder Onboarding Pack
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Account Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Account</DialogTitle>
            <DialogDescription>This will create an account from this enquiry and carry over all data and notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p><strong>Account Name:</strong> {enquiry.company_name}</p>
              <p><strong>City:</strong> {enquiry.city}</p>
              <p><strong>Type:</strong> {enquiry.tenancy_type === TenancyType.AGENCY_BROKERAGE_CONSULTANCY ? 'Agency' : 'Builder'}</p>
              <p><strong>Owner:</strong> {enquiry.contact_name}</p>
              <p><strong>Notes:</strong> {enquiry.notes_thread.length} note(s) will be carried over</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
              <Button onClick={handleConvertToAccount}>Convert Now</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stage Transition Modal */}
      <Dialog open={showStageModal} onOpenChange={v => { if (!v) { setShowStageModal(false); setPendingStage(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to "{pendingStage ? stageLabels[pendingStage] : ''}"</DialogTitle>
            <DialogDescription>Complete the required fields to advance this enquiry.</DialogDescription>
          </DialogHeader>
          {pendingStage === EnquiryStage.CONTACTED && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Outcome <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.values(EnquiryOutcome).map(o => (
                    <button
                      key={o}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-colors ${
                        stageOutcome === o ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setStageOutcome(o)}
                    >
                      {o === EnquiryOutcome.INTERESTED && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
                      {o === EnquiryOutcome.CALL_LATER && <Calendar className="h-4 w-4 text-primary flex-shrink-0" />}
                      {o === EnquiryOutcome.SCHEDULE_DEMO && <ClipboardCheck className="h-4 w-4 text-primary flex-shrink-0" />}
                      {o === EnquiryOutcome.NOT_INTERESTED && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                      {o === EnquiryOutcome.WRONG_OR_BOUNCED_NUMBER && <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />}
                      {outcomeLabels[o]}
                    </button>
                  ))}
                </div>
              </div>

              {stageOutcome === EnquiryOutcome.NOT_INTERESTED && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reason <span className="text-destructive">*</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(NotInterestedReason).map(r => (
                      <Badge
                        key={r}
                        variant={stageNiReason === r ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setStageNiReason(r)}
                      >
                        {niReasonLabels[r]}
                      </Badge>
                    ))}
                  </div>
                  {stageNiReason === NotInterestedReason.OTHER && (
                    <Textarea
                      placeholder="Provide details..."
                      value={stageNiText}
                      onChange={e => setStageNiText(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => { setShowStageModal(false); setPendingStage(null); }}>Cancel</Button>
                <Button onClick={handleStageModalConfirm}>Confirm Transition</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revert Stage Confirmation */}
      <Dialog open={showRevertConfirm} onOpenChange={v => { if (!v) { setShowRevertConfirm(false); setPendingStage(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert Stage</DialogTitle>
            <DialogDescription>
              Are you sure you want to revert to "{pendingStage ? stageLabels[pendingStage] : ''}"? This is for damage control only.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => { setShowRevertConfirm(false); setPendingStage(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevertConfirm}>Revert Stage</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
