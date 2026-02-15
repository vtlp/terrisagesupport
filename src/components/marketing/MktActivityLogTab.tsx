import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { seedMktActivityLog, getCampaignName } from '@/data/marketingSeedData';
import { getUserName } from '@/data/seedData';
import { MktActivityType } from '@/types/marketing';
import {
  PlusCircle, RefreshCw, Link2, DollarSign, Pencil,
  Globe, FileText, Calendar,
} from 'lucide-react';

const typeConfig: Record<MktActivityType, { icon: React.ElementType; color: string; label: string }> = {
  CAMPAIGN_CREATED: { icon: PlusCircle, color: 'bg-success', label: 'Campaign Created' },
  CAMPAIGN_UPDATED: { icon: RefreshCw, color: 'bg-info', label: 'Campaign Updated' },
  UTM_GENERATED: { icon: Link2, color: 'bg-primary', label: 'UTM Generated' },
  BUDGET_CHANGED: { icon: DollarSign, color: 'bg-warning', label: 'Budget Changed' },
  COST_ADDED: { icon: DollarSign, color: 'bg-accent', label: 'Cost Added' },
  COST_EDITED: { icon: Pencil, color: 'bg-info', label: 'Cost Edited' },
  OFFLINE_LOGGED: { icon: Globe, color: 'bg-warning', label: 'Offline Logged' },
  CREATIVE_UPDATED: { icon: FileText, color: 'bg-primary', label: 'Creative Updated' },
  CONTENT_SCHEDULED: { icon: Calendar, color: 'bg-success', label: 'Content Scheduled' },
};

export default function MktActivityLogTab() {
  const sorted = [...seedMktActivityLog].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Activity Timeline</h3>
      <Card>
        <CardContent className="p-5">
          <div className="space-y-0">
            {sorted.map((log, i) => {
              const cfg = typeConfig[log.type];
              const Icon = cfg.icon;
              return (
                <div key={log.id} className="timeline-item">
                  <div className={`timeline-dot ${cfg.color}`} />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          <Icon className="h-2.5 w-2.5 mr-1" />{cfg.label}
                        </Badge>
                        {log.linked_campaign_id && (
                          <span className="text-[10px] text-muted-foreground">
                            {getCampaignName(log.linked_campaign_id)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{log.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getUserName(log.user_id)}
                        {log.city && ` · ${log.city}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(log.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <p className="text-center text-muted-foreground py-12">No activity logged yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
