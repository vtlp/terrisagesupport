import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { onboardingAccounts, accountChecklists, activityLog, integrationConfigs, importJobs } from '@/data/onboardingData';
import { 
  COHORT_LABELS, 
  ONBOARDING_STATUS_LABELS, 
  ACTIVATION_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type TaskStatus,
  type OnboardingStatus,
  type ActivationStatus,
} from '@/types/onboarding';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

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

const taskStatusColors: Record<TaskStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800',
  blocked: 'bg-destructive/10 text-destructive',
  done: 'bg-green-100 text-green-800',
  not_applicable: 'bg-muted text-muted-foreground',
};

export default function AccountDetail() {
  const { accountId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  
  const account = onboardingAccounts.find(a => a.id === accountId);
  const checklist = accountChecklists.find(c => c.accountId === accountId);
  const activities = activityLog.filter(a => a.accountId === accountId);
  const integrations = integrationConfigs.filter(i => i.accountId === accountId);
  const imports = importJobs.filter(i => i.accountId === accountId);

  if (!account) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Account not found</p>
        <Link to="/accounts" className="text-primary hover:underline mt-2 inline-block">
          Back to accounts
        </Link>
      </div>
    );
  }

  const copyId = () => {
    navigator.clipboard.writeText(account.id);
    toast({ description: 'Account ID copied to clipboard' });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/accounts">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">{account.name}</h1>
            <Badge variant="secondary" className={statusColors[account.onboardingStatus]}>
              {ONBOARDING_STATUS_LABELS[account.onboardingStatus]}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>{account.city}</span>
            <span>•</span>
            <span>{COHORT_LABELS[account.cohort]}</span>
            <Button variant="ghost" size="sm" onClick={copyId} className="h-6 px-2">
              <Copy className="h-3 w-3 mr-1" />
              Copy ID
            </Button>
          </div>
        </div>
      </div>

      {/* Status Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Aadhaar</div>
            <div className="flex items-center gap-1">
              {account.aadhaarVerified ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {account.aadhaarVerified ? 'Verified' : 'Pending'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">RERA</div>
            <div className="flex items-center gap-1">
              {account.reraVerified ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {account.reraVerified ? 'Verified' : 'Pending'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">48h Activation</div>
            <Badge variant="secondary" className={activationColors[account.activation48h]}>
              {ACTIVATION_STATUS_LABELS[account.activation48h]}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">7-Day Success</div>
            <Badge variant="secondary" className={activationColors[account.sevenDaySuccess]}>
              {ACTIVATION_STATUS_LABELS[account.sevenDaySuccess]}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Rows Imported</div>
            <span className="text-lg font-semibold">{account.rowsImported}</span>
            {account.fixItQueueCount > 0 && (
              <span className="text-xs text-amber-600 ml-2">
                {account.fixItQueueCount} in Fix-It
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Key Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Onboarding Owner</span>
                  <span className="font-medium">{account.onboardingOwnerName || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Import Type</span>
                  <span className="font-medium capitalize">{account.importType || 'Not started'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{format(account.createdAt, 'd MMM yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">{format(account.updatedAt, 'd MMM yyyy, HH:mm')}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Next Support Action</CardTitle>
              </CardHeader>
              <CardContent>
                {account.nextSupportAction ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="font-medium text-foreground">{account.nextSupportAction}</p>
                      {account.nextSupportActionDate && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Due: {format(account.nextSupportActionDate, 'd MMM yyyy')}
                        </p>
                      )}
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary/90">
                      Mark as Complete
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No pending actions</p>
                )}
              </CardContent>
            </Card>
          </div>

          {account.notes && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{account.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Onboarding Checklist</CardTitle>
              <CardDescription>
                {COHORT_LABELS[account.cohort]} checklist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checklist ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead className="w-24">Owner</TableHead>
                        <TableHead className="w-24">When</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead>Support Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checklist.tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.taskNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{task.task}</p>
                              <p className="text-xs text-muted-foreground mt-1">{task.evidence}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {task.owner === 'user' ? 'User' : 'Internal'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {task.when === 'session' ? 'Session' : '48h'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select defaultValue={task.status}>
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                                <SelectItem value="not_applicable">N/A</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.supportAction}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No checklist assigned yet</p>
                  <Button variant="outline">Assign Checklist</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Verification Status</CardTitle>
              <CardDescription>
                Only status and timestamps are stored. No personal data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Aadhaar</span>
                    {account.aadhaarVerified ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  {account.aadhaarVerifiedAt ? (
                    <p className="text-sm text-muted-foreground">
                      Verified on {format(account.aadhaarVerifiedAt, 'd MMM yyyy')}
                    </p>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      Guide Verification
                    </Button>
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">RERA</span>
                    {account.reraVerified ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  {account.reraVerifiedAt ? (
                    <p className="text-sm text-muted-foreground">
                      Verified on {format(account.reraVerifiedAt, 'd MMM yyyy')}
                    </p>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      Support Verification
                    </Button>
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">GSTIN</span>
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  </div>
                  {account.gstinVerified ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Verified on {format(account.gstinVerifiedAt!, 'd MMM yyyy')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not provided</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Imports Tab */}
        <TabsContent value="imports" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Import History</CardTitle>
            </CardHeader>
            <CardContent>
              {imports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Rows</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium capitalize">{job.type}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={
                            job.status === 'completed' ? 'bg-green-100 text-green-800' :
                            job.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                            job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-muted text-muted-foreground'
                          }>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.totalRows}</TableCell>
                        <TableCell>{job.processedRows}</TableCell>
                        <TableCell>
                          {job.errorRows > 0 ? (
                            <span className="text-destructive">{job.errorRows}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(job.startedAt, 'd MMM, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No imports yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Portal Integrations</CardTitle>
              <CardDescription>MagicBricks and 99acres inbound leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {integrations.length > 0 ? (
                integrations.map((integration) => (
                  <div key={integration.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{integration.type}</span>
                      <Badge variant="secondary" className={
                        integration.status === 'active' ? 'bg-green-100 text-green-800' :
                        integration.status === 'error' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }>
                        {integration.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {integration.lastSyncAt && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Last sync: {format(integration.lastSyncAt, 'd MMM, HH:mm')}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No integrations configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 pb-4 border-b last:border-0">
                      <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.details}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{activity.userName}</span>
                          <span>•</span>
                          <span>{format(activity.createdAt, 'd MMM yyyy, HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No activity recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
