import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, CheckCircle2, XCircle, Clock, Phone, Mail, Save, ExternalLink, CalendarPlus, Copy as CopyIcon, ChevronRight, ChevronDown, Check, Undo2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { EventDetailDialog, EventRow } from '@/components/shared/EventDetailDialog';
import { CalendarEventType } from '@/types/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SendOnboardingDialog } from '@/components/shared/SendOnboardingDialog';
import { PhoneInput, splitPhone, joinPhone, DEFAULT_COUNTRY_CODE } from '@/components/shared/PhoneInput';
import { getCityOptions, getPortalOptions } from '@/data/lookupData';
import { useLookup } from '@/hooks/useLookups';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { MultiSelect } from '@/components/shared/MultiSelect';
import { VoiceTextarea } from '@/components/shared/VoiceTextarea';
import { ExistingEventPrompt, ExistingEventOption } from '@/components/shared/ExistingEventPrompt';
import { PaymentLinkDialog, PaymentLinkResult } from '@/components/shared/PaymentLinkDialog';
import { fmtINR } from '@/lib/billing';
import { useUser } from '@/context/UserContext';

type Stage = 'NEW_ENQUIRY' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'DEMO_COMPLETED' | 'PAYMENT_LINK_SENT' | 'ONBOARDING_PACK_SENT' | 'ACCOUNT_CREATED' | 'LOST';
type Tenancy = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';
type SubStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

interface EnquiryPayload {
  contact_phone_alt?: string;
  whatsapp_enabled?: boolean;
  outcome?: string;
  not_interested_reason?: string;
  not_interested_text?: string;
  demo_outcome?: string;
  focus_area?: string[];
  sales_focus?: string[];
  primary_property_types?: string[];
  team_size_estimate?: number | null;
  current_system?: string | string[];
  current_system_text?: string;
  approx_onboarding_date?: string | null;
  portals_in_use?: string[];
  payment?: PaymentInfo;
  [k: string]: unknown;
}

interface PaymentInfo {
  link_id?: string;
  short_url?: string;
  amount?: number;
  currency?: string;
  status?: 'CREATED' | 'PAID' | 'CANCELLED' | 'FAILED' | 'PENDING';
  paid_at?: string;
  created_at?: string;
  breakdown?: Record<string, unknown>;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Enquiry {
  id: string; full_name: string; phone: string; email: string | null;
  city: string | null; company_name: string | null;
  tenancy_type: Tenancy | null; stage: Stage; source: string | null;
  onboarding_form_link: string | null; onboarding_pack_sent: boolean;
  converted_account_id: string | null;
  demo_scheduled_at: string | null; demo_completed_at: string | null;
  lost_reason: string | null;
  is_duplicate_of: string | null;
  enquiry_code: string | null;
  payload: EnquiryPayload;
  created_at: string;
}

interface DuplicateOf { id: string; enquiry_code: string | null; full_name: string; }

interface NoteRow { id: string; note_text: string; created_at: string; }
interface Submission {
  id: string; status: SubStatus; submitted_at: string; reviewed_at: string | null;
  payload: Record<string, unknown>; tenancy_type: Tenancy;
}

const stageLabels: Record<Stage, string> = {
  NEW_ENQUIRY: 'New', CONTACTED: 'Contacted', DEMO_SCHEDULED: 'Demo Scheduled',
  DEMO_COMPLETED: 'Demo Completed', PAYMENT_LINK_SENT: 'Payment Link Sent',
  ONBOARDING_PACK_SENT: 'Onboarding Sent',
  ACCOUNT_CREATED: 'Account Created', LOST: 'Lost',
};

const SOURCES = [
  { v: 'CALL_DIRECT', l: 'Call (Direct)' },
  { v: 'LANDING_PAGE', l: 'Landing Page' },
  { v: 'META_ADS', l: 'Meta Ads' },
  { v: 'CHAMPION_PARTNER', l: 'Champion / Partner' },
  { v: 'CP_REQUEST_PROJECTS', l: 'CP Request (Projects)' },
];

const FOCUS_AREAS = [
  { v: 'SALES', l: 'Sales' },
  { v: 'RENTALS', l: 'Rentals' },
];

const SALES_FOCUS = [
  { v: 'PRIMARY_ONLY', l: 'Primary only' },
  { v: 'PRIMARY_AND_SECONDARY', l: 'Primary & Secondary' },
  { v: 'LUXURY_ONLY', l: 'Luxury only' },
];

const PROPERTY_TYPES = [
  { v: 'PLOT', l: 'Plot' },
  { v: 'APARTMENT', l: 'Apartment' },
  { v: 'VILLA', l: 'Villa' },
  { v: 'OTHER', l: 'Other' },
];

const OUTCOMES = [
  { v: 'INTERESTED', l: 'Interested' },
  { v: 'CALL_LATER', l: 'Call later' },
  { v: 'SCHEDULE_DEMO', l: 'Schedule demo' },
  { v: 'NOT_INTERESTED', l: 'Not interested' },
  { v: 'WRONG_OR_BOUNCED_NUMBER', l: 'Wrong / bounced number' },
];

const NOT_INTERESTED_REASONS = [
  { v: 'OTHER_CRM_IN_USE', l: 'Other CRM in use' },
  { v: 'NOT_RIGHT_PERSON', l: 'Not the right person' },
  { v: 'NOT_RIGHT_TIME', l: 'Not the right time' },
  { v: 'TOO_MANY_REQUIREMENTS', l: 'Too many requirements' },
  { v: 'BUDGET_CONCERN', l: 'Budget concern' },
  { v: 'OTHER', l: 'Other' },
];

const DEMO_OUTCOMES = [
  { v: 'NO_SHOW', l: 'No show' },
  { v: 'LIKED_WANT_ONBOARD_SOON', l: 'Liked, wants to onboard soon' },
  { v: 'GHOSTED', l: 'Ghosted' },
];

const CURRENT_SYSTEMS = [
  { v: 'SELL_DO', l: 'Sell.do' },
  { v: 'LEADRAT', l: 'LeadRat' },
  { v: 'HOUSSED', l: 'Houssed' },
  { v: 'EXCEL_ONLY', l: 'Excel sheet only' },
  { v: 'OTHER', l: 'Other' },
];

const NONE = '__none__';

export default function EnquiryDetail() {
  const { enquiryId } = useParams<{ enquiryId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [draft, setDraft] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const submission = submissions[0] ?? null;
  const previousSubmission = submissions[1] ?? null;
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [newNote, setNewNote] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pendingEventType, setPendingEventType] = useState<CalendarEventType>(CalendarEventType.GENERAL);
  const [pendingEventTitle, setPendingEventTitle] = useState<string>('');
  const [pendingDemoSchedule, setPendingDemoSchedule] = useState(false);
  const [existingEventOptions, setExistingEventOptions] = useState<ExistingEventOption[]>([]);
  const [existingPromptOpen, setExistingPromptOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<DuplicateOf | null>(null);
  const notesCardRef = useRef<HTMLDivElement | null>(null);
  const [notesPage, setNotesPage] = useState(0);
  const NOTES_PER_PAGE = 4;

  const draftRef = useRef<Enquiry | null>(null);
  const enquiryRef = useRef<Enquiry | null>(null);
  
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { enquiryRef.current = enquiry; }, [enquiry]);

  const loadEvents = useCallback(async (id: string) => {
    const nowIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data } = await supabase.from('calendar_events')
      .select('id, title, scheduled_at, event_type, status, notes, related_entity_type, related_entity_id, created_by')
      .eq('related_entity_type', 'ENQUIRY')
      .eq('related_entity_id', id)
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true });
    setEvents((data ?? []) as EventRow[]);
  }, []);

  const refreshNotes = useCallback(async (id: string) => {
    const { data } = await supabase.from('enquiry_notes')
      .select('id, note_text, created_at').eq('enquiry_id', id)
      .order('created_at', { ascending: false });
    setNotes((data ?? []) as NoteRow[]);
  }, []);

  const refreshSubmission = useCallback(async (id: string) => {
    const { data } = await supabase.from('onboarding_submissions')
      .select('id, status, submitted_at, reviewed_at, payload, tenancy_type')
      .eq('enquiry_id', id).order('submitted_at', { ascending: false });
    setSubmissions((data ?? []) as Submission[]);
  }, []);

  const refreshEnquiryMeta = useCallback(async (id: string) => {
    // Only refresh server-managed fields (stage, conversion, onboarding flags) without
    // overwriting in-progress edits in the draft.
    const { data } = await supabase.from('enquiries')
      .select('stage, converted_account_id, onboarding_pack_sent, onboarding_pack_sent_at, onboarding_form_link, demo_scheduled_at, demo_completed_at')
      .eq('id', id).maybeSingle();
    if (!data) return;
    setEnquiry(prev => prev ? { ...prev, ...data } as Enquiry : prev);
    setDraft(prev => prev ? {
      ...prev,
      stage: data.stage,
      converted_account_id: data.converted_account_id,
      onboarding_pack_sent: data.onboarding_pack_sent,
      onboarding_form_link: data.onboarding_form_link,
    } as Enquiry : prev);
  }, []);

  const load = useCallback(async () => {
    if (!enquiryId) return;
    setLoading(true);
    const [{ data: e, error: eErr }, { data: n }, { data: s }] = await Promise.all([
      supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle(),
      supabase.from('enquiry_notes').select('id, note_text, created_at').eq('enquiry_id', enquiryId).order('created_at', { ascending: false }),
      supabase.from('onboarding_submissions').select('id, status, submitted_at, reviewed_at, payload, tenancy_type').eq('enquiry_id', enquiryId).order('submitted_at', { ascending: false }),
    ]);
    if (eErr || !e) { toast.error('Enquiry not found'); navigate('/enquiries'); return; }
    const payload = (e.payload ?? {}) as EnquiryPayload;
    // Backward-compat: normalise current_system from string to array
    if (typeof payload.current_system === 'string' && payload.current_system) {
      payload.current_system = [payload.current_system];
    }
    const enq = { ...e, payload } as Enquiry;
    setEnquiry(enq);
    setDraft(enq);
    setSaveState('idle');
    setNotes((n ?? []) as NoteRow[]);
    setSubmissions((s ?? []) as Submission[]);
    loadEvents(enq.id);
    if (enq.is_duplicate_of) {
      const { data: dup } = await supabase.from('enquiries')
        .select('id, enquiry_code, full_name')
        .eq('id', enq.is_duplicate_of).maybeSingle();
      setDuplicateOf((dup as DuplicateOf | null) ?? null);
    } else {
      setDuplicateOf(null);
    }
    setLoading(false);
  }, [enquiryId, navigate, loadEvents]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useMemo(() => JSON.stringify(enquiry) !== JSON.stringify(draft), [enquiry, draft]);
  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Mark dirty for save indicator (no autosave — manual Save button is required).
  useEffect(() => {
    if (!enquiry || !draft) return;
    if (isDirty) setSaveState('dirty');
  }, [draft, enquiry, isDirty]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Persist current draft → server. Does NOT reload page.
  const persistDraft = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current; const orig = enquiryRef.current;
    if (!d || !orig) return true;
    if (JSON.stringify(d) === JSON.stringify(orig)) return true;
    setSaveState('saving');
    const update = {
      full_name: d.full_name,
      phone: d.phone,
      email: d.email,
      city: d.city,
      company_name: d.company_name,
      tenancy_type: d.tenancy_type,
      source: d.source,
      demo_scheduled_at: d.demo_scheduled_at,
      demo_completed_at: d.demo_completed_at,
      lost_reason: d.lost_reason,
      payload: d.payload as unknown as never,
    };
    const { error } = await supabase.from('enquiries').update(update).eq('id', d.id);
    if (error) { setSaveState('error'); toast.error(error.message); return false; }
    setEnquiry(d);
    setSaveState('saved');
    return true;
  }, []);

  // Backwards-compatible alias used by side actions.
  const flushPendingSave = useCallback(async () => { await persistDraft(); }, [persistDraft]);

  // Auto-persist pending edits before running a side action (stage change, note, etc.).
  // Returns false only if the silent save fails — never blocks the user for being "dirty".
  const requireClean = useCallback(async (_label = 'continue'): Promise<boolean> => {
    if (!isDirtyRef.current) return true;
    return await persistDraft();
  }, [persistDraft]);

  const setField = <K extends keyof Enquiry>(key: K, value: Enquiry[K]) => {
    setDraft(d => d ? { ...d, [key]: value } : d);
  };
  const setPayload = <K extends keyof EnquiryPayload>(key: K, value: EnquiryPayload[K]) => {
    setDraft(d => d ? { ...d, payload: { ...d.payload, [key]: value } } : d);
  };
  const togglePayloadArr = (key: keyof EnquiryPayload, value: string) => {
    setDraft(d => {
      if (!d) return d;
      const cur = ((d.payload[key] as string[] | undefined) ?? []);
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...d, payload: { ...d.payload, [key]: next } };
    });
  };

  const saveAll = async () => { await persistDraft(); };
  const cancelEdits = () => { if (enquiry) { setDraft(enquiry); setSaveState('idle'); toast('Changes discarded'); } };

  // ---- Existing-event check + scheduling helpers ----
  const openSchedulePrompt = useCallback((eventType: CalendarEventType, defaultTitle: string, isDemoFlow = false) => {
    if (!enquiry) return;
    setPendingEventType(eventType);
    setPendingEventTitle(defaultTitle);
    setPendingDemoSchedule(isDemoFlow);
    const matching = events.filter(e => e.event_type === eventType && new Date(e.scheduled_at) >= new Date());
    if (matching.length > 0) {
      setExistingEventOptions(matching.map(e => ({
        id: e.id, title: e.title, scheduled_at: e.scheduled_at, event_type: e.event_type,
      })));
      setExistingPromptOpen(true);
    } else {
      setScheduleOpen(true);
    }
  }, [enquiry, events]);

  // Outcome change in Contacted stage.
  const handleOutcomeChange = (v: string) => {
    setPayload('outcome', v);
    if (v === 'INTERESTED') {
      setShowNoteForm(true);
      toast('Add a quick note about what they\'re interested in.');
      setTimeout(() => notesCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } else if (v === 'CALL_LATER') {
      openSchedulePrompt(CalendarEventType.CALL_BACK, `Call back ${enquiry?.full_name ?? ''}`.trim());
    } else if (v === 'SCHEDULE_DEMO') {
      openSchedulePrompt(CalendarEventType.DEMO, `Demo · ${enquiry?.company_name || enquiry?.full_name || ''}`.trim(), true);
    }
  };

  const handleDemoOutcomeChange = (v: string) => {
    setPayload('demo_outcome', v);
    if (v === 'GHOSTED' || v === 'NO_SHOW') {
      openSchedulePrompt(CalendarEventType.FOLLOW_UP, `Follow up · ${enquiry?.company_name || enquiry?.full_name || ''}`.trim());
    }
  };

  // Validate that the user can leave the *current* stage based on its mandatory outcome.
  const validateStageGate = (currentStage: Stage, d: Enquiry): string | null => {
    if (currentStage === 'CONTACTED' && !d.payload.outcome) {
      return 'Please select an outcome for the Contacted stage before moving on.';
    }
    if (currentStage === 'DEMO_SCHEDULED' && !d.demo_scheduled_at) {
      return 'Please set the demo scheduled date/time before moving on.';
    }
    if (currentStage === 'DEMO_COMPLETED' && !d.payload.demo_outcome) {
      return 'Please select a demo outcome before moving on.';
    }
    if (currentStage === 'PAYMENT_LINK_SENT' && !d.payload.payment?.status) {
      return 'Please capture the payment outcome (Paid / Pending / Failed) before moving on.';
    }
    return null;
  };

  const updateStage = async (stage: Stage) => {
    if (!enquiry || !draft) return;
    if (!(await requireClean('change the stage'))) return;

    if (stage === 'ACCOUNT_CREATED') {
      toast.error('Account Created is set automatically when you convert the enquiry.');
      return;
    }
    if (stage === 'ONBOARDING_PACK_SENT' && !enquiry.onboarding_pack_sent) {
      toast.error('Use "Send onboarding form" to move to this stage.');
      return;
    }

    const fromIdx = STAGE_ORDER.indexOf(enquiry.stage);
    const toIdx = STAGE_ORDER.indexOf(stage);
    const onboardingIdx = STAGE_ORDER.indexOf('ONBOARDING_PACK_SENT');

    // Once the onboarding pack has been sent, do not allow moving back into
    // pre-onboarding stages (NEW_ENQUIRY … DEMO_COMPLETED). Backward moves
    // among those earlier stages remain allowed.
    if (stage !== 'LOST' && fromIdx >= onboardingIdx && toIdx < onboardingIdx) {
      toast.error('Cannot move back to earlier stages once the onboarding form has been sent.');
      return;
    }

    if (stage !== 'LOST' && toIdx > fromIdx) {
      const blocker = validateStageGate(enquiry.stage, draft);
      if (blocker) { toast.error(blocker); return; }
    }

    if (stage === 'DEMO_SCHEDULED') {
      const hasDemo = events.some(e => e.event_type === 'DEMO');
      if (!hasDemo) {
        openSchedulePrompt(CalendarEventType.DEMO, `Demo · ${enquiry.company_name || enquiry.full_name}`, true);
        return;
      }
    }

    setBusy(true);
    const updates: { stage: Stage; demo_scheduled_at?: string } = { stage };
    if (stage === 'DEMO_SCHEDULED' && !draft.demo_scheduled_at) {
      const demo = events.filter(e => e.event_type === 'DEMO').sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
      if (demo) updates.demo_scheduled_at = demo.scheduled_at;
    }
    const { error } = await supabase.from('enquiries').update(updates).eq('id', enquiry.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Stage updated');
      setEnquiry(prev => prev ? { ...prev, ...updates } as Enquiry : prev);
      setDraft(prev => prev ? { ...prev, ...updates } as Enquiry : prev);
      // When entering Payment Link Sent, prompt the dialog if no link exists yet.
      if (stage === 'PAYMENT_LINK_SENT' && !draft.payload.payment?.short_url) {
        setPaymentDialogOpen(true);
      }
    }
    setBusy(false);
  };

  // Apply the generated Razorpay link locally.
  const applyPaymentResult = (result: PaymentLinkResult) => {
    setEnquiry(prev => prev ? { ...prev, payload: { ...prev.payload, payment: result } } : prev);
    setDraft(prev => prev ? { ...prev, payload: { ...prev.payload, payment: result } } : prev);
    refreshNotes(enquiry?.id ?? '');
  };

  // Manually flip payment outcome (PAID / PENDING / FAILED) — used by the
  // Payment stage outcome panel and unlocks the onboarding action when PAID.
  const setPaymentStatus = async (status: 'PAID' | 'PENDING' | 'FAILED') => {
    if (!enquiry) return;
    const cur = (draft?.payload.payment ?? {}) as PaymentInfo;
    const prevStatus = cur.status ?? null;
    const nextPayment: PaymentInfo = { ...cur, status, paid_at: status === 'PAID' ? new Date().toISOString() : cur.paid_at };
    const nextPayload = { ...draft!.payload, payment: nextPayment };
    const { error } = await supabase.from('enquiries')
      .update({ payload: nextPayload as unknown as never })
      .eq('id', enquiry.id);
    if (error) { toast.error(error.message); return; }
    setEnquiry(prev => prev ? { ...prev, payload: nextPayload } : prev);
    setDraft(prev => prev ? { ...prev, payload: nextPayload } : prev);
    // Log the outcome to the enquiry timeline for traceability.
    if (prevStatus !== status) {
      const amt = cur.amount ? ` ${fmtINR(cur.amount)}` : '';
      await supabase.from('enquiry_notes').insert({
        enquiry_id: enquiry.id,
        note_text: `[Payment]${amt} marked ${status}${prevStatus ? ` (was ${prevStatus})` : ''}`,
      });
      await refreshNotes(enquiry.id);
    }
    toast.success(`Payment marked ${status}`);
  };

  const addNote = async () => {
    if (!enquiry || !newNote.trim()) return;
    if (!(await requireClean('add a note'))) return;
    setBusy(true);
    const { data, error } = await supabase.from('enquiry_notes')
      .insert({ enquiry_id: enquiry.id, note_text: newNote.trim() })
      .select('id, note_text, created_at').single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewNote('');
    setShowNoteForm(false);
    if (data) setNotes(prev => [data as NoteRow, ...prev]);
  };

  const PUBLIC_ORIGIN = 'https://terrisagesupport.lovable.app';

  const isInternalHost = (host: string): boolean => {
    return (
      host.endsWith('.lovableproject.com') ||
      (host.endsWith('.lovable.app') && host.includes('id-preview--')) ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  };

  const toPublicLink = (url: string | null | undefined): string => {
    if (!url) return '';
    try {
      const u = new URL(url);
      if (isInternalHost(u.hostname)) {
        return `${PUBLIC_ORIGIN}${u.pathname}${u.search}${u.hash}`;
      }
      return url;
    } catch {
      return url ?? '';
    }
  };

  const generateLink = (): string => {
    if (!enquiry || !draft) return '';
    const tenancy = enquiry.tenancy_type === 'BUILDER_DEVELOPER' ? 'builder' : 'agency';
    const host = window.location.hostname;
    const publicOrigin = isInternalHost(host) ? PUBLIC_ORIGIN : window.location.origin;
    const params = new URLSearchParams({ enquiry_id: enquiry.id });
    if (enquiry.full_name) params.set('name', enquiry.full_name);
    if (enquiry.phone) params.set('phone', enquiry.phone);
    if (enquiry.email) params.set('email', enquiry.email);
    const teamSize = draft.payload.team_size_estimate;
    if (teamSize !== null && teamSize !== undefined && Number(teamSize) > 0) {
      params.set('team_size', String(teamSize));
    }
    return `${publicOrigin}/onboarding/${tenancy}?${params.toString()}`;
  };

  const handleSendOnboarding = async () => {
    if (!enquiry || !draft) return;
    const teamSize = draft.payload.team_size_estimate;
    if (teamSize === null || teamSize === undefined || Number(teamSize) <= 0) {
      toast.error('Please enter the team / seat size before generating the onboarding link.');
      // Scroll the field into view and focus it.
      const el = document.querySelector<HTMLInputElement>('input[data-field="team_size_estimate"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el?.focus(), 300);
      return;
    }
    const paymentPaid = (draft.payload.payment?.status ?? null) === 'PAID';
    if (!enquiry.onboarding_pack_sent && !paymentPaid) {
      toast.error('Mark the payment as Paid before sending the onboarding form.');
      return;
    }
    if (!(await requireClean('send the onboarding form'))) return;
    const link = generateLink();
    if (!enquiry.onboarding_pack_sent) {
      await supabase.from('enquiries').update({
        onboarding_pack_sent: true,
        onboarding_pack_sent_at: new Date().toISOString(),
        onboarding_form_link: link,
        stage: 'ONBOARDING_PACK_SENT' as Stage,
      }).eq('id', enquiry.id);
      // Log to activity timeline (not notes) — onboarding link history belongs here.
      await supabase.from('activity_log').insert({
        entity_type: 'ENQUIRY',
        entity_id: enquiry.id,
        event_type: 'SUBMISSION',
        summary: 'Onboarding form link generated',
        details: { link },
      });
      await refreshEnquiryMeta(enquiry.id);
    }
    setShareOpen(true);
  };

  const requestRegenerateOnboardingLink = async () => {
    if (!enquiry || !draft) return;
    const teamSize = draft.payload.team_size_estimate;
    if (teamSize === null || teamSize === undefined || Number(teamSize) <= 0) {
      toast.error('Please enter the team / seat size before generating a new onboarding link.');
      return;
    }
    if (!(await requireClean('generate a new onboarding link'))) return;
    setRegenConfirmOpen(true);
  };

  const regenerateOnboardingLink = async () => {
    if (!enquiry) return;
    setRegenConfirmOpen(false);
    setBusy(true);
    try {
      const link = generateLink();
      // IMPORTANT: bumping onboarding_pack_sent_at unlocks the form for a new
      // submission (see check_submission_lock). Older submissions are preserved
      // untouched so staff can compare versions and approve whichever is correct.
      const { error: updErr } = await supabase.from('enquiries').update({
        onboarding_pack_sent: true,
        onboarding_pack_sent_at: new Date().toISOString(),
        onboarding_form_link: link,
      }).eq('id', enquiry.id);
      if (updErr) throw updErr;

      await supabase.from('activity_log').insert({
        entity_type: 'ENQUIRY',
        entity_id: enquiry.id,
        event_type: 'SUBMISSION',
        summary: 'New onboarding form link generated (previous submissions preserved)',
        details: { link },
      });

      await refreshEnquiryMeta(enquiry.id);
      await refreshSubmission(enquiry.id);
      toast.success('New onboarding link ready');
      setShareOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not regenerate link');
    } finally {
      setBusy(false);
    }
  };

  const reviewSubmission = async (status: 'APPROVED' | 'REJECTED') => {
    if (!submission || !enquiry) return;
    setBusy(true);
    await flushPendingSave();
    const { error } = await supabase.from('onboarding_submissions')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', submission.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    // Note: status change is already captured automatically in the Activity Timeline
    // via the trg_submissions_activity trigger, so we no longer duplicate it here as a note.
    toast.success(`Submission ${status.toLowerCase()}`);
    refreshSubmission(enquiry.id);
  };

  const convertToAccount = async () => {
    if (!enquiry) return;
    if (!(await requireClean('convert to account'))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('convert_enquiry_to_account', { _enquiry_id: enquiry.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Account created');
    if (data) navigate(`/accounts/${data}`);
  };

  const canConvert = (): string | null => {
    if (!enquiry) return 'Loading';
    if (!submission) return 'Onboarding form not yet submitted';
    if (submission.status !== 'APPROVED') return 'Submission must be approved';
    if (enquiry.converted_account_id) return 'Already converted';
    return null;
  };

  if (loading || !enquiry || !draft) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const convertBlock = canConvert();
  const subPayload = (submission?.payload ?? {}) as Record<string, unknown>;
  const teamMembers = Array.isArray(subPayload.team_members) ? subPayload.team_members as Array<Record<string, string>> : [];

  const phoneSplit = splitPhone(draft.phone || '');
  const altSplit = splitPhone(draft.payload.contact_phone_alt || '');
  const isBuilder = draft.tenancy_type === 'BUILDER_DEVELOPER';
  const showLost = draft.stage === 'LOST';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/enquiries')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{enquiry.company_name || enquiry.full_name}</h1>
          <p className="text-sm text-muted-foreground truncate">{enquiry.full_name} · {enquiry.phone}</p>
        </div>
        <Badge variant="secondary">{SOURCES.find(s => s.v === enquiry.source)?.l ?? enquiry.source ?? 'No source'}</Badge>
        {duplicateOf && (
          <Link to={`/enquiries/${duplicateOf.id}`}>
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning hover:bg-warning/10">
              <CopyIcon className="h-3 w-3" />
              Duplicate of {duplicateOf.enquiry_code ?? duplicateOf.full_name}
            </Badge>
          </Link>
        )}
        <SaveStatusIndicator state={saveState} isDirty={isDirty} />
        {isDirty && (
          <Button onClick={cancelEdits} disabled={saveState === 'saving'} size="sm" variant="outline">
            <Undo2 className="h-4 w-4 mr-2" /> Cancel
          </Button>
        )}
        <Button onClick={saveAll} disabled={saveState === 'saving' || !isDirty} size="sm" variant={isDirty ? 'default' : 'outline'}>
          {saveState === 'saving' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {isDirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {/* Horizontal stage flow */}
      <StageFlow
        currentStage={enquiry.stage}
        busy={busy}
        onSelectStage={updateStage}
        outcomeNode={
          <StageOutcomePanel
            stage={enquiry.stage}
            draft={draft}
            setField={setField}
            setPayload={setPayload}
            onOutcomeChange={handleOutcomeChange}
            onDemoOutcomeChange={handleDemoOutcomeChange}
            onOpenPaymentDialog={() => setPaymentDialogOpen(true)}
            onSetPaymentStatus={setPaymentStatus}
          />
        }
      />

      {/* Actions + Notes — combined compact card */}
      <Card ref={notesCardRef} className="border-2 border-border shadow-sm">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Actions column */}
            <div className="p-4 space-y-2.5">
              <div className="text-sm font-semibold text-foreground mb-1">Actions</div>
              {(() => {
                const paymentPaid = (draft.payload.payment?.status ?? null) === 'PAID';
                const onboardingSent = enquiry.onboarding_pack_sent || draft.onboarding_pack_sent;
                const onboardEnabled = onboardingSent || paymentPaid;
                const blockedReason = onboardEnabled
                  ? null
                  : 'Mark payment as Paid to unlock onboarding.';
                return (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Button
                        className="flex-1"
                        size="sm"
                        onClick={handleSendOnboarding}
                        disabled={busy || !onboardEnabled}
                        variant={onboardingSent ? 'outline' : 'default'}
                        title={blockedReason ?? undefined}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {onboardingSent ? 'Share onboarding link' : 'Send onboarding form'}
                      </Button>
                      {onboardingSent && !enquiry.converted_account_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={requestRegenerateOnboardingLink}
                          disabled={busy}
                          title="Generate a fresh onboarding link. The previous submission is unlocked so the customer can resubmit updated details."
                          aria-label="Generate new onboarding link"
                          className="px-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {blockedReason && (
                      <p className="text-[11px] text-muted-foreground -mt-1 text-center">{blockedReason}</p>
                    )}
                  </>
                );
              })()}
              <Button className="w-full" size="sm" variant="outline" onClick={() => setScheduleOpen(true)} disabled={busy}>
                <CalendarPlus className="h-4 w-4 mr-2" /> Schedule event
              </Button>
              <Button className="w-full" size="sm" disabled={!!convertBlock || busy} onClick={convertToAccount}>
                Convert to account
              </Button>
              {convertBlock && <p className="text-[11px] text-muted-foreground text-center">{convertBlock}</p>}
              {enquiry.converted_account_id && (
                <Link to={`/accounts/${enquiry.converted_account_id}`}>
                  <Button variant="outline" size="sm" className="w-full">View account</Button>
                </Link>
              )}
              <div className="pt-2 mt-2 border-t border-border/60 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {enquiry.phone}</div>
                {enquiry.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {enquiry.email}</div>}
                <div>Created {format(new Date(enquiry.created_at), 'dd MMM yyyy')}</div>
              </div>
            </div>

            {/* Notes column (spans 2) */}
            <div className="p-4 space-y-2.5 lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold text-foreground">Notes</div>
                {notes.length > NOTES_PER_PAGE && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={notesPage === 0} onClick={() => setNotesPage(p => Math.max(0, p - 1))}>‹</Button>
                    <span>{notesPage + 1}/{Math.ceil(notes.length / NOTES_PER_PAGE)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={(notesPage + 1) * NOTES_PER_PAGE >= notes.length} onClick={() => setNotesPage(p => p + 1)}>›</Button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Textarea autoFocus={showNoteForm} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note…" rows={2} className="text-sm" />
                <Button onClick={addNote} disabled={!newNote.trim() || busy} size="sm">Add</Button>
              </div>
              <div className="space-y-1.5 pt-1 min-h-[7rem]">
                {notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No notes yet.</p>
                ) : (
                  notes.slice(notesPage * NOTES_PER_PAGE, (notesPage + 1) * NOTES_PER_PAGE).map(n => (
                    <div key={n.id} className="text-sm border-l-2 border-primary/40 pl-3 py-0.5">
                      <p className="leading-snug">{n.note_text}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{format(new Date(n.created_at), 'dd MMM, HH:mm')}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable detail card */}
      <Card className="border-2 border-border shadow-sm">
        <CardHeader><CardTitle className="text-base">Enquiry details</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Contact block */}
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-4">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={draft.company_name ?? ''} onChange={e => setField('company_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input value={draft.full_name} onChange={e => setField('full_name', e.target.value)} />
            </div>

            {/* Primary phone + WhatsApp toggle directly under it */}
            <div className="space-y-1.5">
              <Label>Primary phone</Label>
              <PhoneInput
                countryCode={phoneSplit.code}
                onCountryCodeChange={c => setField('phone', joinPhone(c, phoneSplit.number))}
                number={phoneSplit.number}
                onNumberChange={n => setField('phone', joinPhone(phoneSplit.code, n))}
              />
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="wa"
                  checked={!!draft.payload.whatsapp_enabled}
                  onCheckedChange={v => setPayload('whatsapp_enabled', v)}
                />
                <Label htmlFor="wa" className="cursor-pointer text-xs text-muted-foreground font-normal">
                  WhatsApp enabled on primary number
                </Label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Alternate phone</Label>
              <PhoneInput
                countryCode={altSplit.code || DEFAULT_COUNTRY_CODE}
                onCountryCodeChange={c => setPayload('contact_phone_alt', joinPhone(c, altSplit.number))}
                number={altSplit.number}
                onNumberChange={n => setPayload('contact_phone_alt', n ? joinPhone(altSplit.code || DEFAULT_COUNTRY_CODE, n) : '')}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={draft.email ?? ''} onChange={e => setField('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Select value={draft.city ?? NONE} onValueChange={v => setField('city', v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>—</SelectItem>
                  {getCityOptions().map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Classification */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tenancy type</Label>
              <Select value={draft.tenancy_type ?? NONE} onValueChange={v => setField('tenancy_type', v === NONE ? null : v as Tenancy)}>
                <SelectTrigger><SelectValue placeholder="Select tenancy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENCY_BROKERAGE_CONSULTANCY">Agency / Brokerage / Consultancy</SelectItem>
                  <SelectItem value="BUILDER_DEVELOPER">Builder / Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={draft.source ?? NONE} onValueChange={v => setField('source', v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {SOURCES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Qualification — agency vs builder */}
          <div className="space-y-4">
            {/* Seat count first, per request */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Estimated team / seat count</Label>
                <Input
                  data-field="team_size_estimate"
                  type="number"
                  min={0}
                  value={draft.payload.team_size_estimate ?? ''}
                  onChange={e => setPayload('team_size_estimate', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Focus area</Label>
                <MultiSelect
                  options={FOCUS_AREAS.map(o => ({ value: o.v, label: o.l }))}
                  selected={(draft.payload.focus_area as string[] | undefined) ?? []}
                  onChange={vals => setPayload('focus_area', vals)}
                  placeholder="Select focus areas"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {!isBuilder && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Sales focus</Label>
                  <MultiSelect
                    options={SALES_FOCUS.map(o => ({ value: o.v, label: o.l }))}
                    selected={(draft.payload.sales_focus as string[] | undefined) ?? []}
                    onChange={vals => setPayload('sales_focus', vals)}
                    placeholder="Select sales focus"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Primary property types</Label>
                <MultiSelect
                  options={PROPERTY_TYPES.map(o => ({ value: o.v, label: o.l }))}
                  selected={(draft.payload.primary_property_types as string[] | undefined) ?? []}
                  onChange={vals => setPayload('primary_property_types', vals)}
                  placeholder="Select property types"
                />
              </div>
            </div>

            {/* Row: Current system + Specify other (when OTHER selected) */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Current system / software in use</Label>
                <MultiSelect
                  options={CURRENT_SYSTEMS.map(o => ({ value: o.v, label: o.l }))}
                  selected={Array.isArray(draft.payload.current_system)
                    ? draft.payload.current_system
                    : (draft.payload.current_system ? [draft.payload.current_system as string] : [])}
                  onChange={vals => setPayload('current_system', vals)}
                  placeholder="Select current system(s)"
                />
              </div>
              {(Array.isArray(draft.payload.current_system)
                ? draft.payload.current_system.includes('OTHER')
                : draft.payload.current_system === 'OTHER') && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Specify other system</Label>
                  <Input
                    placeholder="e.g. Custom in-house tool"
                    value={draft.payload.current_system_text ?? ''}
                    onChange={e => setPayload('current_system_text', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Row: Portals + Approx. onboarding date side by side */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Portals currently in use</Label>
                <MultiSelect
                  options={getPortalOptions().map(v => ({ value: v, label: v }))}
                  selected={(draft.payload.portals_in_use as string[] | undefined) ?? []}
                  onChange={vals => setPayload('portals_in_use', vals)}
                  placeholder="Select portals"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Approx. onboarding date</Label>
                <Input
                  type="date"
                  value={draft.payload.approx_onboarding_date ?? ''}
                  onChange={e => setPayload('approx_onboarding_date', e.target.value || null)}
                />
              </div>
            </div>
          </div>

          {showLost && (
            <div className="space-y-1.5">
              <Label>Lost reason</Label>
              <VoiceTextarea rows={2} value={draft.lost_reason ?? ''} onChange={v => setField('lost_reason', v)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onboarding submission review */}
      {submission ? (
        <Card className="border-2 border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Onboarding submission
                {submissions.length > 1 && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    (latest of {submissions.length})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {previousSubmission && (
                  <Badge variant="outline" className="text-[11px]">Resubmission</Badge>
                )}
                {submission.status === 'PENDING_REVIEW' && <Badge className="bg-warning/15 text-warning"><Clock className="h-3 w-3 mr-1" />Pending review</Badge>}
                {submission.status === 'APPROVED' && <Badge className="bg-success/15 text-success"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>}
                {submission.status === 'REJECTED' && <Badge className="bg-destructive/15 text-destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Submitted {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <DiffField label="Company" value={subPayload.company_name} previous={previousSubmission?.payload?.company_name} />
              <DiffField label="City" value={subPayload.city} previous={previousSubmission?.payload?.city} />
              <DiffField label="Owner" value={subPayload.owner_name} previous={previousSubmission?.payload?.owner_name} />
              <DiffField label="Phone" value={subPayload.owner_phone} previous={previousSubmission?.payload?.owner_phone} />
              {(subPayload.gst_number || previousSubmission?.payload?.gst_number) && (
                <DiffField label="GST" value={subPayload.gst_number} previous={previousSubmission?.payload?.gst_number} />
              )}
              {(subPayload.rera_number || previousSubmission?.payload?.rera_number) && (
                <DiffField label="RERA" value={subPayload.rera_number} previous={previousSubmission?.payload?.rera_number} />
              )}
            </div>
            {teamMembers.length > 0 && (() => {
              const prevTeam = Array.isArray(previousSubmission?.payload?.team_members)
                ? previousSubmission!.payload!.team_members as Array<Record<string, string>>
                : [];
              const teamChanged = previousSubmission && JSON.stringify(prevTeam) !== JSON.stringify(teamMembers);
              return (
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <span>Team members ({teamMembers.length})</span>
                    {teamChanged && (
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                        Changed (was {prevTeam.length})
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {teamMembers.map((m, i) => (
                      <div key={i} className="text-sm border rounded p-2 flex justify-between">
                        <span>{m.full_name || m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {submission.status === 'PENDING_REVIEW' && (
              <div className="flex gap-2 pt-2">
                <Button onClick={() => reviewSubmission('APPROVED')} disabled={busy} className="flex-1">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button onClick={() => reviewSubmission('REJECTED')} disabled={busy} variant="outline" className="flex-1">
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </div>
            )}

            {/* Submission history */}
            {submissions.length > 1 && (
              <div className="pt-3 mt-3 border-t border-border/60">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Previous submissions</div>
                <div className="space-y-1.5">
                  {submissions.slice(1).map(s => {
                    const isOpen = expandedSubmissionIds.has(s.id);
                    const sp = (s.payload ?? {}) as Record<string, unknown>;
                    return (
                      <div key={s.id} className="border rounded-md">
                        <button
                          type="button"
                          onClick={() => setExpandedSubmissionIds(prev => {
                            const n = new Set(prev);
                            if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
                            return n;
                          })}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/40 rounded-md"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{format(new Date(s.submitted_at), 'dd MMM yyyy, HH:mm')}</span>
                          </div>
                          {s.status === 'PENDING_REVIEW' && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">Pending</Badge>}
                          {s.status === 'APPROVED' && <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Approved</Badge>}
                          {s.status === 'REJECTED' && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Rejected</Badge>}
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div><div className="text-xs text-muted-foreground">Company</div><div>{String(sp.company_name ?? '—')}</div></div>
                            <div><div className="text-xs text-muted-foreground">City</div><div>{String(sp.city ?? '—')}</div></div>
                            <div><div className="text-xs text-muted-foreground">Owner</div><div>{String(sp.owner_name ?? '—')}</div></div>
                            <div><div className="text-xs text-muted-foreground">Phone</div><div>{String(sp.owner_phone ?? '—')}</div></div>
                            {sp.gst_number ? <div><div className="text-xs text-muted-foreground">GST</div><div>{String(sp.gst_number)}</div></div> : null}
                            {sp.rera_number ? <div><div className="text-xs text-muted-foreground">RERA</div><div>{String(sp.rera_number)}</div></div> : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : enquiry.onboarding_pack_sent ? (
        <Card className="border-2 border-border shadow-sm">
          <CardHeader><CardTitle className="text-base">Onboarding submission</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Awaiting customer to complete the form.
            </div>
            {enquiry.onboarding_form_link && (
              <a href={toPublicLink(enquiry.onboarding_form_link)} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-2">
                <ExternalLink className="h-3 w-3" /> Open form link
              </a>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Upcoming events */}
      <Card className="border-2 border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Upcoming events</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus className="h-4 w-4 mr-1" /> Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No upcoming events.</p>
          ) : (
            <div className="space-y-2">
              {events.map(ev => (
                <button key={ev.id} onClick={() => setOpenEvent(ev)}
                  className="w-full text-left rounded-md border border-primary/40 bg-primary/15 px-3 py-2 hover:bg-primary/25 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate text-primary">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(ev.scheduled_at), 'EEE dd MMM, HH:mm')}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 bg-primary/15 text-primary border-primary/30">{ev.event_type.replace('_', ' ')}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityTimeline entityType="ENQUIRY" entityId={enquiry.id} />

      <PaymentLinkDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        enquiryId={enquiry.id}
        defaults={{
          seats: (draft.payload.team_size_estimate as number | null | undefined) ?? null,
          customerName: enquiry.full_name,
          customerEmail: enquiry.email,
          customerPhone: enquiry.phone,
        }}
        onSuccess={applyPaymentResult}
      />

      <SendOnboardingDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        link={generateLink()}
        customerName={enquiry.full_name}
        customerPhone={enquiry.phone}
        customerEmail={enquiry.email ?? undefined}
      />

      <AlertDialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate a new onboarding link?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer can submit fresh details. The previous submission stays on file as a historical version — you can compare both and approve whichever is correct. If you approve the new one, the account will be created from it; otherwise the original approved submission is used.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={regenerateOnboardingLink} disabled={busy}>
              {busy ? 'Generating…' : 'Generate new link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule event</DialogTitle></DialogHeader>
          <CalendarEventForm
            defaultEventType={pendingEventType !== CalendarEventType.GENERAL ? pendingEventType : (pendingDemoSchedule ? CalendarEventType.DEMO : CalendarEventType.FOLLOW_UP)}
            defaultTitle={pendingEventTitle}
            lockedEntityType="ENQUIRY"
            lockedEntityId={enquiry.id}
            lockedEntityLabel={enquiry.company_name || enquiry.full_name}
            onCancel={() => { setScheduleOpen(false); setPendingDemoSchedule(false); setPendingEventTitle(''); setPendingEventType(CalendarEventType.GENERAL); }}
            onSubmit={async (d) => {
              const [hh, mm] = d.time.split(':').map(Number);
              const dt = new Date(d.date); dt.setHours(hh ?? 10, mm ?? 0, 0, 0);
              const scheduledIso = dt.toISOString();
              const { error } = await supabase.from('calendar_events').insert({
                title: d.title, scheduled_at: scheduledIso, notes: d.notes || null,
                event_type: d.event_type as 'DEMO' | 'FOLLOW_UP' | 'CALL_BACK' | 'CHECK_IN' | 'ONBOARDING' | 'OTHER',
                created_by: currentUser.user_id,
                assigned_to: d.assigned_to ?? currentUser.user_id,
                related_entity_type: 'ENQUIRY', related_entity_id: enquiry.id,
              });
              if (error) { toast.error(error.message); return; }
              toast.success('Event scheduled');
              setScheduleOpen(false);

              if (d.event_type === CalendarEventType.DEMO) {
                await supabase.from('enquiries').update({
                  stage: 'DEMO_SCHEDULED' as Stage,
                  demo_scheduled_at: scheduledIso,
                }).eq('id', enquiry.id);
                setEnquiry(prev => prev ? { ...prev, stage: 'DEMO_SCHEDULED', demo_scheduled_at: scheduledIso } : prev);
                setDraft(prev => prev ? { ...prev, stage: 'DEMO_SCHEDULED', demo_scheduled_at: scheduledIso } : prev);
              }
              setPendingDemoSchedule(false);
              setPendingEventTitle('');
              setPendingEventType(CalendarEventType.GENERAL);
              loadEvents(enquiry.id);
            }}
          />
        </DialogContent>
      </Dialog>

      <ExistingEventPrompt
        open={existingPromptOpen}
        onOpenChange={setExistingPromptOpen}
        events={existingEventOptions}
        eventTypeLabel={pendingEventType.replace('_', ' ')}
        onUseExisting={async (ev) => {
          setExistingPromptOpen(false);
          if (pendingDemoSchedule && enquiry) {
            await supabase.from('enquiries').update({
              stage: 'DEMO_SCHEDULED' as Stage,
              demo_scheduled_at: ev.scheduled_at,
            }).eq('id', enquiry.id);
            setEnquiry(prev => prev ? { ...prev, stage: 'DEMO_SCHEDULED', demo_scheduled_at: ev.scheduled_at } : prev);
            setDraft(prev => prev ? { ...prev, stage: 'DEMO_SCHEDULED', demo_scheduled_at: ev.scheduled_at } : prev);
            toast.success('Linked existing demo');
          } else {
            toast.success('Using existing event');
          }
          setPendingDemoSchedule(false);
          setPendingEventTitle('');
          setPendingEventType(CalendarEventType.GENERAL);
        }}
        onCreateNew={() => { setExistingPromptOpen(false); setScheduleOpen(true); }}
      />

      <EventDetailDialog
        event={openEvent}
        open={!!openEvent}
        onOpenChange={(v) => !v && setOpenEvent(null)}
        onChanged={() => { loadEvents(enquiry.id); setOpenEvent(null); }}
      />
    </div>
  );
}

// ---------------- Save status indicator ----------------

function SaveStatusIndicator({ state, isDirty }: { state: SaveState; isDirty: boolean }) {
  let label = '';
  let cls = 'text-muted-foreground';
  if (state === 'saving') { label = 'Saving…'; }
  else if (state === 'error') { label = 'Save failed'; cls = 'text-destructive'; }
  else if (isDirty) { label = 'Unsaved changes'; cls = 'text-warning'; }
  else if (state === 'saved') { label = 'Saved'; cls = 'text-success'; }
  if (!label) return null;
  return <span className={cn('text-xs', cls)}>{label}</span>;
}

// ---------------- Stage Flow ----------------

const STAGE_ORDER: Stage[] = [
  'NEW_ENQUIRY', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PAYMENT_LINK_SENT', 'ONBOARDING_PACK_SENT', 'ACCOUNT_CREATED',
];

function StageFlow({
  currentStage, busy, onSelectStage, outcomeNode,
}: {
  currentStage: Stage;
  busy: boolean;
  onSelectStage: (s: Stage) => void;
  outcomeNode: React.ReactNode;
}) {
  const isLost = currentStage === 'LOST';
  const currentIdx = isLost ? -1 : STAGE_ORDER.indexOf(currentStage);

  return (
    <Card className="border-2 border-primary/40 bg-primary/5 shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGE_ORDER.map((s, i) => {
            const done = !isLost && i < currentIdx;
            const active = !isLost && i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectStage(s)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active && 'bg-primary text-primary-foreground border-primary shadow-sm',
                    done && 'bg-success/15 text-success border-success/30',
                    !active && !done && 'bg-background text-muted-foreground hover:bg-accent',
                  )}
                >
                  <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                    active && 'bg-primary-foreground/20',
                    done && 'bg-success/20',
                    !active && !done && 'bg-muted',
                  )}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {stageLabels[s]}
                </button>
                {i < STAGE_ORDER.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
          <div className="ml-auto pl-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelectStage('LOST')}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isLost ? 'bg-destructive text-destructive-foreground border-destructive' : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
              )}
            >
              Lost
            </button>
          </div>
        </div>
        <Separator />
        <div>{outcomeNode}</div>
      </CardContent>
    </Card>
  );
}

function StageOutcomePanel({
  stage, draft, setField, setPayload, onOutcomeChange, onDemoOutcomeChange, onOpenPaymentDialog, onSetPaymentStatus,
}: {
  stage: Stage;
  draft: Enquiry;
  setField: <K extends keyof Enquiry>(k: K, v: Enquiry[K]) => void;
  setPayload: <K extends keyof EnquiryPayload>(k: K, v: EnquiryPayload[K]) => void;
  onOutcomeChange: (v: string) => void;
  onDemoOutcomeChange: (v: string) => void;
  onOpenPaymentDialog: () => void;
  onSetPaymentStatus: (s: 'PAID' | 'PENDING' | 'FAILED') => void;
}) {
  const isLost = stage === 'LOST';
  const currentIdx = isLost ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage);
  const pastStages = STAGE_ORDER.slice(0, Math.max(0, currentIdx));

  return (
    <div className="space-y-4">
      {pastStages.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Past stage outcomes</div>
          <div className="grid md:grid-cols-2 gap-2">
            {pastStages.map(s => (
              <PastStageSummary key={s} stage={s} draft={draft} />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-medium text-primary uppercase tracking-wide mb-2">Current stage · {stageLabels[stage]}</div>
        <ActiveStagePanel
          stage={stage} draft={draft} setField={setField} setPayload={setPayload}
          onOutcomeChange={onOutcomeChange} onDemoOutcomeChange={onDemoOutcomeChange}
          onOpenPaymentDialog={onOpenPaymentDialog} onSetPaymentStatus={onSetPaymentStatus}
        />
      </div>
    </div>
  );
}

function PastStageSummary({ stage, draft }: { stage: Stage; draft: Enquiry }) {
  const lookup = (list: { v: string; l: string }[], v?: string) => list.find(o => o.v === v)?.l ?? v ?? '—';
  let body: React.ReactNode = <span className="text-muted-foreground">—</span>;

  if (stage === 'NEW_ENQUIRY') {
    body = <span>Captured {format(new Date(draft.created_at), 'dd MMM yyyy')}</span>;
  } else if (stage === 'CONTACTED') {
    const outcome = draft.payload.outcome as string | undefined;
    body = (
      <div className="space-y-0.5">
        <div>Outcome: <span className="font-medium">{lookup(OUTCOMES, outcome)}</span></div>
        {outcome === 'NOT_INTERESTED' && (
          <div className="text-muted-foreground">
            Reason: {lookup(NOT_INTERESTED_REASONS, draft.payload.not_interested_reason as string | undefined)}
            {draft.payload.not_interested_text ? ` · ${draft.payload.not_interested_text}` : ''}
          </div>
        )}
      </div>
    );
  } else if (stage === 'DEMO_SCHEDULED') {
    body = draft.demo_scheduled_at
      ? <span>Scheduled <span className="font-medium">{format(new Date(draft.demo_scheduled_at), 'dd MMM yyyy, HH:mm')}</span></span>
      : <span className="text-muted-foreground">No date recorded</span>;
  } else if (stage === 'DEMO_COMPLETED') {
    body = (
      <div className="space-y-0.5">
        <div>{draft.demo_completed_at ? <>Completed <span className="font-medium">{format(new Date(draft.demo_completed_at), 'dd MMM yyyy, HH:mm')}</span></> : <span className="text-muted-foreground">Date not set</span>}</div>
        <div className="text-muted-foreground">Outcome: {lookup(DEMO_OUTCOMES, draft.payload.demo_outcome as string | undefined)}</div>
      </div>
    );
  } else if (stage === 'PAYMENT_LINK_SENT') {
    const p = draft.payload.payment;
    body = p?.short_url
      ? <span>{fmtINR(p.amount ?? 0)} · <span className="font-medium">{p.status ?? 'CREATED'}</span></span>
      : <span className="text-muted-foreground">No link generated</span>;
  } else if (stage === 'ONBOARDING_PACK_SENT') {
    body = <span>Onboarding form sent</span>;
  } else if (stage === 'ACCOUNT_CREATED') {
    body = <span>Account created</span>;
  }

  return (
    <div className="text-xs rounded border bg-card px-2 py-1.5">
      <div className="font-medium text-[11px] text-muted-foreground mb-0.5">{stageLabels[stage]}</div>
      <div>{body}</div>
    </div>
  );
}

function ActiveStagePanel({
  stage, draft, setField, setPayload, onOutcomeChange, onDemoOutcomeChange, onOpenPaymentDialog, onSetPaymentStatus,
}: {
  stage: Stage;
  draft: Enquiry;
  setField: <K extends keyof Enquiry>(k: K, v: Enquiry[K]) => void;
  setPayload: <K extends keyof EnquiryPayload>(k: K, v: EnquiryPayload[K]) => void;
  onOutcomeChange: (v: string) => void;
  onDemoOutcomeChange: (v: string) => void;
  onOpenPaymentDialog: () => void;
  onSetPaymentStatus: (s: 'PAID' | 'PENDING' | 'FAILED') => void;
}) {
  const outcome = (draft.payload.outcome as string) || '';

  if (stage === 'NEW_ENQUIRY') {
    return <p className="text-sm text-muted-foreground">New enquiry captured. Make first contact, then move to <strong>Contacted</strong>.</p>;
  }

  if (stage === 'CONTACTED') {
    const niReason = (draft.payload.not_interested_reason as string) || '';
    return (
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Outcome</Label>
            <Select value={outcome || NONE} onValueChange={v => onOutcomeChange(v === NONE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {OUTCOMES.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {outcome === 'NOT_INTERESTED' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Select value={niReason || NONE} onValueChange={v => setPayload('not_interested_reason', v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {NOT_INTERESTED_REASONS.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {outcome === 'NOT_INTERESTED' && niReason === 'OTHER' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Additional context</Label>
            <VoiceTextarea
              as="input"
              value={(draft.payload.not_interested_text as string) ?? ''}
              onChange={v => setPayload('not_interested_text', v)}
              placeholder="Describe the reason"
            />
          </div>
        )}
        {outcome === 'INTERESTED' && (
          <div className="space-y-1.5 rounded-md border border-dashed p-3 bg-muted/20">
            <Label className="text-xs">Quick note</Label>
            <VoiceTextarea
              rows={2}
              value={(draft.payload.interested_note_draft as string) ?? ''}
              onChange={v => setPayload('interested_note_draft' as keyof EnquiryPayload, v)}
              placeholder="What are they interested in? (Save the enquiry, then add this to Notes if needed.)"
            />
          </div>
        )}
      </div>
    );
  }

  if (stage === 'DEMO_SCHEDULED') {
    return (
      <div className="space-y-1.5 max-w-md">
        <Label className="text-xs">Demo scheduled at</Label>
        <Input
          type="datetime-local"
          value={draft.demo_scheduled_at ? draft.demo_scheduled_at.slice(0, 16) : ''}
          onChange={e => setField('demo_scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      </div>
    );
  }

  if (stage === 'DEMO_COMPLETED') {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Demo completed at</Label>
          <Input
            type="datetime-local"
            value={draft.demo_completed_at ? draft.demo_completed_at.slice(0, 16) : ''}
            onChange={e => setField('demo_completed_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Demo outcome</Label>
          <Select value={(draft.payload.demo_outcome as string) || NONE} onValueChange={v => onDemoOutcomeChange(v === NONE ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {DEMO_OUTCOMES.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (stage === 'PAYMENT_LINK_SENT') {
    const payment = draft.payload.payment;
    const status = payment?.status ?? null;
    const statusBadge = (s: string) => {
      const cls = s === 'PAID' ? 'bg-success/15 text-success border-success/30'
        : s === 'FAILED' ? 'bg-destructive/15 text-destructive border-destructive/30'
        : s === 'CANCELLED' ? 'bg-muted text-muted-foreground'
        : 'bg-primary/15 text-primary border-primary/30';
      return <Badge variant="outline" className={cn('text-[10px]', cls)}>{s}</Badge>;
    };
    return (
      <div className="space-y-3">
        {payment?.short_url ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{fmtINR(payment.amount ?? 0)}</span>
                {status && statusBadge(status)}
                {payment.created_at && (
                  <span className="text-[11px] text-muted-foreground">
                    Sent {format(new Date(payment.created_at), 'dd MMM, HH:mm')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(payment.short_url!); toast.success('Link copied'); }}>
                  <CopyIcon className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
                <a href={payment.short_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open</Button>
                </a>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground break-all">{payment.short_url}</div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No payment link generated yet.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onOpenPaymentDialog}>
            {payment?.short_url ? 'Generate new link' : 'Generate payment link'}
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs text-muted-foreground">Mark as</Label>
            <Select value={status ?? NONE} onValueChange={v => v !== NONE && onSetPaymentStatus(v as 'PAID' | 'PENDING' | 'FAILED')}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Set status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'ONBOARDING_PACK_SENT') {
    return <p className="text-sm text-muted-foreground">Onboarding form sent. Awaiting customer submission, then approve to convert.</p>;
  }

  if (stage === 'ACCOUNT_CREATED') {
    return <p className="text-sm text-success">Account created. The enquiry is now live in Accounts.</p>;
  }

  if (stage === 'LOST') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Lost reason</Label>
        <Textarea rows={2} value={draft.lost_reason ?? ''} onChange={e => setField('lost_reason', e.target.value)} />
      </div>
    );
  }

  return null;
}

function DiffField({ label, value, previous }: { label: string; value: unknown; previous: unknown }) {
  const cur = value === null || value === undefined || value === '' ? '—' : String(value);
  const prev = previous === null || previous === undefined || previous === '' ? '—' : String(previous);
  const changed = previous !== undefined && cur !== prev;
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {label}
        {changed && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-warning/10 text-warning border-warning/30 leading-none">
            Changed
          </Badge>
        )}
      </div>
      <div className={changed ? 'text-warning font-medium' : ''}>{cur}</div>
      {changed && <div className="text-[10px] text-muted-foreground line-through truncate">was {prev}</div>}
    </div>
  );
}
