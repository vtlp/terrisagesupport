import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Trash2, UserPlus, Users, Award } from 'lucide-react';
import { listRecords, deleteRecord, type MarketingReferral, type MarketingContact, type MarketingChampion } from '@/lib/marketingApi';
import { AddRecordDialog, type FieldDef } from './AddRecordDialog';
import { useToast } from '@/hooks/use-toast';

interface Props { isAdmin: boolean }

const referralFields: FieldDef[] = [
  { key: 'referrer_name', label: 'Referrer name', required: true },
  { key: 'referrer_phone', label: 'Referrer phone' },
  { key: 'referrer_email', label: 'Referrer email' },
  { key: 'referred_company', label: 'Referred company' },
  { key: 'city', label: 'City', type: 'city' },
  { key: 'status', label: 'Status', placeholder: 'NEW / CONTACTED / WON / LOST' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const contactFields: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'title', label: 'Title' },
  { key: 'company', label: 'Company' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City', type: 'city' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const championFields: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'reach', label: 'Reach', type: 'number' },
  { key: 'city', label: 'City', type: 'city' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export function RecordsTab({ isAdmin }: Props) {
  const [view, setView] = useState<'referrals' | 'contacts' | 'champions'>('referrals');
  const [referrals, setReferrals] = useState<MarketingReferral[]>([]);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [champions, setChampions] = useState<MarketingChampion[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const reload = async () => {
    const [r, c, ch] = await Promise.all([
      listRecords<MarketingReferral>('marketing_referrals'),
      listRecords<MarketingContact>('marketing_contacts'),
      listRecords<MarketingChampion>('marketing_champions'),
    ]);
    setReferrals(r); setContacts(c); setChampions(ch);
  };

  useEffect(() => { reload(); }, []);

  const remove = async (table: 'marketing_referrals' | 'marketing_contacts' | 'marketing_champions', id: string) => {
    if (!confirm('Delete this record?')) return;
    try { await deleteRecord(table, id); toast({ title: 'Deleted' }); reload(); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  const matches = (s: string | null | undefined) => !search || (s ?? '').toLowerCase().includes(search.toLowerCase());

  const filteredReferrals = useMemo(() => referrals.filter(r =>
    matches(r.referrer_name) || matches(r.referred_company) || matches(r.city) || matches(r.referrer_phone) || matches(r.referrer_email)),
  [referrals, search]);
  const filteredContacts = useMemo(() => contacts.filter(c =>
    matches(c.name) || matches(c.company) || matches(c.title) || matches(c.city) || matches(c.email)),
  [contacts, search]);
  const filteredChampions = useMemo(() => champions.filter(c =>
    matches(c.name) || matches(c.company) || matches(c.role) || matches(c.city)),
  [champions, search]);

  const dialogConfig = view === 'referrals'
    ? { table: 'marketing_referrals' as const, title: 'Add referral', fields: referralFields }
    : view === 'contacts'
      ? { table: 'marketing_contacts' as const, title: 'Add contact', fields: contactFields }
      : { table: 'marketing_champions' as const, title: 'Add champion', fields: championFields };

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="referrals"><UserPlus className="h-4 w-4 mr-1" />Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1" />Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="champions"><Award className="h-4 w-4 mr-1" />Champions ({champions.length})</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add new</Button>
          )}
        </div>

        <TabsContent value="referrals">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Referrer</TableHead><TableHead>Referred company</TableHead>
                <TableHead>City</TableHead><TableHead>Status</TableHead>
                <TableHead>Contact</TableHead><TableHead className="w-12" />
              </TableRow></TableHeader>
              <TableBody>
                {filteredReferrals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.referrer_name}</TableCell>
                    <TableCell>{r.referred_company ?? '—'}</TableCell>
                    <TableCell>{r.city ?? '—'}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.referrer_phone ?? r.referrer_email ?? '—'}</TableCell>
                    <TableCell>{isAdmin && <button onClick={() => remove('marketing_referrals', r.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredReferrals.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No referrals yet.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Company</TableHead>
                <TableHead>City</TableHead><TableHead>Contact</TableHead><TableHead className="w-12" />
              </TableRow></TableHeader>
              <TableBody>
                {filteredContacts.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.title ?? '—'}</TableCell>
                    <TableCell>{c.company ?? '—'}</TableCell>
                    <TableCell>{c.city ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.phone ?? c.email ?? '—'}</TableCell>
                    <TableCell>{isAdmin && <button onClick={() => remove('marketing_contacts', c.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredContacts.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No contacts yet.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="champions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Role</TableHead>
                <TableHead>Reach</TableHead><TableHead>City</TableHead><TableHead className="w-12" />
              </TableRow></TableHeader>
              <TableBody>
                {filteredChampions.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.company ?? '—'}</TableCell>
                    <TableCell>{c.role ?? '—'}</TableCell>
                    <TableCell>{c.reach.toLocaleString()}</TableCell>
                    <TableCell>{c.city ?? '—'}</TableCell>
                    <TableCell>{isAdmin && <button onClick={() => remove('marketing_champions', c.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredChampions.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No champions yet.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <AddRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogConfig.title}
        table={dialogConfig.table}
        fields={dialogConfig.fields}
        onCreated={reload}
      />
    </div>
  );
}
