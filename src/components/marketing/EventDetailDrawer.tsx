import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteRecord, type MarketingEvent } from '@/lib/marketingApi';
import { DetailDrawer } from './DetailDrawer';

interface Props {
  event: MarketingEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
  onEdit: (e: MarketingEvent) => void;
  isAdmin: boolean;
}

const shortPlaceName = (s: string | null) => (s ?? '').split(',')[0].trim();

export function EventDetailDrawer({ event, open, onOpenChange, onChanged, onEdit, isAdmin }: Props) {
  const { toast } = useToast();
  if (!event) return null;

  const remove = async () => {
    if (!confirm('Delete this event?')) return;
    try { await deleteRecord('marketing_events', event.id); toast({ title: 'Deleted' }); onChanged(); onOpenChange(false); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <DetailDrawer
      open={open} onOpenChange={onOpenChange}
      title={event.event_name}
      subtitle={event.event_date ? new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'No date set'}
      badge={{ label: `${event.attendees} attendees`, variant: 'outline' }}
      sections={[
        {
          title: 'Event details',
          rows: [
            { label: 'City', value: event.city },
            { label: 'Location', value: event.location ? <span title={event.location}>{shortPlaceName(event.location)}</span> : null },
            { label: 'Full address', value: event.location ? <span className="text-xs text-muted-foreground">{event.location}</span> : null },
            { label: 'Date', value: event.event_date ? new Date(event.event_date).toLocaleDateString() : null },
            { label: 'Attendees', value: event.attendees.toLocaleString() },
            { label: 'Created', value: new Date(event.created_at).toLocaleDateString() },
          ],
        },
      ]}
      notes={event.notes}
      footer={isAdmin && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
          </Button>
        </div>
      )}
    />
  );
}
