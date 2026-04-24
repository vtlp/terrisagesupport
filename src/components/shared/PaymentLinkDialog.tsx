import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { calcBilling, fmtINR } from '@/lib/billing';

type Cycle = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

const DEFAULT_BASE_FEE = 33000;
const DEFAULT_SEAT_RATE = 7000;
const DEFAULT_INCLUDED_SEATS = 3;
const DEFAULT_GST_PCT = 18;

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
  expires_at?: string;
  outdated?: boolean;
  mode?: 'PAY_BEFORE_ACCOUNT' | 'TRIAL_FIRST';
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 'INITIAL' uses enquiry_id; 'RENEWAL' / 'TRIAL_CONVERSION' use account_id. */
  purpose?: 'INITIAL' | 'RENEWAL' | 'TRIAL_CONVERSION';
  enquiryId?: string;
  accountId?: string;
  defaults: {
    seats?: number | null;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    planName?: string;
    cycle?: Cycle;
    baseFee?: number;
    seatRate?: number;
    gstPct?: number;
  };
  onSuccess: (result: PaymentLinkResult) => void;
}

export function PaymentLinkDialog({
  open, onOpenChange, purpose = 'INITIAL', enquiryId, accountId, defaults, onSuccess,
}: Props) {
  const [planName, setPlanName] = useState(defaults.planName ?? 'Standard');
  const [cycle, setCycle] = useState<Cycle>(defaults.cycle ?? 'ANNUAL');
  const [seats, setSeats] = useState<number>(defaults.seats ?? 0);
  const [baseFee, setBaseFee] = useState<number>(defaults.baseFee ?? DEFAULT_BASE_FEE);
  const [seatRate, setSeatRate] = useState<number>(defaults.seatRate ?? DEFAULT_SEAT_RATE);
  const [gstPct, setGstPct] = useState<number>(defaults.gstPct ?? DEFAULT_GST_PCT);
  const [name, setName] = useState(defaults.customerName);
  const [email, setEmail] = useState(defaults.customerEmail ?? '');
  const [phone, setPhone] = useState(defaults.customerPhone ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPlanName(defaults.planName ?? 'Standard');
      setCycle(defaults.cycle ?? 'ANNUAL');
      setSeats(defaults.seats && defaults.seats > 0 ? defaults.seats : 0);
      setBaseFee(defaults.baseFee ?? DEFAULT_BASE_FEE);
      setSeatRate(defaults.seatRate ?? DEFAULT_SEAT_RATE);
      setGstPct(defaults.gstPct ?? DEFAULT_GST_PCT);
      setName(defaults.customerName);
      setEmail(defaults.customerEmail ?? '');
      setPhone(defaults.customerPhone ?? '');
    }
  }, [open, defaults.seats, defaults.customerName, defaults.customerEmail, defaults.customerPhone, defaults.planName, defaults.cycle, defaults.baseFee, defaults.seatRate, defaults.gstPct]);

  const breakdown = useMemo(
    () => calcBilling(baseFee, seatRate, seats, gstPct, DEFAULT_INCLUDED_SEATS),
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
    if (purpose === 'INITIAL' && !enquiryId) {
      toast.error('Missing enquiry reference.');
      return;
    }
    if ((purpose === 'RENEWAL' || purpose === 'TRIAL_CONVERSION') && !accountId) {
      toast.error('Missing account reference.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('razorpay-create-payment-link', {
      body: {
        purpose,
        enquiry_id: enquiryId,
        account_id: accountId,
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
      },
    });
    setBusy(false);
    if (error || !data?.success) {
      const msg = data?.error || error?.message || 'Failed to generate payment link';
      toast.error(msg);
      return;
    }
    toast.success(purpose === 'RENEWAL' ? 'Renewal link created' : purpose === 'TRIAL_CONVERSION' ? 'Trial conversion link created' : 'Payment link created');
    onSuccess(data.payment as PaymentLinkResult);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 gap-3">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-4 w-4" />
            {purpose === 'RENEWAL' ? 'Generate renewal link' : purpose === 'TRIAL_CONVERSION' ? 'Generate trial conversion link' : 'Generate payment link'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Plan</Label>
            <Input className="h-8" value={planName} onChange={e => setPlanName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cycle</Label>
            <Select value={cycle} onValueChange={v => setCycle(v as Cycle)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                <SelectItem value="ANNUAL">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Team size</Label>
            <Input className="h-8" type="number" min={1} value={seats}
              onChange={e => setSeats(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">GST %</Label>
            <Input className="h-8" type="number" min={0} value={gstPct}
              onChange={e => setGstPct(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Base fee (₹)</Label>
            <Input className="h-8" type="number" min={0} value={baseFee}
              onChange={e => setBaseFee(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Per-seat rate (₹)</Label>
            <Input className="h-8" type="number" min={0} value={seatRate}
              onChange={e => setSeatRate(Number(e.target.value) || 0)} />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-1">
          Base covers first {DEFAULT_INCLUDED_SEATS} seats. Extra seats charged at per-seat rate.
        </p>

        <div className="space-y-2 pt-2 border-t">
          <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">Customer</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input className="h-8" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <Input className="h-8" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <Input className="h-8" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        <div className="rounded border p-2 text-sm space-y-0.5 bg-muted/30">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Base ({DEFAULT_INCLUDED_SEATS} seats incl.)</span>
            <span>{fmtINR(breakdown.baseFee)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Extra seats ({breakdown.chargeableSeats} × {fmtINR(breakdown.perSeatRate)})</span>
            <span>{fmtINR(breakdown.chargeableSeats * breakdown.perSeatRate)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>GST ({breakdown.gstPct}%)</span>
            <span>{fmtINR(breakdown.gstAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold text-primary pt-1 border-t mt-1">
            <span>Total</span>
            <span>{fmtINR(breakdown.total)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5 mr-1.5" />}
            Generate link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
