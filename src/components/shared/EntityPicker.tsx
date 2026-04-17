import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const NONE = '__none__';
type EntityType = 'ENQUIRY' | 'ACCOUNT';

interface Props {
  entityType: EntityType | '';
  entityId: string | null;
  onChange: (type: EntityType | '', id: string | null) => void;
}

export function EntityPicker({ entityType, entityId, onChange }: Props) {
  const [enquiries, setEnquiries] = useState<{ id: string; full_name: string; company_name: string | null }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; account_name: string }[]>([]);

  useEffect(() => {
    supabase.from('enquiries').select('id, full_name, company_name').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setEnquiries(data ?? []));
    supabase.from('accounts').select('id, account_name').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setAccounts(data ?? []));
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Link to</Label>
        <Select value={entityType || NONE} onValueChange={v => onChange(v === NONE ? '' : (v as EntityType), null)}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            <SelectItem value="ENQUIRY">Enquiry</SelectItem>
            <SelectItem value="ACCOUNT">Account</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Record</Label>
        <Select
          value={entityId ?? NONE}
          onValueChange={v => onChange(entityType as EntityType, v === NONE ? null : v)}
          disabled={!entityType}
        >
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>—</SelectItem>
            {entityType === 'ENQUIRY' && enquiries.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.company_name || e.full_name}</SelectItem>
            ))}
            {entityType === 'ACCOUNT' && accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
