import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ReactNode } from 'react';

interface Section {
  title: string;
  rows: { label: string; value: ReactNode }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  badge?: { label: string; variant?: 'default' | 'secondary' | 'outline' | 'destructive' };
  sections: Section[];
  notes?: string | null;
  footer?: ReactNode;
}

/** Ticket-style structured detail drawer for marketing entities. */
export function DetailDrawer({ open, onOpenChange, title, subtitle, badge, sections, notes, footer }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border bg-muted/30">
          <SheetHeader className="space-y-2 text-left">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg leading-tight">{title}</SheetTitle>
              {badge && <Badge variant={badge.variant ?? 'secondary'}>{badge.label}</Badge>}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </SheetHeader>
        </div>

        <div className="px-6 py-4 space-y-5">
          {sections.map((s) => (
            <section key={s.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{s.title}</p>
              <div className="rounded-md border border-border divide-y divide-border bg-card">
                {s.rows.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{r.label}</span>
                    <span className="text-foreground text-right break-words min-w-0">{r.value || <span className="text-muted-foreground">—</span>}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {notes !== undefined && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notes</p>
              <div className="rounded-md border border-border bg-card p-3 text-sm whitespace-pre-wrap min-h-[60px]">
                {notes ? notes : <span className="text-muted-foreground">No notes added.</span>}
              </div>
            </section>
          )}

          {footer && <div className="pt-2 border-t border-border">{footer}</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
