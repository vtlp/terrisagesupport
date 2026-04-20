import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2 } from 'lucide-react';
import { listRecords, deleteRecord, type MarketingEvent } from '@/lib/marketingApi';
import { AddRecordDialog, type FieldDef } from './AddRecordDialog';
import { useToast } from '@/hooks/use-toast';

interface Props { isAdmin: boolean }

const eventFields: FieldDef[] = [
  { key: 'event_name', label: 'Event name', required: true },
  { key: 'location', label: 'Location' },
  { key: 'city', label: 'City', type: 'city' },
  { key: 'event_date', label: 'Event date', type: 'date' },
  { key: 'attendees', label: 'Attendees', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export function EventsTab({ isAdmin }: Props) {
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const reload = async () => setEvents(await listRecords<MarketingEvent>('marketing_events'));
  useEffect(() => { reload(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try { await deleteRecord('marketing_events', id); toast({ title: 'Deleted' }); reload(); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  const filtered = useMemo(() => events.filter(e =>
    !search || [e.event_name, e.location, e.city].some(v => (v ?? '').toLowerCase().includes(search.toLowerCase()))),
  [events, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add event</Button>}
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Event</TableHead><TableHead>Location</TableHead><TableHead>City</TableHead>
            <TableHead>Date</TableHead><TableHead>Attendees</TableHead><TableHead className="w-12" />
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.event_name}</TableCell>
                <TableCell>{e.location ?? '—'}</TableCell>
                <TableCell>{e.city ?? '—'}</TableCell>
                <TableCell>{e.event_date ? new Date(e.event_date).toLocaleDateString() : '—'}</TableCell>
                <TableCell>{e.attendees.toLocaleString()}</TableCell>
                <TableCell>{isAdmin && <button onClick={() => remove(e.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No events yet.</p>}
      </CardContent></Card>

      <AddRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add event"
        table="marketing_events"
        fields={eventFields}
        onCreated={reload}
      />
    </div>
  );
}
