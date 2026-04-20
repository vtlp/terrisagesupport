import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRecord, updateRecord, type CostItemType, type MarketingCostItem } from '@/lib/marketingApi';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  existing?: MarketingCostItem | null;
}

export function AddSpendDialog({ open, onOpenChange, onSaved, existing }: Props) {
  const { toast } = useToast();
  const isEdit = !!existing;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [costType, setCostType] = useState<CostItemType>('ONLINE');
  const [spendDate, setSpendDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? '');
      setAmount(String(existing.amount ?? ''));
      setCostType(existing.cost_type);
      setSpendDate(existing.spend_date ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setTitle(''); setDescription(''); setAmount(''); setSpendDate('');
      setCostType('ONLINE'); setNotes('');
    }
  }, [open, existing]);

  const submit = async () => {
    if (!title.trim() || !amount) {
      toast({ title: 'Title and amount are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        cost_type: costType,
        spend_date: spendDate || null,
        notes: notes.trim() || null,
      };
      if (isEdit && existing) {
        await updateRecord('marketing_cost_items', existing.id, payload);
        toast({ title: 'Spend updated' });
      } else {
        await createRecord('marketing_cost_items', payload);
        toast({ title: 'Spend added' });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? 'Edit spend' : 'Add spend'}</DialogTitle></DialogHeader>
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
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add spend')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
