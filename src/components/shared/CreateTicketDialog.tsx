import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { TicketPriority, TicketStatus, TicketType, TicketCategory, EntityType, TimelineEventType, type SupportTicket } from '@/types/core';
import { seedAccounts } from '@/data/seedData';
import { AssignmentSelect } from '@/components/shared/AssignmentSelect';
import { toast } from 'sonner';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: SupportTicket) => void;
}

export function CreateTicketDialog({ open, onOpenChange, onCreated }: CreateTicketDialogProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.P3);
  const [type, setType] = useState<TicketType>(TicketType.INCIDENT);
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.OTHER);
  const [accountId, setAccountId] = useState<string>('none');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [market, setMarket] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const reset = () => {
    setSubject(''); setDescription(''); setPriority(TicketPriority.P3);
    setType(TicketType.INCIDENT); setCategory(TicketCategory.OTHER);
    setAccountId('none'); setAssignedTo(null);
    setMarket(''); setTagInput(''); setTags([]);
    setRequesterName(''); setRequesterEmail('');
  };

  const handleSubmit = () => {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      ticket_id: `TKT${Date.now()}`,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      status: TicketStatus.OPEN,
      type,
      category,
      account_id: accountId !== 'none' ? accountId : null,
      requester_name: requesterName || 'Unknown',
      requester_email: requesterEmail,
      assigned_to_user_id: assignedTo,
      queue: 'Ticket Routing',
      tags,
      sla_first_response: new Date(Date.now() + (priority === TicketPriority.P1 ? 3600000 : priority === TicketPriority.P2 ? 14400000 : 86400000)).toISOString(),
      sla_resolution: new Date(Date.now() + (priority === TicketPriority.P1 ? 28800000 : priority === TicketPriority.P2 ? 86400000 : 259200000)).toISOString(),
      first_response_at: null,
      resolved_at: null,
      timeline: [{ id: `TL_${Date.now()}`, type: TimelineEventType.SYSTEM, content: `Ticket created: ${subject.trim()}`, user_id: 'U001', created_at: now }],
      attachments: [],
      notes_thread: [],
      linked_entity_type: accountId !== 'none' ? EntityType.ACCOUNT : null,
      linked_entity_id: accountId !== 'none' ? accountId : null,
      market_field: market,
      created_at: now,
      updated_at: now,
    };
    onCreated(ticket);
    toast.success('Ticket created');
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detailed explanation…" rows={3} />
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
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent className="bg-card max-h-48">
                  <SelectItem value="none">None</SelectItem>
                  {seedAccounts.map(a => <SelectItem key={a.account_id} value={a.account_id}>{a.account_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Requester Name</Label>
              <Input value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label>Requester Email</Label>
              <Input value={requesterEmail} onChange={e => setRequesterEmail(e.target.value)} placeholder="Email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <AssignmentSelect value={assignedTo} onChange={setAssignedTo} />
          </div>
          <div className="space-y-1.5">
            <Label>Market</Label>
            <Input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. Mumbai, Delhi" />
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                placeholder="Add tag…"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
