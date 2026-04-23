// Mark a payment as received outside Razorpay (UPI, NEFT, cash, cheque). Writes
// payload.payment with method=OFFLINE so the rest of the flow (onboarding unlock,
// account conversion → invoice) treats it the same as a Razorpay-paid link.
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fmtINR } from '@/lib/billing';

export interface OfflinePaymentResult {
  status: 'PAID';
  method: 'OFFLINE';
  amount: number;
  currency: 'INR';
  reference: string;
  channel: 'UPI' | 'NEFT' | 'CASH' | 'CHEQUE' | 'OTHER';
  paid_at: string;
  notes?: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enquiryId: string;
  defaultAmount: number;
  onSuccess: (result: OfflinePaymentResult) => void;
}

export function PaymentOfflineDialog({ open, onOpenChange, enquiryId, defaultAmount, onSuccess }: Props) {
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [reference, setReference] = useState('');
  const [channel, setChannel] = useState<OfflinePaymentResult['channel']>('UPI');
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setReference('');
      setChannel('UPI');
      setPaidAt(new Date().toISOString().slice(0, 16));
      setNotes('');
    }
  }, [open, defaultAmount]);

  const submit = async () => {
    if (!amount || amount <= 0) { toast.error('Enter a valid amount.'); return; }
    if (!reference.trim()) { toast.error('Reference / transaction id is required.'); return; }
    setBusy(true);
    const result: OfflinePaymentResult = {
      status: 'PAID',
      method: 'OFFLINE',
      amount,
      currency: 'INR',
      reference: reference.trim(),
      channel,
      paid_at: new Date(paidAt).toISOString(),
      notes: notes.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    // Categorised note for the Notes timeline grouping.
    const { error } = await supabase.from('enquiry_notes').insert({
      enquiry_id: enquiryId,
      note_text: `[Payment] Marked PAID offline · ${channel} · ${fmtINR(amount)} · ref ${result.reference}`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Offline payment recorded');
    onSuccess(result);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-4 w-4" /> Mark as paid (offline)
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Amount (₹)</Label>
            <Input className="h-8" type="number" min={1} value={amount}
              onChange={e => setAmount(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={v => setChannel(v as OfflinePaymentResult['channel'])}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="NEFT">NEFT / IMPS</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Reference / transaction id</Label>
            <Input className="h-8" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="UTR, UPI ref, cheque no., etc." />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Paid at</Label>
            <Input className="h-8" type="datetime-local" value={paidAt}
              onChange={e => setPaidAt(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any context for finance" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5 mr-1.5" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
