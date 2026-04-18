import { useRef, useState } from "react";
import { Upload, X, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadFieldProps {
  label: string;
  acceptedFormats: string;
  acceptedMimeTypes: string[];
  helperText?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
  required?: boolean;
  maxSizeBytes?: number;
}

export function FileUploadField({
  label, acceptedFormats, acceptedMimeTypes, helperText, multiple = false, files, onChange, error, required, maxSizeBytes,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setSizeError(null);
    const arr = Array.from(incoming);
    const oversized = maxSizeBytes ? arr.filter((f) => f.size > maxSizeBytes) : [];
    if (oversized.length > 0) {
      const limitMb = Math.round((maxSizeBytes ?? 0) / (1024 * 1024));
      setSizeError(`${oversized.map((f) => f.name).join(", ")} exceeds the ${limitMb} MB limit.`);
    }
    const valid = arr
      .filter((f) => !maxSizeBytes || f.size <= maxSizeBytes)
      .filter((f) => acceptedMimeTypes.some((t) => f.type === t || t === "*"));
    if (multiple) onChange([...files, ...valid]);
    else onChange(valid.slice(0, 1));
  };

  const removeFile = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          error && "border-destructive"
        )}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag and drop or <span className="text-primary font-medium">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Accepted formats: {acceptedFormats}</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={acceptedMimeTypes.join(",")}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5 text-sm">
              <File className="w-3.5 h-3.5 text-primary" />
              <span className="truncate max-w-[180px]">{file.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}>
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
