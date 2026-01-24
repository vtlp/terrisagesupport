import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { QueueStats } from '@/types/support';

interface QueueStatsTableProps {
  stats: QueueStats[];
  onQueueClick?: (queueId: string) => void;
}

export function QueueStatsTable({ stats, onQueueClick }: QueueStatsTableProps) {
  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-secondary">Workload by Queue</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Queue</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">Unassigned</TableHead>
            <TableHead className="text-right">Breaching</TableHead>
            <TableHead className="text-right">Oldest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((queue) => (
            <TableRow
              key={queue.queueId}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onQueueClick?.(queue.queueId)}
            >
              <TableCell className="font-medium">{queue.queueName}</TableCell>
              <TableCell className="text-right">{queue.openCount}</TableCell>
              <TableCell
                className={cn(
                  'text-right',
                  queue.unassignedCount > 0 && 'text-warning font-medium'
                )}
              >
                {queue.unassignedCount}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right',
                  queue.breachingSoon > 0 && 'text-destructive font-medium'
                )}
              >
                {queue.breachingSoon}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {queue.oldestAge}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
