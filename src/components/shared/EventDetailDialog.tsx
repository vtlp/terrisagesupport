import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ExternalLink, RefreshCw, Trash2, Loader2, Pencil, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EventRow {
  id: string;
  title: string;
  scheduled_at: string;
  event_type: string;
  status: string;
  notes: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  assigned_to?: string | null;
  duration_min?: number | null;
}

interface Props {
  event: EventRow | null;
  ownerName?: string;
  teamMembers?: { id: string; full_name: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

const eventTypeLabels: Record<string, string> = {
  DEMO: 'Demo', FOLLOW_UP: 'Follow-up', CALL_BACK: 'Call Back',
  CHECK_IN: 'Check-in', ONBOARDING: 'Onboarding', OTHER: 'Other', GENERAL: 'General',
};

const EVENT_TYPES = ['DEMO', 'FOLLOW_UP', 'CALL_BACK', 'CHECK_IN', 'ONBOARDING', 'GENERAL', 'OTHER'] as const;
const STATUS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

// Convert ISO timestamp to a value usable by <input type="datetime-local">
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function EventDetailDialog({ event, ownerName, teamMembers = [], open, onOpenChange, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    scheduled_at: '',
    event_type: 'GENERAL',
    notes: '',
    duration_min: 30,
    assigned_to: '' as string,
  });

  // Sync local form state whenever the event changes / dialog opens.
  useEffect(() => {
    if (!event) return;
    setForm({
      title: event.title ?? '',
      scheduled_at: toLocalInput(event.scheduled_at),
      event_type: event.event_type ?? 'GENERAL',
      notes: event.notes ?? '',
      duration_min: event.duration_min ?? 30,
      assigned_to: event.assigned_to ?? event.created_by ?? 'unassigned',
    });
    setEditing(false);
  }, [event?.id, open]);

  if (!event) return null;

  const overdue = event.status === 'SCHEDULED' && new Date(event.scheduled_at).getTime() < Date.now();

  const linkHref = (() => {
    if (!event.related_entity_type || !event.related_entity_id) return null;
    if (event.related_entity_type === 'ENQUIRY') return `/enquiries/${event.related_entity_id}`;
    if (event.related_entity_type === 'ACCOUNT') return `/accounts/${event.related_entity_id}`;
    return null;
  })();

  const updateStatus = async (status: string) => {
    setBusy(true);
    const { error } = await supabase.from('calendar_events')
      .update({ status: status as 'SCHEDULED' })
      .eq('id', event.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Status updated');
    onChanged?.();
  };

  const updateAssignee = async (userId: string) => {
    const newId = userId === 'unassigned' ? null : userId;
    setBusy(true);
    const { error } = await supabase.from('calendar_events')
      .update({ assigned_to: newId })
      .eq('id', event.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Assignee updated');
    onChanged?.();
  };

  const saveEdits = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.scheduled_at) { toast.error('Date & time is required'); return; }
    setBusy(true);
    const newIso = new Date(form.scheduled_at).toISOString();
    const { error } = await supabase.from('calendar_events')
      .update({
        title: form.title.trim(),
        scheduled_at: newIso,
        event_type: form.event_type as 'DEMO',
        notes: form.notes.trim() || null,
        duration_min: Number(form.duration_min) || 30,
        assigned_to: form.assigned_to === 'unassigned' ? null : form.assigned_to,
      })
      .eq('id', event.id);
    if (error) { setBusy(false); toast.error(error.message); return; }

    // If this is a DEMO linked to an enquiry that hasn't been completed yet,
    // keep the enquiry's demo_scheduled_at in sync with the rescheduled event.
    if (form.event_type === 'DEMO' && event.related_entity_type === 'ENQUIRY' && event.related_entity_id) {
      const { data: enq } = await supabase.from('enquiries')
        .select('demo_completed_at')
        .eq('id', event.related_entity_id)
        .maybeSingle();
      if (enq && !enq.demo_completed_at) {
        const { error: enqErr } = await supabase.from('enquiries')
          .update({ demo_scheduled_at: newIso })
          .eq('id', event.related_entity_id);
        if (enqErr) {
          toast.warning(`Event saved, but couldn't update linked enquiry: ${enqErr.message}`);
        } else {
          toast.success('Event updated and linked enquiry rescheduled');
          setBusy(false);
          setEditing(false);
          onChanged?.();
          return;
        }
      }
    }

    setBusy(false);
    toast.success('Event updated');
    setEditing(false);
    onChanged?.();
  };


  const remove = async () => {
    if (!confirm('Delete this event?')) return;
    setBusy(true);
    const { error } = await supabase.from('calendar_events').delete().eq('id', event.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Event deleted');
    onOpenChange(false);
    onChanged?.();
  };

  const syncToGoogle = async () => {
    toast.loading('Syncing to Google Calendar…', { id: `sync-${event.id}` });
    const { data, error } = await supabase.functions.invoke('sync-calendar-event', { body: { event_id: event.id } });
    const resp = data as { error?: string; code?: string; skipped?: boolean } | null;
    if (error || resp?.error) {
      toast.error(resp?.error ?? error?.message ?? 'Sync failed', { id: `sync-${event.id}` });
      return;
    }
    if (resp?.skipped) {
      toast.message('Google Calendar is optional. Connect from Settings to enable sync.', { id: `sync-${event.id}` });
      return;
    }
    toast.success('Synced to Google Calendar', { id: `sync-${event.id}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-8">
            {editing ? 'Edit event' : event.title}
            {!editing && (
              <Badge variant="outline" className="text-[10px]">{eventTypeLabels[event.event_type] ?? event.event_type}</Badge>
            )}
            {!editing && overdue && <Badge className="text-[10px] bg-destructive text-destructive-foreground">Overdue</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="evt-title" className="text-xs">Title</Label>
                <Input id="evt-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="evt-when" className="text-xs">When</Label>
                  <Input id="evt-when" type="datetime-local" value={form.scheduled_at}
                    onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="evt-dur" className="text-xs">Duration (min)</Label>
                  <Input id="evt-dur" type="number" min={5} step={5} value={form.duration_min}
                    onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{eventTypeLabels[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Owner (assigned to)</Label>
                <Select value={form.assigned_to || 'unassigned'} onValueChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="evt-notes" className="text-xs">Notes</Label>
                <Textarea id="evt-notes" rows={3} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={busy}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdits} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">When</div>
                  <div className="font-medium">{format(new Date(event.scheduled_at), 'EEE dd MMM yyyy, HH:mm')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Owner (assigned to)</div>
                  {teamMembers.length > 0 ? (
                    <Select value={event.assigned_to ?? event.created_by ?? 'unassigned'} onValueChange={updateAssignee} disabled={busy}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="font-medium">{ownerName ?? '—'}</div>
                  )}
                </div>
              </div>

              {event.notes && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Notes</div>
                  <p className="rounded-md bg-muted/40 px-3 py-2 whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}

              {linkHref && (
                <Link to={linkHref} onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                  <ExternalLink className="h-3.5 w-3.5" /> Open linked {event.related_entity_type?.toLowerCase()}
                </Link>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Status</div>
                <Select value={event.status} onValueChange={updateStatus} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-between pt-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />} Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" onClick={syncToGoogle} disabled={busy}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Sync to Google
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
