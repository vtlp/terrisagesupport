import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, User, Flag, GitBranch, CheckCircle } from 'lucide-react';
import type { AuditLogEntry } from '@/types/support';
import { cn } from '@/lib/utils';

interface RecentActivityProps {
  entries: AuditLogEntry[];
  onEntryClick?: (entry: AuditLogEntry) => void;
}

const actionIcons: Record<string, React.ElementType> = {
  assigned: User,
  priority_changed: Flag,
  queue_changed: GitBranch,
  resolved: CheckCircle,
};

export function RecentActivity({ entries, onEntryClick }: RecentActivityProps) {
  const getActionDescription = (entry: AuditLogEntry) => {
    switch (entry.action) {
      case 'assigned':
        return 'assigned ticket';
      case 'priority_changed':
        return `changed priority from ${entry.changes.priority?.from} to ${entry.changes.priority?.to}`;
      case 'resolved':
        return 'resolved ticket';
      case 'queue_changed':
        return 'moved ticket to queue';
      default:
        return entry.action.replace('_', ' ');
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-secondary">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border">
        {entries.map((entry) => {
          const Icon = actionIcons[entry.action] || ArrowRight;
          return (
            <div
              key={entry.id}
              className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onEntryClick?.(entry)}
            >
              <div
                className={cn(
                  'p-2 rounded-full',
                  entry.action === 'resolved'
                    ? 'bg-success/10'
                    : entry.action === 'priority_changed'
                    ? 'bg-warning/10'
                    : 'bg-muted'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    entry.action === 'resolved'
                      ? 'text-success'
                      : entry.action === 'priority_changed'
                      ? 'text-warning'
                      : 'text-muted-foreground'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{entry.userName}</span>{' '}
                  <span className="text-muted-foreground">
                    {getActionDescription(entry)}
                  </span>{' '}
                  <span className="font-mono text-xs text-primary">
                    {entry.entityId}
                  </span>
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
