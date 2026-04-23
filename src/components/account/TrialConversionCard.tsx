// Trial-conversion payment-link sub-card on Account › Billing.
// Shown only while the subscription is in TRIAL state. Mirrors RenewalsCard:
// generate / regenerate / copy / open / refresh / cancel + draft email.
// On webhook PAID, the backend flips status TRIAL → ACTIVE and stamps period dates.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Copy as CopyIcon, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { calcBilling, fmtINR } from '@/lib/billing';
import { PaymentLinkDialog, PaymentLinkResult } from '@/components/shared/PaymentLinkDialog';
import { PaymentEmailComposer, buildInitialPaymentEmail } from '@/components/billing/PaymentEmailComposer';

interface Props { accountId: string }

interface TrialState {
  status: 'TRIAL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'OVERDUE';
  plan_name: string;
  base_fee: number;
  seat_rate: number;
  gst_pct: number;
  seats_purchased: number;
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  trial_link_id: string | null;
  trial_link_short_url: string | null;
  trial_link_amount: number;
  trial_link_seats: number;
  trial_link_status: string | null;
  trial_link_created_at: string | null;
  trial_link_expires_at: string | null;
  trial_link_outdated: boolean;
  trial_paid_at: string | null;
  trial_email_last_drafted_at: string | null;
  trial_email_last_sent_at: string | null;
  trial_email_draft_subject: string | null;
  trial_email_draft_body: string | null;
}

interface AccountOwner { name: string; email: string | null; phone: string | null }

const statusBadge = (s: string) => {
  const cls = s === 'PAID' ? 'bg-success/15 text-success border-success/30'
    : s === 'CANCELLED' || s === 'EXPIRED' ? 'bg-destructive/15 text-destructive border-destructive/30'
    : 'bg-primary/15 text-primary border-primary/30';
  return <Badge variant="outline" className={cn('text-[10px]', cls)}>{s}</Badge>;
};

export function TrialConversionCard({ accountId }: Props) {
  const [state, setState] = useState<TrialState | null>(null);
  const [owner, setOwner] = useState<AccountOwner>({ name: '', email: null, phone: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a] = await Promise.all([
      supabase.from('account_billing_settings').select('*').eq('account_id', accountId).maybeSingle(),
      supabase.from('accounts').select('account_name, owner_name, owner_email, owner_phone').eq('id', accountId).maybeSingle(),
    ]);
    if (s.data) setState(s.data as unknown as TrialState);
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
    if (!state || !state.trial_link_id || !breakdown) return false;
    if (state.trial_link_outdated) return true;
    return state.trial_link_seats !== state.seats_purchased
      || Number(state.trial_link_amount) !== Number(breakdown.total);
  }, [state, breakdown]);

  const linkExpired = state?.trial_link_expires_at ? new Date(state.trial_link_expires_at) < new Date() : false;
  const linkActive = !!state?.trial_link_id
    && state.trial_link_status !== 'PAID'
    && state.trial_link_status !== 'CANCELLED'
    && !linkExpired;

  const updateField = async (patch: Partial<TrialState>) => {
    const { error } = await supabase.from('account_billing_settings').update(patch).eq('account_id', accountId);
    if (error) { toast.error(error.message); return; }
    setState(s => s ? { ...s, ...patch } : s);
  };

  const cancel = async () => {
    if (!state?.trial_link_id) return;
    if (!confirm('Cancel this trial conversion link? The customer will no longer be able to pay against it.')) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('razorpay-cancel-payment-link', {
      body: { link_id: state.trial_link_id, purpose: 'TRIAL_CONVERSION', account_id: accountId },
    });
    setBusy(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || 'Failed to cancel'); return; }
    toast.success('Trial link cancelled');
    load();
  };

  const refresh = async () => {
    if (!state?.trial_link_id) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('razorpay-link-status', {
      body: { link_id: state.trial_link_id, purpose: 'TRIAL_CONVERSION', account_id: accountId },
    });
    setBusy(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || 'Failed to refresh'); return; }
    toast.success(`Status: ${data.status ?? 'unchanged'}`);
    load();
  };

  const handleLinkSuccess = (_result: PaymentLinkResult) => { load(); };

  const recordEmail = async (kind: 'drafted' | 'sent', subject: string, body: string) => {
    const nowIso = new Date().toISOString();
    const patch: Partial<TrialState> = {
      trial_email_draft_subject: subject,
      trial_email_draft_body: body,
      ...(kind === 'drafted' ? { trial_email_last_drafted_at: nowIso } : { trial_email_last_sent_at: nowIso }),
    };
    await updateField(patch);
    if (kind === 'sent') toast.success('Trial email marked as sent');
  };

  if (loading || !state || !breakdown) {
    return null;
  }

  // Only render while account is on trial. Once paid → flips to ACTIVE and this hides.
  if (state.status !== 'TRIAL') return null;

  const tmpl = buildInitialPaymentEmail({
    ownerName: owner.name,
    planName: state.plan_name,
    seats: state.trial_link_seats || state.seats_purchased,
    amount: state.trial_link_amount || breakdown.total,
    currency: 'INR',
    paymentLinkUrl: state.trial_link_short_url ?? '',
    expiresAt: state.trial_ends_at,
  });

  const trialDaysLeft = state.trial_ends_at
    ? Math.ceil((new Date(state.trial_ends_at).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <>
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Trial conversion
              <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">On trial</Badge>
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              {state.seats_purchased} seats · {fmtINR(breakdown.total)} ({state.billing_cycle.toLowerCase()})
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div>
              <Label className="text-[11px] text-muted-foreground">Trial start</Label>
              <Input type="date" className="h-8" value={state.trial_starts_at ?? ''}
                onChange={e => updateField({ trial_starts_at: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Trial end</Label>
              <Input type="date" className="h-8" value={state.trial_ends_at ?? ''}
                onChange={e => updateField({ trial_ends_at: e.target.value || null })} />
            </div>
            <div className="flex flex-col justify-end">
              {trialDaysLeft !== null && (
                <div className={cn('text-[11px] font-medium',
                  trialDaysLeft < 0 ? 'text-destructive' : trialDaysLeft <= 7 ? 'text-warning' : 'text-muted-foreground')}>
                  {trialDaysLeft < 0 ? `Trial ended ${-trialDaysLeft}d ago` : `${trialDaysLeft} day(s) left`}
                </div>
              )}
            </div>
          </div>

          {state.trial_link_short_url ? (
            <div className={cn('rounded-md border p-3 space-y-2',
              isOutdated ? 'border-warning/40 bg-warning/5' : 'bg-muted/20')}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{fmtINR(state.trial_link_amount)}</span>
                  <span className="text-[11px] text-muted-foreground">· {state.trial_link_seats} seats</span>
                  {state.trial_link_status && statusBadge(state.trial_link_status)}
                  {isOutdated && <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/40">Outdated</Badge>}
                  {linkExpired && <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/40">Expired</Badge>}
                  {state.trial_link_created_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Sent {format(new Date(state.trial_link_created_at), 'dd MMM, HH:mm')}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(state.trial_link_short_url!); toast.success('Link copied'); }}>
                    <CopyIcon className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                  <a href={state.trial_link_short_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open</Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
                    <RefreshCw className={cn('h-3.5 w-3.5 mr-1', busy && 'animate-spin')} /> Refresh
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground break-all">{state.trial_link_short_url}</div>
              {(state.trial_email_last_drafted_at || state.trial_email_last_sent_at) && (
                <div className="text-[11px] text-muted-foreground border-t pt-1.5 flex gap-4 flex-wrap">
                  {state.trial_email_last_sent_at && <span>Email sent {format(new Date(state.trial_email_last_sent_at), 'dd MMM, HH:mm')}</span>}
                  {state.trial_email_last_drafted_at && !state.trial_email_last_sent_at && (
                    <span>Email drafted {format(new Date(state.trial_email_last_drafted_at), 'dd MMM, HH:mm')}</span>
                  )}
                </div>
              )}
              {isOutdated && (
                <p className="text-[11px] text-warning">Seats or amount have changed since this link was created. Regenerate before sending.</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              When the customer is ready to convert, generate a trial conversion link to collect payment.
              Once paid, the subscription becomes Active and the billing period starts.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setLinkOpen(true)} disabled={busy}>
              {state.trial_link_short_url ? 'Regenerate link' : 'Generate trial link'}
            </Button>
            {state.trial_link_short_url && (
              <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} disabled={busy || isOutdated}>
                Draft email
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
        purpose="TRIAL_CONVERSION"
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
        purpose="INITIAL"
        to={owner.email ?? ''}
        defaultSubject={state.trial_email_draft_subject ?? tmpl.subject}
        defaultBody={state.trial_email_draft_body ?? tmpl.body}
        onDrafted={(s, b) => recordEmail('drafted', s, b)}
        onMarkedSent={(s, b) => recordEmail('sent', s, b)}
      />
    </>
  );
}
