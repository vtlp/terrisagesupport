import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SLATimerProps {
  deadline: Date;
  label?: string;
  className?: string;
}

export function SLATimer({ deadline, label, className }: SLATimerProps) {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const isBreached = diff < 0;
  const isWarning = diff > 0 && diff < 30 * 60 * 1000; // 30 minutes
  
  const formatTime = (ms: number) => {
    const absMs = Math.abs(ms);
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div
      className={cn(
        'sla-timer',
        isBreached && 'sla-timer-breach',
        isWarning && 'sla-timer-warning',
        !isBreached && !isWarning && 'sla-timer-ok',
        className
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>
        {label && <span className="text-muted-foreground mr-1">{label}:</span>}
        {isBreached ? '-' : ''}
        {formatTime(diff)}
      </span>
    </div>
  );
}
