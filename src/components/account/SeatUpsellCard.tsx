import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarPlus, Loader2, Link as LinkIcon, RefreshCw, Copy as CopyIcon, ExternalLink } from 'lucide-react';
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
  account_id: string;
  seat_request_id: string;
  seats_extra: number;
  per_seat_rate: number;
  days_remaining: number;
  days_in_cycle: number;
  prorated_subtotal: number;
  gst_pct: number;
  gst_amount: number;
  total: number;
  link_id: string | null;
  short_url: string | null;
  status: string;
  expires_at: string | null;
  paid_at: string | null;
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

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-primary/15 text-primary',
  PENDING: 'bg-warning/15 text-warning',
  PAID: 'bg-success/15 text-success',
  CANCELLED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-destructive/15 text-destructive',
};

export function SeatUpsellCard({ accountId }: { accountId: string }) {
  const [billing, setBilling] = useState<BillingCtx | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [requests, setRequests] = useState<SeatRequest[]>([]);
  const [links, setLinks] = useState<UpsellLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<SeatRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, a, r, l] = await Promise.all([
      supabase.from('account_billing_settings').select('plan_name, billing_cycle, base_fee, seat_rate, seats_purchased, gst_pct, current_period_start, current_period_end, subscription_started_at, next_renewal_at, trial_starts_at, trial_ends_at').eq('account_id', accountId).maybeSingle(),
      supabase.from('accounts').select('account_name, owner_name, owner_email, owner_phone').eq('id', accountId).maybeSingle(),
      supabase.from('seat_requests').select('*').eq('account_id', accountId).eq('status', 'APPROVED').order('decided_at', { ascending: false }),
      supabase.from('seat_upsell_links').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
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

  // Map approved requests to existing un-paid links (any link not PAID).
  const linksByReq = useMemo(() => {
    const m = new Map<string, UpsellLink>();
    for (const l of links) {
      const cur = m.get(l.seat_request_id);
      if (!cur || new Date(l.created_at) > new Date(cur.created_at)) m.set(l.seat_request_id, l);
    }
    return m;
  }, [links]);

  // Approved requests that don't yet have a PAID upsell link (need billing).
  const pendingUpsells = useMemo(
    () => requests.filter(r => {
      const link = linksByReq.get(r.id);
      return !link || (link.status !== 'PAID');
    }),
    [requests, linksByReq],
  );

  const openDialog = (req: SeatRequest) => {
    setActiveRequest(req);
    setOpen(true);
  };

  const proRata = useMemo(() => {
    if (!billing || !activeRequest) return null;
    // Resolve cycle window with fallbacks: explicit period → subscription → trial → derived from billing cycle
    const cycleMonths = billing.billing_cycle === 'MONTHLY' ? 1 : billing.billing_cycle === 'QUARTERLY' ? 3 : 12;
    let periodStart: Date | null = billing.current_period_start ? new Date(billing.current_period_start) : null;
    let periodEnd: Date | null = billing.current_period_end ? new Date(billing.current_period_end) : null;
    if (!periodStart && billing.subscription_started_at) periodStart = new Date(billing.subscription_started_at);
    if (!periodEnd && billing.next_renewal_at) periodEnd = new Date(billing.next_renewal_at);
    if (!periodStart && billing.trial_starts_at) periodStart = new Date(billing.trial_starts_at);
    if (!periodEnd && billing.trial_ends_at) periodEnd = new Date(billing.trial_ends_at);
    // Last-resort: derive from today
    if (!periodStart && periodEnd) {
      const ps = new Date(periodEnd); ps.setMonth(ps.getMonth() - cycleMonths); periodStart = ps;
    }
    if (!periodEnd && periodStart) {
      const pe = new Date(periodStart); pe.setMonth(pe.getMonth() + cycleMonths); periodEnd = pe;
    }
    if (!periodStart || !periodEnd) {
      periodStart = new Date();
      periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + cycleMonths);
    }
    const daysInCycle = Math.max(1, differenceInCalendarDays(periodEnd, periodStart));
    const daysRemaining = Math.max(0, Math.min(daysInCycle, differenceInCalendarDays(periodEnd, new Date())));
    const seatsExtra = activeRequest.requested_seats;
    const fullSubtotal = billing.seat_rate * seatsExtra;
    const proratedSubtotal = Math.round(fullSubtotal * (daysRemaining / daysInCycle));
    const gstAmount = Math.round((proratedSubtotal * billing.gst_pct) / 100);
    const total = proratedSubtotal + gstAmount;
    return {
      daysInCycle, daysRemaining, seatsExtra,
      perSeatRate: billing.seat_rate,
      fullSubtotal, proratedSubtotal,
      gstPct: billing.gst_pct, gstAmount, total,
      periodStart, periodEnd,
      derived: !billing.current_period_start || !billing.current_period_end,
    };
  }, [billing, activeRequest]);

  const generate = async () => {
    if (!activeRequest || !billing || !proRata || !account) return;
    if (proRata.total <= 0) { toast.error('Calculated total is zero — nothing to charge.'); return; }
    setSubmitting(true);
    // 1. Razorpay link via existing function (purpose = SEAT_UPSELL extension)
    const { data, error } = await supabase.functions.invoke('razorpay-create-payment-link', {
      body: {
        purpose: 'SEAT_UPSELL',
        account_id: accountId,
        seat_request_id: activeRequest.id,
        plan_name: billing.plan_name,
        billing_cycle: billing.billing_cycle,
        seats: proRata.seatsExtra,
        base_fee: 0,
        per_seat_rate: proRata.perSeatRate,
        gst_pct: proRata.gstPct,
        subtotal: proRata.proratedSubtotal,
        gst_amount: proRata.gstAmount,
        total: proRata.total,
        prorata: {
          days_remaining: proRata.daysRemaining,
          days_in_cycle: proRata.daysInCycle,
        },
        customer: {
          name: account.owner_name || account.account_name,
          email: account.owner_email || undefined,
          phone: account.owner_phone || undefined,
        },
      },
    });
    setSubmitting(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || 'Failed to create link');
      return;
    }
    toast.success('Pro-rata payment link created');
    setOpen(false);
    setActiveRequest(null);
    load();
  };

  const refreshStatus = async (link: UpsellLink) => {
    if (!link.link_id) return;
    setBusyId(link.id);
    const { data, error } = await supabase.functions.invoke('razorpay-link-status', {
      body: { link_id: link.link_id, purpose: 'SEAT_UPSELL', account_id: accountId, upsell_link_id: link.id },
    });
    setBusyId(null);
    if (error || !data?.success) { toast.error(data?.error || error?.message || 'Failed to refresh'); return; }
    toast.success(`Status: ${data.status ?? 'unchanged'}`);
    load();
  };

  if (loading) return null;

  if (pendingUpsells.length === 0 && links.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" /> Seat upsell (pro-rata)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingUpsells.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Approved seat requests awaiting billing. Generate a pro-rata link based on time left in the current cycle.
            </p>
            {pendingUpsells.map(r => {
              const existing = linksByReq.get(r.id);
              return (
                <div key={r.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">+{r.requested_seats} seat(s)</span>
                      <Badge className="text-[10px] bg-success/15 text-success">Approved</Badge>
                      {existing && (
                        <Badge className={`text-[10px] ${STATUS_COLORS[existing.status] ?? 'bg-muted'}`}>
                          Link {existing.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.reason ?? 'No reason given'}
                      {r.decided_at && ` · approved ${format(new Date(r.decided_at), 'dd MMM yyyy')}`}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => openDialog(r)}>
                    <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                    {existing ? 'Regenerate link' : 'Generate pro-rata link'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {links.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-[11px] uppercase text-muted-foreground tracking-wide">All upsell links</p>
            {links.map(l => (
              <div key={l.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{fmtINR(l.total)}</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[l.status] ?? 'bg-muted'}`}>{l.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">+{l.seats_extra} seat(s) · {l.days_remaining}/{l.days_in_cycle} days</span>
                  </div>
                  {l.short_url && (
                    <div className="text-[11px] text-muted-foreground break-all mt-0.5">{l.short_url}</div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {l.short_url && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(l.short_url!); toast.success('Copied'); }}>
                        <CopyIcon className="h-3.5 w-3.5" />
                      </Button>
                      <a href={l.short_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5" /></Button>
                      </a>
                    </>
                  )}
                  {l.link_id && l.status !== 'PAID' && (
                    <Button size="sm" variant="outline" onClick={() => refreshStatus(l)} disabled={busyId === l.id}>
                      <RefreshCw className={`h-3.5 w-3.5 ${busyId === l.id ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pro-rata seat upsell</DialogTitle>
            </DialogHeader>
            {activeRequest && billing && proRata && (
              <div className="space-y-3 text-sm">
                <div className="rounded border p-3 bg-muted/20 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Extra seats</span><span className="font-medium">+{proRata.seatsExtra}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Per-seat rate</span><span className="font-medium">{fmtINR(proRata.perSeatRate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cycle window</span><span className="font-medium">
                    {format(proRata.periodStart, 'dd MMM')} – {format(proRata.periodEnd, 'dd MMM yyyy')}
                  </span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days remaining / cycle</span><span className="font-medium">{proRata.daysRemaining} / {proRata.daysInCycle}</span></div>
                </div>
                <div className="rounded border p-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Full-cycle subtotal</span><span>{fmtINR(proRata.fullSubtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">× ({proRata.daysRemaining}/{proRata.daysInCycle})</span><span className="font-medium">{fmtINR(proRata.proratedSubtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST ({proRata.gstPct}%)</span><span>{fmtINR(proRata.gstAmount)}</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t mt-1 text-primary"><span>Total</span><span>{fmtINR(proRata.total)}</span></div>
                </div>
                {proRata.derived && (
                  <p className="text-[11px] text-warning">Billing cycle dates not set explicitly — using {billing.subscription_started_at || billing.next_renewal_at ? 'subscription' : billing.trial_starts_at ? 'trial' : 'estimated'} dates. Set the cycle in Plan & subscription for accurate proration.</p>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Customer</Label>
                  <Input className="h-8" disabled value={account?.owner_name || account?.account_name || ''} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={generate} disabled={submitting || !proRata || proRata.total <= 0}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                Create Razorpay link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
