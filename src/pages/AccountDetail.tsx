import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Trash2, UserCheck, UserX, CheckCircle2, Circle, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCityOptions, BUSINESS_AREA_OPTIONS, PROPERTY_TYPE_FOCUS_OPTIONS, getPortalOptions } from '@/data/lookupData';
import { MultiSelect } from '@/components/shared/MultiSelect';
import { PhoneInput, splitPhone, joinPhone } from '@/components/shared/PhoneInput';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { VerificationTab } from '@/components/account/VerificationTab';
import { BillingTab } from '@/components/account/BillingTab';
import { RenewalsCard } from '@/components/account/RenewalsCard';
import { TrialConversionCard } from '@/components/account/TrialConversionCard';
import { ImportsTab } from '@/components/account/ImportsTab';
import { SeatsAndRequestsTab } from '@/components/account/SeatsAndRequestsTab';

import { ProjectsTab } from '@/components/account/ProjectsTab';
import { ProjectRequestsTab } from '@/components/account/ProjectRequestsTab';
import { DocumentsTab } from '@/components/account/DocumentsTab';

import { CategorizedNotes } from '@/components/account/CategorizedNotes';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { EventDetailDialog, EventRow } from '@/components/shared/EventDetailDialog';
import { CalendarEventType } from '@/types/core';
import { useUser } from '@/context/UserContext';

type Status = 'LIVE' | 'ONBOARDING_IN_PROGRESS' | 'STALLED_ONBOARDING' | 'DEACTIVATED';
type Tenancy = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';

interface Account {
  id: string; account_name: string; city: string | null; tenancy_type: Tenancy; status: Status;
  owner_name: string | null; owner_phone: string | null; owner_email: string | null;
  gst_number: string | null; pan_number: string | null; rera_number: string | null; website: string | null;
  source_enquiry_id: string | null; account_code: string | null;
  tenant_id: string | null;
  payload: Record<string, unknown>;
  created_at: string; updated_at: string;
}
interface Seat {
  id: string; account_id: string; full_name: string; email: string | null; phone: string | null;
  role: string | null; is_active: boolean; created_at: string;
}
interface NoteRow { id: string; note_text: string; created_at: string; }
interface ChecklistRow { id: string; label: string; is_done: boolean; sort_order: number; done_at: string | null; }

const statusColors: Record<Status, string> = {
  LIVE: 'bg-success/15 text-success',
  ONBOARDING_IN_PROGRESS: 'bg-primary/15 text-primary',
  STALLED_ONBOARDING: 'bg-destructive/15 text-destructive',
  DEACTIVATED: 'bg-muted text-muted-foreground',
};
const statusLabels: Record<Status, string> = {
  LIVE: 'Live', ONBOARDING_IN_PROGRESS: 'Onboarding', STALLED_ONBOARDING: 'Stalled', DEACTIVATED: 'Deactivated',
};
const NONE = '__none__';
const ROLES = ['Admin', 'Manager', 'Agent'];

// Canonical onboarding checklist template (sequential, grouped).
// Items are stored in account_checklist_items keyed by exact label.
type ChecklistTemplateItem = {
  label: string;
  section: string;
  // Visibility rule given account context
  show: (ctx: { tenancy: Tenancy; projectsEnabled: boolean }) => boolean;
};
const ONBOARDING_TEMPLATE: ChecklistTemplateItem[] = [
  { section: 'Commercial setup', label: 'Payment received / trial approved', show: () => true },
  { section: 'Commercial setup', label: 'Contract signed', show: () => true },
  { section: 'Verification', label: 'ID / business verification completed', show: () => true },
  { section: 'Workspace setup', label: 'Owner login credentials sent', show: () => true },
  { section: 'Workspace setup', label: 'Team users reviewed and invited', show: () => true },
  { section: 'Workspace setup', label: 'Branding details added', show: () => true },
  { section: 'Workspace setup', label: 'Required integrations configured', show: () => true },
  { section: 'Data setup', label: 'Project data imported',
    show: ({ tenancy, projectsEnabled }) => tenancy === 'BUILDER_DEVELOPER' || projectsEnabled },
  { section: 'Data setup', label: 'Lead data imported', show: () => true },
  { section: 'Data setup', label: 'Secondary market properties imported',
    show: ({ tenancy }) => tenancy === 'AGENCY_BROKERAGE_CONSULTANCY' },
  { section: 'Testing and go-live', label: 'Imported data preview checked', show: () => true },
  { section: 'Testing and go-live', label: 'Share links tested', show: () => true },
  { section: 'Testing and go-live', label: 'Enquiry forms tested', show: () => true },
  { section: 'Testing and go-live', label: 'Account marked live', show: () => true },
];
const GO_LIVE_LABEL = 'Account marked live';

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['overview','seats','checklist','verification','billing','projects','documents','imports','notes','calendar','activity'];
  // Note: legacy 'project-requests' tab merged into 'projects'.
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';
  const handleTabChange = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };
  const [acc, setAcc] = useState<Account | null>(null);
  const [draft, setDraft] = useState<Account | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const { currentUser } = useUser();

  // seat dialog
  const [seatOpen, setSeatOpen] = useState(false);
  const [seatDraft, setSeatDraft] = useState<{ id?: string; full_name: string; email: string; phone: string; role: string; is_active: boolean }>({
    full_name: '', email: '', phone: '+91 ', role: 'Agent', is_active: true,
  });

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    // Auto-mark accounts stuck in onboarding >7 days as stalled (no-op for others)
    await (supabase.rpc as unknown as (fn: string) => Promise<unknown>)('mark_stalled_accounts');
    const [a, s, n, c, ev] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase.from('account_seats').select('*').eq('account_id', accountId).order('created_at'),
      supabase.from('account_notes').select('id, note_text, created_at').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('account_checklist_items').select('id, label, is_done, sort_order, done_at').eq('account_id', accountId).order('sort_order'),
      supabase.from('calendar_events').select('*').eq('related_entity_type', 'ACCOUNT').eq('related_entity_id', accountId).order('scheduled_at', { ascending: true }),
    ]);
    if (a.error || !a.data) { toast.error('Account not found'); navigate('/accounts'); return; }
    const acct = { ...a.data, payload: (a.data.payload ?? {}) as Record<string, unknown> } as Account;
    setAcc(acct);
    setDraft(acct);
    setSeats((s.data ?? []) as Seat[]);
    setNotes((n.data ?? []) as NoteRow[]);

    // Sync canonical checklist template: insert any missing visible items so
    // every account exposes the same sequential onboarding checklist.
    const projectsEnabled =
      Array.isArray((acct.payload as Record<string, unknown>)?.projects) &&
      ((acct.payload as { projects?: unknown[] }).projects?.length ?? 0) > 0
      || (acct.payload as { projects_enabled?: boolean })?.projects_enabled === true;
    const ctx = { tenancy: acct.tenancy_type, projectsEnabled };
    const existing = (c.data ?? []) as ChecklistRow[];
    const existingLabels = new Set(existing.map(r => r.label));
    const toInsert = ONBOARDING_TEMPLATE
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => t.show(ctx) && !existingLabels.has(t.label))
      .map(({ t, idx }) => ({ account_id: accountId, label: t.label, sort_order: idx }));
    if (toInsert.length > 0) {
      const { data: inserted } = await supabase
        .from('account_checklist_items')
        .insert(toInsert)
        .select('id, label, is_done, sort_order, done_at');
      setChecklist([...existing, ...((inserted ?? []) as ChecklistRow[])]);
    } else {
      setChecklist(existing);
    }
    setEvents((ev.data ?? []) as EventRow[]);
    setLoading(false);
  }, [accountId, navigate]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useMemo(() => JSON.stringify(acc) !== JSON.stringify(draft), [acc, draft]);

  const setField = <K extends keyof Account>(k: K, v: Account[K]) => setDraft(d => d ? { ...d, [k]: v } : d);

  const setCompanyField = (key: 'business_area' | 'property_type_focus', value: string) => {
    setDraft(d => {
      if (!d) return d;
      const company = { ...((d.payload?.company as Record<string, unknown> | undefined) ?? {}), [key]: value };
      return { ...d, payload: { ...d.payload, company } };
    });
  };

  const setOnlinePresenceField = (key: 'website' | 'whatsapp_channel' | 'youtube' | 'instagram' | 'facebook' | 'portals', value: string | string[]) => {
    setDraft(d => {
      if (!d) return d;
      const op = { ...((d.payload?.online_presence as Record<string, unknown> | undefined) ?? {}), [key]: value };
      const next: Account = { ...d, payload: { ...d.payload, online_presence: op } };
      if (key === 'website') next.website = (value as string) || null;
      return next;
    });
  };

  const allChecklistDone = useMemo(() => {
    const templateLabels = new Set(ONBOARDING_TEMPLATE.map(t => t.label));
    const relevant = checklist.filter(c => templateLabels.has(c.label));
    return relevant.length > 0 && relevant.every(c => c.is_done);
  }, [checklist]);

  const save = async () => {
    if (!draft || !acc) return;
    if (draft.status === 'LIVE' && acc.status !== 'LIVE' && !allChecklistDone) {
      toast.error('Complete all onboarding tasks before going Live');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('accounts').update({
      account_name: draft.account_name, city: draft.city, status: draft.status, tenancy_type: draft.tenancy_type,
      owner_name: draft.owner_name, owner_phone: draft.owner_phone, owner_email: draft.owner_email,
      gst_number: draft.gst_number, pan_number: draft.pan_number, rera_number: draft.rera_number, website: draft.website,
      
      payload: draft.payload as never,
    }).eq('id', acc.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Saved');
    load();
  };

  const toggleChecklist = async (item: ChecklistRow) => {
    const { error } = await supabase.from('account_checklist_items')
      .update({ is_done: !item.is_done, done_at: !item.is_done ? new Date().toISOString() : null })
      .eq('id', item.id);
    if (error) toast.error(error.message);
    else load();
  };

  const openAddSeat = () => {
    setSeatDraft({ full_name: '', email: '', phone: '+91 ', role: 'Agent', is_active: true });
    setSeatOpen(true);
  };
  const openEditSeat = (s: Seat) => {
    setSeatDraft({
      id: s.id, full_name: s.full_name, email: s.email ?? '', phone: s.phone ?? '+91 ',
      role: s.role ?? 'Agent', is_active: s.is_active,
    });
    setSeatOpen(true);
  };
  const saveSeat = async () => {
    if (!acc || !seatDraft.full_name.trim()) { toast.error('Name is required'); return; }
    setBusy(true);
    const payload = {
      account_id: acc.id,
      full_name: seatDraft.full_name.trim(),
      email: seatDraft.email || null,
      phone: seatDraft.phone || null,
      role: seatDraft.role,
      is_active: seatDraft.is_active,
    };
    const { error } = seatDraft.id
      ? await supabase.from('account_seats').update(payload).eq('id', seatDraft.id)
      : await supabase.from('account_seats').insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSeatOpen(false);
    toast.success(seatDraft.id ? 'Seat updated' : 'Seat added');
    load();
  };
  const removeSeat = async (id: string) => {
    if (!confirm('Remove this seat?')) return;
    const { error } = await supabase.from('account_seats').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Seat removed'); load(); }
  };
  const toggleSeatActive = async (s: Seat) => {
    const { error } = await supabase.from('account_seats').update({ is_active: !s.is_active }).eq('id', s.id);
    if (error) toast.error(error.message);
    else load();
  };

  const handleScheduleEvent = async (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType; assigned_to?: string | null }) => {
    if (!acc) return;
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    const map: Record<string, string> = { DEMO: 'DEMO', FOLLOW_UP: 'FOLLOW_UP', CALL_BACK: 'CALL_BACK', CHECK_IN: 'CHECK_IN', ONBOARDING: 'ONBOARDING', GENERAL: 'OTHER' };
    const { error } = await supabase.from('calendar_events').insert({
      title: data.title, scheduled_at: scheduled.toISOString(), notes: data.notes || null,
      event_type: (map[data.event_type] ?? 'OTHER') as 'OTHER',
      created_by: currentUser.user_id,
      assigned_to: data.assigned_to ?? currentUser.user_id,
      related_entity_type: 'ACCOUNT', related_entity_id: acc.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Event scheduled'); setScheduleOpen(false); load();
  };

  if (loading || !acc) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const phoneSplit = splitPhone(draft.owner_phone ?? '');

  // Build grouped, filtered checklist from the canonical template, joined to DB rows by label.
  const projectsEnabledNow =
    (Array.isArray((acc.payload as Record<string, unknown>)?.projects) &&
      ((acc.payload as { projects?: unknown[] }).projects?.length ?? 0) > 0)
    || (acc.payload as { projects_enabled?: boolean })?.projects_enabled === true;
  const checklistByLabel = new Map(checklist.map(c => [c.label, c]));
  const visibleTemplate = ONBOARDING_TEMPLATE.filter(t =>
    t.show({ tenancy: acc.tenancy_type, projectsEnabled: projectsEnabledNow }));
  const visibleRows = visibleTemplate
    .map(t => ({ tpl: t, row: checklistByLabel.get(t.label) }))
    .filter((x): x is { tpl: ChecklistTemplateItem; row: ChecklistRow } => !!x.row);
  const visibleTotal = visibleTemplate.length;
  const doneCount = visibleRows.filter(x => x.row.is_done).length;
  const preGoLiveIncomplete = visibleRows
    .filter(x => x.tpl.label !== GO_LIVE_LABEL)
    .some(x => !x.row.is_done);

  // Group by section preserving template order
  const groupedSections: { section: string; items: { tpl: ChecklistTemplateItem; row: ChecklistRow }[] }[] = [];
  for (const item of visibleRows) {
    const last = groupedSections[groupedSections.length - 1];
    if (last && last.section === item.tpl.section) last.items.push(item);
    else groupedSections.push({ section: item.tpl.section, items: [item] });
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/accounts')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{acc.account_name}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {acc.city ?? '—'} · {acc.tenancy_type === 'BUILDER_DEVELOPER' ? 'Builder / Developer' : 'Agency / Brokerage'}
            {acc.source_enquiry_id && <> · <Link to={`/enquiries/${acc.source_enquiry_id}`} className="text-primary hover:underline">View source enquiry</Link></>}
          </p>
        </div>
        <Badge className={statusColors[acc.status]}>{statusLabels[acc.status]}</Badge>
        {isDirty && (
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save changes
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="seats">Seats &amp; requests ({seats.filter(s => s.is_active).length})</TabsTrigger>
          <TabsTrigger value="checklist">Onboarding ({doneCount}/{visibleTotal})</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="projects">Projects ({Array.isArray((acc.payload as any)?.projects) ? (acc.payload as any).projects.length : 0})</TabsTrigger>
          
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar ({events.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {(() => {
            const company = (draft.payload?.company as Record<string, unknown> | undefined) ?? {};
            const tagline = (company.tagline as string | undefined)?.trim();
            const businessArea = (company.business_area as string | undefined) ?? '';
            const propertyTypeFocus = (company.property_type_focus as string | undefined) ?? '';
            const isAgency = draft.tenancy_type === 'AGENCY_BROKERAGE_CONSULTANCY';
            const isBuilder = draft.tenancy_type === 'BUILDER_DEVELOPER';

            return (
              <Card>
                <CardHeader><CardTitle className="text-base">Account details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Account name</Label>
                      <Input value={draft.account_name} onChange={e => setField('account_name', e.target.value)} />
                      {tagline && (
                        <p className="text-xs text-muted-foreground italic mt-1">&ldquo;{tagline}&rdquo;</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={draft.status} onValueChange={v => setField('status', v as Status)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusLabels) as Status[]).map(s => (
                            <SelectItem
                              key={s}
                              value={s}
                              disabled={s === 'LIVE' && acc?.status !== 'LIVE' && !allChecklistDone}
                            >
                              {statusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {acc?.status !== 'LIVE' && !allChecklistDone && (
                        <p className="text-xs text-muted-foreground">
                          Complete all onboarding tasks to enable Live.
                        </p>
                      )}
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
                    <div className="space-y-1.5">
                      <Label>Tenancy type</Label>
                      <Select value={draft.tenancy_type} onValueChange={v => setField('tenancy_type', v as Tenancy)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AGENCY_BROKERAGE_CONSULTANCY">Agency / Brokerage</SelectItem>
                          <SelectItem value="BUILDER_DEVELOPER">Builder / Developer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {isAgency && (
                      <div className="space-y-1.5">
                        <Label>Business area</Label>
                        <Select value={businessArea || NONE} onValueChange={v => setCompanyField('business_area', v === NONE ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Select business area" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {BUSINESS_AREA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {isBuilder && (
                      <div className="space-y-1.5">
                        <Label>Property type focus</Label>
                        <Select value={propertyTypeFocus || NONE} onValueChange={v => setCompanyField('property_type_focus', v === NONE ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Select property type focus" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {PROPERTY_TYPE_FOCUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Owner name</Label>
                      <Input value={draft.owner_name ?? ''} onChange={e => setField('owner_name', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Owner email</Label>
                      <Input type="email" value={draft.owner_email ?? ''} onChange={e => setField('owner_email', e.target.value)} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Owner phone</Label>
                      <PhoneInput
                        countryCode={phoneSplit.code}
                        onCountryCodeChange={c => setField('owner_phone', joinPhone(c, phoneSplit.number))}
                        number={phoneSplit.number}
                        onNumberChange={n => setField('owner_phone', joinPhone(phoneSplit.code, n))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>GST number</Label>
                      <Input value={draft.gst_number ?? ''} onChange={e => setField('gst_number', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>PAN number</Label>
                      <Input value={draft.pan_number ?? ''} onChange={e => setField('pan_number', e.target.value)} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>RERA number</Label>
                      <Input value={draft.rera_number ?? ''} onChange={e => setField('rera_number', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {(() => {
            const op = (draft.payload?.online_presence as Record<string, unknown> | undefined) ?? {};
            const website = (op.website as string | undefined) ?? draft.website ?? '';
            const whatsapp = (op.whatsapp_channel as string | undefined) ?? '';
            const youtube = (op.youtube as string | undefined) ?? '';
            const instagram = (op.instagram as string | undefined) ?? '';
            const facebook = (op.facebook as string | undefined) ?? '';
            const portals = Array.isArray(op.portals) ? (op.portals as string[]) : [];
            return (
              <Card>
                <CardHeader><CardTitle className="text-base">Online presence</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input type="url" placeholder="https://" value={website} onChange={e => setOnlinePresenceField('website', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp channel link</Label>
                    <Input type="url" placeholder="https://whatsapp.com/channel/..." value={whatsapp} onChange={e => setOnlinePresenceField('whatsapp_channel', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>YouTube</Label>
                    <Input type="url" placeholder="https://youtube.com/@..." value={youtube} onChange={e => setOnlinePresenceField('youtube', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Instagram</Label>
                    <Input type="url" placeholder="https://instagram.com/..." value={instagram} onChange={e => setOnlinePresenceField('instagram', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Facebook</Label>
                    <Input type="url" placeholder="https://facebook.com/..." value={facebook} onChange={e => setOnlinePresenceField('facebook', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Property portals in use</Label>
                    <MultiSelect
                      options={getPortalOptions().map(v => ({ value: v, label: v }))}
                      selected={portals}
                      onChange={v => setOnlinePresenceField('portals', v)}
                      placeholder="Select portals…"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <Card>
            <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Created</div><div>{format(new Date(acc.created_at), 'dd MMM yyyy')}</div></div>
              <div><div className="text-xs text-muted-foreground">Account code</div><div>{acc.account_code ?? '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Source enquiry</div><div>{acc.source_enquiry_id ? <Link to={`/enquiries/${acc.source_enquiry_id}`} className="text-primary hover:underline">Open</Link> : '—'}</div></div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground">Terrisage tenant ID</div>
                <div className="mt-1 flex gap-2 items-center">
                  <Input
                    value={draft?.tenant_id ?? ''}
                    onChange={(e) => setDraft(d => d ? { ...d, tenant_id: e.target.value } : d)}
                    placeholder="Paste Terrisage tenant UUID"
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncingTenant || !acc.owner_email}
                    title={acc.owner_email ? `Look up using ${acc.owner_email}` : 'Add an owner email first'}
                    onClick={async () => {
                      setSyncingTenant(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('terrisage-tenant-lookup', {
                          body: { accountId: acc.id },
                        });
                        if (error) throw error;
                        const d = (data ?? {}) as { ok?: boolean; tenantId?: string; error?: string };
                        if (!d.ok || !d.tenantId) throw new Error(d.error ?? 'Tenant not found');
                        setAcc(a => a ? { ...a, tenant_id: d.tenantId! } : a);
                        setDraft(dr => dr ? { ...dr, tenant_id: d.tenantId! } : dr);
                        toast.success('Tenant ID synced from Terrisage');
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setSyncingTenant(false);
                      }
                    }}
                  >
                    {syncingTenant ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                    Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || (draft?.tenant_id ?? '') === (acc.tenant_id ?? '')}
                    onClick={async () => {
                      const newVal = (draft?.tenant_id ?? '').trim() || null;
                      setSaving(true);
                      const { error } = await supabase.from('accounts').update({ tenant_id: newVal }).eq('id', acc.id);
                      setSaving(false);
                      if (error) { toast.error(error.message); return; }
                      setAcc(a => a ? { ...a, tenant_id: newVal } : a);
                      toast.success('Tenant ID updated');
                    }}
                  >
                    Save
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Click Sync to look up the tenant on Terrisage using the owner email{acc.owner_email ? ` (${acc.owner_email})` : ''}.
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="seats" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Team Seats Info from onboarding</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {seats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No seats yet.</p>
              ) : (
                <div className="space-y-2">
                  {seats.map(s => {
                    const teamFromForm = ((acc.payload as any)?.team?.members ?? []) as Array<{ email?: string; orgWideAccess?: boolean; agentNetworksAccess?: boolean }>;
                    const formMatch = teamFromForm.find(m => (m.email ?? '').toLowerCase() === (s.email ?? '').toLowerCase());
                    const perms: string[] = [];
                    if (formMatch?.orgWideAccess) perms.push('Org-wide access');
                    if (formMatch?.agentNetworksAccess) perms.push('Agent networks');
                    return (
                      <div key={s.id} className={`flex items-center justify-between border rounded p-3 ${!s.is_active ? 'opacity-60' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{s.full_name}</span>
                            <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/10 text-primary">Role: {s.role ?? 'Agent'}</Badge>
                            {perms.map(p => (
                              <Badge key={p} variant="outline" className="text-[10px] border-warning/30 bg-warning/10 text-warning">Permission: {p}</Badge>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {s.email ?? '—'} · {s.phone ?? '—'}
                          </div>
                          {perms.length === 0 && formMatch && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">No special permissions granted</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <SeatsAndRequestsTab accountId={acc.id} activeSeatsUsed={seats.filter(s => s.is_active).length} onboardingPayload={acc.payload} tenantId={acc.tenant_id} />
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Onboarding checklist</CardTitle>
              <p className="text-xs text-muted-foreground">{doneCount}/{visibleTotal} completed</p>
            </CardHeader>
            <CardContent>
              {visibleRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No checklist items.</p>
              ) : (
                <div className="space-y-4">
                  {groupedSections.map(group => (
                    <div key={group.section} className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-2">
                        {group.section}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map(({ tpl, row }) => {
                          const isGoLive = tpl.label === GO_LIVE_LABEL;
                          return (
                            <div key={row.id}>
                              <button
                                onClick={() => toggleChecklist(row)}
                                className="flex items-start gap-3 w-full text-left px-2 py-2 rounded hover:bg-muted/50 transition-colors"
                              >
                                {row.is_done
                                  ? <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                  : <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                  <span className={`block text-sm leading-snug ${row.is_done ? 'line-through text-muted-foreground' : ''}`}>
                                    {tpl.label}
                                  </span>
                                  {row.is_done && row.done_at && (
                                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                                      Completed {format(new Date(row.done_at), 'dd MMM')}
                                    </span>
                                  )}
                                </div>
                              </button>
                              {isGoLive && !row.is_done && preGoLiveIncomplete && (
                                <p className="text-xs text-muted-foreground pl-10 -mt-1 pb-1">
                                  Some onboarding steps are still incomplete.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <CategorizedNotes accountId={acc.id} notes={notes} onChanged={load} />
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <VerificationTab accountId={acc.id} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingTab accountId={acc.id} />
          <TrialConversionCard accountId={acc.id} />
          <RenewalsCard accountId={acc.id} />
          
        </TabsContent>


        <TabsContent value="projects" className="space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Projects from onboarding</h3>
              <p className="text-xs text-muted-foreground">Captured during the account's onboarding submission.</p>
            </div>
            <ProjectsTab payload={acc.payload} />
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Project requests from Terrisage</h3>
              <p className="text-xs text-muted-foreground">New projects requested by the client from their Terrisage app after go-live.</p>
            </div>
            <ProjectRequestsTab accountId={acc.id} />
          </section>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentsTab payload={acc.payload} />
        </TabsContent>

        <TabsContent value="imports" className="space-y-4">
          <ImportsTab accountId={acc.id} tenancyType={acc.tenancy_type} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Calendar events</CardTitle>
                <Button size="sm" onClick={() => setScheduleOpen(true)}><CalendarIcon className="h-4 w-4 mr-1" /> Schedule event</Button>
              </div>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No events scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {events.map(e => (
                    <button key={e.id} onClick={() => setOpenEvent(e)}
                      className="w-full text-left flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70">
                      <div>
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'EEE dd MMM, HH:mm')}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityTimeline entityType="ACCOUNT" entityId={acc.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule event</DialogTitle></DialogHeader>
          <CalendarEventForm
            onSubmit={handleScheduleEvent}
            onCancel={() => setScheduleOpen(false)}
            lockedEntityType="ACCOUNT"
            lockedEntityId={acc.id}
            lockedEntityLabel={acc.account_name}
          />
        </DialogContent>
      </Dialog>

      <EventDetailDialog event={openEvent} open={!!openEvent} onOpenChange={(v) => !v && setOpenEvent(null)} onChanged={load} />

      {/* Seat dialog */}
      <Dialog open={seatOpen} onOpenChange={setSeatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{seatDraft.id ? 'Edit seat' : 'Add seat'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input value={seatDraft.full_name} onChange={e => setSeatDraft(s => ({ ...s, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={seatDraft.email} onChange={e => setSeatDraft(s => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <PhoneInput
                countryCode={splitPhone(seatDraft.phone).code}
                onCountryCodeChange={c => setSeatDraft(s => ({ ...s, phone: joinPhone(c, splitPhone(s.phone).number) }))}
                number={splitPhone(seatDraft.phone).number}
                onNumberChange={n => setSeatDraft(s => ({ ...s, phone: joinPhone(splitPhone(s.phone).code, n) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={seatDraft.role} onValueChange={v => setSeatDraft(s => ({ ...s, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={seatDraft.is_active} onCheckedChange={v => setSeatDraft(s => ({ ...s, is_active: !!v }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeatOpen(false)}>Cancel</Button>
            <Button onClick={saveSeat} disabled={busy}>{seatDraft.id ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
