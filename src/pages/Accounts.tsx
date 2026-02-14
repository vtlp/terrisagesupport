import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { seedAccounts, getNextUpcomingEvent, seedNotes } from '@/data/seedData';
import { AccountStatus, TenancyType, EntityType } from '@/types/core';
import { format } from 'date-fns';

const statusColors: Record<AccountStatus, string> = {
  [AccountStatus.LIVE]: 'bg-success/15 text-success',
  [AccountStatus.ONBOARDING_IN_PROGRESS]: 'bg-primary/15 text-primary',
  [AccountStatus.STALLED_ONBOARDING]: 'bg-destructive/15 text-destructive',
  [AccountStatus.DEACTIVATED]: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<AccountStatus, string> = {
  [AccountStatus.LIVE]: 'Live',
  [AccountStatus.ONBOARDING_IN_PROGRESS]: 'Onboarding',
  [AccountStatus.STALLED_ONBOARDING]: 'Stalled',
  [AccountStatus.DEACTIVATED]: 'Deactivated',
};

const tenancyLabels: Record<TenancyType, string> = {
  [TenancyType.AGENCY_BROKERAGE_CONSULTANCY]: 'Agency',
  [TenancyType.BUILDER_DEVELOPER]: 'Builder',
};

export default function Accounts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenancyFilter, setTenancyFilter] = useState<string>('all');

  const filtered = seedAccounts.filter(a => {
    const matchSearch = a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      a.owner_phone.includes(search);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchTenancy = tenancyFilter === 'all' || a.tenancy_type === tenancyFilter;
    return matchSearch && matchStatus && matchTenancy;
  });

  const buckets = [
    { label: 'All', value: seedAccounts.length },
    { label: 'Live', value: seedAccounts.filter(a => a.status === AccountStatus.LIVE).length, color: 'text-success' },
    { label: 'Onboarding', value: seedAccounts.filter(a => a.status === AccountStatus.ONBOARDING_IN_PROGRESS).length },
    { label: 'Deactivated', value: seedAccounts.filter(a => a.status === AccountStatus.DEACTIVATED).length, color: 'text-muted-foreground' },
    { label: 'Stalled', value: seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length, color: 'text-destructive' },
  ];

  const getNotesPreview = (noteIds: string[]) => {
    const notes = seedNotes.filter(n => noteIds.includes(n.note_id));
    if (!notes.length) return '—';
    const last = notes[notes.length - 1].note_text;
    return last.slice(0, 60) + (last.length > 60 ? '...' : '');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage accounts and onboarding</p>
      </div>

      {/* Buckets */}
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search account name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(AccountStatus).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tenancyFilter} onValueChange={setTenancyFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={TenancyType.AGENCY_BROKERAGE_CONSULTANCY}>Agency</SelectItem>
            <SelectItem value={TenancyType.BUILDER_DEVELOPER}>Builder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Action</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => {
                const nextEvent = getNextUpcomingEvent(EntityType.ACCOUNT, a.account_id);
                return (
                  <TableRow key={a.account_id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link to={`/accounts/${a.account_id}`} className="font-medium hover:text-primary transition-colors">{a.account_name}</Link>
                    </TableCell>
                    <TableCell>{a.city}</TableCell>
                    <TableCell>{tenancyLabels[a.tenancy_type]}</TableCell>
                    <TableCell className="text-sm">{a.owner_name}</TableCell>
                    <TableCell><Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {nextEvent ? (
                        <div>
                          <div className="text-xs">{nextEvent.title}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(nextEvent.scheduled_at), 'dd MMM')}</div>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{getNotesPreview(a.notes_thread)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(a => (
          <Link key={a.account_id} to={`/accounts/${a.account_id}`}>
            <Card className="mb-3">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium">{a.account_name}</div>
                  <Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{a.city} • {tenancyLabels[a.tenancy_type]} • {a.owner_name}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
