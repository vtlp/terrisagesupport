import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { seedTickets, getUserName, seedNotes } from '@/data/seedData';
import { TicketPriority, TicketStatus } from '@/types/core';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

const priorityColors: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'bg-muted text-muted-foreground',
  [TicketPriority.MEDIUM]: 'bg-primary/15 text-primary',
  [TicketPriority.HIGH]: 'bg-warning/15 text-warning',
  [TicketPriority.URGENT]: 'bg-destructive/15 text-destructive',
};

const statusColors: Record<TicketStatus, string> = {
  [TicketStatus.NEW]: 'bg-info/15 text-info',
  [TicketStatus.IN_PROGRESS]: 'bg-primary/15 text-primary',
  [TicketStatus.WAITING_ON_CLIENT]: 'bg-warning/15 text-warning',
  [TicketStatus.RESOLVED]: 'bg-success/15 text-success',
  [TicketStatus.CLOSED]: 'bg-muted text-muted-foreground',
};

export default function Tickets() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(
    ticketId ? seedTickets.find(t => t.ticket_id === ticketId) || null : null
  );

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-full md:w-96 flex-shrink-0 border-r border-border overflow-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Support Tickets</h2>
          <Button size="sm" className="bg-primary"><Plus className="h-4 w-4 mr-1" />New Ticket</Button>
        </div>
        <div className="divide-y divide-border">
          {seedTickets.map(t => (
            <div
              key={t.ticket_id}
              className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selected?.ticket_id === t.ticket_id ? 'bg-accent/10 border-l-2 border-l-primary' : ''}`}
              onClick={() => { setSelected(t); navigate(`/tickets/${t.ticket_id}`); }}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium text-sm">{t.subject}</span>
                <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge className={statusColors[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
                <span>{getUserName(t.assigned_to_user_id)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="hidden md:flex flex-1 min-w-0">
        {selected ? (
          <div className="p-6 w-full overflow-auto space-y-4">
            <h2 className="text-xl font-bold">{selected.subject}</h2>
            <div className="flex gap-2">
              <Badge className={priorityColors[selected.priority]}>{selected.priority}</Badge>
              <Badge className={statusColors[selected.status]}>{selected.status.replace(/_/g, ' ')}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selected.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Assigned: </span>{getUserName(selected.assigned_to_user_id)}</div>
              <div><span className="text-muted-foreground">Market: </span>{selected.market_field}</div>
              <div><span className="text-muted-foreground">Created: </span>{format(new Date(selected.created_at), 'dd MMM yyyy')}</div>
              <div><span className="text-muted-foreground">Tags: </span>{selected.tags.join(', ') || '—'}</div>
            </div>
            {selected.notes_thread.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Notes</h3>
                {seedNotes.filter(n => selected.notes_thread.includes(n.note_id)).map(n => (
                  <Card key={n.note_id} className="mb-2">
                    <CardContent className="p-3">
                      <p className="text-sm">{n.note_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{getUserName(n.created_by_user_id)} • {format(new Date(n.created_at), 'dd MMM HH:mm')}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <p className="text-muted-foreground">Select a ticket to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
