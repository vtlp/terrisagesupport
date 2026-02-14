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
import { TicketPriority, TicketStatus, EntityType, type SupportTicket } from '@/types/core';
import { seedAccounts, seedEnquiries } from '@/data/seedData';
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
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [linkedType, setLinkedType] = useState<string>('none');
  const [linkedId, setLinkedId] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [market, setMarket] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const linkedEntities = linkedType === EntityType.ACCOUNT
    ? seedAccounts.map(a => ({ id: a.account_id, name: a.account_name }))
    : linkedType === EntityType.ENQUIRY
    ? seedEnquiries.map(e => ({ id: e.enquiry_id, name: e.company_name }))
    : [];

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const reset = () => {
    setSubject(''); setDescription(''); setPriority(TicketPriority.MEDIUM);
    setLinkedType('none'); setLinkedId(''); setAssignedTo(null);
    setMarket(''); setTagInput(''); setTags([]);
  };

  const handleSubmit = () => {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    const ticket: SupportTicket = {
      ticket_id: `TKT${Date.now()}`,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      status: TicketStatus.NEW,
      linked_entity_type: linkedType !== 'none' ? (linkedType as EntityType) : null,
      linked_entity_id: linkedId || null,
      assigned_to_user_id: assignedTo,
      market_field: market,
      tags,
      attachments: [],
      notes_thread: [],
      due_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
        <div className="space-y-4 py-2">
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
                  {Object.values(TicketPriority).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <AssignmentSelect value={assignedTo} onChange={setAssignedTo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Link To</Label>
              <Select value={linkedType} onValueChange={v => { setLinkedType(v); setLinkedId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value={EntityType.ACCOUNT}>Account</SelectItem>
                  <SelectItem value={EntityType.ENQUIRY}>Enquiry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {linkedType !== 'none' && (
              <div className="space-y-1.5">
                <Label>{linkedType === EntityType.ACCOUNT ? 'Account' : 'Enquiry'}</Label>
                <Select value={linkedId} onValueChange={setLinkedId}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent className="bg-card max-h-48">
                    {linkedEntities.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
