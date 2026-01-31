import { useState } from 'react';
import { Settings, Users, RotateCcw, Scale, User, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mockQueues, mockUsers } from '@/data/mockData';
import { mockRoutingRules } from '@/data/routingData';
import type { AssignmentMethod, RoutingRule } from '@/types/routing';
import { toast } from 'sonner';

interface RoutingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const assignmentMethods: { value: AssignmentMethod; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'round_robin',
    label: 'Round Robin',
    description: 'Assign tickets evenly in rotation',
    icon: <RotateCcw className="h-4 w-4" />,
  },
  {
    value: 'load_balanced',
    label: 'Load Balanced',
    description: 'Assign to user with fewest open tickets',
    icon: <Scale className="h-4 w-4" />,
  },
  {
    value: 'specific_user',
    label: 'Specific User',
    description: 'Always assign to a designated user',
    icon: <User className="h-4 w-4" />,
  },
  {
    value: 'least_recent',
    label: 'Least Recent',
    description: 'Assign to user who received a ticket longest ago',
    icon: <Clock className="h-4 w-4" />,
  },
];

export function RoutingConfigDialog({ open, onOpenChange }: RoutingConfigDialogProps) {
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);
  const [rules, setRules] = useState<RoutingRule[]>(mockRoutingRules);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);

  const selectedRule = rules.find(r => r.queueId === selectedQueueId);

  const handleMethodChange = (queueId: string, method: AssignmentMethod) => {
    setRules(prev =>
      prev.map(rule =>
        rule.queueId === queueId
          ? { ...rule, assignmentMethod: method, updatedAt: new Date() }
          : rule
      )
    );
  };

  const handleToggleRule = (queueId: string) => {
    setRules(prev =>
      prev.map(rule =>
        rule.queueId === queueId
          ? { ...rule, isActive: !rule.isActive, updatedAt: new Date() }
          : rule
      )
    );
  };

  const handleSpecificUserChange = (queueId: string, userId: string) => {
    setRules(prev =>
      prev.map(rule =>
        rule.queueId === queueId
          ? { ...rule, specificUserId: userId, updatedAt: new Date() }
          : rule
      )
    );
  };

  const handleEligibleUserToggle = (queueId: string, userId: string) => {
    setRules(prev =>
      prev.map(rule => {
        if (rule.queueId !== queueId) return rule;
        const isEligible = rule.eligibleUserIds.includes(userId);
        return {
          ...rule,
          eligibleUserIds: isEligible
            ? rule.eligibleUserIds.filter(id => id !== userId)
            : [...rule.eligibleUserIds, userId],
          updatedAt: new Date(),
        };
      })
    );
  };

  const handleSave = () => {
    toast.success('Routing configuration saved', {
      description: `${rules.filter(r => r.isActive).length} active routing rules configured`,
    });
    onOpenChange(false);
  };

  const getMethodIcon = (method: AssignmentMethod) => {
    return assignmentMethods.find(m => m.value === method)?.icon;
  };

  const getMethodLabel = (method: AssignmentMethod) => {
    return assignmentMethods.find(m => m.value === method)?.label || method;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configure Auto-Assignment Routing
          </DialogTitle>
          <DialogDescription>
            Set up automatic ticket assignment rules for each queue. Tickets will be assigned to eligible users based on the selected method.
          </DialogDescription>
        </DialogHeader>

        {/* Global Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Label htmlFor="auto-assign" className="font-medium">Auto-Assignment</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign incoming tickets to available users
              </p>
            </div>
          </div>
          <Switch
            id="auto-assign"
            checked={autoAssignEnabled}
            onCheckedChange={setAutoAssignEnabled}
          />
        </div>

        <Separator />

        {/* Queue Rules */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {rules.map(rule => {
                const queue = mockQueues.find(q => q.id === rule.queueId);
                const isExpanded = selectedQueueId === rule.queueId;

                return (
                  <div
                    key={rule.id}
                    className={`border rounded-lg transition-all ${
                      rule.isActive ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'
                    }`}
                  >
                    {/* Queue Header */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setSelectedQueueId(isExpanded ? null : rule.queueId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => handleToggleRule(rule.queueId)}
                            onClick={e => e.stopPropagation()}
                          />
                          <div>
                            <div className="font-medium">{rule.queueName}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              {getMethodIcon(rule.assignmentMethod)}
                              <span>{getMethodLabel(rule.assignmentMethod)}</span>
                              <span className="text-muted-foreground">•</span>
                              <span>{rule.eligibleUserIds.length} eligible users</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>

                    {/* Expanded Settings */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                        {/* Assignment Method */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Assignment Method
                          </Label>
                          <Select
                            value={rule.assignmentMethod}
                            onValueChange={(v: AssignmentMethod) =>
                              handleMethodChange(rule.queueId, v)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card">
                              {assignmentMethods.map(method => (
                                <SelectItem key={method.value} value={method.value}>
                                  <div className="flex items-center gap-2">
                                    {method.icon}
                                    <div>
                                      <div>{method.label}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {method.description}
                                      </div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Specific User Selection (when method is specific_user) */}
                        {rule.assignmentMethod === 'specific_user' && (
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Assign To
                            </Label>
                            <Select
                              value={rule.specificUserId || ''}
                              onValueChange={(v) =>
                                handleSpecificUserChange(rule.queueId, v)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                              <SelectContent className="bg-card">
                                {mockUsers.map(user => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name} ({user.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Eligible Users (for other methods) */}
                        {rule.assignmentMethod !== 'specific_user' && (
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Eligible Users
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              {mockUsers.map(user => (
                                <div
                                  key={user.id}
                                  className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`${rule.queueId}-${user.id}`}
                                    checked={rule.eligibleUserIds.includes(user.id)}
                                    onCheckedChange={() =>
                                      handleEligibleUserToggle(rule.queueId, user.id)
                                    }
                                  />
                                  <label
                                    htmlFor={`${rule.queueId}-${user.id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    <div>{user.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {user.role} • {user.teams.join(', ')}
                                    </div>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
