import { cn } from '@/lib/utils';
import type { Priority } from '@/types/support';

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  P1: { label: 'P1 – Critical', className: 'pill-priority-p1' },
  P2: { label: 'P2 – High', className: 'pill-priority-p2' },
  P3: { label: 'P3 – Medium', className: 'pill-priority-p3' },
  P4: { label: 'P4 – Low', className: 'pill-priority-p4' },
};

interface PriorityPillProps {
  priority: Priority;
  compact?: boolean;
  className?: string;
}

export function PriorityPill({ priority, compact, className }: PriorityPillProps) {
  const config = priorityConfig[priority];
  
  return (
    <span className={cn('pill', config.className, className)}>
      {compact ? priority : config.label}
    </span>
  );
}
