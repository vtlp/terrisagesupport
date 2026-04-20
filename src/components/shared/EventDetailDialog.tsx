import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ExternalLink, RefreshCw, Trash2, Loader2 } from 'lucide-react';
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
  CHECK_IN: 'Check-in', ONBOARDING: 'Onboarding', OTHER: 'Other',
};

const STATUS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export function EventDetailDialog({ event, ownerName, teamMembers = [], open, onOpenChange, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event.title}
            <Badge variant="outline" className="text-[10px]">{eventTypeLabels[event.event_type] ?? event.event_type}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
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

          <div className="flex gap-2 justify-between pt-2">
            <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />} Delete
            </Button>
            <Button size="sm" onClick={syncToGoogle} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" /> Sync to Google
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
