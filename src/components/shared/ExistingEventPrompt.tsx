import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';

export interface ExistingEventOption {
  id: string;
  title: string;
  scheduled_at: string;
  event_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: ExistingEventOption[];
  eventTypeLabel: string;
  onUseExisting: (ev: ExistingEventOption) => void;
  onCreateNew: () => void;
}

export function ExistingEventPrompt({ open, onOpenChange, events, eventTypeLabel, onUseExisting, onCreateNew }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>An upcoming {eventTypeLabel.toLowerCase()} already exists</DialogTitle>
          <DialogDescription>
            Use the existing event or create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={() => onUseExisting(ev)}
              className="w-full text-left rounded-md border px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{ev.title}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(ev.scheduled_at), 'EEE dd MMM, HH:mm')}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCreateNew}>Create new event</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
