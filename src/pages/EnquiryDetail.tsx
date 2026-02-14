import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { seedEnquiries, seedNotes, seedCalendarEvents, seedAccounts, seedUsers, getUserName, getCalendarEventsForEntity, getNextUpcomingEvent } from '@/data/seedData';
import {
  EnquiryStage, EnquiryOutcome, EnquirySource, TenancyType, FocusArea, SalesFocus,
  PrimaryPropertyType, NotInterestedReason, DemoOutcome, EntityType, CalendarEventStatus,
  AccountStatus, VerificationStatus,
} from '@/types/core';
import type { Enquiry, Note, CalendarEvent, Account } from '@/types/core';
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
import { StageChangeModal } from '@/components/shared/StageChangeModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useUser } from '@/context/UserContext';
import {
  ArrowLeft, Phone, Mail, MessageSquare, Building2, MapPin, Users, Calendar,
  Send, UserCheck, ClipboardCheck, FileText, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';

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
  const [showStageChange, setShowStageChange] = useState(false);
  const [pendingStage, setPendingStage] = useState<EnquiryStage | null>(null);

  if (!enquiry) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Enquiry not found.</p>
        <Button variant="link" onClick={() => navigate('/enquiries')}>← Back to Pipeline</Button>
      </div>
    );
  }

  const notes = seedNotes.filter(n => enquiry.notes_thread.includes(n.note_id));
  const events = getCalendarEventsForEntity(EntityType.ENQUIRY, enquiry.enquiry_id);
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
    if (!enquiry.onboarding_pack_sent) return 'Onboarding pack must be sent first';
    return null;
  };

  const handleStageChange = (newStage: EnquiryStage) => {
    if (newStage === EnquiryStage.DEMO_SCHEDULED) {
      const missing = canScheduleDemo();
      if (missing.length > 0) {
        toast.error(`Prerequisites missing: ${missing.join(', ')}`);
        return;
      }
      setShowDemoSchedule(true);
      return;
    }
    if (newStage === EnquiryStage.DEMO_COMPLETED) {
      setShowDemoOutcome(true);
      return;
    }
    if (newStage === EnquiryStage.ACCOUNT_CREATED) {
      const err = canConvert();
      if (err) { toast.error(err); return; }
      setShowConvertDialog(true);
      return;
    }
    // For CONTACTED or beyond: show stage change modal for outcome enforcement
    if (newStage !== EnquiryStage.NEW_ENQUIRY) {
      setPendingStage(newStage);
      setShowStageChange(true);
      return;
    }
    update({ stage: newStage });
  };

  const handleStageChangeConfirm = (outcome: EnquiryOutcome, note: string, niReason?: NotInterestedReason) => {
    if (!pendingStage) return;
    update({
      stage: pendingStage,
      outcome,
      ...(niReason ? { not_interested_reason: niReason } : {}),
    });
    if (note.trim()) {
      handleAddNote(note);
    }
    toast.success(`Stage updated to ${stageLabels[pendingStage]}`);
    setShowStageChange(false);
    setPendingStage(null);
  };

  const handleOutcomeChange = (outcome: EnquiryOutcome) => {
    update({ outcome });
    if (outcome === EnquiryOutcome.INTERESTED || outcome === EnquiryOutcome.CALL_LATER) {
      toast.info('Consider creating a follow-up calendar event and sending WhatsApp content');
    }
    if (outcome === EnquiryOutcome.SCHEDULE_DEMO) {
      const missing = canScheduleDemo();
      if (missing.length > 0) {
        toast.warning(`Fill prerequisites before scheduling: ${missing.join(', ')}`);
      }
    }
    if (outcome === EnquiryOutcome.NOT_INTERESTED) {
      toast.info('Please select a reason and add a note');
    }
  };

  const handleDemoScheduled = (data: { title: string; date: Date; time: string; notes: string }) => {
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

  const handleSendOnboardingPack = (packId: string) => {
    update({ onboarding_pack_sent: true, onboarding_pack_id: packId });
    toast.success('Onboarding pack marked as sent. Content copied to clipboard.');
    setShowOnboardingPack(false);
  };

  const handleConvertToAccount = () => {
    update({ stage: EnquiryStage.ACCOUNT_CREATED });
    toast.success(`Account "${enquiry.company_name}" created! All data and notes carried over.`);
    setShowConvertDialog(false);
  };

  const handleCalendarEventCreated = (data: { title: string; date: Date; time: string; notes: string }) => {
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
                  <CardTitle className="text-xl">{enquiry.company_name}</CardTitle>
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
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
                  <Input value={enquiry.contact_phone} onChange={e => update({ contact_phone: e.target.value })} disabled={isConverted} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Alt Phone</Label>
                  <Input value={enquiry.contact_phone_alt} onChange={e => update({ contact_phone_alt: e.target.value })} disabled={isConverted} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                  <Input value={enquiry.contact_email} onChange={e => update({ contact_email: e.target.value })} disabled={isConverted} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> City</Label>
                  <Input value={enquiry.city} onChange={e => update({ city: e.target.value })} disabled={isConverted} />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Switch checked={enquiry.whatsapp_enabled} onCheckedChange={v => update({ whatsapp_enabled: v })} disabled={isConverted} />
                  <Label className="text-sm flex items-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</Label>
                </div>
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
                    <Input value={enquiry.current_system_text} onChange={e => update({ current_system_text: e.target.value })} disabled={isConverted} />
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

                {/* Conditional: Sales Focus */}
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

                {/* Conditional: Property Types */}
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

                {/* Portals */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Portals in Use</Label>
                  <Input
                    value={enquiry.portals_in_use.join(', ')}
                    onChange={e => update({ portals_in_use: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="MagicBricks, 99acres, Housing.com..."
                    disabled={isConverted}
                  />
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

          {/* Stage + Outcome Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stage & Outcome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stage</Label>
                  <Select value={enquiry.stage} onValueChange={v => handleStageChange(v as EnquiryStage)} disabled={isConverted}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(EnquiryStage).map(s => (
                        <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Outcome</Label>
                  <Select value={enquiry.outcome ?? 'none'} onValueChange={v => handleOutcomeChange(v as EnquiryOutcome)} disabled={isConverted}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {Object.values(EnquiryOutcome).map(o => (
                        <SelectItem key={o} value={o}>{outcomeLabels[o]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Not Interested Reasons */}
              {enquiry.outcome === EnquiryOutcome.NOT_INTERESTED && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(NotInterestedReason).map(r => (
                      <Badge
                        key={r}
                        variant={enquiry.not_interested_reason === r ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => update({ not_interested_reason: r })}
                      >
                        {niReasonLabels[r]}
                      </Badge>
                    ))}
                  </div>
                  {enquiry.not_interested_reason === NotInterestedReason.OTHER && (
                    <Textarea
                      placeholder="Provide details..."
                      value={enquiry.not_interested_text}
                      onChange={e => update({ not_interested_text: e.target.value })}
                    />
                  )}
                </div>
              )}

              {/* Demo Outcome display */}
              {enquiry.demo_outcome && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Demo Outcome:</Label>
                  <Badge variant="outline">{demoOutcomeLabels[enquiry.demo_outcome]}</Badge>
                </div>
              )}

              {/* Onboarding Pack Status */}
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

        {/* Right Sidebar — Actions + Calendar */}
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
                    <Send className="h-4 w-4 mr-2" /> Send Onboarding Pack
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

          {isConverted && (
            <Card className="border-success/30">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="font-medium text-success">Converted to Account</p>
                <p className="text-xs text-muted-foreground mt-1">{enquiry.company_name}</p>
              </CardContent>
            </Card>
          )}

          {/* Calendar Events */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Calendar Events</CardTitle></CardHeader>
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
            defaultTitle={`Follow-up — ${enquiry.company_name}`}
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

      {/* Stage Change Enforcement Modal */}
      {pendingStage && (
        <StageChangeModal
          open={showStageChange}
          onOpenChange={(open) => {
            setShowStageChange(open);
            if (!open) setPendingStage(null);
          }}
          targetStage={pendingStage}
          currentOutcome={enquiry.outcome}
          onConfirm={handleStageChangeConfirm}
        />
      )}
    </div>
  );
}
