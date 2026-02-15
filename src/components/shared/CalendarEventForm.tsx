import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CalendarEventFormProps {
  onSubmit: (data: { title: string; date: Date; time: string; notes: string }) => void;
  onCancel: () => void;
  defaultTitle?: string;
  defaultDescription?: string;
}

export function CalendarEventForm({ onSubmit, onCancel, defaultTitle = '', defaultDescription = '' }: CalendarEventFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState(defaultDescription);

  const handleSubmit = () => {
    if (title && date) {
      onSubmit({ title, date, time, notes });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Event Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow-up call" />
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
