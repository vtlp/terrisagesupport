import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { calcBilling, fmtINR } from '@/lib/billing';

type Cycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface PaymentLinkResult {
  link_id: string;
  short_url: string;
  amount: number;
  currency: 'INR';
  status: 'CREATED' | 'PAID' | 'CANCELLED';
  breakdown: {
    plan_name: string;
    billing_cycle: Cycle;
    base_fee: number;
    per_seat_rate: number;
    seats: number;
    gst_pct: number;
    subtotal: number;
    gst_amount: number;
    total: number;
  };
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enquiryId: string;
  defaults: {
    seats?: number | null;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
  };
  onSuccess: (result: PaymentLinkResult) => void;
}

export function PaymentLinkDialog({ open, onOpenChange, enquiryId, defaults, onSuccess }: Props) {
  const [planName, setPlanName] = useState('Standard');
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [seats, setSeats] = useState<number>(defaults.seats ?? 1);
  const [baseFee, setBaseFee] = useState<number>(0);
  const [seatRate, setSeatRate] = useState<number>(0);
  const [gstPct, setGstPct] = useState<number>(18);
  const [name, setName] = useState(defaults.customerName);
  const [email, setEmail] = useState(defaults.customerEmail ?? '');
  const [phone, setPhone] = useState(defaults.customerPhone ?? '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSeats(defaults.seats && defaults.seats > 0 ? defaults.seats : 1);
      setName(defaults.customerName);
      setEmail(defaults.customerEmail ?? '');
      setPhone(defaults.customerPhone ?? '');
    }
  }, [open, defaults.seats, defaults.customerName, defaults.customerEmail, defaults.customerPhone]);

  const breakdown = useMemo(
    () => calcBilling(baseFee, seatRate, seats, gstPct),
    [baseFee, seatRate, seats, gstPct],
  );

  const submit = async () => {
    if (breakdown.total <= 0) {
      toast.error('Total must be greater than zero.');
      return;
    }
    if (!name.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('razorpay-create-payment-link', {
      body: {
        enquiry_id: enquiryId,
        plan_name: planName,
        billing_cycle: cycle,
        seats: breakdown.seats,
        base_fee: breakdown.baseFee,
        per_seat_rate: breakdown.perSeatRate,
        gst_pct: breakdown.gstPct,
        subtotal: breakdown.subtotal,
        gst_amount: breakdown.gstAmount,
        total: breakdown.total,
        customer: { name, email: email || undefined, phone: phone || undefined },
        notes: notes || undefined,
      },
    });
    setBusy(false);
    if (error || !data?.success) {
      const msg = data?.error || error?.message || 'Failed to generate payment link';
      toast.error(msg);
      return;
    }
    toast.success('Payment link created');
    onSuccess(data.payment as PaymentLinkResult);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> Generate payment link
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Plan name</Label>
            <Input value={planName} onChange={e => setPlanName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Billing cycle</Label>
            <Select value={cycle} onValueChange={v => setCycle(v as Cycle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="ANNUAL">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Team size (seats)</Label>
            <Input type="number" min={1} value={seats}
              onChange={e => setSeats(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="space-y-1.5">
            <Label>Base fee (₹)</Label>
            <Input type="number" min={0} value={baseFee}
              onChange={e => setBaseFee(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Per-seat rate (₹)</Label>
            <Input type="number" min={0} value={seatRate}
              onChange={e => setSeatRate(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>GST %</Label>
            <Input type="number" min={0} value={gstPct}
              onChange={e => setGstPct(Number(e.target.value) || 0)} />
          </div>

          <div className="space-y-1.5 md:col-span-2 pt-2 border-t">
            <Label className="text-xs uppercase text-muted-foreground tracking-wide">Customer</Label>
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Internal note shown on the payment link." />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground">Subtotal</div>
            <div className="text-base font-semibold">{fmtINR(breakdown.subtotal)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground">GST ({breakdown.gstPct}%)</div>
            <div className="text-base font-semibold">{fmtINR(breakdown.gstAmount)}</div>
          </div>
          <div className="border rounded p-3 bg-primary/5">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-base font-semibold text-primary">{fmtINR(breakdown.total)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
            Generate link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
