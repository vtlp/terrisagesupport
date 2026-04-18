import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Users, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

type Status = 'LIVE' | 'ONBOARDING_IN_PROGRESS' | 'STALLED_ONBOARDING' | 'DEACTIVATED';
type Tenancy = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';

interface AccountRow {
  id: string; account_name: string; city: string | null;
  tenancy_type: Tenancy; status: Status;
  owner_name: string | null; owner_phone: string | null;
  seat_count: number;
}

const statusColors: Record<Status, string> = {
  LIVE: 'bg-success/15 text-success',
  ONBOARDING_IN_PROGRESS: 'bg-primary/15 text-primary',
  STALLED_ONBOARDING: 'bg-destructive/15 text-destructive',
  DEACTIVATED: 'bg-muted text-muted-foreground',
};
const statusLabels: Record<Status, string> = {
  LIVE: 'Live',
  ONBOARDING_IN_PROGRESS: 'Onboarding',
  STALLED_ONBOARDING: 'Stalled',
  DEACTIVATED: 'Deactivated',
};
const tenancyLabels: Record<Tenancy, string> = {
  AGENCY_BROKERAGE_CONSULTANCY: 'Agency',
  BUILDER_DEVELOPER: 'Builder',
};

export default function Accounts() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenancyFilter, setTenancyFilter] = useState<string>('all');
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s === 'STALLED_ONBOARDING') setStatusFilter('STALLED_ONBOARDING');
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // Auto-mark accounts stuck in onboarding >7 days as stalled
      await (supabase.rpc as unknown as (fn: string) => Promise<unknown>)('mark_stalled_accounts');
      const [{ data: accs }, { data: seats }] = await Promise.all([
        supabase.from('accounts').select('id, account_name, city, tenancy_type, status, owner_name, owner_phone').order('created_at', { ascending: false }),
        supabase.from('account_seats').select('account_id, is_active'),
      ]);
      if (!active) return;
      const seatCounts: Record<string, number> = {};
      (seats ?? []).forEach(s => {
        if (s.is_active) seatCounts[s.account_id] = (seatCounts[s.account_id] ?? 0) + 1;
      });
      setRows((accs ?? []).map(a => ({ ...a, seat_count: seatCounts[a.id] ?? 0 } as AccountRow)));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = rows.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.account_name.toLowerCase().includes(q) || (a.owner_phone ?? '').includes(search);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchTenancy = tenancyFilter === 'all' || a.tenancy_type === tenancyFilter;
    return matchSearch && matchStatus && matchTenancy;
  });

  const buckets = [
    { label: 'All', value: rows.length },
    { label: 'Live', value: rows.filter(a => a.status === 'LIVE').length, color: 'text-success' },
    { label: 'Onboarding', value: rows.filter(a => a.status === 'ONBOARDING_IN_PROGRESS').length },
    { label: 'Stalled', value: rows.filter(a => a.status === 'STALLED_ONBOARDING').length, color: 'text-destructive' },
    { label: 'Deactivated', value: rows.filter(a => a.status === 'DEACTIVATED').length, color: 'text-muted-foreground' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage accounts and onboarding</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {buckets.map(b => (
          <Card key={b.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-xl font-bold ${b.color ?? ''}`}>{b.value}</div>
              <div className="text-xs text-muted-foreground">{b.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search account name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(statusLabels) as Status[]).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tenancyFilter} onValueChange={setTenancyFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="AGENCY_BROKERAGE_CONSULTANCY">Agency</SelectItem>
            <SelectItem value="BUILDER_DEVELOPER">Builder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No accounts yet. Convert an approved enquiry to create one.</TableCell></TableRow>
                  ) : filtered.map(a => (
                    <TableRow key={a.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link to={`/accounts/${a.id}`} className="font-medium hover:text-primary">{a.account_name}</Link>
                      </TableCell>
                      <TableCell>{a.city ?? '—'}</TableCell>
                      <TableCell>{tenancyLabels[a.tenancy_type]}</TableCell>
                      <TableCell className="text-sm">{a.owner_name ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{a.seat_count}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map(a => (
              <Link key={a.id} to={`/accounts/${a.id}`}>
                <Card className="mb-3">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium">{a.account_name}</div>
                      <Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.city ?? '—'} • {tenancyLabels[a.tenancy_type]} • {a.owner_name ?? '—'}
                      <span className="ml-1">• <Users className="inline h-3 w-3" /> {a.seat_count}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
