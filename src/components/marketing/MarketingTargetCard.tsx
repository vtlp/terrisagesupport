import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, type LucideIcon } from 'lucide-react';
import { EditableNumber } from './EditableNumber';
import type { MarketingTarget, TenancyTypeDb } from '@/lib/marketingApi';

interface Props {
  title: string;
  Icon: LucideIcon;
  accentClass: string;
  tenancy: TenancyTypeDb;
  target: MarketingTarget | null;
  liveCount: number;
  currentQuarterKey: 'q1' | 'q2' | 'q3' | 'q4';
  isAdmin: boolean;
  onSave: (tenancy: TenancyTypeDb, patch: Partial<Pick<MarketingTarget, 'q1' | 'q2' | 'q3' | 'q4' | 'total_target'>>) => Promise<void>;
}

export function MarketingTargetCard({
  title, Icon, accentClass, tenancy, target, liveCount, currentQuarterKey, isAdmin, onSave,
}: Props) {
  const q = (k: 'q1' | 'q2' | 'q3' | 'q4') => target?.[k] ?? 0;
  const totalT = target?.total_target ?? 0;
  const denom = q(currentQuarterKey);
  const pct = denom > 0 ? Math.min(100, (liveCount / denom) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accentClass}`} />{title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {(['q1', 'q2', 'q3', 'q4'] as const).map(qk => (
            <div key={qk} className="bg-muted rounded p-2">
              <p className="text-muted-foreground uppercase text-xs">{qk}</p>
              <p className="text-lg font-bold text-foreground">
                <EditableNumber
                  value={q(qk)}
                  disabled={!isAdmin}
                  onSave={(n) => onSave(tenancy, { [qk]: n } as never)}
                />
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Target:</span>
          <span className="font-semibold text-foreground">
            <EditableNumber value={totalT} disabled={!isAdmin} onSave={(n) => onSave(tenancy, { total_target: n })} />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp className={`h-4 w-4 ${accentClass}`} />
          <span className="text-sm text-muted-foreground">Current {currentQuarterKey.toUpperCase()} progress:</span>
          <span className="font-semibold text-foreground">{liveCount}/{denom}</span>
          <div className="flex-1 bg-muted rounded-full h-2 ml-2">
            <div className={`rounded-full h-2 transition-all ${accentClass.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
