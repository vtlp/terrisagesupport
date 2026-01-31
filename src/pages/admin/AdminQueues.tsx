import { useState } from 'react';
import { Plus, GitBranch, Edit, MoreHorizontal } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { mockQueues as initialQueues } from '@/data/mockData';
import { RoutingConfigDialog } from '@/components/admin/RoutingConfigDialog';
import { QueueFormDialog } from '@/components/admin/QueueFormDialog';
import type { Queue } from '@/types/support';

export default function AdminQueues() {
  const [routingDialogOpen, setRoutingDialogOpen] = useState(false);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [queues, setQueues] = useState<Queue[]>(initialQueues);

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

  const handleNewQueue = () => {
    setEditingQueue(null);
    setQueueDialogOpen(true);
  };

  const handleEditQueue = (queue: Queue) => {
    setEditingQueue(queue);
    setQueueDialogOpen(true);
  };

  const handleSaveQueue = (queueData: Partial<Queue>) => {
    if (editingQueue) {
      // Update existing queue
      setQueues(prev =>
        prev.map(q =>
          q.id === editingQueue.id ? { ...q, ...queueData } as Queue : q
        )
      );
    } else {
      // Add new queue
      setQueues(prev => [...prev, queueData as Queue]);
    }
  };

  const handleDeleteQueue = (queueId: string) => {
    setQueues(prev => prev.filter(q => q.id !== queueId));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Queues & Routing</h1>
          <p className="text-muted-foreground">
            Configure ticket queues and automatic routing rules
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={handleNewQueue}>
          <Plus className="h-4 w-4 mr-2" />
          New Queue
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Active Queues</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue Name</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((queue) => (
                <TableRow key={queue.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{queue.name}</span>
                        {queue.description && (
                          <p className="text-xs text-muted-foreground">{queue.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {queue.categories.map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {categoryLabels[cat] || cat}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {queue.products?.map((p) => (
                        <Badge
                          key={p}
                          variant="secondary"
                          className="uppercase text-xs bg-accent/20 text-accent-foreground"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card">
                        <DropdownMenuItem onClick={() => handleEditQueue(queue)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRoutingDialogOpen(true)}>
                          View routing rules
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteQueue(queue.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">Routing Rules</h3>
          <p className="text-sm text-muted-foreground">
            Tickets are automatically routed to queues based on category and product.
            Priority escalation rules can be configured per queue.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setRoutingDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Configure Routing
          </Button>
        </div>
      </div>

      <RoutingConfigDialog
        open={routingDialogOpen}
        onOpenChange={setRoutingDialogOpen}
      />

      <QueueFormDialog
        open={queueDialogOpen}
        onOpenChange={setQueueDialogOpen}
        queue={editingQueue}
        onSave={handleSaveQueue}
      />
    </div>
  );
}
