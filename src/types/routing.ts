export type AssignmentMethod = 'round_robin' | 'load_balanced' | 'specific_user' | 'least_recent';

export interface RoutingRule {
  id: string;
  queueId: string;
  queueName: string;
  assignmentMethod: AssignmentMethod;
  specificUserId?: string;
  eligibleUserIds: string[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingConfig {
  rules: RoutingRule[];
  defaultMethod: AssignmentMethod;
  autoAssignEnabled: boolean;
}
