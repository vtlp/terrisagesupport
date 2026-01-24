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
  Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { onboardingAccounts, onboardingMetrics, activationReviews, activityLog } from '@/data/onboardingData';
import { mockDashboardMetrics, mockTickets } from '@/data/mockData';
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
  const ticketMetrics = mockDashboardMetrics;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Onboarding operations at a glance
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Link to="/accounts">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{onboardingMetrics.totalAccounts}</div>
                  <div className="text-xs text-muted-foreground">Total Accounts</div>
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

        <Link to="/tickets">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Ticket className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{openTickets}</div>
                  <div className="text-xs text-muted-foreground">Open Tickets</div>
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
        <Link to="/onboarding">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Onboarding Tracker</p>
                <p className="text-xs text-muted-foreground">Full funnel view</p>
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
        <Link to="/activation">
          <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Reviews</p>
                <p className="text-xs text-muted-foreground">48h and 7-day checks</p>
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
    </div>
  );
}
