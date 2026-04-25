import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import { fmtINR } from '@/lib/billing';

interface SeatRequest {
  id: string;
  account_id: string;
  requested_seats: number;
  reason: string | null;
  requested_by_email: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';
  decided_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

interface UpsellLink {
  id: string;
  seat_request_id: string;
  status: string;
  created_at: string;
}

interface BillingCtx {
  plan_name: string;
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';
  base_fee: number;
  seat_rate: number;
  seats_purchased: number;
  gst_pct: number;
  current_period_start: string | null;
  current_period_end: string | null;
  subscription_started_at: string | null;
  next_renewal_at: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
}

interface AccountInfo {
  account_name: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
}

function computeProRata(billing: BillingCtx, seatsExtra: number) {
  const cycleMonths = billing.billing_cycle === 'MONTHLY' ? 1 : billing.billing_cycle === 'QUARTERLY' ? 3 : billing.billing_cycle === 'HALF_YEARLY' ? 6 : 12;
  let periodStart: Date | null = billing.current_period_start ? new Date(billing.current_period_start) : null;
  let periodEnd: Date | null = billing.current_period_end ? new Date(billing.current_period_end) : null;
  if (!periodStart && billing.subscription_started_at) periodStart = new Date(billing.subscription_started_at);
  if (!periodEnd && billing.next_renewal_at) periodEnd = new Date(billing.next_renewal_at);
  if (!periodStart && billing.trial_starts_at) periodStart = new Date(billing.trial_starts_at);
  if (!periodEnd && billing.trial_ends_at) periodEnd = new Date(billing.trial_ends_at);
  if (!periodStart && periodEnd) { const ps = new Date(periodEnd); ps.setMonth(ps.getMonth() - cycleMonths); periodStart = ps; }
  if (!periodEnd && periodStart) { const pe = new Date(periodStart); pe.setMonth(pe.getMonth() + cycleMonths); periodEnd = pe; }
  if (!periodStart || !periodEnd) {
    periodStart = new Date();
    periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + cycleMonths);
  }
  const daysInCycle = Math.max(1, differenceInCalendarDays(periodEnd, periodStart));
  const daysRemaining = Math.max(0, Math.min(daysInCycle, differenceInCalendarDays(periodEnd, new Date())));
  const fullSubtotal = billing.seat_rate * seatsExtra;
  const proratedSubtotal = Math.round(fullSubtotal * (daysRemaining / daysInCycle));
  const gstAmount = Math.round((proratedSubtotal * billing.gst_pct) / 100);
  const total = proratedSubtotal + gstAmount;
  return { daysInCycle, daysRemaining, seatsExtra, perSeatRate: billing.seat_rate, fullSubtotal, proratedSubtotal, gstPct: billing.gst_pct, gstAmount, total, periodStart, periodEnd };
}

export function SeatUpsellCard({ accountId }: { accountId: string }) {
  const [billing, setBilling] = useState<BillingCtx | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [requests, setRequests] = useState<SeatRequest[]>([]);
  const [links, setLinks] = useState<UpsellLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, a, r, l] = await Promise.all([
      supabase.from('account_billing_settings').select('plan_name, billing_cycle, base_fee, seat_rate, seats_purchased, gst_pct, current_period_start, current_period_end, subscription_started_at, next_renewal_at, trial_starts_at, trial_ends_at').eq('account_id', accountId).maybeSingle(),
      supabase.from('accounts').select('account_name, owner_name, owner_email, owner_phone').eq('id', accountId).maybeSingle(),
      supabase.from('seat_requests').select('*').eq('account_id', accountId).eq('status', 'APPROVED').order('decided_at', { ascending: false }),
      supabase.from('seat_upsell_links').select('id, seat_request_id, status, created_at').eq('account_id', accountId).order('created_at', { ascending: false }),
    ]);
    if (b.data) setBilling({
      plan_name: b.data.plan_name,
      billing_cycle: b.data.billing_cycle as BillingCtx['billing_cycle'],
      base_fee: Number(b.data.base_fee),
      seat_rate: Number(b.data.seat_rate),
      seats_purchased: Number(b.data.seats_purchased ?? 0),
      gst_pct: Number(b.data.gst_pct),
      current_period_start: b.data.current_period_start,
      current_period_end: b.data.current_period_end,
      subscription_started_at: b.data.subscription_started_at,
      next_renewal_at: b.data.next_renewal_at,
      trial_starts_at: b.data.trial_starts_at,
      trial_ends_at: b.data.trial_ends_at,
    });
    if (a.data) setAccount(a.data as AccountInfo);
    setRequests((r.data ?? []) as SeatRequest[]);
    setLinks((l.data ?? []) as UpsellLink[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // Latest link per request
  const linksByReq = useMemo(() => {
    const m = new Map<string, UpsellLink>();
    for (const l of links) {
      const cur = m.get(l.seat_request_id);
      if (!cur || new Date(l.created_at) > new Date(cur.created_at)) m.set(l.seat_request_id, l);
    }
    return m;
  }, [links]);

  // Approved requests that don't yet have a PAID upsell link.
  const pendingUpsells = useMemo(
    () => requests.filter(r => {
      const link = linksByReq.get(r.id);
      return !link || (link.status !== 'PAID');
    }),
    [requests, linksByReq],
  );

  const generate = async (req: SeatRequest) => {
    if (!billing || !account) { toast.error('Billing context not ready'); return; }
    const proRata = computeProRata(billing, req.requested_seats);
    if (proRata.total <= 0) { toast.error('Calculated total is zero — nothing to charge.'); return; }
    setBusyId(req.id);
    const { data, error } = await supabase.functions.invoke('razorpay-create-payment-link', {
      body: {
        purpose: 'SEAT_UPSELL',
        account_id: accountId,
        seat_request_id: req.id,
        plan_name: billing.plan_name,
        billing_cycle: billing.billing_cycle,
        seats: proRata.seatsExtra,
        base_fee: 0,
        per_seat_rate: proRata.perSeatRate,
        gst_pct: proRata.gstPct,
        subtotal: proRata.proratedSubtotal,
        gst_amount: proRata.gstAmount,
        total: proRata.total,
        prorata: { days_remaining: proRata.daysRemaining, days_in_cycle: proRata.daysInCycle },
        customer: {
          name: account.owner_name || account.account_name,
          email: account.owner_email || undefined,
          phone: account.owner_phone || undefined,
        },
      },
    });
    setBusyId(null);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || 'Failed to create link');
      return;
    }
    const url: string | undefined = data?.payment?.short_url;
    if (url) {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      toast.success('Pro-rata link created and copied');
    } else {
      toast.success('Pro-rata link created');
    }
    load();
  };

  if (loading) return null;
  if (pendingUpsells.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" /> Seat upsell (pro-rata)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Approved seat requests awaiting billing. Generate a pro-rata link based on time left in the current cycle. Once paid, the invoice is added to Billing automatically.
        </p>
        {pendingUpsells.map(r => {
          const proRata = billing ? computeProRata(billing, r.requested_seats) : null;
          return (
            <div key={r.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">+{r.requested_seats} seat(s)</span>
                  <Badge className="text-[10px] bg-success/15 text-success">Approved</Badge>
                  {proRata && (
                    <span className="text-[11px] text-muted-foreground">
                      {fmtINR(proRata.total)} · {proRata.daysRemaining}/{proRata.daysInCycle} days
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.reason ?? 'No reason given'}
                  {r.decided_at && ` · approved ${format(new Date(r.decided_at), 'dd MMM yyyy')}`}
                </div>
              </div>
              <Button size="sm" onClick={() => generate(r)} disabled={busyId === r.id || !billing || !account}>
                {busyId === r.id
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <LinkIcon className="h-3.5 w-3.5 mr-1.5" />}
                Generate &amp; copy link
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
