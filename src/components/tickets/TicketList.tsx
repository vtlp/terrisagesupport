import { useState } from 'react';
import { Filter, SortAsc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TicketRow } from './TicketRow';
import type { Ticket } from '@/types/support';

type TabValue = 'my-queue' | 'unassigned' | 'breaching' | 'breached' | 'all';

interface TicketListProps {
  tickets: Ticket[];
  selectedTicketId?: string;
  onSelectTicket: (ticket: Ticket) => void;
  defaultTab?: TabValue;
}

export function TicketList({
  tickets,
  selectedTicketId,
  onSelectTicket,
  defaultTab = 'all',
}: TicketListProps) {
  const [activeTab, setActiveTab] = useState<TabValue>(defaultTab);
  const [sortBy, setSortBy] = useState<'sla' | 'newest' | 'priority' | 'updated'>(
    'sla'
  );

  const now = new Date();

  const filterTickets = (tab: TabValue) => {
    let filtered = tickets;

    switch (tab) {
      case 'my-queue':
        filtered = tickets.filter((t) => t.assigneeId === 'u1'); // Current user
        break;
      case 'unassigned':
        filtered = tickets.filter((t) => !t.assigneeId);
        break;
      case 'breaching':
        filtered = tickets.filter((t) => {
          const timeToSLA = t.slaResolution.getTime() - now.getTime();
          return timeToSLA > 0 && timeToSLA < 60 * 60 * 1000; // Within 1 hour
        });
        break;
      case 'breached':
        filtered = tickets.filter((t) => t.slaResolution.getTime() < now.getTime());
        break;
      default:
        filtered = tickets.filter(
          (t) => t.status !== 'resolved' && t.status !== 'closed'
        );
    }

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'sla':
          return a.slaResolution.getTime() - b.slaResolution.getTime();
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'priority':
          const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'updated':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        default:
          return 0;
      }
    });
  };

  const filteredTickets = filterTickets(activeTab);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Tabs */}
      <div className="p-3 border-b border-border">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
        >
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="my-queue" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              My Queue
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Unassigned
            </TabsTrigger>
            <TabsTrigger value="breaching" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Breaching
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filter Bar */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs">
          <Filter className="h-3 w-3 mr-1" />
          Filters
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <SortAsc className="h-3 w-3 mr-1" />
              Sort: {sortBy === 'sla' ? 'SLA' : sortBy}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-card">
            <DropdownMenuItem onClick={() => setSortBy('sla')}>
              SLA soonest
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('newest')}>
              Newest
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('priority')}>
              Priority
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('updated')}>
              Last updated
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredTickets.length} tickets
        </span>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No tickets in this view</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              selected={ticket.id === selectedTicketId}
              onClick={() => onSelectTicket(ticket)}
            />
          ))
        )}
      </div>
    </div>
  );
}
