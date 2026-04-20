import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { listContacts, type MarketingContact } from '@/lib/marketingApi';
import { ContactDialog } from './ContactDialog';
import { ContactDetailDrawer } from './ContactDetailDrawer';

interface Props { isAdmin: boolean }

export function ContactsTab({ isAdmin }: Props) {
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingContact | null>(null);
  const [detail, setDetail] = useState<MarketingContact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reload = async () => setContacts(await listContacts());
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c =>
      !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
        || (c.phone ?? '').toLowerCase().includes(q) || (c.city ?? '').toLowerCase().includes(q)
        || c.contact_type.toLowerCase().includes(q));
  }, [contacts, search]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openRow = (c: MarketingContact) => { setDetail(c); setDrawerOpen(true); };
  const openEdit = (c: MarketingContact) => { setEditing(c); setDialogOpen(true); setDrawerOpen(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add new</Button>}
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Type</TableHead>
            <TableHead>Email / Phone</TableHead><TableHead>City</TableHead>
            <TableHead className="text-right">Files</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openRow(c)}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{c.contact_type}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.email ?? c.phone ?? '—'}</TableCell>
                <TableCell>{c.city ?? '—'}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{c.attachments?.length ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No contacts yet.</p>}
      </CardContent></Card>

      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} contact={editing} onSaved={reload} />
      <ContactDetailDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        contact={detail} onEdit={openEdit} onChanged={reload} isAdmin={isAdmin}
      />
    </div>
  );
}
