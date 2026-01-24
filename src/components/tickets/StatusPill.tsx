import { cn } from '@/lib/utils';
import type { TicketStatus } from '@/types/support';

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'pill-status-open' },
  pending_customer: { label: 'Pending Customer', className: 'pill-status-pending' },
  pending_internal: { label: 'Pending Internal', className: 'pill-status-pending' },
  resolved: { label: 'Resolved', className: 'pill-status-resolved' },
  closed: { label: 'Closed', className: 'pill-status-closed' },
};

interface StatusPillProps {
  status: TicketStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn('pill', config.className, className)}>
      {config.label}
    </span>
  );
}
