import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Plus, Trash2, UserCheck, UserX, CheckCircle2, Circle, Calendar as CalendarIcon } from 'lucide-react';
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
import { defaultMarkets } from '@/data/lookupData';
import { PhoneInput, splitPhone, joinPhone } from '@/components/shared/PhoneInput';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { VerificationTab } from '@/components/account/VerificationTab';
import { BillingTab } from '@/components/account/BillingTab';
import { ImportsTab } from '@/components/account/ImportsTab';
import { SeatRequestsTab } from '@/components/account/SeatRequestsTab';
import { ApiKeysCard } from '@/components/account/ApiKeysCard';
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

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [acc, setAcc] = useState<Account | null>(null);
  const [draft, setDraft] = useState<Account | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newNote, setNewNote] = useState('');
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
    setChecklist((c.data ?? []) as ChecklistRow[]);
    setEvents((ev.data ?? []) as EventRow[]);
    setLoading(false);
  }, [accountId, navigate]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useMemo(() => JSON.stringify(acc) !== JSON.stringify(draft), [acc, draft]);

  const setField = <K extends keyof Account>(k: K, v: Account[K]) => setDraft(d => d ? { ...d, [k]: v } : d);

  const save = async () => {
    if (!draft || !acc) return;
    setSaving(true);
    const { error } = await supabase.from('accounts').update({
      account_name: draft.account_name, city: draft.city, status: draft.status, tenancy_type: draft.tenancy_type,
      owner_name: draft.owner_name, owner_phone: draft.owner_phone, owner_email: draft.owner_email,
      gst_number: draft.gst_number, pan_number: draft.pan_number, rera_number: draft.rera_number, website: draft.website,
    }).eq('id', acc.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Saved');
    load();
  };

  const addNote = async () => {
    if (!acc || !newNote.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('account_notes').insert({ account_id: acc.id, note_text: newNote.trim() });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setNewNote(''); load(); }
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

  const handleScheduleEvent = async (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    if (!acc) return;
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    const map: Record<string, string> = { DEMO: 'DEMO', FOLLOW_UP: 'FOLLOW_UP', CALL_BACK: 'CALL_BACK', CHECK_IN: 'CHECK_IN', ONBOARDING: 'ONBOARDING', GENERAL: 'OTHER' };
    const { error } = await supabase.from('calendar_events').insert({
      title: data.title, scheduled_at: scheduled.toISOString(), notes: data.notes || null,
      event_type: (map[data.event_type] ?? 'OTHER') as 'OTHER',
      created_by: currentUser.user_id,
      related_entity_type: 'ACCOUNT', related_entity_id: acc.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Event scheduled'); setScheduleOpen(false); load();
  };

  if (loading || !acc) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const phoneSplit = splitPhone(draft.owner_phone ?? '');
  const doneCount = checklist.filter(c => c.is_done).length;

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

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="seats">Seats ({seats.filter(s => s.is_active).length})</TabsTrigger>
          <TabsTrigger value="seat-requests">Seat requests</TabsTrigger>
          <TabsTrigger value="checklist">Onboarding ({doneCount}/{checklist.length})</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar ({events.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Account details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Account name</Label>
                  <Input value={draft.account_name} onChange={e => setField('account_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={v => setField('status', v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusLabels) as Status[]).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Select value={draft.city ?? NONE} onValueChange={v => setField('city', v === NONE ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NONE}>—</SelectItem>
                      {defaultMarkets.map(m => <SelectItem key={m.id} value={m.value}>{m.value}</SelectItem>)}
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
                <div className="space-y-1.5">
                  <Label>RERA number</Label>
                  <Input value={draft.rera_number ?? ''} onChange={e => setField('rera_number', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input type="url" value={draft.website ?? ''} onChange={e => setField('website', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Created</div><div>{format(new Date(acc.created_at), 'dd MMM yyyy')}</div></div>
              <div><div className="text-xs text-muted-foreground">Account code</div><div>{acc.account_code ?? '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Source enquiry</div><div>{acc.source_enquiry_id ? <Link to={`/enquiries/${acc.source_enquiry_id}`} className="text-primary hover:underline">Open</Link> : '—'}</div></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seats" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Team seats</CardTitle>
                <Button size="sm" onClick={openAddSeat}><Plus className="h-4 w-4 mr-1" /> Add seat</Button>
              </div>
            </CardHeader>
            <CardContent>
              {seats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No seats yet.</p>
              ) : (
                <div className="space-y-2">
                  {seats.map(s => (
                    <div key={s.id} className={`flex items-center justify-between border rounded p-3 ${!s.is_active ? 'opacity-60' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{s.full_name}</span>
                          <Badge variant="outline" className="text-[10px]">{s.role ?? 'Agent'}</Badge>
                          {!s.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {s.email ?? '—'} · {s.phone ?? '—'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditSeat(s)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleSeatActive(s)}>
                          {s.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeSeat(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Onboarding checklist</CardTitle></CardHeader>
            <CardContent>
              {checklist.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No checklist items.</p>
              ) : (
                <div className="space-y-2">
                  {checklist.map(c => (
                    <button key={c.id} onClick={() => toggleChecklist(c)}
                      className="flex items-start gap-3 w-full text-left p-2 rounded hover:bg-muted/50 transition-colors">
                      {c.is_done
                        ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                        : <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${c.is_done ? 'line-through text-muted-foreground' : ''}`}>{c.label}</p>
                        {c.done_at && <p className="text-xs text-muted-foreground">Done {format(new Date(c.done_at), 'dd MMM, HH:mm')}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes & activity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note…" rows={2} />
                <Button onClick={addNote} disabled={!newNote.trim() || busy}>Add</Button>
              </div>
              <Separator />
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {notes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p> :
                  notes.map(n => (
                    <div key={n.id} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                      <p>{n.note_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), 'dd MMM, HH:mm')}</p>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <VerificationTab accountId={acc.id} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingTab accountId={acc.id} />
          <ApiKeysCard accountId={acc.id} />
        </TabsContent>

        <TabsContent value="seat-requests" className="space-y-4">
          <SeatRequestsTab accountId={acc.id} />
        </TabsContent>

        <TabsContent value="imports" className="space-y-4">
          <ImportsTab accountId={acc.id} />
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
