import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { seedTickets, getUserName, seedNotes, seedCalendarEvents, seedAccounts, seedEnquiries } from '@/data/seedData';
import { TicketPriority, TicketStatus, EntityType, CalendarEventStatus } from '@/types/core';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { AssignmentSelect } from '@/components/shared/AssignmentSelect';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { format } from 'date-fns';
import {
  Plus, Search, ArrowLeft, ExternalLink, CalendarIcon, Tag,
  Clock, AlertTriangle, User, Building2, Ticket,
} from 'lucide-react';

const priorityColors: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'bg-muted text-muted-foreground',
  [TicketPriority.MEDIUM]: 'bg-primary/15 text-primary',
  [TicketPriority.HIGH]: 'bg-warning/15 text-warning',
  [TicketPriority.URGENT]: 'bg-destructive/15 text-destructive',
};

const statusColors: Record<TicketStatus, string> = {
  [TicketStatus.NEW]: 'bg-primary/15 text-primary',
  [TicketStatus.IN_PROGRESS]: 'bg-warning/15 text-warning',
  [TicketStatus.WAITING_ON_CLIENT]: 'bg-muted text-muted-foreground',
  [TicketStatus.RESOLVED]: 'bg-success/15 text-success',
  [TicketStatus.CLOSED]: 'bg-muted text-muted-foreground',
};

function getLinkedEntityName(type: EntityType | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === EntityType.ACCOUNT) {
    return seedAccounts.find(a => a.account_id === id)?.account_name ?? id;
  }
  if (type === EntityType.ENQUIRY) {
    return seedEnquiries.find(e => e.enquiry_id === id)?.company_name ?? id;
  }
  return id;
}

function getLinkedEntityPath(type: EntityType | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === EntityType.ACCOUNT) return `/accounts/${id}`;
  if (type === EntityType.ENQUIRY) return `/enquiries/${id}`;
  return null;
}

export default function Tickets() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const selected = ticketId ? seedTickets.find(t => t.ticket_id === ticketId) ?? null : null;

  // Detail state (only when selected)
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [ticketPriority, setTicketPriority] = useState<TicketPriority | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  // Sync detail state when selection changes
  const currentStatus = ticketStatus ?? selected?.status ?? TicketStatus.NEW;
  const currentPriority = ticketPriority ?? selected?.priority ?? TicketPriority.MEDIUM;
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
      {/* ── List Panel ── */}
      <div className={`w-full md:w-96 flex-shrink-0 border-r border-border overflow-auto ${selected ? 'hidden md:block' : ''}`}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Support Tickets</h2>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Ticket</Button>
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
                {Object.values(TicketStatus).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
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
                <Badge className={statusColors[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
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
            {/* Mobile back button */}
            <div className="md:hidden">
              <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
              </Button>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Ticket className="h-3 w-3" />
                <span>{selected.ticket_id}</span>
                <span>•</span>
                <span>Created {format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm')}</span>
              </div>
              <h1 className="text-xl font-bold text-foreground">{selected.subject}</h1>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            </div>

            {/* Controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Status</label>
                <Select value={currentStatus} onValueChange={(v) => setTicketStatus(v as TicketStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketStatus).map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
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
                <label className="text-xs text-muted-foreground font-medium">Assigned To</label>
                <AssignmentSelect
                  value={currentAssigned}
                  onChange={setAssignedTo}
                />
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Linked Entity */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Linked Entity</CardTitle></CardHeader>
                <CardContent>
                  {selected.linked_entity_type && selected.linked_entity_id ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Badge variant="outline" className="mr-2">{selected.linked_entity_type}</Badge>
                        {(() => {
                          const path = getLinkedEntityPath(selected.linked_entity_type, selected.linked_entity_id);
                          const name = getLinkedEntityName(selected.linked_entity_type, selected.linked_entity_id);
                          return path ? (
                            <Link to={path} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                              {name} <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : <span className="text-sm">{name}</span>;
                        })()}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No linked entity</p>
                  )}
                </CardContent>
              </Card>

              {/* Meta info */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Updated:</span>
                    <span>{format(new Date(selected.updated_at), 'dd MMM yyyy, HH:mm')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Market:</span>
                    <span>{selected.market_field}</span>
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

            {/* Notes */}
            <NotesPanel notes={notes} onAddNote={handleAddNote} />

            {/* Attachments */}
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
