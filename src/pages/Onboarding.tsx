import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Download, ExternalLink, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { onboardingAccounts, onboardingMetrics } from '@/data/onboardingData';
import { 
  COHORT_LABELS, 
  ONBOARDING_STATUS_LABELS, 
  ACTIVATION_STATUS_LABELS,
  BLOCKER_CATEGORY_LABELS,
  type OnboardingStatus,
  type ActivationStatus,
} from '@/types/onboarding';
import { format, differenceInHours, differenceInDays } from 'date-fns';

const statusColors: Record<OnboardingStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-accent/20 text-accent-foreground',
  stalled: 'bg-destructive/10 text-destructive',
};

const activationColors: Record<ActivationStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  pass: 'bg-accent/20 text-accent-foreground',
  at_risk: 'bg-amber-100 text-amber-800',
  failed: 'bg-destructive/10 text-destructive',
};

export default function Onboarding() {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [activationFilter, setActivationFilter] = useState<string>('all');

  const cities = [...new Set(onboardingAccounts.map(a => a.city))];

  const filteredAccounts = onboardingAccounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(search.toLowerCase());
    const matchesCity = cityFilter === 'all' || account.city === cityFilter;
    const matchesCohort = cohortFilter === 'all' || account.cohort === cohortFilter;
    const matchesActivation = activationFilter === 'all' || account.activation48h === activationFilter;
    return matchesSearch && matchesCity && matchesCohort && matchesActivation;
  });

  const computeHours = (start?: Date, end?: Date) => {
    if (!start || !end) return '—';
    return `${differenceInHours(end, start)}h`;
  };

  const computeDays = (date?: Date) => {
    if (!date) return '—';
    return `${differenceInDays(new Date(), date)}d`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Onboarding Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end visibility into account activation
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">In Progress</div>
            <span className="text-2xl font-bold">{onboardingMetrics.inProgress}</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">48h Pass</div>
            <span className="text-2xl font-bold text-primary">{onboardingMetrics.activation48hPass}</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">48h At Risk</div>
            <span className="text-2xl font-bold text-amber-600">{onboardingMetrics.activation48hAtRisk}</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">7-Day Pass</div>
            <span className="text-2xl font-bold text-primary">{onboardingMetrics.sevenDayPass}</span>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Overdue Actions</div>
            <span className="text-2xl font-bold text-destructive">{onboardingMetrics.overdueActions}</span>
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
        <Select value={activationFilter} onValueChange={setActivationFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="48h Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="pass">Pass</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tracker Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium min-w-[160px]">Account</TableHead>
                  <TableHead className="font-medium">City</TableHead>
                  <TableHead className="font-medium">Cohort</TableHead>
                  <TableHead className="font-medium">Owner</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium text-center">Aadhaar</TableHead>
                  <TableHead className="font-medium text-center">RERA</TableHead>
                  <TableHead className="font-medium">Rows</TableHead>
                  <TableHead className="font-medium">Fix-It</TableHead>
                  <TableHead className="font-medium">48h</TableHead>
                  <TableHead className="font-medium">7-Day</TableHead>
                  <TableHead className="font-medium">Blocker</TableHead>
                  <TableHead className="font-medium min-w-[140px]">Next Action</TableHead>
                  <TableHead className="font-medium">Import Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Link 
                        to={`/accounts/${account.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {account.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{account.city}</TableCell>
                    <TableCell>
                      <span className="text-xs">{COHORT_LABELS[account.cohort].split('/')[0].trim()}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {account.onboardingOwnerName?.split(' ')[0] || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${statusColors[account.onboardingStatus]} text-xs`}>
                        {ONBOARDING_STATUS_LABELS[account.onboardingStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {account.aadhaarVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {account.reraVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{account.rowsImported}</TableCell>
                    <TableCell>
                      {account.fixItQueueCount > 0 ? (
                        <span className="text-amber-600 font-medium">{account.fixItQueueCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${activationColors[account.activation48h]} text-xs`}>
                        {ACTIVATION_STATUS_LABELS[account.activation48h]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${activationColors[account.sevenDaySuccess]} text-xs`}>
                        {ACTIVATION_STATUS_LABELS[account.sevenDaySuccess]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.topBlockerCategory && account.topBlockerCategory !== 'none' ? (
                        <span className="text-xs text-destructive">
                          {BLOCKER_CATEGORY_LABELS[account.topBlockerCategory]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.nextSupportAction ? (
                        <div className="text-xs">
                          <span className="block truncate max-w-[120px]">{account.nextSupportAction}</span>
                          {account.nextSupportActionDate && (
                            <span className="text-muted-foreground">
                              {format(account.nextSupportActionDate, 'd MMM')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {computeHours(account.importStartedAt, account.importCompletedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
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
                <Badge variant="secondary" className={activationColors[account.activation48h]}>
                  48h: {ACTIVATION_STATUS_LABELS[account.activation48h]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">City:</span> {account.city}
                </div>
                <div>
                  <span className="text-muted-foreground">Rows:</span> {account.rowsImported}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Aadhaar:</span>
                  {account.aadhaarVerified ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Clock className="h-3 w-3" />}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">RERA:</span>
                  {account.reraVerified ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Clock className="h-3 w-3" />}
                </div>
              </div>
              {account.nextSupportAction && (
                <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                  <span className="text-muted-foreground">Next:</span> {account.nextSupportAction}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
