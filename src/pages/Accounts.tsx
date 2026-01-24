import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Building2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { onboardingAccounts } from '@/data/onboardingData';
import { 
  COHORT_LABELS, 
  ONBOARDING_STATUS_LABELS, 
  ACTIVATION_STATUS_LABELS,
  type OnboardingStatus,
  type ActivationStatus,
  type Cohort,
} from '@/types/onboarding';
import { format } from 'date-fns';

const statusColors: Record<OnboardingStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-800',
  stalled: 'bg-destructive/10 text-destructive',
};

const activationColors: Record<ActivationStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  pass: 'bg-green-100 text-green-800',
  at_risk: 'bg-amber-100 text-amber-800',
  failed: 'bg-destructive/10 text-destructive',
};

export default function Accounts() {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const cities = [...new Set(onboardingAccounts.map(a => a.city))];

  const filteredAccounts = onboardingAccounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(search.toLowerCase()) ||
      account.city.toLowerCase().includes(search.toLowerCase());
    const matchesCity = cityFilter === 'all' || account.city === cityFilter;
    const matchesCohort = cohortFilter === 'all' || account.cohort === cohortFilter;
    const matchesStatus = statusFilter === 'all' || account.onboardingStatus === statusFilter;
    return matchesSearch && matchesCity && matchesCohort && matchesStatus;
  });

  const stats = {
    total: onboardingAccounts.length,
    inProgress: onboardingAccounts.filter(a => a.onboardingStatus === 'in_progress').length,
    atRisk: onboardingAccounts.filter(a => a.activation48h === 'at_risk').length,
    completed: onboardingAccounts.filter(a => a.onboardingStatus === 'completed').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage onboarding and account maintenance
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.inProgress}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{stats.atRisk}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.completed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map(city => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cohortFilter} onValueChange={setCohortFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cohort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cohorts</SelectItem>
            <SelectItem value="channel_partner">Channel Partner</SelectItem>
            <SelectItem value="broker_agency">Broker / Agency</SelectItem>
            <SelectItem value="builder_venture">Builder / Venture</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="stalled">Stalled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Accounts Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">Account</TableHead>
                  <TableHead className="font-medium">City</TableHead>
                  <TableHead className="font-medium">Cohort</TableHead>
                  <TableHead className="font-medium">Owner</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">48h Activation</TableHead>
                  <TableHead className="font-medium">Next Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Link 
                        to={`/accounts/${account.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {account.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{account.city}</TableCell>
                    <TableCell>
                      <span className="text-sm">{COHORT_LABELS[account.cohort]}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.onboardingOwnerName || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[account.onboardingStatus]}>
                        {ONBOARDING_STATUS_LABELS[account.onboardingStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={activationColors[account.activation48h]}>
                        {ACTIVATION_STATUS_LABELS[account.activation48h]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.nextSupportAction ? (
                        <div className="text-sm">
                          <span className="text-foreground">{account.nextSupportAction}</span>
                          {account.nextSupportActionDate && (
                            <span className="text-muted-foreground block text-xs">
                              {format(account.nextSupportActionDate, 'd MMM')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards (visible on small screens) */}
      <div className="md:hidden space-y-3">
        {filteredAccounts.map((account) => (
          <Card key={account.id} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <Link 
                  to={`/accounts/${account.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {account.name}
                </Link>
                <Badge variant="secondary" className={statusColors[account.onboardingStatus]}>
                  {ONBOARDING_STATUS_LABELS[account.onboardingStatus]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">City:</span>{' '}
                  <span>{account.city}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cohort:</span>{' '}
                  <span>{COHORT_LABELS[account.cohort].split('/')[0]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">48h:</span>{' '}
                  <Badge variant="secondary" className={`${activationColors[account.activation48h]} text-xs`}>
                    {ACTIVATION_STATUS_LABELS[account.activation48h]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Owner:</span>{' '}
                  <span>{account.onboardingOwnerName || '—'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
