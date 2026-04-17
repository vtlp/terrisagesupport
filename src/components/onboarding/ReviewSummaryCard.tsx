import { Edit3, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewField {
  label: string;
  value: string | undefined;
  required?: boolean;
}

interface ReviewSummaryCardProps {
  title: string;
  fields: ReviewField[];
  onEdit: () => void;
}

export function ReviewSummaryCard({ title, fields, onEdit }: ReviewSummaryCardProps) {
  const hasMissing = fields.some((f) => f.required && !f.value);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hasMissing && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              Incomplete
            </span>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="gap-1.5 text-primary">
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </Button>
      </div>
      <div className="px-5 py-4 space-y-3">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">{field.label}</dt>
            <dd className="text-sm text-foreground">
              {field.value || (
                <span className="text-destructive/70 italic">Not provided{field.required ? " (required)" : ""}</span>
              )}
            </dd>
          </div>
        ))}
      </div>
    </div>
  );
}
