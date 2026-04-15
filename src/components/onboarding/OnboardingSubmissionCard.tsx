import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SubmissionStatus } from '@/types/core';
import type { OnboardingFormSubmission } from '@/types/core';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Link2, Copy, ExternalLink, Users, Building2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OnboardingSubmissionCardProps {
  formLink: string | null;
  submission: OnboardingFormSubmission | null;
  packSent: boolean;
  onApprove: () => void;
  onReject: () => void;
  onResendLink: () => void;
}

export function OnboardingSubmissionCard({ formLink, submission, packSent, onApprove, onReject, onResendLink }: OnboardingSubmissionCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!packSent) return null;

  const copyLink = () => {
    if (formLink) {
      navigator.clipboard.writeText(formLink);
      toast.success('Form link copied to clipboard');
    }
  };

  // No submission yet
  if (!submission) {
    return (
      <Card className="border-warning/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Onboarding Form
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-warning border-warning/30">Awaiting Submission</Badge>
          </div>
          {formLink && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Form link sent to customer:</p>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs font-mono break-all">
                <Link2 className="h-3 w-3 flex-shrink-0" />
                <span className="flex-1">{formLink}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={copyLink}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Approved
  if (submission.status === SubmissionStatus.APPROVED) {
    return (
      <Card className="border-success/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="font-medium text-success text-sm">Onboarding Form Approved</p>
              <p className="text-xs text-muted-foreground">
                {submission.reviewed_at && `Approved on ${format(new Date(submission.reviewed_at), 'dd MMM yyyy')}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rejected
  if (submission.status === SubmissionStatus.REJECTED) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive text-sm">Onboarding Form Rejected</p>
              <p className="text-xs text-muted-foreground">
                {submission.reviewed_at && `Rejected on ${format(new Date(submission.reviewed_at), 'dd MMM yyyy')}`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onResendLink}>
            <ExternalLink className="h-3 w-3 mr-1" /> Re-send Form Link
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pending Review
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Onboarding Submission
          <Badge className="bg-primary/15 text-primary text-xs">Pending Review</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Submitted {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              {isOpen ? 'Hide Details' : 'Show Details'}
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {/* Business Info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Business Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Field label="Company" value={submission.company_name} />
                <Field label="City" value={submission.city} />
                <Field label="Address" value={submission.company_address} />
                <Field label="Owner" value={submission.owner_name} />
                <Field label="Email" value={submission.owner_email} />
                <Field label="Phone" value={submission.owner_phone} />
                <Field label="GST" value={submission.gst_number} />
                <Field label="PAN" value={submission.pan_number} />
                <Field label="RERA" value={submission.rera_number} />
                <Field label="Website" value={submission.website_url} />
              </div>
            </div>

            {/* Team Members */}
            {submission.team_members.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <Users className="h-3 w-3" /> Team Members ({submission.team_members.length})
                </h4>
                <div className="space-y-1">
                  {submission.team_members.map((m, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                      <span className="font-medium">{m.name}</span> — {m.role} · {m.email} · {m.phone}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {submission.projects.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Projects ({submission.projects.length})</h4>
                <div className="space-y-1">
                  {submission.projects.map((p, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                      <span className="font-medium">{p.project_name}</span> — {p.location} · {p.units} units · {p.type}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {submission.uploaded_files.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Uploaded Files</h4>
                {submission.uploaded_files.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground">📎 {f}</p>
                ))}
              </div>
            )}

            {submission.additional_notes && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Notes</h4>
                <p className="text-sm">{submission.additional_notes}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" className="flex-1" onClick={onApprove}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" onClick={onReject}>
            <XCircle className="h-3 w-3 mr-1" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
