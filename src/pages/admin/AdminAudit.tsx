import { Search, Filter, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { mockAuditLog } from '@/data/mockData';
import { format } from 'date-fns';

export default function AdminAudit() {
  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'resolved':
        return 'bg-success/20 text-success border-success/30';
      case 'priority_changed':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'assigned':
        return 'bg-info/20 text-info border-info/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatAction = (action: string) =>
    action.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Audit Log</h1>
          <p className="text-muted-foreground">
            Complete history of all system changes
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search audit log..." className="pl-9" />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAuditLog.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {format(entry.createdAt, 'dd MMM yyyy, HH:mm')}
                </TableCell>
                <TableCell className="font-medium">{entry.userName}</TableCell>
                <TableCell>
                  <Badge className={getActionBadgeStyle(entry.action)}>
                    {formatAction(entry.action)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{entry.entityId}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {Object.entries(entry.changes)
                    .map(([key, val]) => `${key}: ${val.from} → ${val.to}`)
                    .join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
