import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface GuidanceItem {
  term: string;
  description: string;
}

interface GuidanceCardProps {
  title: string;
  items: GuidanceItem[];
  defaultOpen?: boolean;
}

export function GuidanceCard({ title, items, defaultOpen = false }: GuidanceCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-muted/50 border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/80 transition-colors">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-3">
          {items.map((item) => (
            <div key={item.term}>
              <dt className="text-sm font-semibold text-foreground">{item.term}</dt>
              <dd className="text-sm text-muted-foreground mt-0.5">{item.description}</dd>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
