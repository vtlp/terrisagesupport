import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+971', label: '🇦🇪 +971' },
];

interface Props {
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  number: string;
  onNumberChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
}

export function PhoneInput({ countryCode, onCountryCodeChange, number, onNumberChange, placeholder = '9876543210', id, invalid }: Props) {
  return (
    <div className="flex gap-2">
      <Select value={countryCode} onValueChange={onCountryCodeChange}>
        <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        id={id}
        inputMode="tel"
        value={number}
        onChange={e => onNumberChange(e.target.value.replace(/[^0-9\s\-]/g, ''))}
        placeholder={placeholder}
        className={invalid ? 'border-destructive' : ''}
      />
    </div>
  );
}

export const DEFAULT_COUNTRY_CODE = '+91';

export function splitPhone(full: string): { code: string; number: string } {
  const trimmed = (full ?? '').trim();
  for (const c of COUNTRY_CODES) {
    if (trimmed.startsWith(c.code)) return { code: c.code, number: trimmed.slice(c.code.length).trim() };
  }
  return { code: DEFAULT_COUNTRY_CODE, number: trimmed };
}

export function joinPhone(code: string, number: string): string {
  return `${code} ${number.trim()}`.trim();
}
