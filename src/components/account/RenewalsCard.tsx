// Renewal payment-link sub-card on Account › Billing.
// Mirrors the enquiry payment panel: shows current renewal-link state, with
// generate / regenerate / copy / open / draft email / mark sent / cancel /
// refresh actions. Renewal history continues to live in account_invoices.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Copy as CopyIcon, ExternalLink, Loader2, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { calcBilling, fmtINR } from '@/lib/billing';
import { PaymentLinkDialog, PaymentLinkResult } from '@/components/shared/PaymentLinkDialog';
import { PaymentEmailComposer, buildRenewalPaymentEmail } from '@/components/billing/PaymentEmailComposer';

interface Props { accountId: string }

interface RenewalState {
  status: 'TRIAL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'OVERDUE';
  plan_name: string;
  base_fee: number;
  seat_rate: number;
  gst_pct: number;
  seats_purchased: number;
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';
  current_period_end: string | null;
  renewal_due_date: string | null;
  renewal_notes: string | null;
  renewal_link_id: string | null;
  renewal_link_short_url: string | null;
  renewal_link_amount: number;
  renewal_link_seats: number;
  renewal_link_status: string | null;
  renewal_link_created_at: string | null;
  renewal_link_expires_at: string | null;
  renewal_link_outdated: boolean;
  renewal_paid_at: string | null;
  renewal_email_last_drafted_at: string | null;
  renewal_email_last_sent_at: string | null;
  renewal_email_draft_subject: string | null;
  renewal_email_draft_body: string | null;
}

interface AccountOwner { name: string; email: string | null; phone: string | null }

const statusBadge = (s: string) => {
  const cls = s === 'PAID' ? 'bg-success/15 text-success border-success/30'
    : s === 'CANCELLED' || s === 'EXPIRED' ? 'bg-destructive/15 text-destructive border-destructive/30'
    : 'bg-primary/15 text-primary border-primary/30';
  return <Badge variant="outline" className={cn('text-[10px]', cls)}>{s}</Badge>;
};

export function RenewalsCard({ accountId }: Props) {
  const [state, setState] = useState<RenewalState | null>(null);
  const [owner, setOwner] = useState<AccountOwner>({ name: '', email: null, phone: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a] = await Promise.all([
      supabase.from('account_billing_settings').select('*').eq('account_id', accountId).maybeSingle(),
      supabase.from('accounts').select('account_name, owner_name, owner_email, owner_phone').eq('id', accountId).maybeSingle(),
    ]);
    if (s.data) {
      const r = s.data as unknown as RenewalState;
      setState(r);
      setDueDate(r.renewal_due_date ?? '');
      setNotes(r.renewal_notes ?? '');
    }
    if (a.data) {
      setOwner({
        name: a.data.owner_name ?? a.data.account_name ?? '',
        email: a.data.owner_email,
        phone: a.data.owner_phone,
      });
    }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const breakdown = useMemo(
    () => state ? calcBilling(state.base_fee, state.seat_rate, state.seats_purchased, state.gst_pct, 3) : null,
    [state],
  );

  const isOutdated = useMemo(() => {
    if (!state || !state.renewal_link_id || !breakdown) return false;
    if (state.renewal_link_outdated) return true;
    return state.renewal_link_seats !== state.seats_purchased
      || Number(state.renewal_link_amount) !== Number(breakdown.total);
  }, [state, breakdown]);

  const linkExpired = state?.renewal_link_expires_at ? new Date(state.renewal_link_expires_at) < new Date() : false;
  const linkActive = !!state?.renewal_link_id
    && state.renewal_link_status !== 'PAID'
    && state.renewal_link_status !== 'CANCELLED'
    && !linkExpired;

  const updateField = async (patch: Partial<RenewalState>) => {
    const { error } = await supabase.from('account_billing_settings').update(patch).eq('account_id', accountId);
    if (error) { toast.error(error.message); return; }
    setState(s => s ? { ...s, ...patch } : s);
  };

  const cancel = async () => {
    if (!state?.renewal_link_id) return;
    if (!confirm('Cancel this renewal payment link?')) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('razorpay-cancel-payment-link', {
      body: { link_id: state.renewal_link_id, purpose: 'RENEWAL', account_id: accountId },
    });
    setBusy(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || 'Failed to cancel'); return; }
    toast.success('Renewal link cancelled');
    load();
  };

  const refresh = async () => {
    if (!state?.renewal_link_id) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('razorpay-link-status', {
      body: { link_id: state.renewal_link_id, purpose: 'RENEWAL', account_id: accountId },
    });
    setBusy(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || 'Failed to refresh'); return; }
    toast.success(`Status: ${data.status ?? 'unchanged'}`);
    load();
  };

  const handleLinkSuccess = (_result: PaymentLinkResult) => {
    load();
  };

  const recordEmail = async (kind: 'drafted' | 'sent', subject: string, body: string) => {
    const nowIso = new Date().toISOString();
    const patch: Partial<RenewalState> = {
      renewal_email_draft_subject: subject,
      renewal_email_draft_body: body,
      ...(kind === 'drafted' ? { renewal_email_last_drafted_at: nowIso } : { renewal_email_last_sent_at: nowIso }),
    };
    await updateField(patch);
    if (kind === 'sent') toast.success('Renewal email marked as sent');
  };

  // Hide entirely while the account is on trial — the TrialConversionCard
  // owns the first payment. RenewalsCard only makes sense once the account
  // is ACTIVE (or post-active states like PAUSED / OVERDUE / CANCELLED).
  if (state && state.status === 'TRIAL') return null;

  if (loading || !state || !breakdown) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Renewal payment link</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  const tmpl = buildRenewalPaymentEmail({
    ownerName: owner.name,
    planName: state.plan_name,
    seats: state.renewal_link_seats || state.seats_purchased,
    amount: state.renewal_link_amount || breakdown.total,
    currency: 'INR',
    paymentLinkUrl: state.renewal_link_short_url ?? '',
    dueDate: state.renewal_due_date,
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Renewal payment link
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {state.seats_purchased} seats · {fmtINR(breakdown.total)} ({state.billing_cycle.toLowerCase()})
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.renewal_link_short_url ? (
            <div className={cn('rounded-md border p-3 space-y-2',
              isOutdated ? 'border-warning/40 bg-warning/5' : 'bg-muted/20')}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{fmtINR(state.renewal_link_amount)}</span>
                  <span className="text-[11px] text-muted-foreground">· {state.renewal_link_seats} seats</span>
                  {state.renewal_link_status && statusBadge(state.renewal_link_status)}
                  {isOutdated && <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/40">Outdated</Badge>}
                  {linkExpired && <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/40">Expired</Badge>}
                  {state.renewal_link_created_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Sent {format(new Date(state.renewal_link_created_at), 'dd MMM, HH:mm')}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(state.renewal_link_short_url!); toast.success('Link copied'); }}>
                    <CopyIcon className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                  <a href={state.renewal_link_short_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open</Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
                    <RefreshCw className={cn('h-3.5 w-3.5 mr-1', busy && 'animate-spin')} /> Refresh
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground break-all">{state.renewal_link_short_url}</div>
              {(state.renewal_email_last_drafted_at || state.renewal_email_last_sent_at) && (
                <div className="text-[11px] text-muted-foreground border-t pt-1.5 flex gap-4 flex-wrap">
                  {state.renewal_email_last_sent_at && <span>Email sent {format(new Date(state.renewal_email_last_sent_at), 'dd MMM, HH:mm')}</span>}
                  {state.renewal_email_last_drafted_at && !state.renewal_email_last_sent_at && (
                    <span>Email drafted {format(new Date(state.renewal_email_last_drafted_at), 'dd MMM, HH:mm')}</span>
                  )}
                </div>
              )}
              {isOutdated && (
                <p className="text-[11px] text-warning">Seats or amount have changed since this link was created. Regenerate before sending.</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No renewal link generated for this cycle yet.
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Renewal due date</Label>
              <Input
                type="date"
                className="h-8"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                onBlur={() => state.renewal_due_date !== (dueDate || null) && updateField({ renewal_due_date: dueDate || null })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Renewal notes</Label>
              <Textarea
                rows={1}
                className="resize-none min-h-[2rem] h-8 py-1.5"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => state.renewal_notes !== (notes || null) && updateField({ renewal_notes: notes || null })}
                placeholder="Optional context — visible in audit log"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setLinkOpen(true)} disabled={busy}>
              {state.renewal_link_short_url ? 'Regenerate link' : 'Generate renewal link'}
            </Button>
            {state.renewal_link_short_url && (
              <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} disabled={busy || isOutdated}>
                Draft renewal email
              </Button>
            )}
            {linkActive && (
              <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>Cancel link</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        purpose="RENEWAL"
        accountId={accountId}
        defaults={{
          seats: state.seats_purchased,
          customerName: owner.name,
          customerEmail: owner.email,
          customerPhone: owner.phone,
          planName: state.plan_name,
          cycle: state.billing_cycle,
          baseFee: state.base_fee,
          seatRate: state.seat_rate,
          gstPct: state.gst_pct,
        }}
        onSuccess={handleLinkSuccess}
      />

      <PaymentEmailComposer
        open={emailOpen}
        onOpenChange={setEmailOpen}
        purpose="RENEWAL"
        to={owner.email ?? ''}
        defaultSubject={state.renewal_email_draft_subject ?? tmpl.subject}
        defaultBody={state.renewal_email_draft_body ?? tmpl.body}
        onDrafted={(s, b) => recordEmail('drafted', s, b)}
        onMarkedSent={(s, b) => recordEmail('sent', s, b)}
      />
    </>
  );
}
