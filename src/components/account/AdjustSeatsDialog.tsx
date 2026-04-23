import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { fmtINR } from '@/lib/billing';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  currentSeats: number;
  inUseSeats: number;
  onApplied: () => void;
}

type Mode = 'add' | 'remove';
type Timing = 'immediate' | 'renewal';

interface Proration {
  prorated_amount?: number;
  days_remaining?: number;
  cycle_days?: number;
  per_seat_rate?: number;
  delta?: number;
  base?: number;
}

export function AdjustSeatsDialog({ open, onOpenChange, accountId, currentSeats, inUseSeats, onApplied }: Props) {
  const [mode, setMode] = useState<Mode>('add');
  const [timing, setTiming] = useState<Timing>('immediate');
  const [count, setCount] = useState<string>('1');
  const [notes, setNotes] = useState('');
  const [proration, setProration] = useState<Proration | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const n = Math.max(0, parseInt(count, 10) || 0);
  const delta = mode === 'add' ? n : -n;
  const newTotal = currentSeats + delta;
  const decreaseBlocked = mode === 'remove' && timing === 'immediate' && newTotal < inUseSeats;

  useEffect(() => {
    if (!open) {
      setMode('add'); setTiming('immediate'); setCount('1'); setNotes(''); setProration(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || timing !== 'immediate' || n === 0) { setProration(null); return; }
    let cancelled = false;
    setPreviewing(true);
    supabase.rpc('compute_proration', { _account_id: accountId, _delta: delta }).then(({ data, error }) => {
      if (cancelled) return;
      setPreviewing(false);
      if (error) { setProration(null); return; }
      setProration((data as Proration) || null);
    });
    return () => { cancelled = true; };
  }, [open, accountId, delta, n, timing]);

  const submit = async () => {
    if (n === 0) { toast.error('Enter a seat count'); return; }
    if (decreaseBlocked) {
      toast.error('Cannot decrease below seats currently in use');
      return;
    }
    setSubmitting(true);
    if (timing === 'immediate') {
      const reason = mode === 'add' ? 'MANUAL' : 'MANUAL';
      const { error } = await supabase.rpc('apply_seat_delta', {
        _account_id: accountId,
        _delta: delta,
        _reason: reason,
        _notes: notes || null,
      });
      setSubmitting(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`${mode === 'add' ? 'Added' : 'Removed'} ${n} seat${n === 1 ? '' : 's'}`);
    } else {
      // Schedule for renewal — record decision row
      const { data: bs } = await supabase.from('account_billing_settings')
        .select('current_period_end').eq('account_id', accountId).maybeSingle();
      const periodEnd = bs?.current_period_end;
      if (!periodEnd) {
        setSubmitting(false);
        toast.error('Subscription period not set; cannot schedule for renewal');
        return;
      }
      const decision = mode === 'add' ? 'RENEW_INCREASE' : 'RENEW_DECREASE';
      const { error } = await supabase.from('account_renewal_decisions').insert({
        account_id: accountId,
        decision,
        new_seats: newTotal,
        notes: notes || null,
        period_end: periodEnd,
      });
      setSubmitting(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Change scheduled for next renewal');
    }
    onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust seats</DialogTitle>
          <DialogDescription>
            Currently allocated: <strong>{currentSeats}</strong> · In use (CRM): <strong>{inUseSeats}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === 'add' ? 'default' : 'outline'} onClick={() => setMode('add')} type="button">Add seats</Button>
            <Button variant={mode === 'remove' ? 'default' : 'outline'} onClick={() => setMode('remove')} type="button">Remove seats</Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seat-count">{mode === 'add' ? 'Seats to add' : 'Seats to remove'}</Label>
            <Input id="seat-count" type="number" min={1} value={count} onChange={e => setCount(e.target.value)} />
            <p className="text-xs text-muted-foreground">New total: <strong>{Math.max(0, newTotal)}</strong></p>
          </div>

          <div className="space-y-2">
            <Label>When</Label>
            <RadioGroup value={timing} onValueChange={(v) => setTiming(v as Timing)}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="immediate" id="t-now" className="mt-0.5" />
                <Label htmlFor="t-now" className="font-normal cursor-pointer">
                  Effective immediately {mode === 'add' && <span className="text-xs text-muted-foreground">(prorated invoice)</span>}
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="renewal" id="t-renew" className="mt-0.5" />
                <Label htmlFor="t-renew" className="font-normal cursor-pointer">
                  At next renewal <span className="text-xs text-muted-foreground">(no charge now)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {timing === 'immediate' && mode === 'add' && (
            <div className="rounded border bg-muted/40 p-3 text-sm">
              {previewing ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating proration…</div>
              ) : proration ? (
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Per-seat rate</span><span>{fmtINR(proration.per_seat_rate || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days remaining / cycle</span><span>{proration.days_remaining ?? '—'} / {proration.cycle_days ?? '—'}</span></div>
                  <div className="flex justify-between font-medium pt-1 border-t"><span>Prorated charge (excl. GST)</span><span>{fmtINR(proration.prorated_amount || 0)}</span></div>
                  <p className="text-[11px] text-muted-foreground">A DRAFT invoice will be created. Confirm in Billing tab.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Enter a seat count to preview proration.</p>
              )}
            </div>
          )}

          {decreaseBlocked && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                Cannot decrease below {inUseSeats} (currently in use in CRM). Either schedule for next renewal or wait for seats to be released.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="seat-notes">Notes (optional)</Label>
            <Textarea id="seat-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || n === 0 || decreaseBlocked}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {timing === 'immediate' ? 'Apply now' : 'Schedule for renewal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
