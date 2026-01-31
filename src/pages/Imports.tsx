import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, Clock, RefreshCw, FileUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { importJobs, onboardingAccounts } from '@/data/onboardingData';
import { format } from 'date-fns';
import { StartImportDialog } from '@/components/imports/StartImportDialog';

export default function Imports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const filteredJobs = importJobs.filter(job => {
    const account = onboardingAccounts.find(a => a.id === job.accountId);
    const matchesSearch = account?.name.toLowerCase().includes(search.toLowerCase()) ?? false;
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesType = typeFilter === 'all' || job.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: importJobs.length,
    completed: importJobs.filter(j => j.status === 'completed').length,
    processing: importJobs.filter(j => j.status === 'processing').length,
    failed: importJobs.filter(j => j.status === 'failed').length,
    totalErrors: importJobs.reduce((sum, j) => sum + j.errorRows, 0),
  };

  const getAccount = (accountId: string) => onboardingAccounts.find(a => a.id === accountId);

  const statusColors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-accent/20 text-accent-foreground',
    failed: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Imports & Data Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track import jobs and data quality
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Start Import
          </Button>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <StartImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Total Jobs</div>
                <span className="text-xl font-bold">{stats.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Completed</div>
                <span className="text-xl font-bold text-primary">{stats.completed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-xs text-muted-foreground">Processing</div>
                <span className="text-xl font-bold text-blue-600">{stats.processing}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div>
                <div className="text-xs text-muted-foreground">Failed</div>
                <span className="text-xl font-bold text-destructive">{stats.failed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div>
                <div className="text-xs text-muted-foreground">Total Errors</div>
                <span className="text-xl font-bold text-amber-600">{stats.totalErrors}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="leads">Leads</SelectItem>
            <SelectItem value="listings">Listings</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="enquiries">Enquiries</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Import Jobs Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">Account</TableHead>
                  <TableHead className="font-medium">Type</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Progress</TableHead>
                  <TableHead className="font-medium">Total</TableHead>
                  <TableHead className="font-medium">Processed</TableHead>
                  <TableHead className="font-medium">Errors</TableHead>
                  <TableHead className="font-medium">Duplicates</TableHead>
                  <TableHead className="font-medium">Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => {
                  const account = getAccount(job.accountId);
                  const progress = job.totalRows > 0 ? (job.processedRows / job.totalRows) * 100 : 0;
                  
                  return (
                    <TableRow key={job.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {account?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="capitalize">{job.type}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[job.status]}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10">
                            {Math.round(progress)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{job.totalRows}</TableCell>
                      <TableCell>{job.processedRows}</TableCell>
                      <TableCell>
                        {job.errorRows > 0 ? (
                          <span className="text-destructive font-medium">{job.errorRows}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.duplicateRows > 0 ? (
                          <span className="text-amber-600">{job.duplicateRows}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(job.startedAt, 'd MMM, HH:mm')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Data Health Tips */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Data Health Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 border rounded-lg">
              <p className="font-medium mb-1">Fix-It Queue Management</p>
              <p className="text-muted-foreground">
                Keep Fix-It count below 10% of total imports. High counts indicate mapping issues.
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="font-medium mb-1">Duplicate Detection</p>
              <p className="text-muted-foreground">
                Duplicates are auto-flagged. Review and merge to maintain data integrity.
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="font-medium mb-1">Required Fields</p>
              <p className="text-muted-foreground">
                Leads: name, phone. Listings: locality, price. Inventory: unit ID, project.
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="font-medium mb-1">Retry Failed Imports</p>
              <p className="text-muted-foreground">
                Failed imports can be retried after fixing source data issues.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
