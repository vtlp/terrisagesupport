import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  listContacts, listReferralRecords, createReferralRecord, updateReferralRecord,
  REFERRAL_STATUSES, REFERRER_ELIGIBLE_TYPES,
  type MarketingContact, type MarketingReferralRecord, type ReferralStatus,
} from '@/lib/marketingApi';
import { ContactDetailDrawer } from './ContactDetailDrawer';
import { ReferralDetailDrawer } from './ReferralDetailDrawer';

interface Props { isAdmin: boolean }

export function ReferralManagementTab({ isAdmin }: Props) {
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [records, setRecords] = useState<MarketingReferralRecord[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingReferralRecord | null>(null);
  const [drawerContact, setDrawerContact] = useState<MarketingContact | null>(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<MarketingReferralRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const openContact = (c: MarketingContact) => {
    setDetailOpen(false);
    setDrawerContact(c); setContactDrawerOpen(true);
  };
  const openDetail = (r: MarketingReferralRecord) => { setDetailRecord(r); setDetailOpen(true); };
  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (r: MarketingReferralRecord) => { setEditing(r); setOpen(true); setDetailOpen(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search referrals…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add referral</Button>}
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Referrer</TableHead><TableHead>Contact</TableHead><TableHead>Date</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Seats</TableHead>
            <TableHead className="text-right">Price / seat</TableHead>
            <TableHead className="text-right">Commission %</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => {
              const c = contactById[r.contact_id];
              const total = r.seats_referred * Number(r.price_per_seat) * (Number(r.commission_pct) / 100);
              return (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(r)}>
                  <TableCell>
                    <button
                      className="font-medium text-primary hover:underline text-left"
                      onClick={(e) => { e.stopPropagation(); c && openContact(c); }}
                    >
                      {c?.name ?? '—'}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c?.email ?? c?.phone ?? '—'}</TableCell>
                  <TableCell>{new Date(r.referral_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{r.seats_referred}</TableCell>
                  <TableCell className="text-right">₹{Number(r.price_per_seat).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.commission_pct}%</TableCell>
                  <TableCell className="text-right font-semibold">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No referrals yet.</p>}
      </CardContent></Card>

      <ReferralDialog
        open={open} onOpenChange={setOpen}
        contacts={eligibleContacts}
        existing={editing}
        onSaved={reload}
      />

      <ReferralDetailDrawer
        record={detailRecord} contact={detailRecord ? contactById[detailRecord.contact_id] : null}
        open={detailOpen} onOpenChange={setDetailOpen}
        onChanged={reload} onEdit={openEdit} onOpenContact={openContact} isAdmin={isAdmin}
      />

      <ContactDetailDrawer
        contact={drawerContact} open={contactDrawerOpen} onOpenChange={setContactDrawerOpen}
        onEdit={() => { /* edit contact from contacts tab */ }}
        onChanged={reload} isAdmin={isAdmin}
      />
    </div>
  );
}

function ReferralDialog({ open, onOpenChange, contacts, existing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  contacts: MarketingContact[];
  existing: MarketingReferralRecord | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!existing;
  const [contactType, setContactType] = useState<MarketingContact['contact_type'] | ''>('');
  const [contactId, setContactId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<ReferralStatus>('New');
  const [seats, setSeats] = useState(0);
  const [pricePerSeat, setPricePerSeat] = useState(0);
  const [pct, setPct] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const existingContact = contacts.find(c => c.id === existing.contact_id);
      setContactType(existingContact?.contact_type ?? '');
      setContactId(existing.contact_id);
      setDate(existing.referral_date);
      setStatus(existing.status);
      setSeats(existing.seats_referred);
      setPricePerSeat(Number(existing.price_per_seat));
      setPct(Number(existing.commission_pct));
      setNotes(existing.notes ?? '');
    } else {
      setContactType(''); setContactId(''); setDate(new Date().toISOString().slice(0, 10)); setStatus('New');
      setSeats(0); setPricePerSeat(0); setPct(0); setNotes('');
    }
  }, [open, existing, contacts]);

  const eligibleTypes = useMemo(
    () => Array.from(new Set(contacts.map(c => c.contact_type))).sort(),
    [contacts],
  );
  const filteredContacts = useMemo(
    () => contactType ? contacts.filter(c => c.contact_type === contactType) : [],
    [contacts, contactType],
  );
  const total = seats * pricePerSeat * (pct / 100);
  const selected = contacts.find(c => c.id === contactId);

  const submit = async () => {
    if (!contactId) { toast({ title: 'Select a referrer', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const payload = {
        contact_id: contactId, referral_date: date, status,
        seats_referred: seats, commission_pct: pct, price_per_seat: pricePerSeat,
        notes: notes || null,
      };
      if (isEdit && existing) {
        await updateReferralRecord(existing.id, payload);
        toast({ title: 'Referral updated' });
      } else {
        await createReferralRecord(payload);
        toast({ title: 'Referral added' });
      }
      onSaved(); onOpenChange(false);
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit referral' : 'Add referral'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact type *</Label>
              <Select
                value={contactType}
                onValueChange={(v) => { setContactType(v as MarketingContact['contact_type']); setContactId(''); }}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {eligibleTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referrer *</Label>
              <Select value={contactId} onValueChange={setContactId} disabled={!contactType}>
                <SelectTrigger><SelectValue placeholder={contactType ? 'Select referrer' : 'Select type first'} /></SelectTrigger>
                <SelectContent>
                  {filteredContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {selected.email ?? '—'} · {selected.phone ?? '—'}
            </p>
          )}
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
              <div><Label>Price / seat</Label><Input type="number" min={0} value={pricePerSeat} onChange={e => setPricePerSeat(Number(e.target.value))} /></div>
              <div><Label>Commission %</Label><Input type="number" min={0} step="0.01" value={pct} onChange={e => setPct(Number(e.target.value))} /></div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total commission</span>
              <span className="font-semibold">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add notes for this referral…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{isEdit ? 'Save changes' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
