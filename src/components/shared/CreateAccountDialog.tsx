import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TenancyType, AccountStatus, VerificationStatus } from '@/types/core';
import { seedAccounts } from '@/data/seedData';
import { toast } from 'sonner';

const defaultChecklist = [
  { id: 'CK01', label: 'Welcome call completed', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK02', label: 'PAN verification initiated', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK03', label: 'Identity verification initiated', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK04', label: 'Data import — Leads', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK05', label: 'Data import — Projects/Listings', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK06', label: 'Integration setup', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK07', label: 'Team training session', completed: false, completed_at: null, completed_by_user_id: null },
  { id: 'CK08', label: 'Go-live confirmation', completed: false, completed_at: null, completed_by_user_id: null },
];

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAccountDialog({ open, onOpenChange }: CreateAccountDialogProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    account_name: '',
    city: '',
    tenancy_type: '' as string,
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    whatsapp_enabled: true,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.account_name.trim()) e.account_name = 'Required';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.tenancy_type) e.tenancy_type = 'Required';
    if (!form.owner_name.trim()) e.owner_name = 'Required';
    if (!form.owner_phone.trim()) e.owner_phone = 'Required';
    if (!form.owner_email.trim()) e.owner_email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email)) e.owner_email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const newId = `ACC${Date.now()}`;
    const now = new Date().toISOString();
    seedAccounts.push({
      account_id: newId,
      account_name: form.account_name.trim(),
      city: form.city.trim(),
      tenancy_type: form.tenancy_type as TenancyType,
      status: AccountStatus.ONBOARDING_IN_PROGRESS,
      owner_name: form.owner_name.trim(),
      owner_phone: form.owner_phone.trim(),
      owner_email: form.owner_email.trim(),
      whatsapp_enabled: form.whatsapp_enabled,
      account_overview_text: form.notes.trim(),
      verification_pan_status: VerificationStatus.NOT_STARTED,
      verification_identity_status: VerificationStatus.NOT_STARTED,
      overview_fields: {},
      onboarding_pack_id: null,
      onboarding_checklist: [...defaultChecklist],
      notes_thread: [],
      documents: [],
      next_calendar_event_id: null,
      support_ticket_ids: [],
      integrations: {},
      data_ingestion_jobs: [],
      created_from_enquiry_id: null,
      created_at: now,
      updated_at: now,
    });
    toast.success('Account created successfully');
    onOpenChange(false);
    navigate(`/accounts/${newId}`);
  };

  const update = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>Add a new account manually. Required fields are marked.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Account Name *</Label>
            <Input value={form.account_name} onChange={e => update('account_name', e.target.value)} placeholder="e.g. Skyline Realty" />
            {errors.account_name && <p className="text-xs text-destructive">{errors.account_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="e.g. Mumbai" />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tenancy Type *</Label>
              <Select value={form.tenancy_type} onValueChange={v => update('tenancy_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TenancyType.AGENCY_BROKERAGE_CONSULTANCY}>Agency / Brokerage</SelectItem>
                  <SelectItem value={TenancyType.BUILDER_DEVELOPER}>Builder / Developer</SelectItem>
                </SelectContent>
              </Select>
              {errors.tenancy_type && <p className="text-xs text-destructive">{errors.tenancy_type}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Owner Name *</Label>
            <Input value={form.owner_name} onChange={e => update('owner_name', e.target.value)} placeholder="Full name" />
            {errors.owner_name && <p className="text-xs text-destructive">{errors.owner_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} placeholder="9876543210" />
              {errors.owner_phone && <p className="text-xs text-destructive">{errors.owner_phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input value={form.owner_email} onChange={e => update('owner_email', e.target.value)} placeholder="owner@company.in" type="email" />
              {errors.owner_email && <p className="text-xs text-destructive">{errors.owner_email}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>WhatsApp Enabled</Label>
            <Switch checked={form.whatsapp_enabled} onCheckedChange={v => update('whatsapp_enabled', v)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Initial notes about this account..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
