import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  CheckCircle,
  FolderOpen,
  UserX,
  AlertTriangle,
  AlertCircle,
  Clock,
  Timer,
  Plus,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/dashboard/KPICard';
import { QueueStatsTable } from '@/components/dashboard/QueueStatsTable';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TicketRow } from '@/components/tickets/TicketRow';
import {
  mockDashboardMetrics,
  mockQueueStats,
  mockTickets,
  mockAuditLog,
} from '@/data/mockData';

export default function Dashboard() {
  const navigate = useNavigate();
  const metrics = mockDashboardMetrics;
  
  // Sort tickets by SLA risk
  const priorityQueue = [...mockTickets]
    .filter((t) => t.status !== 'resolved' && t.status !== 'closed')
    .sort((a, b) => a.slaResolution.getTime() - b.slaResolution.getTime())
    .slice(0, 5);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Dashboard</h1>
          <p className="text-muted-foreground">
            Operational overview for today
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
          <Button
            onClick={() => navigate('/tickets/new')}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <KPICard
          label="Enquiries today"
          value={metrics.enquiriesToday}
          icon={Inbox}
          onClick={() => navigate('/tickets?created=today')}
        />
        <KPICard
          label="Solved today"
          value={metrics.solvedToday}
          icon={CheckCircle}
          onClick={() => navigate('/tickets?resolved=today')}
        />
        <KPICard
          label="Open now"
          value={metrics.openNow}
          icon={FolderOpen}
          onClick={() => navigate('/tickets?status=open')}
        />
        <KPICard
          label="Unassigned"
          value={metrics.unassigned}
          icon={UserX}
          variant="warning"
          onClick={() => navigate('/tickets/unassigned')}
        />
        <KPICard
          label="Breaching soon"
          value={metrics.breachingSoon}
          icon={AlertTriangle}
          variant="warning"
          onClick={() => navigate('/tickets/breaching-soon')}
        />
        <KPICard
          label="Breached today"
          value={metrics.breachedToday}
          icon={AlertCircle}
          variant="danger"
          onClick={() => navigate('/tickets/breached-today')}
        />
        <KPICard
          label="Avg 1st response"
          value={formatDuration(metrics.avgFirstResponseMinutes)}
          icon={Clock}
        />
        <KPICard
          label="Avg resolution"
          value={formatDuration(metrics.avgResolveMinutes)}
          icon={Timer}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Priority Queue */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-secondary">Priority Queue</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/tickets')}
              className="text-primary hover:text-primary/80"
            >
              View all
            </Button>
          </div>
          <div className="divide-y divide-border">
            {priorityQueue.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              />
            ))}
          </div>
        </div>

        {/* Queue Stats */}
        <div className="space-y-6">
          <QueueStatsTable
            stats={mockQueueStats}
            onQueueClick={(queueId) => navigate(`/tickets?queue=${queueId}`)}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity
        entries={mockAuditLog}
        onEntryClick={(entry) => navigate(`/tickets/${entry.entityId}`)}
      />
    </div>
  );
}
