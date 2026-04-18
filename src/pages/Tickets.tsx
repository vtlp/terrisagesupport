import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { TicketPriority, TicketStatus, TicketType, TicketCategory, EntityType, CalendarEventStatus, CalendarEventType, TimelineEventType, type SupportTicket } from '@/types/core';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { AttachmentUploader } from '@/components/shared/AttachmentUploader';
import { AssignmentSelect } from '@/components/shared/AssignmentSelect';
import { CalendarEventForm } from '@/components/shared/CalendarEventForm';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, Search, ArrowLeft, ExternalLink, CalendarIcon, Tag,
  Clock, User, Building2, Ticket, MessageSquare,
  ArrowRightLeft, Shield, PanelLeftClose, PanelLeft,
  Phone, X, Save,
} from 'lucide-react';
import { CreateTicketDialog } from '@/components/shared/CreateTicketDialog';
import { getCityOptions, getTagOptions } from '@/data/lookupData';
import { toast } from 'sonner';
import {
  fetchTicketList, fetchTicketDetail, fetchProfiles, fetchAccountsLite,
  updateTicket, addTicketMessage, subscribeTicketChanges,
  type ProfileRow, type AccountRow,
} from '@/lib/ticketsApi';
import { seedNotes } from '@/data/seedData';

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
      <span>{label}: {isBreached ? 'Breached' : `${formatDistanceToNow(dl, { addSuffix: false })} left`}</span>
    </div>
  );
}

export default function Tickets() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const profileMap = new Map(profiles.map(p => [p.id, p.full_name]));
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const getUserName = (id: string | null) => id ? (profileMap.get(id) ?? 'User') : 'Unassigned';

  // Editable state
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [ticketPriority, setTicketPriority] = useState<TicketPriority | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TicketType>(TicketType.INCIDENT);
  const [editCategory, setEditCategory] = useState<TicketCategory>(TicketCategory.OTHER);
  const [editCity, setEditCity] = useState('');
  const [editRequesterName, setEditRequesterName] = useState('');
  const [editRequesterEmail, setEditRequesterEmail] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [hasEdits, setHasEdits] = useState(false);

  const [showEventForm, setShowEventForm] = useState(false);
  const [noteRefresh, setNoteRefresh] = useState(0);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [closingComment, setClosingComment] = useState('');

  // Initial load
  const reloadList = useCallback(async () => {
    try {
      const list = await fetchTicketList();
      setTickets(list);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tickets');
    }
  }, []);

  useEffect(() => {
    reloadList();
    fetchProfiles().then(setProfiles).catch(() => {});
    fetchAccountsLite().then(setAccounts).catch(() => {});
    const unsub = subscribeTicketChanges(() => {
      reloadList();
      if (ticketId) fetchTicketDetail(ticketId).then(t => t && setSelected(t)).catch(() => {});
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load detail when route changes
  useEffect(() => {
    if (!ticketId) { setSelected(null); return; }
    fetchTicketDetail(ticketId).then(t => setSelected(t)).catch(() => setSelected(null));
  }, [ticketId]);

  // Initialize editable fields when ticket changes
  const initEditFields = useCallback((t: SupportTicket | null) => {
    if (!t) return;
    setEditSubject(t.subject);
    setEditDescription(t.description);
    setEditType(t.type);
    setEditCategory(t.category);
    setEditCity(t.market_field);
    setEditRequesterName(t.requester_name);
    setEditRequesterEmail(t.requester_email);
    setEditTags([...t.tags]);
    setTicketStatus(null);
    setTicketPriority(null);
    setAssignedTo(null);
    setHasEdits(false);
  }, []);

  useEffect(() => {
    if (selected) initEditFields(selected);
  }, [selected?.ticket_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStatus = ticketStatus ?? selected?.status ?? TicketStatus.OPEN;
  const currentPriority = ticketPriority ?? selected?.priority ?? TicketPriority.P3;
  const currentAssigned = assignedTo ?? selected?.assigned_to_user_id ?? null;

  // Detect changes
  const detectEdits = () => {
    if (!selected) return false;
    return editSubject !== selected.subject ||
      editDescription !== selected.description ||
      editType !== selected.type ||
      editCategory !== selected.category ||
      editCity !== selected.market_field ||
      editRequesterName !== selected.requester_name ||
      editRequesterEmail !== selected.requester_email ||
      JSON.stringify(editTags) !== JSON.stringify(selected.tags) ||
      (ticketStatus !== null && ticketStatus !== selected.status) ||
      (ticketPriority !== null && ticketPriority !== selected.priority) ||
      (assignedTo !== null && assignedTo !== selected.assigned_to_user_id);
  };

  useEffect(() => {
    setHasEdits(detectEdits());
  }, [editSubject, editDescription, editType, editCategory, editCity, editRequesterName, editRequesterEmail, editTags, ticketStatus, ticketPriority, assignedTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tickets.filter(t => {
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

  const handleAddNote = async (text: string) => {
    if (!selected) return;
    try {
      await addTicketMessage(selected.ticket_id, text, true);
      const fresh = await fetchTicketDetail(selected.ticket_id);
      if (fresh) setSelected(fresh);
      setNoteRefresh(prev => prev + 1);
    } catch (e) {
      console.error(e);
      toast.error('Failed to add note');
    }
  };

  const handleCreateEvent = (_data: { title: string; date: Date; time: string; notes: string; event_type: CalendarEventType }) => {
    void _data; void CalendarEventStatus;
    setShowEventForm(false);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    try {
      await updateTicket(selected.ticket_id, {
        subject: editSubject,
        description: editDescription,
        type: editType,
        category: editCategory,
        market_city: editCity || null,
        requester_name: editRequesterName,
        requester_email: editRequesterEmail || null,
        tags: editTags,
        status: currentStatus,
        priority: currentPriority,
        assigned_to: currentAssigned,
      });
      setHasEdits(false);
      setTicketStatus(null);
      setTicketPriority(null);
      setAssignedTo(null);
      toast.success('Ticket updated');
      const fresh = await fetchTicketDetail(selected.ticket_id);
      if (fresh) setSelected(fresh);
      reloadList();
    } catch (e) {
      console.error(e);
      toast.error('Update failed');
    }
  };

  const handleCancel = () => {
    if (selected) initEditFields(selected);
  };

  const handleCloseTicket = async () => {
    if (!closingComment.trim()) {
      toast.error('Closing comments are required');
      return;
    }
    if (!selected) return;
    try {
      await addTicketMessage(selected.ticket_id, `Ticket closed: ${closingComment.trim()}`, true);
      await updateTicket(selected.ticket_id, { status: TicketStatus.CLOSED, resolution_notes: closingComment.trim() });
      setCloseDialog(false);
      setClosingComment('');
      setTicketStatus(null);
      toast.success('Ticket closed');
      const fresh = await fetchTicketDetail(selected.ticket_id);
      if (fresh) setSelected(fresh);
      reloadList();
    } catch (e) {
      console.error(e);
      toast.error('Failed to close');
    }
  };

  const selectTicket = (id: string) => {
    if (hasEdits) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    setShowEventForm(false);
    navigate(`/tickets/${id}`);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
    setTagInput('');
  };

  // Get linked account for call/whatsapp
  const linkedAccount = selected?.account_id ? accountMap.get(selected.account_id) : null;
  const phoneNumber = linkedAccount?.owner_phone || '';
  const linkedAccountName = (id: string | null) => id ? (accountMap.get(id)?.account_name ?? '—') : '—';

  return (
    <div className="flex h-full">
      <CreateTicketDialog
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        onCreated={(ticket) => {
          reloadList();
          navigate(`/tickets/${ticket.ticket_id}`);
        }}
      />

      {/* Close Ticket Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Close Ticket</DialogTitle>
            <DialogDescription>Add closing comments before closing this ticket.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Closing comments (required)..."
            value={closingComment}
            onChange={e => setClosingComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleCloseTicket}>Close Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── List Panel ── */}
      {!isListCollapsed && (
        <div className={`w-full md:w-96 flex-shrink-0 border-r border-border overflow-auto ${selected ? 'hidden md:block' : ''}`}>
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Support Tickets</h2>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setIsListCollapsed(true)} title="Collapse panel">
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => setCreateTicketOpen(true)}><Plus className="h-4 w-4 mr-1" />New</Button>
              </div>
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
      )}

      {/* ── Detail Panel ── */}
      <div className={`flex-1 min-w-0 overflow-auto ${!selected ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <div className="p-4 md:p-6 w-full space-y-6">
            {/* Top bar: Back + collapse + Update/Cancel/Close */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {isListCollapsed && (
                  <Button variant="ghost" size="sm" onClick={() => setIsListCollapsed(false)} title="Show list">
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasEdits && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleUpdate}>
                      <Save className="h-3 w-3 mr-1" /> Update
                    </Button>
                  </>
                )}
                {currentStatus !== TicketStatus.CLOSED && (
                  <Button variant="destructive" size="sm" onClick={() => setCloseDialog(true)}>
                    Close Ticket
                  </Button>
                )}
              </div>
            </div>

            {/* Header — editable subject + description */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Ticket className="h-3 w-3" />
                <span>{selected.ticket_id}</span>
                <span>•</span>
                <span>Created {format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm')}</span>
              </div>
              <Input
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                className="text-xl font-bold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
              />
              <Textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="text-sm text-muted-foreground border-none p-0 min-h-[40px] focus-visible:ring-0 bg-transparent resize-none"
                rows={2}
              />
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

            {/* Merged "Account Details" card */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Account Details</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Account:</span>
                    {selected.account_id ? (
                      <Link to={`/accounts/${selected.account_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        {linkedAccountName(selected.account_id)} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : <span>—</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Requester:</span>
                    <Input value={editRequesterName} onChange={e => setEditRequesterName(e.target.value)} className="h-7 text-sm border-none p-0 bg-transparent w-auto flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <Input value={editRequesterEmail} onChange={e => setEditRequesterEmail(e.target.value)} className="h-7 text-sm border-none p-0 bg-transparent w-auto flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <Select value={editType} onValueChange={v => setEditType(v as TicketType)}>
                      <SelectTrigger className="h-7 text-xs border-none bg-transparent w-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(TicketType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Category:</span>
                    <Select value={editCategory} onValueChange={v => setEditCategory(v as TicketCategory)}>
                      <SelectTrigger className="h-7 text-xs border-none bg-transparent w-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(TicketCategory).map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">City:</span>
                    <Select value={editCity || '__none__'} onValueChange={v => setEditCity(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="h-7 text-xs border-none bg-transparent w-auto"><SelectValue placeholder="City" /></SelectTrigger>
                      <SelectContent className="max-h-48">
                        <SelectItem value="__none__">None</SelectItem>
                        {getCityOptions().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tags — editable with lookup suggestions */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {editTags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setEditTags(editTags.filter(x => x !== tag))} />
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {getTagOptions().filter(t => !editTags.includes(t)).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] cursor-pointer hover:bg-primary/15" onClick={() => setEditTags([...editTags, tag])}>
                      + {tag}
                    </Badge>
                  ))}
                  <div className="flex gap-1 ml-1">
                    <Input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      placeholder="Custom…"
                      className="h-6 text-xs w-20 border-dashed"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                  </div>
                </div>

                {/* Call / WhatsApp CTAs */}
                {(phoneNumber || editRequesterEmail) && (
                  <div className="flex gap-2 pt-2 border-t border-border/50 mt-2">
                    {phoneNumber && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${phoneNumber}`}><Phone className="h-3 w-3 mr-1" /> Call</a>
                      </Button>
                    )}
                    {phoneNumber && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                          <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

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
                      defaultEventType={CalendarEventType.FOLLOW_UP}
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
              {isListCollapsed && (
                <Button variant="ghost" size="sm" onClick={() => setIsListCollapsed(false)} className="mb-2">
                  <PanelLeft className="h-4 w-4 mr-1" /> Show List
                </Button>
              )}
              <Ticket className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Select a ticket to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
