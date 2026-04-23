// Defer payment collection: lets staff send the onboarding form now and reconcile
// payment later from the Account Billing tab. Writes payload.payment with status=DEFERRED.
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface DeferredPaymentResult {
  status: 'DEFERRED';
  method: 'DEFER';
  reason: string;
  deferred_at: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enquiryId: string;
  onSuccess: (result: DeferredPaymentResult) => void;
}

export function PaymentDeferDialog({ open, onOpenChange, enquiryId, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setReason(''); }, [open]);

  const submit = async () => {
    if (!reason.trim()) { toast.error('Add a short reason for deferring.'); return; }
    setBusy(true);
    const result: DeferredPaymentResult = {
      status: 'DEFERRED',
      method: 'DEFER',
      reason: reason.trim(),
      deferred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('enquiry_notes').insert({
      enquiry_id: enquiryId,
      note_text: `[Payment] Deferred · ${result.reason}`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment deferred. Onboarding unlocked.');
    onSuccess(result);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Defer · collect payment later
          </DialogTitle>
          <DialogDescription className="text-xs">
            The customer will receive the onboarding form now. Payment will need to be reconciled
            from the Account Billing tab once the account is created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Reason for deferring</Label>
          <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. PO awaited, finance approval pending, paying after onboarding…" />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Clock className="h-3.5 w-3.5 mr-1.5" />}
            Defer & continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
