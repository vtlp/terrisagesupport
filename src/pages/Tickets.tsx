import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { seedTickets, getUserName, seedNotes, seedCalendarEvents, seedAccounts, seedEnquiries, getAccountName } from '@/data/seedData';
import { TicketPriority, TicketStatus, EntityType, CalendarEventStatus, TimelineEventType } from '@/types/core';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { AssignmentSelect } from '@/components/shared/AssignmentSelect';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, Search, ArrowLeft, ExternalLink, CalendarIcon, Tag,
  Clock, User, Building2, Ticket, AlertTriangle, MessageSquare,
  ArrowRightLeft, Shield,
} from 'lucide-react';
import { CreateTicketDialog } from '@/components/shared/CreateTicketDialog';

const priorityColors: Record<TicketPriority, string> = {
  [TicketPriority.P1]: 'bg-destructive/15 text-destructive font-semibold',
  [TicketPriority.P2]: 'bg-warning/15 text-warning',
  [TicketPriority.P3]: 'bg-primary/15 text-primary',
  [TicketPriority.P4]: 'bg-muted text-muted-foreground',
};

const statusColors: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-primary/15 text-primary',
  [TicketStatus.PENDING_CUSTOMER]: 'bg-warning/15 text-warning',
  [TicketStatus.PENDING_INTERNAL]: 'bg-info/15 text-info',
  [TicketStatus.RESOLVED]: 'bg-success/15 text-success',
  [TicketStatus.CLOSED]: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.PENDING_CUSTOMER]: 'Pending Customer',
  [TicketStatus.PENDING_INTERNAL]: 'Pending Internal',
  [TicketStatus.RESOLVED]: 'Resolved',
  [TicketStatus.CLOSED]: 'Closed',
};

function SLATimer({ deadline, label }: { deadline: string | null; label: string }) {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  const isBreached = diff < 0;
  const isWarning = diff > 0 && diff < 3600000;
  return (
    <div className={`sla-timer ${isBreached ? 'sla-timer-breach' : isWarning ? 'sla-timer-warning' : 'sla-timer-ok'}`}>
      <Clock className="h-3 w-3" />
      <span>{label}: {isBreached ? 'Breached' : formatDistanceToNow(dl, { addSuffix: false })} left</span>
    </div>
  );
}

export default function Tickets() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const selected = ticketId ? seedTickets.find(t => t.ticket_id === ticketId) ?? null : null;

  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [ticketPriority, setTicketPriority] = useState<TicketPriority | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [noteRefresh, setNoteRefresh] = useState(0);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  const currentStatus = ticketStatus ?? selected?.status ?? TicketStatus.OPEN;
  const currentPriority = ticketPriority ?? selected?.priority ?? TicketPriority.P3;
  const currentAssigned = assignedTo ?? selected?.assigned_to_user_id ?? null;

  const filtered = seedTickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const notes = selected
    ? seedNotes.filter(n => n.entity_type === EntityType.TICKET && n.entity_id === selected.ticket_id)
    : [];
  void noteRefresh;

  const handleAddNote = (text: string) => {
    if (!selected) return;
    seedNotes.push({
      note_id: `N${Date.now()}`,
      entity_type: EntityType.TICKET,
      entity_id: selected.ticket_id,
      note_text: text,
      created_by_user_id: 'U001',
      created_at: new Date().toISOString(),
    });
    setNoteRefresh(prev => prev + 1);
  };

  const handleCreateEvent = (data: { title: string; date: Date; time: string; notes: string }) => {
    if (!selected) return;
    const scheduled = new Date(data.date);
    const [h, m] = data.time.split(':');
    scheduled.setHours(parseInt(h), parseInt(m));
    seedCalendarEvents.push({
      event_id: `CE${Date.now()}`,
      entity_type: EntityType.TICKET,
      entity_id: selected.ticket_id,
      title: data.title,
      scheduled_at: scheduled.toISOString(),
      created_by_user_id: 'U001',
      notes: data.notes || undefined,
      status: CalendarEventStatus.UPCOMING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setShowEventForm(false);
  };

  const selectTicket = (id: string) => {
    setTicketStatus(null);
    setTicketPriority(null);
    setAssignedTo(null);
    setShowEventForm(false);
    navigate(`/tickets/${id}`);
  };

  return (
    <div className="flex h-full">
      <CreateTicketDialog
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        onCreated={(ticket) => {
          seedTickets.unshift(ticket);
          navigate(`/tickets/${ticket.ticket_id}`);
        }}
      />
      {/* ── List Panel ── */}
      <div className={`w-full md:w-96 flex-shrink-0 border-r border-border overflow-auto ${selected ? 'hidden md:block' : ''}`}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Support Tickets</h2>
            <Button size="sm" onClick={() => setCreateTicketOpen(true)}><Plus className="h-4 w-4 mr-1" />New</Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search subject or tags..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.values(TicketStatus).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {Object.values(TicketPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map(t => (
            <div
              key={t.ticket_id}
              className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selected?.ticket_id === t.ticket_id ? 'bg-accent/10 border-l-2 border-l-primary' : ''}`}
              onClick={() => selectTicket(t.ticket_id)}
            >
              <div className="flex items-start justify-between mb-1 gap-2">
                <span className="font-medium text-sm truncate">{t.subject}</span>
                <Badge className={`flex-shrink-0 ${priorityColors[t.priority]}`}>{t.priority}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge className={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                <span>{getUserName(t.assigned_to_user_id)}</span>
                <span className="ml-auto">{format(new Date(t.updated_at), 'dd MMM')}</span>
              </div>
              {t.tags.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {t.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">No tickets match filters.</p>
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      <div className={`flex-1 min-w-0 overflow-auto ${!selected ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <div className="p-4 md:p-6 w-full space-y-6">
            <div className="md:hidden">
              <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
              </Button>
            </div>

            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Ticket className="h-3 w-3" />
                <span>{selected.ticket_id}</span>
                <span>•</span>
                <span>Created {format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm')}</span>
              </div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{selected.subject}</h1>
                <div className="flex gap-2">
                  <Badge className={priorityColors[selected.priority]}>{selected.priority}</Badge>
                  <Badge className={statusColors[selected.status]}>{statusLabels[selected.status]}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              {/* SLA Timers */}
              <div className="flex gap-4 flex-wrap">
                <SLATimer deadline={selected.sla_first_response} label="First Response" />
                <SLATimer deadline={selected.sla_resolution} label="Resolution" />
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Status</label>
                <Select value={currentStatus} onValueChange={(v) => setTicketStatus(v as TicketStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketStatus).map(s => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Priority</label>
                <Select value={currentPriority} onValueChange={(v) => setTicketPriority(v as TicketPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketPriority).map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Queue</label>
                <Input value={selected.queue} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Assigned To</label>
                <AssignmentSelect value={currentAssigned} onChange={setAssignedTo} />
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Account & Requester</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Account:</span>
                    {selected.account_id ? (
                      <Link to={`/accounts/${selected.account_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        {getAccountName(selected.account_id)} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : <span>—</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Requester:</span>
                    <span>{selected.requester_name}</span>
                  </div>
                  {selected.requester_email && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground ml-5">Email:</span>
                      <span>{selected.requester_email}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline" className="text-xs">{selected.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Category:</span>
                    <span className="text-xs">{selected.category.replace(/_/g, ' ')}</span>
                  </div>
                  {selected.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {selected.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {selected.timeline.map(entry => (
                    <div key={entry.id} className="timeline-item">
                      <div className={`timeline-dot ${
                        entry.type === TimelineEventType.CUSTOMER_MESSAGE ? 'timeline-customer' :
                        entry.type === TimelineEventType.AGENT_REPLY ? 'timeline-agent' :
                        entry.type === TimelineEventType.INTERNAL_NOTE ? 'timeline-internal' :
                        'timeline-system'
                      }`} />
                      <div className="text-sm">{entry.content}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.user_id ? getUserName(entry.user_id) : 'System'} • {format(new Date(entry.created_at), 'dd MMM, HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Schedule follow-up */}
            <div>
              {!showEventForm ? (
                <Button variant="outline" size="sm" onClick={() => setShowEventForm(true)}>
                  <CalendarIcon className="h-4 w-4 mr-1" /> Schedule Follow-up
                </Button>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <CalendarEventForm
                      onSubmit={handleCreateEvent}
                      onCancel={() => setShowEventForm(false)}
                      defaultTitle={`Follow-up — ${selected.subject.slice(0, 40)}`}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            <NotesPanel notes={notes} onAddNote={handleAddNote} />
            <AttachmentUploader
              attachments={selected.attachments.map(id => ({ file_name: id, file_url: '#' }))}
              onUpload={() => {}}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center space-y-2">
              <Ticket className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Select a ticket to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
