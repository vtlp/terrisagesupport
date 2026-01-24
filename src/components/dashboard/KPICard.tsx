import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
}

export function KPICard({
  label,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  onClick,
}: KPICardProps) {
  return (
    <div
      className={cn(
        'kpi-card group',
        onClick && 'cursor-pointer hover:border-primary/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="kpi-card-label">{label}</p>
          <p
            className={cn(
              'kpi-card-value',
              variant === 'warning' && 'text-warning',
              variant === 'danger' && 'text-destructive'
            )}
          >
            {value}
          </p>
        </div>
        {Icon && (
          <div
            className={cn(
              'p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors',
              variant === 'warning' && 'bg-warning/10',
              variant === 'danger' && 'bg-destructive/10'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5 text-muted-foreground group-hover:text-primary',
                variant === 'warning' && 'text-warning',
                variant === 'danger' && 'text-destructive'
              )}
            />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium',
              trend.positive ? 'text-success' : 'text-destructive'
            )}
          >
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted-foreground">vs yesterday</span>
        </div>
      )}
    </div>
  );
}
