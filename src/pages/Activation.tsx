import { useState } from 'react';
import { Search, Filter, AlertTriangle, CheckCircle2, Clock, Calendar } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { activationReviews, onboardingAccounts } from '@/data/onboardingData';
import { ACTIVATION_STATUS_LABELS, type ActivationStatus } from '@/types/onboarding';
import { format, isToday, isTomorrow, isThisWeek, isPast, addDays } from 'date-fns';

const activationColors: Record<ActivationStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  pass: 'bg-accent/20 text-accent-foreground',
  at_risk: 'bg-amber-100 text-amber-800',
  failed: 'bg-destructive/10 text-destructive',
};

export default function Activation() {
  const [activeTab, setActiveTab] = useState('due-24h');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const now = new Date();
  const tomorrow = addDays(now, 1);

  // Filter reviews by cadence
  const dueIn24h = activationReviews.filter(r => 
    r.scheduledDate && !r.completedDate && 
    (isToday(r.scheduledDate) || isTomorrow(r.scheduledDate))
  );
  
  const overdue = activationReviews.filter(r => 
    r.scheduledDate && !r.completedDate && isPast(r.scheduledDate) && !isToday(r.scheduledDate)
  );
  
  const thisWeek = activationReviews.filter(r => 
    r.scheduledDate && !r.completedDate && isThisWeek(r.scheduledDate) && !isToday(r.scheduledDate) && !isTomorrow(r.scheduledDate)
  );

  const getAccount = (accountId: string) => onboardingAccounts.find(a => a.id === accountId);

  const ReviewCard = ({ review }: { review: typeof activationReviews[0] }) => {
    const account = getAccount(review.accountId);
    if (!account) return null;

    return (
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-foreground">{account.name}</h3>
              <p className="text-sm text-muted-foreground">{account.city}</p>
            </div>
            <Badge variant="secondary" className={activationColors[review.status]}>
              {ACTIVATION_STATUS_LABELS[review.status]}
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{review.type === '48h' ? '48-Hour Check' : '7-Day Review'}</span>
            </div>
            {review.scheduledDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled</span>
                <span className={isPast(review.scheduledDate) && !isToday(review.scheduledDate) ? 'text-destructive font-medium' : ''}>
                  {format(review.scheduledDate, 'd MMM yyyy')}
                </span>
              </div>
            )}
            {review.notes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">{review.notes}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            {review.status === 'pending' ? (
              <>
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90">
                  Mark Pass
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  Flag At Risk
                </Button>
              </>
            ) : review.status === 'at_risk' ? (
              <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                Nudge and Unblock
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activation & Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          48-hour checks and 7-day reviews
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Due in 24h</div>
                <span className="text-xl font-bold">{dueIn24h.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border border-destructive/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div>
                <div className="text-xs text-muted-foreground">Overdue</div>
                <span className="text-xl font-bold text-destructive">{overdue.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">This Week</div>
                <span className="text-xl font-bold">{thisWeek.length}</span>
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
                <span className="text-xl font-bold">
                  {activationReviews.filter(r => r.completedDate).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Review Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="48h">48-Hour Check</SelectItem>
            <SelectItem value="7day">7-Day Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="due-24h" className="relative">
            Due in 24h
            {dueIn24h.length > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-1.5">
                {dueIn24h.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="relative">
            Overdue
            {overdue.length > 0 && (
              <span className="ml-2 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">
                {overdue.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="this-week">This Week</TabsTrigger>
        </TabsList>

        <TabsContent value="due-24h" className="mt-4">
          {dueIn24h.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dueIn24h.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">No reviews due in the next 24 hours</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          {overdue.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overdue.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">No overdue reviews</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="this-week" className="mt-4">
          {thisWeek.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {thisWeek.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No other reviews scheduled this week</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 48h Activation Checklist */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">48-Hour Activation Checklist</CardTitle>
          <CardDescription>Quick assessment for new accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs">1</div>
              <div className="flex-1">
                <p className="font-medium">Verification complete</p>
                <p className="text-sm text-muted-foreground">Aadhaar and RERA verified</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs">2</div>
              <div className="flex-1">
                <p className="font-medium">Import completed</p>
                <p className="text-sm text-muted-foreground">Minimum rows imported with acceptable Fix-It count</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs">3</div>
              <div className="flex-1">
                <p className="font-medium">First action taken</p>
                <p className="text-sm text-muted-foreground">User has performed at least one meaningful action</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs">4</div>
              <div className="flex-1">
                <p className="font-medium">No critical blockers</p>
                <p className="text-sm text-muted-foreground">Account not stalled or blocked</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button className="flex-1 bg-primary hover:bg-primary/90">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Pass
            </Button>
            <Button variant="outline" className="flex-1">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Flag At Risk
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
