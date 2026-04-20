import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLookup } from '@/hooks/useLookups';
import { createRecord } from '@/lib/marketingApi';
import { useToast } from '@/hooks/use-toast';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'city';
  required?: boolean;
  placeholder?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  table: 'marketing_referrals' | 'marketing_contacts' | 'marketing_champions' | 'marketing_events';
  fields: FieldDef[];
  onCreated: () => void;
}

export function AddRecordDialog({ open, onOpenChange, title, table, fields, onCreated }: Props) {
  const { toast } = useToast();
  const cities = useLookup('cities');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setValues(p => ({ ...p, [k]: v }));
  const reset = () => setValues({});

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        toast({ title: `${f.label} is required`, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      fields.forEach(f => {
        const v = values[f.key];
        if (v === undefined || v === '') { payload[f.key] = null; return; }
        if (f.type === 'number') payload[f.key] = Number(v);
        else payload[f.key] = v;
      });
      await createRecord(table, payload);
      toast({ title: 'Record added' });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({ title: 'Failed to add', description: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <Label>{f.label}{f.required && ' *'}</Label>
              {f.type === 'textarea' ? (
                <Textarea value={values[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} rows={2} />
              ) : f.type === 'city' ? (
                <Select value={values[f.key] || 'none'} onValueChange={(v) => set(f.key, v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="none">—</SelectItem>
                    {cities.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
