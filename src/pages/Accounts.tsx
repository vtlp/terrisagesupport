import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, CheckCircle2, AlertTriangle, Clock, Play, Calendar, FileUp } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { onboardingAccounts } from '@/data/onboardingData';
import { toast } from 'sonner';
import { 
  COHORT_LABELS, 
  ONBOARDING_STATUS_LABELS, 
  ACTIVATION_STATUS_LABELS,
  type OnboardingStatus,
  type ActivationStatus,
} from '@/types/onboarding';
import { format } from 'date-fns';

const statusColors: Record<OnboardingStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-accent/20 text-primary',
  stalled: 'bg-destructive/10 text-destructive',
};

const activationColors: Record<ActivationStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  pass: 'bg-accent/20 text-primary',
  at_risk: 'bg-amber-100 text-amber-800',
  failed: 'bg-destructive/10 text-destructive',
};

export default function Accounts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewAccount, setShowNewAccount] = useState(false);

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

  const handleStartOnboarding = (accountId: string, accountName: string) => {
    toast.success('Onboarding started', {
      description: `Checklist assigned to ${accountName}`,
    });
  };

  const handleStartImport = (accountId: string, accountName: string) => {
    toast.success('Import started', {
      description: `Import flow initiated for ${accountName}`,
    });
  };

  const handleScheduleDemo = (accountId: string, accountName: string) => {
    toast.success('Demo scheduled', {
      description: `Calendar invite queued for ${accountName}`,
    });
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
        <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>
            </DialogHeader>
            <NewAccountForm onSuccess={() => { 
              setShowNewAccount(false); 
              toast.success('Account created', { description: 'Ready for onboarding' }); 
            }} />
          </DialogContent>
        </Dialog>
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
              <CheckCircle2 className="h-5 w-5 text-primary" />
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

      {/* Accounts Table - Desktop */}
      <Card className="border-border hidden md:block">
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
                  <TableHead className="font-medium text-right">Actions</TableHead>
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
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {account.onboardingStatus === 'not_started' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleStartOnboarding(account.id, account.name)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleStartImport(account.id, account.name)}
                        >
                          <FileUp className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleScheduleDemo(account.id, account.name)}
                        >
                          <Calendar className="h-3 w-3" />
                        </Button>
                      </div>
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
                <Badge variant="secondary" className={statusColors[account.onboardingStatus]}>
                  {ONBOARDING_STATUS_LABELS[account.onboardingStatus]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
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
              <div className="flex gap-2">
                {account.onboardingStatus === 'not_started' && (
                  <Button 
                    size="sm" 
                    className="flex-1 bg-primary"
                    onClick={() => handleStartOnboarding(account.id, account.name)}
                  >
                    Start Onboarding
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleStartImport(account.id, account.name)}
                >
                  <FileUp className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleScheduleDemo(account.id, account.name)}
                >
                  <Calendar className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewAccountForm({ onSuccess }: { onSuccess: () => void }) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Account Name</label>
        <Input placeholder="Company or agency name" required />
      </div>
      <div>
        <label className="text-sm font-medium">City</label>
        <Input placeholder="City" required />
      </div>
      <div>
        <label className="text-sm font-medium">Cohort</label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select cohort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="channel_partner">Channel Partner / Consultant</SelectItem>
            <SelectItem value="broker_agency">Broker / Agency</SelectItem>
            <SelectItem value="builder_venture">Builder / Venture</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Contact Name</label>
        <Input placeholder="Primary contact" required />
      </div>
      <div>
        <label className="text-sm font-medium">Contact Phone</label>
        <Input placeholder="+91 XXXXX XXXXX" required />
      </div>
      <Button type="submit" className="w-full bg-primary">
        Create Account
      </Button>
    </form>
  );
}
