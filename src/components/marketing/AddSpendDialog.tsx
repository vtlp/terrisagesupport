import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRecord, type CostItemType } from '@/lib/marketingApi';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function AddSpendDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [costType, setCostType] = useState<CostItemType>('ONLINE');
  const [spendDate, setSpendDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(''); setDescription(''); setAmount(''); setSpendDate('');
    setCostType('ONLINE'); setNotes('');
  };

  const submit = async () => {
    if (!title.trim() || !amount) {
      toast({ title: 'Title and amount are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createRecord('marketing_cost_items', {
        title: title.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        cost_type: costType,
        spend_date: spendDate || null,
        notes: notes.trim() || null,
      });
      toast({ title: 'Spend added' });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({ title: 'Failed to add spend', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add spend</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Google Ads — Mumbai campaign" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={costType} onValueChange={(v) => setCostType(v as CostItemType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="ONLINE">Online</SelectItem>
                  <SelectItem value="OFFLINE">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Spend date</Label>
            <Input type="date" value={spendDate} onChange={e => setSpendDate(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional context, vendor, campaign reference…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add spend'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
