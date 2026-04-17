import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RepeatableCardProps {
  title: string;
  subtitle?: string;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function RepeatableCard({
  title, subtitle, index, onRemove, canRemove, children, defaultExpanded = true,
}: RepeatableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/30 border-b border-border">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-left flex-1">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {subtitle && <span className="text-sm text-muted-foreground">— {subtitle}</span>}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
        </button>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive ml-2 h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      {expanded && <div className="p-5 space-y-5">{children}</div>}
    </div>
  );
}

interface AddCardButtonProps {
  label: string;
  onClick: () => void;
}

export function AddCardButton({ label, onClick }: AddCardButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className="w-full border-dashed gap-2 text-muted-foreground hover:text-foreground">
      <Plus className="w-4 h-4" />
      {label}
    </Button>
  );
}
