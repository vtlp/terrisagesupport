import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar,
  ArrowRight,
  FileUp,
  Users,
  Ticket,
  Plus,
  Shield,
  Target,
  Briefcase,
  Settings,
  PhoneCall,
  TrendingUp,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { onboardingAccounts, onboardingMetrics, activationReviews, activityLog } from '@/data/onboardingData';
import { mockDashboardMetrics, mockTickets } from '@/data/mockData';
import { enquiryMetrics, demoMetrics } from '@/data/enquiryData';
import { 
  COHORT_LABELS,
  type OnboardingStatus,
  type ActivationStatus,
} from '@/types/onboarding';
import { format, isToday, isTomorrow } from 'date-fns';

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

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Get accounts requiring attention
  const atRiskAccounts = onboardingAccounts.filter(a => a.activation48h === 'at_risk');
  const stalledAccounts = onboardingAccounts.filter(a => a.onboardingStatus === 'stalled');
  const pendingReviews = activationReviews.filter(r => 
    r.scheduledDate && !r.completedDate && (isToday(r.scheduledDate) || isTomorrow(r.scheduledDate))
  );
  const recentActivity = activityLog.slice(0, 5);

  // Tickets data
  const openTickets = mockTickets.filter(t => t.status === 'open').length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Terrisage Support Operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/tickets/new?type=verification')}
            className="border-secondary text-secondary hover:bg-secondary/5"
          >
            <Shield className="h-4 w-4 mr-2" />
            Verification Ticket
          </Button>
          <Link to="/accounts">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </Link>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs defaultValue="operational" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
        </TabsList>

        {/* Business View */}
        <TabsContent value="business" className="space-y-6 mt-6">
          <Card className="border-border bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Why Onboarding Matters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Purpose</div>
                  <p className="text-sm">
                    Onboarding exists to drive <span className="font-semibold text-primary">adoption and retention</span>. 
                    Every account that activates successfully is a customer for life.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">North Star Metrics</div>
                  <div className="flex gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg flex-1">
                      <div className="text-2xl font-bold text-primary">48h</div>
                      <div className="text-xs text-muted-foreground">Activation Target</div>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg flex-1">
                      <div className="text-2xl font-bold text-primary">7-Day</div>
                      <div className="text-xs text-muted-foreground">Success Review</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Scaling Constraint</div>
                  <p className="text-sm">
                    <span className="font-semibold">Support discipline</span> is the scaling constraint. 
                    This UI must make discipline easy, not optional.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{onboardingMetrics.totalAccounts}</div>
                <div className="text-sm text-muted-foreground">Total Accounts</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">
                  {Math.round((onboardingMetrics.activation48hPass / (onboardingMetrics.activation48hPass + onboardingMetrics.activation48hAtRisk || 1)) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Activation Rate</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{onboardingMetrics.sevenDayPass}</div>
                <div className="text-sm text-muted-foreground">7-Day Success</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-foreground">{enquiryMetrics.converted}</div>
                <div className="text-sm text-muted-foreground">Converted</div>
              </CardContent>
            </Card>
          </div>

          {/* Funnel Summary */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Onboarding Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <div className="flex-shrink-0 p-3 bg-muted rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold">{enquiryMetrics.totalEnquiries}</div>
                  <div className="text-xs text-muted-foreground">Enquiries</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-shrink-0 p-3 bg-muted rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold">{enquiryMetrics.qualified}</div>
                  <div className="text-xs text-muted-foreground">Qualified</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-shrink-0 p-3 bg-muted rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold">{demoMetrics.completed}</div>
                  <div className="text-xs text-muted-foreground">Demos</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-shrink-0 p-3 bg-primary/10 rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold text-primary">{onboardingMetrics.totalAccounts}</div>
                  <div className="text-xs text-muted-foreground">Accounts</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-shrink-0 p-3 bg-accent/20 rounded-lg text-center min-w-[100px]">
                  <div className="text-lg font-bold text-primary">{onboardingMetrics.activation48hPass}</div>
                  <div className="text-xs text-muted-foreground">Activated</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operational View */}
        <TabsContent value="operational" className="space-y-6 mt-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Link to="/enquiries">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <PhoneCall className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{enquiryMetrics.totalEnquiries}</div>
                      <div className="text-xs text-muted-foreground">Enquiries</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/demos">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{demoMetrics.todayDemos}</div>
                      <div className="text-xs text-muted-foreground">Demos Today</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/onboarding">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{onboardingMetrics.inProgress}</div>
                      <div className="text-xs text-muted-foreground">In Progress</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/activation">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{onboardingMetrics.activation48hPass}</div>
                      <div className="text-xs text-muted-foreground">48h Pass</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/activation">
              <Card className="border-border border-amber-200 hover:border-amber-400 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-600">{onboardingMetrics.activation48hAtRisk}</div>
                      <div className="text-xs text-muted-foreground">At Risk</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/onboarding">
              <Card className="border-border border-destructive/30 hover:border-destructive/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-lg">
                      <Clock className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-destructive">{onboardingMetrics.overdueActions}</div>
                      <div className="text-xs text-muted-foreground">Overdue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Accounts Requiring Attention */}
            <Card className="border-border lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Accounts Requiring Attention</CardTitle>
                  <Link to="/onboarding">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {[...atRiskAccounts, ...stalledAccounts].length > 0 ? (
                  <div className="space-y-3">
                    {[...atRiskAccounts, ...stalledAccounts].slice(0, 5).map((account) => (
                      <Link 
                        key={account.id} 
                        to={`/accounts/${account.id}`}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${
                            account.activation48h === 'at_risk' ? 'bg-amber-500' : 'bg-destructive'
                          }`} />
                          <div>
                            <p className="font-medium text-foreground">{account.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {account.city} • {COHORT_LABELS[account.cohort].split('/')[0].trim()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {account.activation48h === 'at_risk' && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                              At Risk
                            </Badge>
                          )}
                          {account.onboardingStatus === 'stalled' && (
                            <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                              Stalled
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
                    <p className="text-muted-foreground">All accounts on track</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Due Today/Tomorrow */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Due Soon</CardTitle>
                  <Link to="/activation">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {pendingReviews.length > 0 ? (
                  <div className="space-y-3">
                    {pendingReviews.map((review) => {
                      const account = onboardingAccounts.find(a => a.id === review.accountId);
                      return (
                        <div 
                          key={review.id} 
                          className="p-3 border rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{account?.name}</span>
                            <Badge variant="secondary" className={activationColors[review.status]}>
                              {review.type === '48h' ? '48h' : '7-Day'}
                            </Badge>
                          </div>
                          {review.scheduledDate && (
                            <p className="text-xs text-muted-foreground">
                              {isToday(review.scheduledDate) ? 'Today' : 'Tomorrow'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No reviews due soon</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest support actions across all accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const account = onboardingAccounts.find(a => a.id === activity.accountId);
                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{activity.action}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <Link 
                            to={`/accounts/${activity.accountId}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {account?.name}
                          </Link>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{activity.details}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{activity.userName}</span>
                          <span>•</span>
                          <span>{format(activity.createdAt, 'd MMM, HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-4 gap-4">
            <Link to="/enquiries">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <PhoneCall className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Enquiries</p>
                    <p className="text-xs text-muted-foreground">Capture and convert</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/demos">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Demos</p>
                    <p className="text-xs text-muted-foreground">Schedule and manage</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/imports">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Import Health</p>
                    <p className="text-xs text-muted-foreground">Data quality status</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/support-actions">
              <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Support Actions</p>
                    <p className="text-xs text-muted-foreground">Templates and guides</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>

        {/* Technical View */}
        <TabsContent value="technical" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Platform Enablers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Bulk Import API</span>
                  <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Dedupe Service</span>
                  <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Import Audit Logs</span>
                  <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Event Tracking</span>
                  <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Adoption Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="p-2 bg-muted/50 rounded">
                  <div className="flex justify-between text-sm">
                    <span>first_login</span>
                    <span className="font-medium">142</span>
                  </div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="flex justify-between text-sm">
                    <span>first_lead_created</span>
                    <span className="font-medium">98</span>
                  </div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="flex justify-between text-sm">
                    <span>import_completed</span>
                    <span className="font-medium">67</span>
                  </div>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <div className="flex justify-between text-sm">
                    <span>activation_set</span>
                    <span className="font-medium">52</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/technical">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Tenant Defaults
                  </Button>
                </Link>
                <Link to="/playbooks">
                  <Button variant="outline" className="w-full justify-start">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Playbooks
                  </Button>
                </Link>
                <Link to="/technical">
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Pilot Metrics
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Default Enums */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Lead Source Enum</CardTitle>
              <CardDescription>Available lead sources for enquiry capture</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['Call', 'Website', 'Referral', 'Manual', 'Meta Ads', 'Google Ads', 'MagicBricks', '99acres', 'Walk-in'].map(source => (
                  <Badge key={source} variant="outline">{source}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
