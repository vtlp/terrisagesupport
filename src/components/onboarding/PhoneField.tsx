import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { label: "🇮🇳 +91", value: "+91", country: "India" },
  { label: "🇺🇸 +1", value: "+1", country: "United States" },
  { label: "🇬🇧 +44", value: "+44", country: "United Kingdom" },
  { label: "🇦🇪 +971", value: "+971", country: "UAE" },
  { label: "🇸🇬 +65", value: "+65", country: "Singapore" },
  { label: "🇭🇰 +852", value: "+852", country: "Hong Kong" },
  { label: "🇦🇺 +61", value: "+61", country: "Australia" },
  { label: "🇨🇦 +1", value: "+1-CA", country: "Canada" },
  { label: "🇸🇦 +966", value: "+966", country: "Saudi Arabia" },
  { label: "🇶🇦 +974", value: "+974", country: "Qatar" },
  { label: "🇴🇲 +968", value: "+968", country: "Oman" },
  { label: "🇧🇭 +973", value: "+973", country: "Bahrain" },
  { label: "🇰🇼 +965", value: "+965", country: "Kuwait" },
];

interface PhoneFieldProps {
  label: string;
  required?: boolean;
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  className?: string;
  disabled?: boolean;
}

export function PhoneField({
  label, required, countryCode, onCountryCodeChange, value, onChange, error, helperText, className, disabled,
}: PhoneFieldProps) {
  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    onChange(digits);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={onCountryCodeChange} disabled={disabled}>
          <SelectTrigger className={cn("w-[110px] shrink-0", error && "border-destructive", disabled && "bg-muted/50 cursor-not-allowed opacity-100")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((cc) => (
              <SelectItem key={cc.value} value={cc.value}>{cc.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="10-digit mobile number"
          disabled={disabled}
          readOnly={disabled}
          className={cn(
            "flex-1",
            error && "border-destructive focus-visible:ring-destructive",
            disabled && "bg-muted/50 cursor-not-allowed",
          )}
          maxLength={10}
        />
      </div>
      {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
