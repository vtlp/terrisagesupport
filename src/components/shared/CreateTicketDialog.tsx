import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { TicketPriority, TicketStatus, TicketType, TicketCategory, type SupportTicket } from '@/types/core';
import { getCityOptions, getTagOptions } from '@/data/lookupData';
import { VoiceTextarea } from '@/components/shared/VoiceTextarea';
import { toast } from 'sonner';
import { createTicket, fetchAccountsLite, fetchProfiles, fetchQueues, type AccountRow, type ProfileRow, type QueueRow } from '@/lib/ticketsApi';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: SupportTicket) => void;
}

interface QueueMemberRow { id: string; queue_id: string; user_id: string; is_active: boolean; sort_order: number }

export function CreateTicketDialog({ open, onOpenChange, onCreated }: CreateTicketDialogProps) {
  const { currentUser } = useUser();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.P3);
  const [type, setType] = useState<TicketType>(TicketType.INCIDENT);
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.OTHER);
  const [accountId, setAccountId] = useState<string>('none');
  const [queueId, setQueueId] = useState<string>('none');
  const [assignedTo, setAssignedTo] = useState<string | null>(currentUser.user_id || null);
  const [market, setMarket] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterTouched, setRequesterTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [queueMembers, setQueueMembers] = useState<QueueMemberRow[]>([]);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState<boolean>(true);

  const cities = getCityOptions();
  const availableTags = getTagOptions();

  useEffect(() => {
    if (!open) return;
    setAutoAssignEnabled(window.localStorage.getItem('ticket_auto_assign') !== 'false');
    fetchAccountsLite().then(setAccounts).catch(() => {});
    fetchQueues().then(setQueues).catch(() => {});
    fetchProfiles().then(setProfiles).catch(() => {});
    supabase.from('ticket_queue_members').select('*')
      .then(({ data }) => setQueueMembers((data ?? []) as QueueMemberRow[]));
  }, [open]);

  // Auto-populate requester from selected account (unless user manually edited)
  useEffect(() => {
    if (accountId === 'none' || requesterTouched) return;
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setRequesterName(prev => prev || (acc as AccountRow & { owner_name?: string }).account_name || '');
    setRequesterEmail(prev => prev || acc.owner_email || '');
  }, [accountId, accounts, requesterTouched]);

  // Assignable users: filtered by queue members when auto-assign on + queue selected
  const assignableUsers = useMemo(() => {
    if (autoAssignEnabled && queueId !== 'none') {
      const memberIds = new Set(
        queueMembers.filter(m => m.queue_id === queueId && m.is_active).map(m => m.user_id),
      );
      return profiles.filter(p => memberIds.has(p.id));
    }
    return profiles;
  }, [autoAssignEnabled, queueId, queueMembers, profiles]);

  // Reset assignee if no longer valid for the new queue
  useEffect(() => {
    if (assignedTo && !assignableUsers.some(u => u.id === assignedTo)) {
      setAssignedTo(null);
    }
  }, [assignableUsers, assignedTo]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const reset = () => {
    setSubject(''); setDescription(''); setPriority(TicketPriority.P3);
    setType(TicketType.INCIDENT); setCategory(TicketCategory.OTHER);
    setAccountId('none'); setQueueId('none');
    setAssignedTo(currentUser.user_id || null);
    setMarket(''); setTags([]); setTagInput('');
    setRequesterName(''); setRequesterEmail(''); setRequesterTouched(false);
  };

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        status: TicketStatus.OPEN,
        type,
        category,
        account_id: accountId !== 'none' ? accountId : null,
        requester_name: requesterName || 'Unknown',
        requester_email: requesterEmail || null,
        assigned_to: assignedTo,
        queue_id: autoAssignEnabled && queueId !== 'none' ? queueId : null,
        tags,
        market_city: market || null,
      });
      onCreated(ticket);
      toast.success('Ticket created');
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 px-1 -mx-1 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <VoiceTextarea value={description} onChange={setDescription} placeholder="Detailed explanation…" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  {Object.values(TicketPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as TicketType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  {Object.values(TicketType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={v => setCategory(v as TicketCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  {Object.values(TicketCategory).map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={(v) => { setAccountId(v); setRequesterTouched(false); }}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent className="bg-card max-h-48">
                  <SelectItem value="none">None</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Requester Name</Label>
              <Input
                value={requesterName}
                onChange={e => { setRequesterName(e.target.value); setRequesterTouched(true); }}
                placeholder="Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Requester Email</Label>
              <Input
                value={requesterEmail}
                onChange={e => { setRequesterEmail(e.target.value); setRequesterTouched(true); }}
                placeholder="Email"
              />
            </div>
          </div>
          <div className={autoAssignEnabled ? 'grid grid-cols-2 gap-3' : ''}>
            {autoAssignEnabled && (
              <div className="space-y-1.5">
                <Label>Queue</Label>
                <Select value={queueId} onValueChange={setQueueId}>
                  <SelectTrigger><SelectValue placeholder="Select queue…" /></SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="none">No queue</SelectItem>
                    {queues.filter(q => q.is_active).map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select
                value={assignedTo ?? 'unassigned'}
                onValueChange={(v) => setAssignedTo(v === 'unassigned' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={autoAssignEnabled && queueId !== 'none' ? 'Auto (round-robin)' : 'Assign to…'} />
                </SelectTrigger>
                <SelectContent className="bg-card max-h-48">
                  <SelectItem value="unassigned">
                    {autoAssignEnabled && queueId !== 'none' ? 'Auto (round-robin)' : 'Unassigned'}
                  </SelectItem>
                  {assignableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || 'Unnamed'}</SelectItem>
                  ))}
                  {autoAssignEnabled && queueId !== 'none' && assignableUsers.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2">No active members in this queue</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Select value={market || '__none__'} onValueChange={(v) => setMarket(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select city…" /></SelectTrigger>
              <SelectContent className="bg-card max-h-48">
                <SelectItem value="__none__">None</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {availableTags.map(tag => (
                <Badge
                  key={tag}
                  variant={tags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                placeholder="Add custom tag…"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tags.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1">
                    {t}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter(x => x !== t))} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Creating…' : 'Create Ticket'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
