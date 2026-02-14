import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GitBranch, Users, RotateCcw, Scale, UserCheck, Clock } from 'lucide-react';
import { seedUsers } from '@/data/seedData';
import { toast } from 'sonner';

type AssignmentMethod = 'round_robin' | 'load_balanced' | 'specific_user' | 'least_recent';

interface QueueConfig {
  id: string;
  name: string;
  description: string;
  method: AssignmentMethod;
  eligibleUserIds: string[];
  specificUserId?: string;
}

const methodLabels: Record<AssignmentMethod, { label: string; icon: React.ElementType }> = {
  round_robin: { label: 'Round Robin', icon: RotateCcw },
  load_balanced: { label: 'Load Balanced', icon: Scale },
  specific_user: { label: 'Specific User', icon: UserCheck },
  least_recent: { label: 'Least Recent', icon: Clock },
};

export default function AdminQueues() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [queues, setQueues] = useState<QueueConfig[]>([
    { id: 'Q1', name: 'Enquiry Routing', description: 'Assigns new enquiries to agents', method: 'round_robin', eligibleUserIds: ['U001', 'U002', 'U003', 'U004'] },
    { id: 'Q2', name: 'Ticket Routing', description: 'Assigns new support tickets to agents', method: 'load_balanced', eligibleUserIds: ['U002', 'U003', 'U004'] },
    { id: 'Q3', name: 'Urgent Escalation', description: 'Routes P1/P2 tickets to senior agents', method: 'specific_user', eligibleUserIds: ['U001', 'U005'], specificUserId: 'U001' },
  ]);

  const updateQueue = (id: string, updates: Partial<QueueConfig>) => {
    setQueues(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    toast.success('Queue updated');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assignment Rules</h1>
          <p className="text-muted-foreground">Configure ticket and enquiry assignment routing</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2">
          <Label htmlFor="auto-assign" className="text-sm">Auto-Assignment</Label>
          <Switch id="auto-assign" checked={autoAssign} onCheckedChange={setAutoAssign} />
          <Badge className={autoAssign ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
            {autoAssign ? 'ON' : 'OFF'}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {queues.map(queue => {
          const MethodIcon = methodLabels[queue.method].icon;
          return (
            <Card key={queue.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  {queue.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{queue.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Assignment Method</Label>
                    <Select value={queue.method} onValueChange={v => updateQueue(queue.id, { method: v as AssignmentMethod })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card">
                        {Object.entries(methodLabels).map(([key, { label, icon: MIcon }]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <MIcon className="h-3.5 w-3.5" />{label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {queue.method === 'specific_user' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Assigned User</Label>
                      <Select value={queue.specificUserId ?? ''} onValueChange={v => updateQueue(queue.id, { specificUserId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                        <SelectContent className="bg-card">
                          {seedUsers.filter(u => u.is_active).map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Eligible Agents</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {seedUsers.filter(u => u.is_active).map(u => {
                      const isEligible = queue.eligibleUserIds.includes(u.user_id);
                      return (
                        <Badge
                          key={u.user_id}
                          variant={isEligible ? 'default' : 'outline'}
                          className={`cursor-pointer transition-colors ${isEligible ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                          onClick={() => {
                            const ids = isEligible
                              ? queue.eligibleUserIds.filter(id => id !== u.user_id)
                              : [...queue.eligibleUserIds, u.user_id];
                            updateQueue(queue.id, { eligibleUserIds: ids });
                          }}
                        >
                          <Users className="h-3 w-3 mr-1" />{u.full_name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
