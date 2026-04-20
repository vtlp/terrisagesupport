import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  listContacts, listReferralRecords, createReferralRecord, updateReferralRecord, deleteReferralRecord,
  REFERRAL_STATUSES, REFERRER_ELIGIBLE_TYPES,
  type MarketingContact, type MarketingReferralRecord, type ReferralStatus,
} from '@/lib/marketingApi';
import { ContactDetailDrawer } from './ContactDetailDrawer';

interface Props { isAdmin: boolean }

export function ReferralManagementTab({ isAdmin }: Props) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [records, setRecords] = useState<MarketingReferralRecord[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [drawerContact, setDrawerContact] = useState<MarketingContact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reload = async () => {
    const [c, r] = await Promise.all([listContacts(), listReferralRecords()]);
    setContacts(c); setRecords(r);
  };
  useEffect(() => { reload(); }, []);

  const eligibleContacts = useMemo(
    () => contacts.filter(c => REFERRER_ELIGIBLE_TYPES.includes(c.contact_type)),
    [contacts],
  );
  const contactById = useMemo(() => Object.fromEntries(contacts.map(c => [c.id, c])), [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      const c = contactById[r.contact_id];
      return !q || c?.name.toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
    });
  }, [records, contactById, search]);

  const openContact = (c: MarketingContact) => { setDrawerContact(c); setDrawerOpen(true); };

  const handleStatusChange = async (id: string, status: ReferralStatus) => {
    try { await updateReferralRecord(id, { status }); reload(); }
    catch (e) { toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this referral?')) return;
    try { await deleteReferralRecord(id); reload(); toast({ title: 'Deleted' }); }
    catch (e) { toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search referrals…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add referral</Button>}
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Referrer</TableHead><TableHead>Contact</TableHead><TableHead>Date</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Seats</TableHead>
            <TableHead className="text-right">% / Seat</TableHead><TableHead className="text-right">Total</TableHead>
            <TableHead className="w-12" />
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => {
              const c = contactById[r.contact_id];
              const total = r.seats_referred * r.price_per_seat * (r.commission_pct / 100);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <button className="font-medium text-primary hover:underline text-left" onClick={() => c && openContact(c)}>
                      {c?.name ?? '—'}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c?.email ?? c?.phone ?? '—'}</TableCell>
                  <TableCell>{new Date(r.referral_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v as ReferralStatus)}>
                        <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REFERRAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{r.status}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{r.seats_referred}</TableCell>
                  <TableCell className="text-right text-xs">{r.commission_pct}% / ₹{Number(r.price_per_seat).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell>{isAdmin && <button onClick={() => remove(r.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No referrals yet.</p>}
      </CardContent></Card>

      <AddReferralDialog
        open={open} onOpenChange={setOpen}
        contacts={eligibleContacts}
        onCreated={reload}
      />

      <ContactDetailDrawer
        contact={drawerContact} open={drawerOpen} onOpenChange={setDrawerOpen}
        onEdit={() => { /* open contact dialog from contacts tab */ }}
        onChanged={reload} isAdmin={isAdmin}
      />
    </div>
  );
}

function AddReferralDialog({ open, onOpenChange, contacts, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; contacts: MarketingContact[]; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [contactId, setContactId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<ReferralStatus>('New');
  const [seats, setSeats] = useState(0);
  const [pct, setPct] = useState(0);
  const [pricePerSeat, setPricePerSeat] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setContactId(''); setDate(new Date().toISOString().slice(0, 10)); setStatus('New');
      setSeats(0); setPct(0); setPricePerSeat(0); setNotes('');
    }
  }, [open]);

  const total = seats * pricePerSeat * (pct / 100);
  const selected = contacts.find(c => c.id === contactId);

  const submit = async () => {
    if (!contactId) { toast({ title: 'Select a referrer', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await createReferralRecord({
        contact_id: contactId, referral_date: date, status,
        seats_referred: seats, commission_pct: pct, price_per_seat: pricePerSeat,
        notes: notes || null,
      });
      toast({ title: 'Referral added' });
      onCreated(); onOpenChange(false);
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add referral</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Referrer (contact) *</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Select referrer" /></SelectTrigger>
              <SelectContent>
                {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.contact_type}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground mt-1">
                {selected.email ?? '—'} · {selected.phone ?? '—'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date of referral</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ReferralStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REFERRAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Commission</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Seats referred</Label><Input type="number" min={0} value={seats} onChange={e => setSeats(Number(e.target.value))} /></div>
              <div><Label>Commission %</Label><Input type="number" min={0} step="0.01" value={pct} onChange={e => setPct(Number(e.target.value))} /></div>
              <div><Label>Price / seat</Label><Input type="number" min={0} value={pricePerSeat} onChange={e => setPricePerSeat(Number(e.target.value))} /></div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total commission</span>
              <span className="font-semibold">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
