import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, CheckCircle2, XCircle, Clock, Phone, Mail, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SendOnboardingDialog } from '@/components/shared/SendOnboardingDialog';

type Stage = 'NEW_ENQUIRY' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'DEMO_COMPLETED' | 'ONBOARDING_PACK_SENT' | 'ACCOUNT_CREATED' | 'LOST';
type Tenancy = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';
type SubStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

interface Enquiry {
  id: string; full_name: string; phone: string; email: string | null;
  city: string | null; company_name: string | null;
  tenancy_type: Tenancy | null; stage: Stage; source: string | null;
  onboarding_form_link: string | null; onboarding_pack_sent: boolean;
  converted_account_id: string | null;
  created_at: string;
}
interface NoteRow { id: string; note_text: string; created_at: string; }
interface Submission {
  id: string; status: SubStatus; submitted_at: string; reviewed_at: string | null;
  payload: Record<string, unknown>; tenancy_type: Tenancy;
}

const stageLabels: Record<Stage, string> = {
  NEW_ENQUIRY: 'New', CONTACTED: 'Contacted', DEMO_SCHEDULED: 'Demo Scheduled',
  DEMO_COMPLETED: 'Demo Completed', ONBOARDING_PACK_SENT: 'Onboarding Sent',
  ACCOUNT_CREATED: 'Account Created', LOST: 'Lost',
};

export default function EnquiryDetail() {
  const { enquiryId } = useParams<{ enquiryId: string }>();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    if (!enquiryId) return;
    setLoading(true);
    const [{ data: e, error: eErr }, { data: n }, { data: s }] = await Promise.all([
      supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle(),
      supabase.from('enquiry_notes').select('id, note_text, created_at').eq('enquiry_id', enquiryId).order('created_at', { ascending: false }),
      supabase.from('onboarding_submissions').select('id, status, submitted_at, reviewed_at, payload, tenancy_type').eq('enquiry_id', enquiryId).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (eErr || !e) { toast.error('Enquiry not found'); navigate('/enquiries'); return; }
    setEnquiry(e as Enquiry);
    setNotes((n ?? []) as NoteRow[]);
    setSubmission(s as Submission | null);
    setLoading(false);
  }, [enquiryId, navigate]);

  useEffect(() => { load(); }, [load]);

  const updateStage = async (stage: Stage) => {
    if (!enquiry) return;
    setBusy(true);
    const { error } = await supabase.from('enquiries').update({ stage }).eq('id', enquiry.id);
    if (error) toast.error(error.message);
    else {
      await supabase.from('enquiry_notes').insert({ enquiry_id: enquiry.id, note_text: `Stage changed to ${stageLabels[stage]}` });
      toast.success('Stage updated');
      load();
    }
    setBusy(false);
  };

  const addNote = async () => {
    if (!enquiry || !newNote.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('enquiry_notes').insert({ enquiry_id: enquiry.id, note_text: newNote.trim() });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setNewNote(''); load(); }
  };

  const generateLink = (): string => {
    if (!enquiry) return '';
    const tenancy = enquiry.tenancy_type === 'BUILDER_DEVELOPER' ? 'builder' : 'agency';
    return `${window.location.origin}/onboarding/${tenancy}?enquiry_id=${enquiry.id}`;
  };

  const handleSendOnboarding = async () => {
    if (!enquiry) return;
    const link = generateLink();
    if (!enquiry.onboarding_pack_sent) {
      await supabase.from('enquiries').update({
        onboarding_pack_sent: true,
        onboarding_pack_sent_at: new Date().toISOString(),
        onboarding_form_link: link,
        stage: 'ONBOARDING_PACK_SENT' as Stage,
      }).eq('id', enquiry.id);
      await supabase.from('enquiry_notes').insert({
        enquiry_id: enquiry.id, note_text: `Onboarding form link generated: ${link}`,
      });
      load();
    }
    setShareOpen(true);
  };

  const reviewSubmission = async (status: 'APPROVED' | 'REJECTED') => {
    if (!submission) return;
    setBusy(true);
    const { error } = await supabase.from('onboarding_submissions')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', submission.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from('enquiry_notes').insert({
      enquiry_id: enquiry!.id,
      note_text: `Onboarding submission ${status === 'APPROVED' ? 'approved' : 'rejected'}`,
    });
    toast.success(`Submission ${status.toLowerCase()}`);
    load();
  };

  const convertToAccount = async () => {
    if (!enquiry) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('convert_enquiry_to_account', { _enquiry_id: enquiry.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Account created');
    if (data) navigate(`/accounts/${data}`);
  };

  const canConvert = (): string | null => {
    if (!enquiry) return 'Loading';
    if (!submission) return 'Onboarding form not yet submitted';
    if (submission.status !== 'APPROVED') return 'Submission must be approved';
    if (enquiry.converted_account_id) return 'Already converted';
    return null;
  };

  if (loading || !enquiry) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const convertBlock = canConvert();
  const payload = (submission?.payload ?? {}) as Record<string, unknown>;
  const teamMembers = Array.isArray(payload.team_members) ? payload.team_members as Array<Record<string, string>> : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/enquiries')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{enquiry.full_name}</h1>
          <p className="text-sm text-muted-foreground">{enquiry.company_name ?? '—'}</p>
        </div>
        <Badge>{stageLabels[enquiry.stage]}</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{enquiry.phone}</div>
              {enquiry.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{enquiry.email}</div>}
              {enquiry.city && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{enquiry.city}</div>}
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{enquiry.tenancy_type === 'BUILDER_DEVELOPER' ? 'Builder / Developer' : 'Agency / Brokerage'}</div>
            </CardContent>
          </Card>

          {submission ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Onboarding Submission</CardTitle>
                  {submission.status === 'PENDING_REVIEW' && <Badge className="bg-warning/15 text-warning"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>}
                  {submission.status === 'APPROVED' && <Badge className="bg-success/15 text-success"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>}
                  {submission.status === 'REJECTED' && <Badge className="bg-destructive/15 text-destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Submitted {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Company</div><div>{String(payload.company_name ?? '—')}</div></div>
                  <div><div className="text-xs text-muted-foreground">City</div><div>{String(payload.city ?? '—')}</div></div>
                  <div><div className="text-xs text-muted-foreground">Owner</div><div>{String(payload.owner_name ?? '—')}</div></div>
                  <div><div className="text-xs text-muted-foreground">Phone</div><div>{String(payload.owner_phone ?? '—')}</div></div>
                  {payload.gst_number ? <div><div className="text-xs text-muted-foreground">GST</div><div>{String(payload.gst_number)}</div></div> : null}
                  {payload.rera_number ? <div><div className="text-xs text-muted-foreground">RERA</div><div>{String(payload.rera_number)}</div></div> : null}
                </div>
                {teamMembers.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Team members ({teamMembers.length})</div>
                    <div className="space-y-1.5">
                      {teamMembers.map((m, i) => (
                        <div key={i} className="text-sm border rounded p-2 flex justify-between">
                          <span>{m.full_name}</span>
                          <span className="text-xs text-muted-foreground">{m.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {submission.status === 'PENDING_REVIEW' && (
                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => reviewSubmission('APPROVED')} disabled={busy} className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button onClick={() => reviewSubmission('REJECTED')} disabled={busy} variant="outline" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : enquiry.onboarding_pack_sent ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Onboarding Submission</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Awaiting customer to complete the form.
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle className="text-base">Notes & Activity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." rows={2} />
                <Button onClick={addNote} disabled={!newNote.trim() || busy}>Add</Button>
              </div>
              <Separator />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p> :
                  notes.map(n => (
                    <div key={n.id} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                      <p>{n.note_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), 'dd MMM, HH:mm')}</p>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Stage</label>
                <Select value={enquiry.stage} onValueChange={(v: Stage) => updateStage(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(stageLabels) as Stage[]).map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSendOnboarding} disabled={busy} variant={enquiry.onboarding_pack_sent ? 'outline' : 'default'}>
                <Send className="h-4 w-4 mr-2" />
                {enquiry.onboarding_pack_sent ? 'Share Onboarding Link' : 'Send Onboarding Form'}
              </Button>
              <Button className="w-full" disabled={!!convertBlock || busy} onClick={convertToAccount}>
                Convert to Account
              </Button>
              {convertBlock && <p className="text-xs text-muted-foreground text-center">{convertBlock}</p>}
              {enquiry.converted_account_id && (
                <Link to={`/accounts/${enquiry.converted_account_id}`}>
                  <Button variant="outline" className="w-full">View Account</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SendOnboardingDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        link={generateLink()}
        customerName={enquiry.full_name}
        customerPhone={enquiry.phone}
        customerEmail={enquiry.email ?? undefined}
      />
    </div>
  );
}
