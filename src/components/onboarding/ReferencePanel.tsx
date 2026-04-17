import { FileText } from "lucide-react";

interface ReferencePanelProps {
  title: string;
  fields: string[];
}

export function ReferencePanel({ title, fields }: ReferencePanelProps) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {fields.map((field) => (
          <li key={field} className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
            {field}
          </li>
        ))}
      </ul>
    </div>
  );
}
