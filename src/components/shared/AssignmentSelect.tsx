import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { seedUsers } from '@/data/seedData';

interface AssignmentSelectProps {
  value: string | null;
  onChange: (userId: string | null) => void;
}

export function AssignmentSelect({ value, onChange }: AssignmentSelectProps) {
  return (
    <Select value={value ?? 'unassigned'} onValueChange={(v) => onChange(v === 'unassigned' ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Assign to..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {seedUsers.filter(u => u.is_active).map(u => (
          <SelectItem key={u.user_id} value={u.user_id}>
            {u.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
