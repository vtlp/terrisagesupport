import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  onSave: (next: number) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  prefix?: string;
}

export function EditableNumber({ value, onSave, disabled, className, prefix }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const commit = async () => {
    const n = Number(draft);
    if (Number.isNaN(n) || n < 0) { setDraft(String(value)); setOpen(false); return; }
    if (n === value) { setOpen(false); return; }
    setSaving(true);
    try { await onSave(n); } finally { setSaving(false); setOpen(false); }
  };

  if (disabled) {
    return <span className={className}>{prefix}{value.toLocaleString()}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1.5 group cursor-pointer hover:text-primary', className)}
        >
          <span>{prefix}{value.toLocaleString()}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 bg-card" align="center">
        <div className="space-y-2">
          <Input
            ref={inputRef}
            type="number"
            min={0}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
            disabled={saving}
            className="h-9"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={commit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
