import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { TicketPriority, TicketStatus, TicketType, TicketCategory, EntityType, TimelineEventType, type SupportTicket } from '@/types/core';
import { NotesPanel } from '@/components/shared/NotesPanel';
import { AssignmentSelect } from '@/components/shared/AssignmentSelect';
import { TicketAttachments } from '@/components/shared/TicketAttachments';
import { TicketEvents } from '@/components/shared/TicketEvents';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { VoiceTextarea } from '@/components/shared/VoiceTextarea';
import { format } from 'date-fns';
import {
  Plus, Search, ArrowLeft, ExternalLink, Tag, Clock, User, Building2, Ticket,
  MessageSquare, PanelLeftClose, PanelLeft, Phone, X, Save,
} from 'lucide-react';
import { CreateTicketDialog } from '@/components/shared/CreateTicketDialog';
import { getCityOptions, getTagOptions } from '@/data/lookupData';
import { toast } from 'sonner';
import {
  fetchTicketList, fetchTicketDetail, fetchProfiles, fetchAccountsLite,
  updateTicket, addTicketMessage, subscribeTicketChanges,
  type ProfileRow, type AccountRow,
} from '@/lib/ticketsApi';


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
  const dl = new Date(deadline);
  const diff = dl.getTime() - Date.now();
  const isBreached = diff < 0;
  const isWarning = diff > 0 && diff < 3600000;
  const tone = isBreached
    ? 'text-destructive'
    : isWarning ? 'text-warning' : 'text-muted-foreground';
  const text = isBreached
    ? 'Breached'
    : `${Math.max(1, Math.round(diff / 60000))} min left`;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
      <Clock className="h-3 w-3" />
      {label}: {text}
    </span>
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

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p.full_name])), [profiles]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
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

  // Fetch ticket_code (DB has it; SupportTicket maps queue→ticket_code fallback already, but we want a clear ST- code)
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  useEffect(() => {
    if (!ticketId) { setTicketCode(null); return; }
    // Lazy import to avoid circular: use supabase via ticketsApi already loads it; quick direct fetch:
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('tickets').select('ticket_code').eq('id', ticketId).maybeSingle()
        .then(({ data }) => setTicketCode((data?.ticket_code as string | null) ?? null));
    });
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

  // Warn on browser tab close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasEdits) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasEdits]);

  // Search across subject, ticket code, tags, requester name/email
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tickets.filter(t => {
      const code = (t.queue || '').toString().toLowerCase(); // fallback shows code in queue field
      const matchSearch = !q ||
        t.subject.toLowerCase().includes(q) ||
        code.includes(q) ||
        t.requester_name.toLowerCase().includes(q) ||
        (t.requester_email ?? '').toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  // Notes pulled from timeline (INTERNAL_NOTE only) so they live separately from timeline UI
  const notesFromTimeline = useMemo(() => {
    if (!selected) return [];
    return selected.timeline
      .filter(t => t.type === TimelineEventType.INTERNAL_NOTE)
      .map(t => ({
        note_id: t.id,
        entity_type: EntityType.TICKET,
        entity_id: selected.ticket_id,
        note_text: t.content,
        created_by_user_id: t.user_id ?? '',
        created_at: t.created_at,
      }));
  }, [selected]);

  const notes = notesFromTimeline;
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

  // Centralized "leave with unsaved changes" guard
  const guardLeave = (action: () => void) => {
    if (hasEdits) {
      if (!window.confirm('You have unsaved changes. Discard them and continue?')) return;
    }
    action();
  };

  const selectTicket = (id: string) => guardLeave(() => navigate(`/tickets/${id}`));
  const goBack = () => guardLeave(() => navigate('/tickets'));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
    setTagInput('');
  };

  const linkedAccount = selected?.account_id ? accountMap.get(selected.account_id) : null;
  const phoneNumber = linkedAccount?.owner_phone || '';
  const linkedAccountName = (id: string | null) => id ? (accountMap.get(id)?.account_name ?? '—') : '—';

  // Display code: prefer real DB ticket_code (ST-xxxxxx), fallback to short UUID
  const displayCode = ticketCode ?? (selected ? `#${selected.ticket_id.slice(0, 8)}` : '');

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
            <DialogTitle>Close ticket</DialogTitle>
            <DialogDescription>Add closing comments before closing this ticket.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Closing comments (required)…"
            value={closingComment}
            onChange={e => setClosingComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleCloseTicket}>Close ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── List Panel ── */}
      {!isListCollapsed && (
        <div className={`w-full md:w-96 flex-shrink-0 border-r border-border overflow-auto ${selected ? 'hidden md:block' : ''}`}>
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Support tickets</h2>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setIsListCollapsed(true)} title="Collapse panel">
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => setCreateTicketOpen(true)}><Plus className="h-4 w-4 mr-1" />New</Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, subject, requester, or tag…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {Object.values(TicketStatus).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
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
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted-foreground font-mono">{t.queue || '—'}</div>
                    <div className="font-medium text-sm truncate">{t.subject}</div>
                  </div>
                  <Badge className={`flex-shrink-0 ${priorityColors[t.priority]}`}>{t.priority}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge className={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                  <span className="truncate">{getUserName(t.assigned_to_user_id)}</span>
                  <span className="ml-auto whitespace-nowrap">{format(new Date(t.updated_at), 'dd MMM')}</span>
                </div>
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
          <div className="w-full max-w-6xl mx-auto">
            {/* Sticky compact header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {isListCollapsed && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsListCollapsed(false)} title="Show list">
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goBack} title="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="font-mono text-sm font-medium text-foreground/80">{displayCode}</span>
                <Badge className={`${priorityColors[currentPriority]} text-[10px] px-1.5 py-0`}>{currentPriority}</Badge>
                <Badge className={`${statusColors[currentStatus]} text-[10px] px-1.5 py-0`}>{statusLabels[currentStatus]}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {currentStatus !== TicketStatus.CLOSED && (
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => setCloseDialog(true)}>
                    Close
                  </Button>
                )}
                {hasEdits && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={handleCancel}>
                    Discard
                  </Button>
                )}
                <Button size="sm" className="h-8" onClick={handleUpdate} disabled={!hasEdits}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
              </div>
            </div>

            {/* Two-column body */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 p-4 md:p-6">
              {/* ── MAIN COLUMN ── */}
              <div className="space-y-6 min-w-0">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Title</label>
                  <Input
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    className="text-lg font-semibold border border-border/40 mt-1 h-auto py-2.5 focus-visible:ring-1"
                    placeholder="Ticket subject"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-muted-foreground">{editSubject.length}/2000</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Description</label>
                  <div className="mt-1 rounded-md border border-border/40 bg-card">
                    <VoiceTextarea
                      value={editDescription}
                      onChange={setEditDescription}
                      placeholder="Describe the issue or request…"
                      rows={6}
                    />
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-muted-foreground">{editDescription.length}/20000</span>
                  </div>
                </div>

                <div>
                  <TicketAttachments ticketId={selected.ticket_id} />
                </div>

                <div>
                  <TicketEvents
                    ticketId={selected.ticket_id}
                    ticketSubject={selected.subject}
                    accountId={selected.account_id}
                  />
                </div>

                <div>
                  <NotesPanel notes={notes} onAddNote={handleAddNote} />
                </div>
              </div>

              {/* ── RIGHT RAIL ── */}
              <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
                {/* Account / Requester */}
                <div className="rounded-md border border-border/50 bg-card p-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Account
                    </label>
                    {selected.account_id ? (
                      <Link to={`/accounts/${selected.account_id}`} className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                        {linkedAccountName(selected.account_id)} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                      <User className="h-3 w-3" /> Requester
                    </label>
                    <Input value={editRequesterName} onChange={e => setEditRequesterName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Email</label>
                    <Input value={editRequesterEmail} onChange={e => setEditRequesterEmail(e.target.value)} className="h-8 text-sm" placeholder="email@example.com" />
                  </div>
                  {phoneNumber && (
                    <div className="flex gap-1.5 pt-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" asChild>
                        <a href={`tel:${phoneNumber}`}><Phone className="h-3 w-3 mr-1" /> Call</a>
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs flex-1" asChild>
                        <a href={`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                          <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Assignment & Status */}
                <div className="rounded-md border border-border/50 bg-card p-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Assign to</label>
                    <AssignmentSelect value={currentAssigned} onChange={setAssignedTo} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</label>
                    <Select value={currentStatus} onValueChange={(v) => setTicketStatus(v as TicketStatus)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(TicketStatus).map(s => (
                          <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Priority</label>
                    <Select value={currentPriority} onValueChange={(v) => setTicketPriority(v as TicketPriority)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(TicketPriority).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Type</label>
                    <Select value={editType} onValueChange={v => setEditType(v as TicketType)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(TicketType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Category</label>
                    <Select value={editCategory} onValueChange={v => setEditCategory(v as TicketCategory)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(TicketCategory).map(c => (
                          <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">City</label>
                    <Select value={editCity || '__none__'} onValueChange={v => setEditCity(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent className="max-h-48">
                        <SelectItem value="__none__">None</SelectItem>
                        {getCityOptions().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Queue</label>
                    <Input value={selected.queue} readOnly className="h-8 text-sm bg-muted/30" />
                  </div>
                </div>

                <div className="rounded-md border border-border/50 bg-card p-3 space-y-2">
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {editTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs gap-1">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setEditTags(editTags.filter(x => x !== tag))} />
                      </Badge>
                    ))}
                    <Input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      placeholder="Add tag…"
                      className="h-6 text-xs w-24 border-dashed"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                  </div>
                  {getTagOptions().filter(t => !editTags.includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                      {getTagOptions().filter(t => !editTags.includes(t)).slice(0, 6).map(tag => (
                        <button
                          key={tag}
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
                          onClick={() => setEditTags([...editTags, tag])}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-border/50 bg-card p-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Created {format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Updated {format(new Date(selected.updated_at), 'dd MMM yyyy, HH:mm')}
                  </div>
                  <div className="pt-1.5 border-t border-border/40 space-y-1">
                    <SLATimer deadline={selected.sla_first_response} label="First response" />
                    <div />
                    <SLATimer deadline={selected.sla_resolution} label="Resolution" />
                  </div>
                </div>
              </aside>
            </div>

            <div className="px-4 md:px-6 pb-6">
              <ActivityTimeline
                entityType="TICKET"
                entityId={selected.ticket_id}
                title="Ticket history"
                includeAll
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center space-y-2">
              {isListCollapsed && (
                <Button variant="ghost" size="sm" onClick={() => setIsListCollapsed(false)} className="mb-2">
                  <PanelLeft className="h-4 w-4 mr-1" /> Show list
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
