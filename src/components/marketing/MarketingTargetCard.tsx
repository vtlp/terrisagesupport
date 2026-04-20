import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  /** Achieved count per quarter for the current year. */
  quarterlyAchieved: Record<'q1' | 'q2' | 'q3' | 'q4', number>;
  currentQuarterKey: 'q1' | 'q2' | 'q3' | 'q4';
  isAdmin: boolean;
  onSave: (tenancy: TenancyTypeDb, patch: Partial<Pick<MarketingTarget, 'q1' | 'q2' | 'q3' | 'q4' | 'total_target'>>) => Promise<void>;
}

export function MarketingTargetCard({
  title, Icon, accentClass, tenancy, target, liveCount, quarterlyAchieved, currentQuarterKey, isAdmin, onSave,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const q = (k: 'q1' | 'q2' | 'q3' | 'q4') => target?.[k] ?? 0;
  const totalT = q('q1') + q('q2') + q('q3') + q('q4');
  const denom = q(currentQuarterKey);
  const pct = denom > 0 ? Math.min(100, (liveCount / denom) * 100) : 0;
  const quarters: Array<'q1' | 'q2' | 'q3' | 'q4'> = ['q1', 'q2', 'q3', 'q4'];
  const currentIdx = quarters.indexOf(currentQuarterKey);

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailOpen(true)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`h-4 w-4 ${accentClass}`} />{title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 text-center text-sm" onClick={(e) => e.stopPropagation()}>
            {quarters.map(qk => (
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
            <span className="font-semibold text-foreground">{totalT}</span>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${accentClass}`} />{title} — Quarter Performance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {quarters.map((qk, idx) => {
              const tgt = q(qk);
              const ach = quarterlyAchieved[qk] ?? 0;
              const p = tgt > 0 ? Math.min(100, (ach / tgt) * 100) : 0;
              const isPast = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const labelTag = isPast ? 'Past' : isCurrent ? 'Current' : 'Upcoming';
              return (
                <div key={qk} className="rounded-md border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground uppercase">{qk}</span>
                      <span className="text-xs text-muted-foreground">{labelTag}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{ach} / {tgt}</span>
                  </div>
                  <div className="bg-muted rounded-full h-2">
                    <div
                      className={`rounded-full h-2 transition-all ${accentClass.replace('text-', 'bg-')}`}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{tgt > 0 ? `${p.toFixed(1)}% achieved` : 'No target set'}</p>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Year Total</span>
              <span className="font-semibold text-foreground">
                {(quarterlyAchieved.q1 + quarterlyAchieved.q2 + quarterlyAchieved.q3 + quarterlyAchieved.q4)} / {totalT}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
