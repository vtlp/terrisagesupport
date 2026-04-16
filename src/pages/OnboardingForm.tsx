import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface TeamMember {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

export default function OnboardingForm() {
  const { tenancy } = useParams<{ tenancy: 'agency' | 'builder' }>();
  const [searchParams] = useSearchParams();
  const enquiryId = searchParams.get('enquiry_id');
  const navigate = useNavigate();

  const tenancyType = tenancy === 'builder' ? 'BUILDER_DEVELOPER' : 'AGENCY_BROKERAGE_CONSULTANCY';
  const isBuilder = tenancy === 'builder';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Step 1: Business info
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  // Step 2: Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  // Step 3: Team
  const [team, setTeam] = useState<TeamMember[]>([
    { full_name: '', email: '', phone: '', role: 'Agent' },
  ]);
  // Step 4: Notes
  const [notes, setNotes] = useState('');

  const totalSteps = 5;

  const addMember = () =>
    setTeam([...team, { full_name: '', email: '', phone: '', role: 'Agent' }]);
  const removeMember = (i: number) => setTeam(team.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: keyof TeamMember, value: string) => {
    const next = [...team];
    next[i] = { ...next[i], [field]: value };
    setTeam(next);
  };

  const handleSubmit = async () => {
    if (!companyName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      toast.error('Please fill required fields');
      return;
    }
    setSubmitting(true);
    const payload = {
      company_name: companyName,
      city,
      website,
      gst_number: gstNumber,
      pan_number: panNumber,
      rera_number: isBuilder ? reraNumber : undefined,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      owner_email: ownerEmail,
      team_members: team.filter(m => m.full_name.trim()),
      notes,
    };
    const { error } = await supabase.from('onboarding_submissions').insert({
      enquiry_id: enquiryId,
      tenancy_type: tenancyType as 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER',
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
            <h1 className="text-2xl font-semibold">Thank you!</h1>
            <p className="text-muted-foreground">
              Your onboarding details have been submitted to the Terrisage team. We will review and get back to you shortly.
            </p>
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
          <p className="text-sm text-muted-foreground mt-1">
            Step {step} of {totalSteps}
          </p>
          <div className="w-full bg-muted h-1 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
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
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Compliance Details</CardTitle>
                <CardDescription>Tax and regulatory numbers (optional).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>PAN Number</Label>
                    <Input value={panNumber} onChange={e => setPanNumber(e.target.value)} />
                  </div>
                </div>
                {isBuilder && (
                  <div className="space-y-2">
                    <Label>RERA Number</Label>
                    <Input value={reraNumber} onChange={e => setReraNumber(e.target.value)} />
                  </div>
                )}
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Primary Contact</CardTitle>
                <CardDescription>Account owner details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Owner Name *</Label>
                  <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="+91" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Add team members who will use Terrisage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {team.map((m, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Member {i + 1}</span>
                      {team.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeMember(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input placeholder="Full name" value={m.full_name} onChange={e => updateMember(i, 'full_name', e.target.value)} />
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Input placeholder="Phone" value={m.phone} onChange={e => updateMember(i, 'phone', e.target.value)} />
                      <Input placeholder="Email" value={m.email} onChange={e => updateMember(i, 'email', e.target.value)} />
                    </div>
                    <Input placeholder="Role (e.g. Agent, Manager)" value={m.role} onChange={e => updateMember(i, 'role', e.target.value)} />
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
                <CardDescription>Optional notes or requirements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tell us anything that will help us set up your account faster." />
                <div className="rounded-lg border p-4 bg-muted/30 text-sm space-y-1">
                  <div className="font-medium">Review</div>
                  <div className="text-muted-foreground">{companyName} • {city}</div>
                  <div className="text-muted-foreground">{ownerName} • {ownerPhone}</div>
                  <div className="text-muted-foreground">{team.filter(m=>m.full_name.trim()).length} team member(s)</div>
                </div>
              </CardContent>
            </>
          )}

          <div className="flex justify-between p-6 pt-0">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
