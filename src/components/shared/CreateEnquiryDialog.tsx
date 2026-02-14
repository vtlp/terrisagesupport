import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { EnquirySource, EnquiryStage, TenancyType } from '@/types/core';
import type { Enquiry } from '@/types/core';
import { toast } from 'sonner';

interface CreateEnquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (enquiry: Enquiry) => void;
}

const sourceLabels: Record<EnquirySource, string> = {
  [EnquirySource.CALL_DIRECT]: 'Direct Call',
  [EnquirySource.LANDING_PAGE]: 'Landing Page',
  [EnquirySource.META_ADS]: 'Meta Ads',
  [EnquirySource.CHAMPION_PARTNER]: 'Champion Partner',
  [EnquirySource.CP_REQUEST_PROJECTS]: 'CP Request',
};

export function CreateEnquiryDialog({ open, onOpenChange, onCreated }: CreateEnquiryDialogProps) {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneAlt, setContactPhoneAlt] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<EnquirySource>(EnquirySource.CALL_DIRECT);
  const [tenancyType, setTenancyType] = useState<string>('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = 'Company name is required';
    else if (companyName.trim().length > 100) errs.companyName = 'Max 100 characters';

    if (!contactName.trim()) errs.contactName = 'Contact name is required';
    else if (contactName.trim().length > 100) errs.contactName = 'Max 100 characters';

    if (!contactPhone.trim()) errs.contactPhone = 'Phone is required';
    else if (!/^[0-9+\-\s()]{7,20}$/.test(contactPhone.trim())) errs.contactPhone = 'Invalid phone number';

    if (contactPhoneAlt && !/^[0-9+\-\s()]{7,20}$/.test(contactPhoneAlt.trim())) errs.contactPhoneAlt = 'Invalid phone number';

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) errs.contactEmail = 'Invalid email';
    if (contactEmail && contactEmail.length > 255) errs.contactEmail = 'Max 255 characters';

    if (!city.trim()) errs.city = 'City is required';
    else if (city.trim().length > 100) errs.city = 'Max 100 characters';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetForm = () => {
    setCompanyName('');
    setContactName('');
    setContactPhone('');
    setContactPhoneAlt('');
    setContactEmail('');
    setCity('');
    setSource(EnquirySource.CALL_DIRECT);
    setTenancyType('');
    setWhatsappEnabled(false);
    setErrors({});
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const newId = `ENQ${String(Date.now()).slice(-3)}`;
    const now = new Date().toISOString();

    const newEnquiry: Enquiry = {
      enquiry_id: newId,
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_phone_alt: contactPhoneAlt.trim(),
      contact_email: contactEmail.trim(),
      whatsapp_enabled: whatsappEnabled,
      tenancy_type: tenancyType ? (tenancyType as TenancyType) : null,
      city: city.trim(),
      source,
      stage: EnquiryStage.NEW_ENQUIRY,
      outcome: null,
      not_interested_reason: null,
      not_interested_text: '',
      demo_outcome: null,
      assigned_to_user_id: null,
      notes_thread: [],
      focus_area: [],
      sales_focus: [],
      primary_property_types: [],
      team_size_estimate: null,
      current_system_text: '',
      approx_onboarding_date: null,
      portals_in_use: [],
      demo_event_id: null,
      onboarding_pack_sent: false,
      onboarding_pack_id: null,
      created_at: now,
      updated_at: now,
    };

    onCreated?.(newEnquiry);
    toast.success(`Enquiry ${newId} created for ${companyName.trim()}`);
    resetForm();
    onOpenChange(false);
    navigate(`/enquiries/${newId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Enquiry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Company */}
          <div className="space-y-1.5">
            <Label>Company Name <span className="text-destructive">*</span></Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Skyline Realty" />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name <span className="text-destructive">*</span></Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
              {errors.contactName && <p className="text-xs text-destructive">{errors.contactName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="9876543210" />
              {errors.contactPhone && <p className="text-xs text-destructive">{errors.contactPhone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Alt Phone</Label>
              <Input value={contactPhoneAlt} onChange={e => setContactPhoneAlt(e.target.value)} placeholder="Optional" />
              {errors.contactPhoneAlt && <p className="text-xs text-destructive">{errors.contactPhoneAlt}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Optional" />
              {errors.contactEmail && <p className="text-xs text-destructive">{errors.contactEmail}</p>}
            </div>
          </div>

          {/* City + WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City <span className="text-destructive">*</span></Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai" />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2 h-10">
                <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
                <Label className="cursor-pointer">WhatsApp</Label>
              </div>
            </div>
          </div>

          {/* Source + Tenancy */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={v => setSource(v as EnquirySource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(EnquirySource).map(s => (
                    <SelectItem key={s} value={s}>{sourceLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tenancy Type</Label>
              <Select value={tenancyType || 'none'} onValueChange={v => setTenancyType(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Set</SelectItem>
                  <SelectItem value={TenancyType.AGENCY_BROKERAGE_CONSULTANCY}>Agency / Brokerage</SelectItem>
                  <SelectItem value={TenancyType.BUILDER_DEVELOPER}>Builder / Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
            <Button onClick={handleSubmit}>Create Enquiry</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
