import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarEventType } from '@/types/core';
import { EntityPicker } from './EntityPicker';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

const eventTypeLabels: Record<CalendarEventType, string> = {
  [CalendarEventType.DEMO]: 'Demo',
  [CalendarEventType.FOLLOW_UP]: 'Follow-up',
  [CalendarEventType.CALL_BACK]: 'Call Back',
  [CalendarEventType.CHECK_IN]: 'Check-in',
  [CalendarEventType.ONBOARDING]: 'Onboarding',
  [CalendarEventType.GENERAL]: 'General',
};

interface SubmitData {
  title: string; date: Date; time: string; notes: string;
  event_type: CalendarEventType;
  related_entity_type: 'ENQUIRY' | 'ACCOUNT' | '';
  related_entity_id: string | null;
  assigned_to: string | null;
}

interface CalendarEventFormProps {
  onSubmit: (data: SubmitData) => void;
  onCancel: () => void;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultEventType?: CalendarEventType;
  defaultAssignedTo?: string | null;
  /** When provided, the entity link is locked (pre-filled context). */
  lockedEntityType?: 'ENQUIRY' | 'ACCOUNT';
  lockedEntityId?: string;
  lockedEntityLabel?: string;
}

export function CalendarEventForm({
  onSubmit, onCancel,
  defaultTitle = '', defaultDescription = '', defaultEventType = CalendarEventType.GENERAL,
  defaultAssignedTo = null,
  lockedEntityType, lockedEntityId, lockedEntityLabel,
}: CalendarEventFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState(defaultDescription);
  const [eventType, setEventType] = useState<CalendarEventType>(defaultEventType);
  const [linkType, setLinkType] = useState<'ENQUIRY' | 'ACCOUNT' | ''>(lockedEntityType ?? '');
  const [linkId, setLinkId] = useState<string | null>(lockedEntityId ?? null);
  const [assignedTo, setAssignedTo] = useState<string | null>(defaultAssignedTo);
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('is_active', true)
      .order('full_name').then(({ data }) => setTeam((data ?? []) as { id: string; full_name: string }[]));
  }, []);

  const handleSubmit = () => {
    if (title && date) {
      onSubmit({
        title, date, time, notes, event_type: eventType,
        related_entity_type: linkType,
        related_entity_id: linkId,
        assigned_to: assignedTo,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Event Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow-up call" />
      </div>
      <div className="space-y-2">
        <Label>Event Type</Label>
        <Select value={eventType} onValueChange={(v) => setEventType(v as CalendarEventType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.values(CalendarEventType).map(t => (
              <SelectItem key={t} value={t}>{eventTypeLabels[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {lockedEntityType ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Linking to <span className="font-medium">{lockedEntityType === 'ENQUIRY' ? 'Enquiry' : 'Account'}</span>
          {lockedEntityLabel ? <>: <span className="font-medium">{lockedEntityLabel}</span></> : null}
        </div>
      ) : (
        <EntityPicker entityType={linkType} entityId={linkId} onChange={(t, id) => { setLinkType(t); setLinkId(id); }} />
      )}
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!title || !date}>Create Event</Button>
      </div>
    </div>
  );
}
