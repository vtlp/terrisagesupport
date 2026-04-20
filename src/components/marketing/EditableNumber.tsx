import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  onSave: (next: number) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  prefix?: string;
}

export function EditableNumber({ value, onSave, disabled, className, prefix }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const n = Number(draft);
    if (Number.isNaN(n) || n < 0) { setDraft(String(value)); setEditing(false); return; }
    if (n === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(n); } finally { setSaving(false); setEditing(false); }
  };

  const cancel = () => { setDraft(String(value)); setEditing(false); };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <Input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className={cn('h-7 w-20 px-2 text-sm', className)}
          disabled={saving}
        />
        <button type="button" onClick={commit} className="text-success" disabled={saving}><Check className="h-4 w-4" /></button>
        <button type="button" onClick={cancel} className="text-muted-foreground" disabled={saving}><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setEditing(true)}
      className={cn(
        'inline-flex items-center gap-1.5 group',
        !disabled && 'cursor-pointer hover:text-primary',
        className,
      )}
    >
      <span>{prefix}{value.toLocaleString()}</span>
      {!disabled && <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </button>
  );
}
