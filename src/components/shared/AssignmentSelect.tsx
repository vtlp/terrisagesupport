import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface AssignmentSelectProps {
  value: string | null;
  onChange: (userId: string | null) => void;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

export function AssignmentSelect({ value, onChange }: AssignmentSelectProps) {
  const [users, setUsers] = useState<ProfileRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (!cancelled && data) setUsers(data as ProfileRow[]);
    };
    load();

    // Realtime: keep names fresh when admin edits a profile
    const channel = supabase
      .channel('assignment-select-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Select value={value ?? 'unassigned'} onValueChange={(v) => onChange(v === 'unassigned' ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Assign to..." />
      </SelectTrigger>
      <SelectContent className="bg-card">
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {users.map(u => (
          <SelectItem key={u.id} value={u.id}>
            {u.full_name || 'Unnamed user'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
