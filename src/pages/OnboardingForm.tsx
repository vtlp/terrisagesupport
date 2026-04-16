import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { PhoneInput, DEFAULT_COUNTRY_CODE, joinPhone } from '@/components/shared/PhoneInput';
import { getCityOptions } from '@/data/lookupData';

interface TeamMember {
  full_name: string;
  email: string;
  phoneCode: string;
  phoneNumber: string;
  role: 'ADMIN' | 'MANAGER' | 'AGENT';
  permissions: string[];
}

const ROLE_OPTIONS = [
  { v: 'ADMIN', l: 'Admin', desc: 'Full access to manage account, billing & users' },
  { v: 'MANAGER', l: 'Manager', desc: 'Manage team, listings & leads' },
  { v: 'AGENT', l: 'Agent', desc: 'Field user — needs permissions selected below' },
] as const;

const AGENT_PERMISSIONS = [
  { v: 'manage_leads', l: 'Manage leads' },
  { v: 'manage_listings', l: 'Manage listings' },
  { v: 'view_reports', l: 'View reports' },
  { v: 'site_visits', l: 'Schedule site visits' },
  { v: 'export_data', l: 'Export data' },
];

const PHONE_RE = /^[0-9\s\-]{6,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[A-Z0-9]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;

export default function OnboardingForm() {
  const { tenancy } = useParams<{ tenancy: 'agency' | 'builder' }>();
  const [searchParams] = useSearchParams();
  const enquiryId = searchParams.get('enquiry_id');

  const tenancyType = tenancy === 'builder' ? 'BUILDER_DEVELOPER' : 'AGENCY_BROKERAGE_CONSULTANCY';
  const isBuilder = tenancy === 'builder';
  const cities = getCityOptions();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: Business
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  // Step 2: Compliance
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  // Step 3: Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhoneCode, setOwnerPhoneCode] = useState(DEFAULT_COUNTRY_CODE);
  const [ownerPhoneNumber, setOwnerPhoneNumber] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  // Step 4: Team
  const [team, setTeam] = useState<TeamMember[]>([
    { full_name: '', email: '', phoneCode: DEFAULT_COUNTRY_CODE, phoneNumber: '', role: 'AGENT', permissions: [] },
  ]);
  // Step 5: Notes
  const [notes, setNotes] = useState('');

  const totalSteps = 5;

  useEffect(() => { setErrors({}); }, [step]);

  const addMember = () =>
    setTeam([...team, { full_name: '', email: '', phoneCode: DEFAULT_COUNTRY_CODE, phoneNumber: '', role: 'AGENT', permissions: [] }]);
  const removeMember = (i: number) => setTeam(team.filter((_, idx) => idx !== i));
  const updateMember = (i: number, patch: Partial<TeamMember>) => {
    const next = [...team];
    next[i] = { ...next[i], ...patch };
    setTeam(next);
  };
  const togglePermission = (i: number, perm: string) => {
    const m = team[i];
    const has = m.permissions.includes(perm);
    updateMember(i, { permissions: has ? m.permissions.filter(p => p !== perm) : [...m.permissions, perm] });
  };

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!companyName.trim()) e.companyName = 'Company name is required';
      else if (companyName.trim().length > 100) e.companyName = 'Max 100 characters';
      if (!city.trim()) e.city = 'City is required';
      if (website && !URL_RE.test(website.trim())) e.website = 'Enter a valid URL (https://...)';
    }
    if (s === 2) {
      if (gstNumber && !GST_RE.test(gstNumber.trim().toUpperCase())) e.gstNumber = 'Invalid GST format (e.g. 27AAAPL1234C1Z5)';
      if (panNumber && !PAN_RE.test(panNumber.trim().toUpperCase())) e.panNumber = 'Invalid PAN format (e.g. AAAPL1234C)';
      if (isBuilder && reraNumber && reraNumber.trim().length < 5) e.reraNumber = 'RERA number too short';
    }
    if (s === 3) {
      if (!ownerName.trim()) e.ownerName = 'Owner name is required';
      else if (ownerName.trim().length > 100) e.ownerName = 'Max 100 characters';
      if (!ownerPhoneNumber.trim()) e.ownerPhone = 'Phone is required';
      else if (!PHONE_RE.test(ownerPhoneNumber.trim())) e.ownerPhone = 'Enter a valid phone number';
      if (!ownerEmail.trim()) e.ownerEmail = 'Email is required';
      else if (!EMAIL_RE.test(ownerEmail.trim())) e.ownerEmail = 'Invalid email address';
      else if (ownerEmail.length > 255) e.ownerEmail = 'Max 255 characters';
    }
    if (s === 4) {
      team.forEach((m, i) => {
        const filled = m.full_name.trim() || m.email.trim() || m.phoneNumber.trim();
        if (!filled) return;
        if (!m.full_name.trim()) e[`m_${i}_name`] = 'Name is required';
        if (!m.phoneNumber.trim()) e[`m_${i}_phone`] = 'Phone is required';
        else if (!PHONE_RE.test(m.phoneNumber.trim())) e[`m_${i}_phone`] = 'Invalid phone';
        if (m.email && !EMAIL_RE.test(m.email.trim())) e[`m_${i}_email`] = 'Invalid email';
        if (m.role === 'AGENT' && m.permissions.length === 0) e[`m_${i}_perms`] = 'Select at least one permission';
      });
    }
    if (s === 5) {
      if (notes && notes.length > 1000) e.notes = 'Max 1000 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validateStep(step)) setStep(s => s + 1); };
  const handleBackClick = () => {
    const hasContent = companyName || city || website || gstNumber || panNumber || reraNumber
      || ownerName || ownerPhoneNumber || ownerEmail || notes
      || team.some(m => m.full_name || m.phoneNumber || m.email);
    if (step === 1 && hasContent) { setBackConfirmOpen(true); return; }
    if (step > 1) setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= totalSteps; s++) {
      if (!validateStep(s)) {
        setStep(s);
        toast.error('Please fix the highlighted fields before submitting');
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      company_name: companyName.trim(),
      city: city.trim(),
      website: website.trim() || null,
      gst_number: gstNumber.trim().toUpperCase() || null,
      pan_number: panNumber.trim().toUpperCase() || null,
      rera_number: isBuilder ? (reraNumber.trim() || null) : null,
      owner_name: ownerName.trim(),
      owner_phone: joinPhone(ownerPhoneCode, ownerPhoneNumber),
      owner_email: ownerEmail.trim(),
      team_members: team
        .filter(m => m.full_name.trim())
        .map(m => ({
          full_name: m.full_name.trim(),
          email: m.email.trim() || null,
          phone: joinPhone(m.phoneCode, m.phoneNumber),
          role: m.role,
          permissions: m.role === 'AGENT' ? m.permissions : null,
        })),
      notes: notes.trim() || null,
    };
    const { error } = await (supabase.from('onboarding_submissions') as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).insert({
      enquiry_id: enquiryId,
      tenancy_type: tenancyType,
      payload,
      status: 'PENDING_REVIEW',
    });
    setSubmitting(false);
    if (error) {
      toast.error('Submission failed: ' + error.message);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-12 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h1 className="text-2xl font-semibold">Thank you, {ownerName.split(' ')[0] || 'there'}!</h1>
            <p className="text-muted-foreground">
              Your onboarding details for <span className="font-medium text-foreground">{companyName}</span> have been submitted to the Terrisage team. Our onboarding specialist will review your details and reach out within 1 business day to confirm next steps and schedule your account go-live.
            </p>
            <p className="text-xs text-muted-foreground">You can safely close this window.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">
            Terrisage Onboarding — {isBuilder ? 'Builder / Developer' : 'Agency / Brokerage'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step} of {totalSteps}</p>
          <div className="w-full bg-muted h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-primary h-full transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Tell us about your company.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Skyline Realty" />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
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
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourcompany.com" />
                    {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Compliance Details</CardTitle>
                <CardDescription>Tax and regulatory numbers (all optional).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>GST Number</Label>
                    <Input value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} placeholder="27AAAPL1234C1Z5" maxLength={15} />
                    {errors.gstNumber && <p className="text-xs text-destructive">{errors.gstNumber}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>PAN Number</Label>
                    <Input value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} placeholder="AAAPL1234C" maxLength={10} />
                    {errors.panNumber && <p className="text-xs text-destructive">{errors.panNumber}</p>}
                  </div>
                </div>
                {isBuilder && (
                  <div className="space-y-1.5">
                    <Label>RERA Number</Label>
                    <Input value={reraNumber} onChange={e => setReraNumber(e.target.value)} placeholder="State RERA registration number" />
                    {errors.reraNumber && <p className="text-xs text-destructive">{errors.reraNumber}</p>}
                  </div>
                )}
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Primary Contact</CardTitle>
                <CardDescription>Account owner details — we will use this to set up the master login.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Owner Name <span className="text-destructive">*</span></Label>
                  <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Full name" />
                  {errors.ownerName && <p className="text-xs text-destructive">{errors.ownerName}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone <span className="text-destructive">*</span></Label>
                    <PhoneInput
                      countryCode={ownerPhoneCode} onCountryCodeChange={setOwnerPhoneCode}
                      number={ownerPhoneNumber} onNumberChange={setOwnerPhoneNumber}
                      invalid={!!errors.ownerPhone}
                    />
                    {errors.ownerPhone && <p className="text-xs text-destructive">{errors.ownerPhone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@company.com" />
                    {errors.ownerEmail && <p className="text-xs text-destructive">{errors.ownerEmail}</p>}
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Add team members who will use Terrisage. You can edit roles later.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {team.map((m, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Member {i + 1}</span>
                      {team.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeMember(i)} aria-label="Remove member">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Full Name</Label>
                      <Input placeholder="e.g. Priya Sharma" value={m.full_name} onChange={e => updateMember(i, { full_name: e.target.value })} />
                      {errors[`m_${i}_name`] && <p className="text-xs text-destructive">{errors[`m_${i}_name`]}</p>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <PhoneInput
                          countryCode={m.phoneCode} onCountryCodeChange={v => updateMember(i, { phoneCode: v })}
                          number={m.phoneNumber} onNumberChange={v => updateMember(i, { phoneNumber: v })}
                          invalid={!!errors[`m_${i}_phone`]}
                        />
                        {errors[`m_${i}_phone`] && <p className="text-xs text-destructive">{errors[`m_${i}_phone`]}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" placeholder="member@company.com" value={m.email} onChange={e => updateMember(i, { email: e.target.value })} />
                        {errors[`m_${i}_email`] && <p className="text-xs text-destructive">{errors[`m_${i}_email`]}</p>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={m.role} onValueChange={(v: 'ADMIN' | 'MANAGER' | 'AGENT') => updateMember(i, { role: v, permissions: v === 'AGENT' ? m.permissions : [] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(r => (
                            <SelectItem key={r.v} value={r.v}>
                              <div>
                                <div className="font-medium">{r.l}</div>
                                <div className="text-xs text-muted-foreground">{r.desc}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {m.role === 'AGENT' && (
                      <div className="space-y-2 p-3 rounded-md bg-background border">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Agent Permissions</Label>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {AGENT_PERMISSIONS.map(p => (
                            <label key={p.v} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={m.permissions.includes(p.v)}
                                onCheckedChange={() => togglePermission(i, p.v)}
                              />
                              {p.l}
                            </label>
                          ))}
                        </div>
                        {errors[`m_${i}_perms`] && <p className="text-xs text-destructive">{errors[`m_${i}_perms`]}</p>}
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={addMember} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Add Member
                </Button>
              </CardContent>
            </>
          )}

          {step === 5 && (
            <>
              <CardHeader>
                <CardTitle>Anything Else?</CardTitle>
                <CardDescription>Optional notes that will help us set up your account faster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. preferred go-live date, existing CRM, integrations needed…" maxLength={1000} />
                <div className="text-xs text-muted-foreground text-right">{notes.length}/1000</div>
                {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
                <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1">
                  <div className="font-medium mb-2">Review your details</div>
                  <div className="text-muted-foreground"><span className="text-foreground">{companyName}</span> • {city}</div>
                  <div className="text-muted-foreground"><span className="text-foreground">{ownerName}</span> • {joinPhone(ownerPhoneCode, ownerPhoneNumber)} • {ownerEmail}</div>
                  <div className="text-muted-foreground">{team.filter(m => m.full_name.trim()).length} team member(s)</div>
                </div>
              </CardContent>
            </>
          )}

          <div className="flex justify-between p-6 pt-0">
            <Button variant="outline" disabled={step === 1} onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < totalSteps ? (
              <Button onClick={handleNext}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</> : 'Submit Onboarding'}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <AlertDialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your progress?</AlertDialogTitle>
            <AlertDialogDescription>
              You are on the first step. Going back will not save anything you have entered. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on this step</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setBackConfirmOpen(false); window.history.back(); }}>
              Discard & leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
