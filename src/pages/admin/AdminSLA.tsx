import { Clock, Edit } from 'lucide-react';
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

const slaPolicies = [
  {
    priority: 'P1',
    label: 'Critical',
    firstResponse: 30,
    resolution: 120,
  },
  {
    priority: 'P2',
    label: 'High',
    firstResponse: 60,
    resolution: 480,
  },
  {
    priority: 'P3',
    label: 'Medium',
    firstResponse: 240,
    resolution: 1440,
  },
  {
    priority: 'P4',
    label: 'Low',
    firstResponse: 480,
    resolution: 2880,
  },
];

export default function AdminSLA() {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">SLA Policies</h1>
          <p className="text-muted-foreground">
            Define response and resolution targets by priority level
          </p>
        </div>
        <Button variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          Edit Policies
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>First Response Target</TableHead>
              <TableHead>Resolution Target</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slaPolicies.map((policy) => (
              <TableRow key={policy.priority}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        policy.priority === 'P1'
                          ? 'bg-destructive/20 text-destructive border-destructive/30'
                          : policy.priority === 'P2'
                          ? 'bg-warning/20 text-warning border-warning/30'
                          : policy.priority === 'P3'
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {policy.priority}
                    </Badge>
                    <span className="font-medium">{policy.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDuration(policy.firstResponse)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDuration(policy.resolution)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Active
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 bg-muted/30 rounded-lg border border-border p-4">
        <h4 className="font-medium mb-2">SLA Breach Handling</h4>
        <p className="text-sm text-muted-foreground">
          Tickets approaching SLA breach appear in the "Breaching Soon" queue 30
          minutes before the target. Breached tickets are highlighted in red and
          automatically escalated to team leads.
        </p>
      </div>
    </div>
  );
}
