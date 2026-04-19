import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar as CalIcon, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { EventDetailDialog, EventRow } from '@/components/shared/EventDetailDialog';
import { CalendarEventType } from '@/types/core';
import { useUser } from '@/context/UserContext';

interface Props {
  ticketId: string;
  ticketSubject: string;
  /** Optional default-related entity to pre-link new events; tickets may belong to an account. */
  accountId?: string | null;
}

const typeLabels: Record<string, string> = {
  DEMO: 'Demo', FOLLOW_UP: 'Follow-up', CALL_BACK: 'Call Back',
  CHECK_IN: 'Check-in', ONBOARDING: 'Onboarding', OTHER: 'Other',
};

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-primary/15 text-primary',
  COMPLETED: 'bg-success/15 text-success',
  CANCELLED: 'bg-muted text-muted-foreground',
  NO_SHOW: 'bg-destructive/15 text-destructive',
};

export function TicketEvents({ ticketId, ticketSubject, accountId }: Props) {
  const { currentUser } = useUser();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('related_entity_type', 'TICKET')
      .eq('related_entity_id', ticketId)
      .order('scheduled_at', { ascending: true });
    if (error) { toast.error('Failed to load events'); setLoading(false); return; }
    setEvents((data ?? []) as EventRow[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
      .then(({ data }) => setTeam((data ?? []) as { id: string; full_name: string }[]));
  }, []);

  const handleSchedule = async (data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType; assigned_to: string | null }) => {
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m), 0, 0);
    const map: Record<string, string> = { DEMO: 'DEMO', FOLLOW_UP: 'FOLLOW_UP', CALL_BACK: 'CALL_BACK', CHECK_IN: 'CHECK_IN', ONBOARDING: 'ONBOARDING', GENERAL: 'OTHER' };
    const { error } = await supabase.from('calendar_events').insert({
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      notes: data.notes || null,
      event_type: (map[data.event_type] ?? 'OTHER') as 'OTHER',
      created_by: currentUser.user_id,
      assigned_to: data.assigned_to ?? currentUser.user_id,
      related_entity_type: 'TICKET',
      related_entity_id: ticketId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Event scheduled');
    setOpenForm(false);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalIcon className="h-4 w-4" /> Events ({events.length})
        </h3>
        <Button variant="outline" size="sm" onClick={() => setOpenForm(true)}>
          <Plus className="h-3 w-3 mr-1" /> Schedule
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scheduled events.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map(ev => (
            <Card key={ev.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setOpenEvent(ev)}>
              <CardContent className="p-2.5 flex items-center gap-3">
                <CalIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ev.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(ev.scheduled_at), 'EEE dd MMM, HH:mm')}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{typeLabels[ev.event_type] ?? ev.event_type}</Badge>
                <Badge className={`text-[10px] ${statusColors[ev.status] ?? ''}`}>{ev.status.replace('_', ' ')}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule event</DialogTitle>
            <DialogDescription>Linked to this ticket</DialogDescription>
          </DialogHeader>
          <CalendarEventForm
            onSubmit={handleSchedule}
            onCancel={() => setOpenForm(false)}
            defaultTitle={`Follow-up — ${ticketSubject.slice(0, 60)}`}
            defaultEventType={CalendarEventType.FOLLOW_UP}
            lockedEntityType={accountId ? 'ACCOUNT' : 'ENQUIRY'}
            lockedEntityId={accountId ?? ticketId}
            lockedEntityLabel={`Ticket: ${ticketSubject.slice(0, 40)}`}
          />
        </DialogContent>
      </Dialog>

      <EventDetailDialog
        event={openEvent}
        teamMembers={team}
        open={!!openEvent}
        onOpenChange={(v) => !v && setOpenEvent(null)}
        onChanged={load}
      />
    </div>
  );
}
