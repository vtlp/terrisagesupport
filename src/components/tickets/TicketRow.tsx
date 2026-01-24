import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusPill } from './StatusPill';
import { PriorityPill } from './PriorityPill';
import { SLATimer } from './SLATimer';
import { cn } from '@/lib/utils';
import type { Ticket } from '@/types/support';
import { formatDistanceToNow } from 'date-fns';

interface TicketRowProps {
  ticket: Ticket;
  selected?: boolean;
  onClick?: () => void;
}

export function TicketRow({ ticket, selected, onClick }: TicketRowProps) {
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const categoryLabels: Record<string, string> = {
    listings_inventory: 'Listings',
    billing_plan: 'Billing',
    api_integrations: 'API',
    onboarding_migration: 'Onboarding',
    security_access: 'Security',
    compliance_legal: 'Compliance',
    performance_reliability: 'Performance',
    other: 'Other',
  };

  return (
    <div
      className={cn(
        'ticket-row',
        selected && 'ticket-row-selected'
      )}
      onClick={onClick}
    >
      {/* Priority indicator */}
      <div className="w-1 h-10 rounded-full flex-shrink-0" 
        style={{
          backgroundColor: ticket.priority === 'P1' ? 'hsl(var(--destructive))' :
                          ticket.priority === 'P2' ? 'hsl(var(--warning))' :
                          ticket.priority === 'P3' ? 'hsl(var(--primary))' :
                          'hsl(var(--muted-foreground))'
        }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground font-mono">
            {ticket.id}
          </span>
          <PriorityPill priority={ticket.priority} compact />
        </div>
        <h4 className="text-sm font-medium text-foreground truncate mb-1">
          {ticket.subject}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{ticket.account.name}</span>
          <span>·</span>
          <span>{categoryLabels[ticket.category]}</span>
          <span>·</span>
          <span>{formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}</span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <StatusPill status={ticket.status} />
          <SLATimer deadline={ticket.slaResolution} />
        </div>
        {ticket.assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(ticket.assignee.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-xs text-warning">Unassigned</span>
        )}
      </div>
    </div>
  );
}
