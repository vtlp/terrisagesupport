export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'open' | 'pending_customer' | 'pending_internal' | 'resolved' | 'closed';
export type TicketType = 'incident' | 'question' | 'task' | 'feedback';

export type Category = 
  | 'listings_inventory'
  | 'billing_plan'
  | 'api_integrations'
  | 'onboarding_migration'
  | 'security_access'
  | 'compliance_legal'
  | 'performance_reliability'
  | 'other';

export type Product = 'crm' | 'customer_app';
export type MarketType = 'sales' | 'lettings' | 'commercial' | 'new_homes';

export interface Account {
  id: string;
  name: string;
  email: string;
  company?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'agent';
  teams: string[];
}

export interface Queue {
  id: string;
  name: string;
  description?: string;
  categories: Category[];
  products?: Product[];
}

export interface SLAPolicy {
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  type: TicketType;
  category: Category;
  product: Product;
  market: MarketType;
  
  accountId: string;
  account: Account;
  
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  
  assigneeId?: string;
  assignee?: User;
  
  queueId: string;
  queue: Queue;
  
  tags: string[];
  
  slaFirstResponse: Date;
  slaResolution: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  relatedEntities?: {
    projectId?: string;
    propertyId?: string;
    listingId?: string;
    leadId?: string;
  };
}

export interface TimelineEvent {
  id: string;
  ticketId: string;
  type: 'customer_message' | 'agent_reply' | 'internal_note' | 'status_change' | 'assignment' | 'priority_change' | 'system';
  content: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
  createdAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface KBArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: Category;
  tags: string[];
  usedCount: number;
  helpfulRating?: number;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Macro {
  id: string;
  name: string;
  category: string;
  description: string;
  replyTemplate: string;
  internalNoteTemplate?: string;
  statusTransition?: TicketStatus;
  tags?: string[];
}

export interface DashboardMetrics {
  enquiriesToday: number;
  solvedToday: number;
  openNow: number;
  unassigned: number;
  breachingSoon: number;
  breachedToday: number;
  avgFirstResponseMinutes: number;
  avgResolveMinutes: number;
}

export interface QueueStats {
  queueId: string;
  queueName: string;
  openCount: number;
  unassignedCount: number;
  breachingSoon: number;
  oldestAge: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: 'ticket' | 'user' | 'queue' | 'sla' | 'routing';
  entityId: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  userId: string;
  userName: string;
  createdAt: Date;
}
