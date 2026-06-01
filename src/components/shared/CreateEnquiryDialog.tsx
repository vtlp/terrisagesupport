import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getCityOptions } from '@/data/lookupData';
import { useLookup } from '@/hooks/useLookups';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { PhoneInput, DEFAULT_COUNTRY_CODE, joinPhone } from './PhoneInput';

interface CreateEnquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}


const PHONE_RE = /^[0-9\s\-]{6,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STAGE_LABELS: Record<string, string> = {
  NEW_ENQUIRY: 'New', CONTACTED: 'Contacted', DEMO_SCHEDULED: 'Demo Scheduled',
  DEMO_COMPLETED: 'Demo Completed', ONBOARDING_PACK_SENT: 'Onboarding Sent',
  ACCOUNT_CREATED: 'Account Created', LOST: 'Lost',
};

interface DuplicateMatch {
  id: string; full_name: string; company_name: string | null;
  stage: string; created_at: string;
}

const normalisePhone = (s: string) => s.replace(/\D/g, '');

export function CreateEnquiryDialog({ open, onOpenChange, onCreated }: CreateEnquiryDialogProps) {
  const navigate = useNavigate();
  const cities = getCityOptions();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phoneCode, setPhoneCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneAltCode, setPhoneAltCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneAltNumber, setPhoneAltNumber] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const sources = useLookup('sources');
  const [tenancyType, setTenancyType] = useState<string>('AGENCY_BROKERAGE_CONSULTANCY');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!companyName.trim()) e.companyName = 'Company name is required';
    else if (companyName.trim().length > 100) e.companyName = 'Max 100 characters';
    if (!contactName.trim()) e.contactName = 'Contact name is required';
    else if (contactName.trim().length > 100) e.contactName = 'Max 100 characters';
    if (!phoneNumber.trim()) e.phone = 'Phone number is required';
    else if (!PHONE_RE.test(phoneNumber.trim())) e.phone = 'Enter a valid phone number';
    if (phoneAltNumber && !PHONE_RE.test(phoneAltNumber.trim())) e.phoneAlt = 'Invalid phone number';
    if (email && !EMAIL_RE.test(email.trim())) e.email = 'Invalid email address';
    if (email && email.length > 255) e.email = 'Max 255 characters';
    if (!city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const reset = () => {
    setCompanyName(''); setContactName('');
    setPhoneCode(DEFAULT_COUNTRY_CODE); setPhoneNumber('');
    setPhoneAltCode(DEFAULT_COUNTRY_CODE); setPhoneAltNumber('');
    setEmail(''); setCity(''); setSource('');
    setTenancyType('AGENCY_BROKERAGE_CONSULTANCY');
    setWhatsappEnabled(true); setNotes(''); setErrors({}); setDuplicate(null);
  };

  const findDuplicate = async (): Promise<DuplicateMatch | null> => {
    const digits = normalisePhone(joinPhone(phoneCode, phoneNumber));
    if (digits.length < 6) return null;
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('enquiries')
      .select('id, full_name, company_name, stage, created_at, phone')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    const match = (data ?? []).find(r => normalisePhone(r.phone) === digits);
    return (match as DuplicateMatch) ?? null;
  };

  const insertEnquiry = async (isDuplicateOf: string | null) => {
    setSubmitting(true);
    const trimmedNotes = notes.trim();
    const { data, error } = await supabase.from('enquiries').insert({
      full_name: contactName.trim(),
      company_name: companyName.trim(),
      phone: joinPhone(phoneCode, phoneNumber),
      email: email.trim() || null,
      city: city.trim(),
      tenancy_type: tenancyType as 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER',
      source,
      stage: 'NEW_ENQUIRY',
      is_duplicate_of: isDuplicateOf,
      payload: {
        contact_phone_alt: phoneAltNumber ? joinPhone(phoneAltCode, phoneAltNumber) : null,
        whatsapp_enabled: whatsappEnabled,
        initial_notes: trimmedNotes,
      },
    } as never).select('id').maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Enquiry created for ${companyName.trim()}`);
    const id = (data as { id?: string } | null)?.id;
    // Persist initial note into enquiry_notes so it shows up in the Notes panel.
    if (id && trimmedNotes) {
      await supabase.from('enquiry_notes').insert({
        enquiry_id: id,
        note_text: trimmedNotes,
      } as never);
    }
    if (id && isDuplicateOf) {
      await supabase.rpc('log_activity', {
        _entity_type: 'ENQUIRY', _entity_id: id, _event_type: 'NOTE',
        _summary: 'Duplicate phone — created intentionally',
        _details: { duplicate_of: isDuplicateOf } as never,
      } as never);
    }
    if (id) onCreated?.(id);
    reset();
    onOpenChange(false);
    if (id) navigate(`/enquiries/${id}`);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const dup = await findDuplicate();
    if (dup) { setDuplicate(dup); return; }
    await insertEnquiry(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Enquiry</DialogTitle>
        </DialogHeader>

        {duplicate && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
              <div>
                <p className="font-medium">An enquiry already exists for this number</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opened {format(new Date(duplicate.created_at), 'dd MMM yyyy')} for{' '}
                  <span className="font-medium text-foreground">{duplicate.company_name || duplicate.full_name}</span> · current stage:{' '}
                  <span className="font-medium text-foreground">{STAGE_LABELS[duplicate.stage] ?? duplicate.stage}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/enquiries/${duplicate.id}`); }}>
                Open existing
              </Button>
              <Button size="sm" onClick={() => insertEnquiry(duplicate.id)} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create anyway'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Skyline Realty" />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name <span className="text-destructive">*</span></Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
              {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <PhoneInput
                countryCode={phoneCode} onCountryCodeChange={setPhoneCode}
                number={phoneNumber} onNumberChange={(n) => { setPhoneNumber(n); setDuplicate(null); }}
                invalid={!!errors.phone}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Alternate Phone</Label>
              <PhoneInput
                countryCode={phoneAltCode} onCountryCodeChange={setPhoneAltCode}
                number={phoneAltNumber} onNumberChange={setPhoneAltNumber}
                placeholder="Optional"
                invalid={!!errors.phoneAlt}
              />
              {errors.phoneAlt && <p className="text-xs text-destructive">{errors.phoneAlt}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@company.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City <span className="text-destructive">*</span></Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue placeholder="Select city…" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2 h-10">
                <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} id="wa" />
                <Label htmlFor="wa" className="cursor-pointer">WhatsApp on primary number</Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tenancy Type</Label>
              <Select value={tenancyType} onValueChange={setTenancyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENCY_BROKERAGE_CONSULTANCY">Agency / Brokerage</SelectItem>
                  <SelectItem value="BUILDER_DEVELOPER">Builder / Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source || undefined} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {sources
                    .filter(s => !/landing page|terrisage/i.test(s.name))
                    .map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Initial Notes</Label>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What did the customer ask about?" />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !!duplicate}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Enquiry'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
