import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { listRecords, type MarketingEvent } from '@/lib/marketingApi';
import { AddEventDialog } from './AddEventDialog';
import { EventDetailDrawer } from './EventDetailDrawer';

interface Props { isAdmin: boolean }

const shortPlaceName = (s: string | null) => (s ?? '').split(',')[0].trim();

export function EventsTab({ isAdmin }: Props) {
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingEvent | null>(null);
  const [detail, setDetail] = useState<MarketingEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reload = async () => setEvents(await listRecords<MarketingEvent>('marketing_events'));
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => events.filter(e =>
    !search || [e.event_name, e.location, e.city].some(v => (v ?? '').toLowerCase().includes(search.toLowerCase()))),
  [events, search]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openRow = (e: MarketingEvent) => { setDetail(e); setDrawerOpen(true); };
  const openEdit = (e: MarketingEvent) => { setEditing(e); setDialogOpen(true); setDrawerOpen(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add event</Button>}
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Event</TableHead><TableHead>City</TableHead><TableHead>Location</TableHead>
            <TableHead>Date</TableHead><TableHead className="text-right">Attendees</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openRow(e)}>
                <TableCell className="font-medium">{e.event_name}</TableCell>
                <TableCell>{e.city ?? '—'}</TableCell>
                <TableCell className="max-w-xs truncate" title={e.location ?? ''}>{shortPlaceName(e.location) || '—'}</TableCell>
                <TableCell>{e.event_date ? new Date(e.event_date).toLocaleDateString() : '—'}</TableCell>
                <TableCell className="text-right">{e.attendees.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No events yet.</p>}
      </CardContent></Card>

      <AddEventDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={reload} existing={editing} />
      <EventDetailDrawer
        event={detail} open={drawerOpen} onOpenChange={setDrawerOpen}
        onChanged={reload} onEdit={openEdit} isAdmin={isAdmin}
      />
    </div>
  );
}
