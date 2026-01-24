import { useState } from 'react';
import { Calendar, Clock, Phone, Video, Users, Plus, CheckCircle2, XCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { mockDemos, demoMetrics, supportUsers } from '@/data/enquiryData';
import { SEGMENT_LABELS, DEMO_OUTCOME_LABELS } from '@/types/enquiry';
import type { Demo, DemoOutcome, DemoType } from '@/types/enquiry';
import { format, isToday, isTomorrow, addDays, startOfWeek, endOfWeek, isSameDay, startOfDay } from 'date-fns';

const demoTypeIcons: Record<DemoType, React.ReactNode> = {
  zoom: <Video className="h-4 w-4" />,
  google_meet: <Video className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
};

const outcomeColors: Record<DemoOutcome, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  no_show: 'bg-red-100 text-red-700',
  reschedule: 'bg-amber-100 text-amber-700',
  not_a_fit: 'bg-slate-100 text-slate-700',
};

export default function Demos() {
  const [view, setView] = useState<'agenda' | 'week'>('agenda');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [selectedDemo, setSelectedDemo] = useState<Demo | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const now = new Date();
  const upcomingDemos = mockDemos
    .filter(d => !d.outcome && new Date(d.scheduledDate) >= now)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const pastDemos = mockDemos
    .filter(d => d.outcome || new Date(d.scheduledDate) < now)
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  const todayDemos = upcomingDemos.filter(d => isToday(new Date(d.scheduledDate)));
  const tomorrowDemos = upcomingDemos.filter(d => isTomorrow(new Date(d.scheduledDate)));
  const thisWeekDemos = upcomingDemos.filter(d => {
    const demoDate = new Date(d.scheduledDate);
    return !isToday(demoDate) && !isTomorrow(demoDate) && demoDate <= endOfWeek(now);
  });
  const laterDemos = upcomingDemos.filter(d => new Date(d.scheduledDate) > endOfWeek(now));

  const filteredDemos = (demos: Demo[]) => {
    if (cohortFilter === 'all') return demos;
    return demos.filter(d => {
      if (cohortFilter === 'agency') return d.segment === 'agency' || d.segment === 'solo_agent';
      if (cohortFilter === 'builder') return d.segment === 'builder' || d.segment === 'venture_owner' || d.segment === 'builder_group';
      return d.segment === cohortFilter;
    });
  };

  const handleOutcome = (demo: Demo, outcome: DemoOutcome) => {
    toast.success(`Demo marked as ${DEMO_OUTCOME_LABELS[outcome]}`, {
      description: outcome === 'completed' ? 'Follow-up action created' : undefined,
    });
    setSelectedDemo(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Demos and Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule and manage product demonstrations
          </p>
        </div>
        <Dialog open={showBooking} onOpenChange={setShowBooking}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Demo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Demo</DialogTitle>
            </DialogHeader>
            <DemoBookingForm onSuccess={() => { setShowBooking(false); toast.success('Demo scheduled', { description: 'Calendar invite sent' }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{demoMetrics.totalScheduled}</div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{demoMetrics.todayDemos}</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{demoMetrics.thisWeek}</div>
            <div className="text-xs text-muted-foreground">This Week</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{demoMetrics.completed}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{demoMetrics.noShows}</div>
            <div className="text-xs text-muted-foreground">No Shows</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{demoMetrics.conversionRate}%</div>
            <div className="text-xs text-muted-foreground">Conversion Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as 'agenda' | 'week')}>
          <TabsList>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={cohortFilter} onValueChange={setCohortFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by cohort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cohorts</SelectItem>
            <SelectItem value="agency">Agencies and Brokers</SelectItem>
            <SelectItem value="builder">Builders</SelectItem>
            <SelectItem value="solo_agent">Solo Agents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agenda View */}
      {view === 'agenda' && (
        <div className="space-y-6">
          {/* Today */}
          {filteredDemos(todayDemos).length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Today
              </h2>
              <div className="space-y-3">
                {filteredDemos(todayDemos).map(demo => (
                  <DemoCard key={demo.id} demo={demo} onClick={() => setSelectedDemo(demo)} />
                ))}
              </div>
            </div>
          )}

          {/* Tomorrow */}
          {filteredDemos(tomorrowDemos).length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-3">Tomorrow</h2>
              <div className="space-y-3">
                {filteredDemos(tomorrowDemos).map(demo => (
                  <DemoCard key={demo.id} demo={demo} onClick={() => setSelectedDemo(demo)} />
                ))}
              </div>
            </div>
          )}

          {/* This Week */}
          {filteredDemos(thisWeekDemos).length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-3">This Week</h2>
              <div className="space-y-3">
                {filteredDemos(thisWeekDemos).map(demo => (
                  <DemoCard key={demo.id} demo={demo} onClick={() => setSelectedDemo(demo)} />
                ))}
              </div>
            </div>
          )}

          {/* Later */}
          {filteredDemos(laterDemos).length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-3 text-muted-foreground">Later</h2>
              <div className="space-y-3">
                {filteredDemos(laterDemos).map(demo => (
                  <DemoCard key={demo.id} demo={demo} onClick={() => setSelectedDemo(demo)} />
                ))}
              </div>
            </div>
          )}

          {upcomingDemos.length === 0 && (
            <Card className="border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                No upcoming demos scheduled
              </CardContent>
            </Card>
          )}

          {/* Past Demos */}
          <div>
            <h2 className="text-lg font-medium mb-3 text-muted-foreground">Past Demos</h2>
            <div className="space-y-3">
              {filteredDemos(pastDemos).slice(0, 5).map(demo => (
                <DemoCard key={demo.id} demo={demo} onClick={() => setSelectedDemo(demo)} isPast />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <WeekView demos={filteredDemos(mockDemos)} onDemoClick={setSelectedDemo} />
      )}

      {/* Demo Detail Dialog */}
      <Dialog open={!!selectedDemo} onOpenChange={() => setSelectedDemo(null)}>
        <DialogContent className="max-w-lg">
          {selectedDemo && (
            <DemoDetail 
              demo={selectedDemo} 
              onOutcome={(outcome) => handleOutcome(selectedDemo, outcome)}
              onClose={() => setSelectedDemo(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DemoCard({ demo, onClick, isPast }: { demo: Demo; onClick: () => void; isPast?: boolean }) {
  const demoDate = new Date(demo.scheduledDate);

  return (
    <Card 
      className={`border-border cursor-pointer hover:border-primary/50 transition-colors ${isPast ? 'opacity-75' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{demo.contactName}</span>
              {demo.accountName && (
                <Badge variant="outline" className="font-normal text-xs">
                  {demo.accountName}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              {demo.city} • {SEGMENT_LABELS[demo.segment]}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(demoDate, 'EEE, dd MMM')}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {format(demoDate, 'HH:mm')} ({demo.duration}m)
              </div>
              <div className="flex items-center gap-1">
                {demoTypeIcons[demo.type]}
                <span className="capitalize">{demo.type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {demo.outcome ? (
              <Badge className={outcomeColors[demo.outcome]}>
                {DEMO_OUTCOME_LABELS[demo.outcome]}
              </Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>
            )}
            <span className="text-xs text-muted-foreground">{demo.hostName}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeekView({ demos, onDemoClick }: { demos: Demo[]; onDemoClick: (demo: Demo) => void }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(day => {
        const dayDemos = demos.filter(d => isSameDay(new Date(d.scheduledDate), day));
        const isCurrentDay = isToday(day);

        return (
          <div key={day.toISOString()} className="min-h-[200px]">
            <div className={`text-center p-2 rounded-t-lg ${isCurrentDay ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <div className="text-xs font-medium">{format(day, 'EEE')}</div>
              <div className="text-lg font-bold">{format(day, 'd')}</div>
            </div>
            <div className="border border-t-0 rounded-b-lg p-1 space-y-1 min-h-[160px]">
              {dayDemos.map(demo => (
                <div 
                  key={demo.id}
                  className="p-2 bg-primary/10 rounded text-xs cursor-pointer hover:bg-primary/20"
                  onClick={() => onDemoClick(demo)}
                >
                  <div className="font-medium truncate">{demo.contactName}</div>
                  <div className="text-muted-foreground">{format(new Date(demo.scheduledDate), 'HH:mm')}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DemoDetail({ demo, onOutcome, onClose }: { demo: Demo; onOutcome: (outcome: DemoOutcome) => void; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>{demo.contactName}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Phone</div>
          <div>{demo.contactPhone}</div>
        </div>
        <div>
          <div className="text-muted-foreground">City</div>
          <div>{demo.city}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Date and Time</div>
          <div>{format(new Date(demo.scheduledDate), 'EEE, dd MMM yyyy HH:mm')}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Duration</div>
          <div>{demo.duration} minutes</div>
        </div>
        <div>
          <div className="text-muted-foreground">Type</div>
          <div className="capitalize flex items-center gap-1">
            {demoTypeIcons[demo.type]}
            {demo.type.replace('_', ' ')}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Host</div>
          <div>{demo.hostName}</div>
        </div>
      </div>

      {demo.meetingLink && (
        <div>
          <div className="text-sm text-muted-foreground mb-1">Meeting Link</div>
          <a href={demo.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
            {demo.meetingLink}
          </a>
        </div>
      )}

      <div>
        <div className="text-sm font-medium mb-2">Agenda</div>
        <ul className="space-y-1">
          {demo.agendaItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground">{i + 1}.</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {demo.outcome ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Outcome:</span>
            <Badge className={outcomeColors[demo.outcome]}>
              {DEMO_OUTCOME_LABELS[demo.outcome]}
            </Badge>
          </div>
          {demo.outcomeNotes && (
            <p className="text-sm text-muted-foreground">{demo.outcomeNotes}</p>
          )}
          {demo.nextSupportAction && (
            <div className="text-sm">
              <span className="text-muted-foreground">Next action: </span>
              {demo.nextSupportAction}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 pt-4 border-t">
          <div className="text-sm font-medium">Record Outcome</div>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onOutcome('completed')}
            >
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
              Completed
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onOutcome('no_show')}
            >
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              No Show
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onOutcome('reschedule')}
            >
              <RotateCcw className="h-4 w-4 mr-2 text-amber-600" />
              Reschedule
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onOutcome('not_a_fit')}
            >
              <AlertCircle className="h-4 w-4 mr-2 text-slate-600" />
              Not a Fit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoBookingForm({ onSuccess }: { onSuccess: () => void }) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Contact Name</label>
        <Input placeholder="Name" required />
      </div>
      <div>
        <label className="text-sm font-medium">Phone</label>
        <Input placeholder="+91 XXXXX XXXXX" required />
      </div>
      <div>
        <label className="text-sm font-medium">Segment</label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select segment" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Date</label>
        <Input type="date" required />
      </div>
      <div>
        <label className="text-sm font-medium">Time</label>
        <Input type="time" required />
      </div>
      <div>
        <label className="text-sm font-medium">Meeting Type</label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zoom">Zoom</SelectItem>
            <SelectItem value="google_meet">Google Meet</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1 bg-primary">
          Schedule Demo
        </Button>
        <Button type="button" variant="outline" onClick={() => toast.success('Agenda attached')}>
          Attach Agenda
        </Button>
      </div>
    </form>
  );
}
