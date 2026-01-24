import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Send,
  MessageSquare,
  Clock,
  User,
  Building,
  Tag,
  ChevronDown,
  Paperclip,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusPill } from './StatusPill';
import { PriorityPill } from './PriorityPill';
import { SLATimer } from './SLATimer';
import { cn } from '@/lib/utils';
import type { Ticket, TimelineEvent } from '@/types/support';
import { mockTimelineEvents, mockUsers, mockQueues } from '@/data/mockData';

interface TicketDetailProps {
  ticket: Ticket;
}

export function TicketDetail({ ticket }: TicketDetailProps) {
  const [replyMode, setReplyMode] = useState<'reply' | 'note'>('reply');
  const [replyText, setReplyText] = useState('');

  const timeline = mockTimelineEvents[ticket.id] || [];

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const categoryLabels: Record<string, string> = {
    listings_inventory: 'Listings & Inventory',
    billing_plan: 'Billing & Plan',
    api_integrations: 'API & Integrations',
    onboarding_migration: 'Onboarding & Migration',
    security_access: 'Security & Access',
    compliance_legal: 'Compliance & Legal',
    performance_reliability: 'Performance & Reliability',
    other: 'Other',
  };

  const renderTimelineItem = (event: TimelineEvent) => {
    const isCustomer = event.type === 'customer_message';
    const isAgent = event.type === 'agent_reply';
    const isInternal = event.type === 'internal_note';
    const isSystem = event.type === 'status_change' || event.type === 'assignment' || event.type === 'system';

    return (
      <div key={event.id} className="timeline-item">
        <div
          className={cn(
            'timeline-dot',
            isCustomer && 'timeline-customer',
            isAgent && 'timeline-agent',
            isInternal && 'timeline-internal',
            isSystem && 'timeline-system'
          )}
        />
        <div
          className={cn(
            'rounded-lg p-3',
            isCustomer && 'bg-info/5 border border-info/20',
            isAgent && 'bg-primary/5 border border-primary/20',
            isInternal && 'bg-warning/5 border border-warning/20',
            isSystem && 'bg-muted'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {!isSystem && (
                <Avatar className="h-6 w-6">
                  <AvatarFallback
                    className={cn(
                      'text-xs',
                      isCustomer && 'bg-info/20 text-info',
                      isAgent && 'bg-primary/20 text-primary',
                      isInternal && 'bg-warning/20 text-warning'
                    )}
                  >
                    {getInitials(event.authorName || 'System')}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-sm font-medium">
                {event.authorName || 'System'}
              </span>
              {isInternal && (
                <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                  Internal
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {format(event.createdAt, 'dd MMM, HH:mm')}
            </span>
          </div>
          <p className="text-sm text-foreground">{event.content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">
                {ticket.id}
              </span>
              <StatusPill status={ticket.status} />
              <PriorityPill priority={ticket.priority} compact />
            </div>
            <h2 className="text-lg font-semibold text-secondary truncate">
              {ticket.subject}
            </h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card">
              <DropdownMenuItem>Merge ticket</DropdownMenuItem>
              <DropdownMenuItem>Print</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* SLA & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SLATimer deadline={ticket.slaFirstResponse} label="1st resp" />
            <SLATimer deadline={ticket.slaResolution} label="Resolve" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Pending Customer
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Resolve
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4 scrollbar-thin">
            {timeline.map(renderTimelineItem)}
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-border bg-card">
            <Tabs
              value={replyMode}
              onValueChange={(v) => setReplyMode(v as 'reply' | 'note')}
              className="mb-3"
            >
              <TabsList className="bg-muted/50">
                <TabsTrigger
                  value="reply"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Reply
                </TabsTrigger>
                <TabsTrigger
                  value="note"
                  className="data-[state=active]:bg-warning data-[state=active]:text-warning-foreground"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  Internal Note
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Textarea
              placeholder={
                replyMode === 'reply'
                  ? 'Write your reply to the customer...'
                  : 'Add an internal note for your team...'
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-24 mb-3 resize-none"
            />
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm">
                <Paperclip className="h-4 w-4 mr-1" />
                Attach
              </Button>
              <Button
                className={cn(
                  replyMode === 'reply'
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-warning hover:bg-warning/90 text-warning-foreground'
                )}
              >
                <Send className="h-4 w-4 mr-1" />
                {replyMode === 'reply' ? 'Send Reply' : 'Add Note'}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-border bg-card overflow-auto p-4 space-y-6 hidden xl:block">
          {/* Assignment */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Assignment
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Queue</label>
                <Select defaultValue={ticket.queueId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {mockQueues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Assignee</label>
                <Select defaultValue={ticket.assigneeId || 'unassigned'}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {mockUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Classification
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <span>{categoryLabels[ticket.category]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{ticket.type}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="uppercase">{ticket.product}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Market</span>
                <span className="capitalize">{ticket.market.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Account
            </h4>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{ticket.account.name}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{ticket.account.company}</p>
                <p>{ticket.account.email}</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {ticket.account.plan}
                </Badge>
              </div>
            </div>
          </div>

          {/* Requester */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Requester
            </h4>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-info/10 text-info">
                  {getInitials(ticket.requesterName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{ticket.requesterName}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.requesterEmail}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Tags
            </h4>
            <div className="flex flex-wrap gap-1">
              {ticket.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-accent/20 text-accent-foreground"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Timeline
            </h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{format(ticket.createdAt, 'dd MMM yyyy, HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}</span>
              </div>
              {ticket.firstResponseAt && (
                <div className="flex justify-between">
                  <span>First response</span>
                  <span>{format(ticket.firstResponseAt, 'dd MMM, HH:mm')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
