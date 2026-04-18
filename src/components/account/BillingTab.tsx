import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Receipt, Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Cycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
type SubStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'OVERDUE';
type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

interface Settings {
  id?: string;
  plan_name: string;
  billing_cycle: Cycle;
  base_fee: number;
  seat_rate: number;
  seats_purchased: number;
  gst_pct: number;
  next_renewal_at: string | null;
  status: SubStatus;
}

interface Invoice {
  id: string; invoice_no: string | null; period_from: string | null; period_to: string | null;
  plan_name: string | null; seat_count: number; seat_rate: number; base_fee: number;
  subtotal: number; gst_pct: number; gst_amount: number; total: number;
  status: InvoiceStatus; issued_at: string | null; due_at: string | null; paid_at: string | null; notes: string | null;
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-primary/15 text-primary',
  PAID: 'bg-success/15 text-success',
  OVERDUE: 'bg-destructive/15 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const DEFAULT_SETTINGS: Settings = {
  plan_name: 'Standard', billing_cycle: 'MONTHLY', base_fee: 0, seat_rate: 0, seats_purchased: 0,
  gst_pct: 18, next_renewal_at: null, status: 'ACTIVE',
};

export function BillingTab({ accountId }: { accountId: string }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [seatCount, setSeatCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<Invoice> & { id?: string }>({
    invoice_no: '', period_from: null, period_to: null, plan_name: 'Standard',
    seat_count: 0, seat_rate: 0, base_fee: 0, gst_pct: 18, status: 'DRAFT', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [s, inv, seats] = await Promise.all([
      supabase.from('account_billing_settings').select('*').eq('account_id', accountId).maybeSingle(),
      supabase.from('account_invoices').select('*').eq('account_id', accountId).order('issued_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('account_seats').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('is_active', true),
    ]);
    if (s.data) {
      const loaded: Settings = {
        id: s.data.id, plan_name: s.data.plan_name, billing_cycle: s.data.billing_cycle,
        base_fee: Number(s.data.base_fee), seat_rate: Number(s.data.seat_rate),
        seats_purchased: Number((s.data as { seats_purchased?: number }).seats_purchased ?? 0),
        gst_pct: Number(s.data.gst_pct),
        next_renewal_at: s.data.next_renewal_at, status: s.data.status,
      };
      setSettings(loaded); setSavedSettings(loaded);
    }
    setInvoices((inv.data ?? []).map(i => ({
      ...i, seat_count: i.seat_count, seat_rate: Number(i.seat_rate), base_fee: Number(i.base_fee),
      subtotal: Number(i.subtotal), gst_pct: Number(i.gst_pct), gst_amount: Number(i.gst_amount), total: Number(i.total),
    })) as Invoice[]);
    setSeatCount(seats.count ?? 0);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const settingsDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  const monthlyTotal = useMemo(() => {
    const sub = settings.base_fee + settings.seat_rate * seatCount;
    return sub + sub * (settings.gst_pct / 100);
  }, [settings, seatCount]);

  const draftSubtotal = (Number(draft.base_fee) || 0) + (Number(draft.seat_rate) || 0) * (Number(draft.seat_count) || 0);
  const draftGst = draftSubtotal * (Number(draft.gst_pct) || 0) / 100;
  const draftTotal = draftSubtotal + draftGst;

  const saveSettings = async () => {
    setSavingSettings(true);
    const payload = {
      account_id: accountId, plan_name: settings.plan_name, billing_cycle: settings.billing_cycle,
      base_fee: settings.base_fee, seat_rate: settings.seat_rate,
      seats_purchased: settings.seats_purchased,
      gst_pct: settings.gst_pct,
      next_renewal_at: settings.next_renewal_at, status: settings.status,
    };
    const { error } = settings.id
      ? await supabase.from('account_billing_settings').update(payload).eq('id', settings.id)
      : await supabase.from('account_billing_settings').insert(payload);
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Billing settings saved');
    load();
  };

  const openNew = () => {
    setDraft({
      invoice_no: '', period_from: null, period_to: null, plan_name: settings.plan_name,
      seat_count: seatCount, seat_rate: settings.seat_rate, base_fee: settings.base_fee,
      gst_pct: settings.gst_pct, status: 'DRAFT', notes: '',
    });
    setOpen(true);
  };

  const openEdit = (i: Invoice) => {
    setDraft({ ...i });
    setOpen(true);
  };

  const saveInvoice = async () => {
    setBusy(true);
    const sub = (Number(draft.base_fee) || 0) + (Number(draft.seat_rate) || 0) * (Number(draft.seat_count) || 0);
    const gst = sub * (Number(draft.gst_pct) || 0) / 100;
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      account_id: accountId,
      invoice_no: draft.invoice_no || null,
      period_from: draft.period_from || null,
      period_to: draft.period_to || null,
      plan_name: draft.plan_name || settings.plan_name,
      seat_count: Number(draft.seat_count) || 0,
      seat_rate: Number(draft.seat_rate) || 0,
      base_fee: Number(draft.base_fee) || 0,
      subtotal: sub, gst_pct: Number(draft.gst_pct) || 0, gst_amount: gst, total: sub + gst,
      status: (draft.status ?? 'DRAFT') as InvoiceStatus,
      issued_at: draft.issued_at ?? (draft.status && draft.status !== 'DRAFT' ? new Date().toISOString() : null),
      due_at: draft.due_at ?? null,
      paid_at: draft.status === 'PAID' ? (draft.paid_at ?? new Date().toISOString()) : null,
      notes: draft.notes || null,
      created_by: user?.id ?? null,
    };
    const { error } = draft.id
      ? await supabase.from('account_invoices').update(payload).eq('id', draft.id)
      : await supabase.from('account_invoices').insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Invoice saved');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    const { error } = await supabase.from('account_invoices').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Plan & subscription</CardTitle>
            {settingsDirty && (
              <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Plan name</Label>
              <Input value={settings.plan_name} onChange={e => setSettings(s => ({ ...s, plan_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing cycle</Label>
              <Select value={settings.billing_cycle} onValueChange={v => setSettings(s => ({ ...s, billing_cycle: v as Cycle }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={settings.status} onValueChange={v => setSettings(s => ({ ...s, status: v as SubStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Base fee (₹)</Label>
              <Input type="number" value={settings.base_fee} onChange={e => setSettings(s => ({ ...s, base_fee: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Per-seat rate (₹)</Label>
              <Input type="number" value={settings.seat_rate} onChange={e => setSettings(s => ({ ...s, seat_rate: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>GST %</Label>
              <Input type="number" value={settings.gst_pct} onChange={e => setSettings(s => ({ ...s, gst_pct: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Seats purchased</Label>
              <Input type="number" min={0} value={settings.seats_purchased}
                onChange={e => setSettings(s => ({ ...s, seats_purchased: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Next renewal</Label>
              <Input type="date" value={settings.next_renewal_at ? settings.next_renewal_at.substring(0, 10) : ''}
                onChange={e => setSettings(s => ({ ...s, next_renewal_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="border rounded p-3">
              <div className="text-xs text-muted-foreground">Seat capacity</div>
              <div className="text-lg font-semibold">
                {seatCount} / {settings.seats_purchased}
                {settings.seats_purchased > 0 && (
                  <span className={`ml-2 text-xs font-normal ${seatCount > settings.seats_purchased ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {Math.max(settings.seats_purchased - seatCount, 0)} available
                  </span>
                )}
              </div>
              {seatCount > settings.seats_purchased && settings.seats_purchased > 0 && (
                <div className="text-[10px] text-destructive mt-0.5">Over capacity</div>
              )}
            </div>
            <div className="border rounded p-3"><div className="text-xs text-muted-foreground">Subtotal / cycle</div><div className="text-lg font-semibold">{fmtINR(settings.base_fee + settings.seat_rate * seatCount)}</div></div>
            <div className="border rounded p-3"><div className="text-xs text-muted-foreground">GST ({settings.gst_pct}%)</div><div className="text-lg font-semibold">{fmtINR((settings.base_fee + settings.seat_rate * seatCount) * settings.gst_pct / 100)}</div></div>
            <div className="border rounded p-3 bg-primary/5"><div className="text-xs text-muted-foreground">Total / cycle</div><div className="text-lg font-semibold text-primary">{fmtINR(monthlyTotal)}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Invoices ({invoices.length})</CardTitle>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New invoice</Button>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map(i => (
                <div key={i.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{i.invoice_no ?? '(draft)'}</span>
                      <Badge className={`text-[10px] ${STATUS_COLORS[i.status]}`}>{i.status}</Badge>
                      {i.period_from && i.period_to && (
                        <span className="text-xs text-muted-foreground">{format(new Date(i.period_from), 'dd MMM')} – {format(new Date(i.period_to), 'dd MMM yyyy')}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {i.seat_count} seats · {i.plan_name ?? '—'} {i.issued_at && `· Issued ${format(new Date(i.issued_at), 'dd MMM yyyy')}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmtINR(i.total)}</div>
                    <div className="text-[10px] text-muted-foreground">incl. GST</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{draft.id ? 'Edit invoice' : 'New invoice'}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Invoice no.</Label><Input value={draft.invoice_no ?? ''} onChange={e => setDraft(d => ({ ...d, invoice_no: e.target.value }))} placeholder="INV-2025-001" /></div>
            <div className="space-y-1.5"><Label>Plan name</Label><Input value={draft.plan_name ?? ''} onChange={e => setDraft(d => ({ ...d, plan_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Period from</Label><Input type="date" value={draft.period_from?.substring(0, 10) ?? ''} onChange={e => setDraft(d => ({ ...d, period_from: e.target.value || null }))} /></div>
            <div className="space-y-1.5"><Label>Period to</Label><Input type="date" value={draft.period_to?.substring(0, 10) ?? ''} onChange={e => setDraft(d => ({ ...d, period_to: e.target.value || null }))} /></div>
            <div className="space-y-1.5"><Label>Base fee (₹)</Label><Input type="number" value={draft.base_fee ?? 0} onChange={e => setDraft(d => ({ ...d, base_fee: Number(e.target.value) || 0 }))} /></div>
            <div className="space-y-1.5"><Label>Seats</Label><Input type="number" value={draft.seat_count ?? 0} onChange={e => setDraft(d => ({ ...d, seat_count: Number(e.target.value) || 0 }))} /></div>
            <div className="space-y-1.5"><Label>Per-seat rate (₹)</Label><Input type="number" value={draft.seat_rate ?? 0} onChange={e => setDraft(d => ({ ...d, seat_rate: Number(e.target.value) || 0 }))} /></div>
            <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={draft.gst_pct ?? 18} onChange={e => setDraft(d => ({ ...d, gst_pct: Number(e.target.value) || 0 }))} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={draft.status as string} onValueChange={v => setDraft(d => ({ ...d, status: v as InvoiceStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem><SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={draft.due_at?.substring(0, 10) ?? ''} onChange={e => setDraft(d => ({ ...d, due_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-sm"><span className="text-muted-foreground">Subtotal: </span><span className="font-medium">{fmtINR(draftSubtotal)}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">GST: </span><span className="font-medium">{fmtINR(draftGst)}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Total: </span><span className="font-semibold text-primary">{fmtINR(draftTotal)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveInvoice} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
