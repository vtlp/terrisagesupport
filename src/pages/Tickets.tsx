import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { mockTickets } from '@/data/mockData';
import type { Ticket } from '@/types/support';

export default function Tickets() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(
    ticketId ? mockTickets.find((t) => t.id === ticketId) || null : null
  );

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    navigate(`/tickets/${ticket.id}`);
  };

  return (
    <div className="flex h-full">
      {/* List Panel */}
      <div className="w-96 flex-shrink-0 border-r border-border">
        <TicketList
          tickets={mockTickets}
          selectedTicketId={selectedTicket?.id}
          onSelectTicket={handleSelectTicket}
        />
      </div>

      {/* Detail Panel */}
      <div className="flex-1 min-w-0">
        {selectedTicket ? (
          <TicketDetail ticket={selectedTicket} />
        ) : (
          <div className="h-full flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">
                Select a ticket to view details
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose from the list on the left
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
