import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, User, Phone, Mail, FileText, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProjectRecord {
  projectName?: string;
  project_name?: string;
  location?: string;
  // Agency
  repName?: string;
  repMobile?: string;
  repMobileCode?: string;
  repEmail?: string;
  builderName?: string;
  builderDetails?: string;
  // Builder
  contactName?: string;
  contactMobile?: string;
  contactMobileCode?: string;
  contactEmail?: string;
  propertyType?: string;
  additionalNotes?: string;
  // Files
  brochurePaths?: string[];
}

interface Props {
  payload: Record<string, unknown>;
  accountId?: string;
}

type LinkedProject = {
  id: string;
  job_id: string;
  linked_at: string;
  import_jobs: {
    id: string;
    label: string | null;
    property_type: string | null;
    status: string;
    extracted_data: Record<string, unknown> | null;
    representative_input: Record<string, unknown> | null;
  } | null;
};

function linkedProjectName(lp: LinkedProject): string {
  const job = lp.import_jobs;
  if (!job) return lp.job_id.slice(0, 8);
  const ed = (job.extracted_data ?? {}) as { projectData?: { project_name?: string } };
  const ri = (job.representative_input ?? {}) as { project_name?: string };
  return ed.projectData?.project_name?.trim() || ri.project_name?.trim() || job.label || `Job ${job.id.slice(0, 8)}`;
}

export function ProjectsTab({ payload, accountId }: Props) {
  const projects = (payload?.projects as ProjectRecord[] | undefined) ?? [];
  const [signing, setSigning] = useState<string | null>(null);
  const [linked, setLinked] = useState<LinkedProject[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLinkedLoading(true);
    supabase
      .from('import_job_account_links' as never)
      .select('id, job_id, linked_at, import_jobs:job_id(id, label, property_type, status, extracted_data, representative_input)')
      .eq('account_id', accountId)
      .order('linked_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setLinked(((data ?? []) as unknown) as LinkedProject[]);
        setLinkedLoading(false);
      });
  }, [accountId]);

  const openFile = async (path: string) => {
    setSigning(path);
    const { data, error } = await supabase.storage
      .from('onboarding-uploads')
      .createSignedUrl(path, 60 * 10);
    setSigning(null);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? 'Could not open file');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const linkedSection = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Linked projects from Admin Data
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Projects that the support team has tagged to this account.
        </p>
      </CardHeader>
      <CardContent>
        {linkedLoading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : linked.length === 0 ? (
          <p className="text-xs text-muted-foreground">No linked projects.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {linked.map(lp => (
              <div key={lp.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{linkedProjectName(lp)}</div>
                  <div className="text-xs text-muted-foreground">
                    {lp.import_jobs?.property_type ?? '—'} · linked {new Date(lp.linked_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{lp.import_jobs?.status ?? '—'}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (projects.length === 0) {
    return (
      <div className="space-y-3">
        {accountId && linkedSection}
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No projects were captured during onboarding.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accountId && linkedSection}
      {projects.map((p, i) => {
        const name = p.projectName || p.project_name || `Project ${i + 1}`;
        const contactName = p.repName || p.contactName;
        const contactPhone = p.repMobile
          ? `${p.repMobileCode ?? ''} ${p.repMobile}`.trim()
          : p.contactMobile
          ? `${p.contactMobileCode ?? ''} ${p.contactMobile}`.trim()
          : null;
        const contactEmail = p.repEmail || p.contactEmail;
        const brochures = p.brochurePaths ?? [];

        return (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {name}
                  </CardTitle>
                  {p.location && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.location}
                    </p>
                  )}
                </div>
                {p.propertyType && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {p.propertyType.replace(/-/g, ' ')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(contactName || contactPhone || contactEmail) && (
                <div className="grid sm:grid-cols-3 gap-2">
                  {contactName && (
                    <InfoLine icon={<User className="h-3.5 w-3.5" />} label="Contact" value={contactName} />
                  )}
                  {contactPhone && (
                    <InfoLine icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={contactPhone} />
                  )}
                  {contactEmail && (
                    <InfoLine icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contactEmail} />
                  )}
                </div>
              )}

              {p.builderName && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <InfoLine icon={<Building2 className="h-3.5 w-3.5" />} label="Builder" value={p.builderName} />
                  {p.builderDetails && (
                    <InfoLine icon={<FileText className="h-3.5 w-3.5" />} label="Builder details" value={p.builderDetails} />
                  )}
                </div>
              )}

              {p.additionalNotes && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Additional notes</div>
                  <p className="text-sm whitespace-pre-wrap">{p.additionalNotes}</p>
                </div>
              )}

              {brochures.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Brochures ({brochures.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {brochures.map((path) => {
                      const fileName = path.split('/').pop() ?? path;
                      return (
                        <Button
                          key={path}
                          size="sm"
                          variant="outline"
                          onClick={() => openFile(path)}
                          disabled={signing === path}
                          className="text-xs h-8"
                        >
                          {signing === path ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3 w-3 mr-1" />
                          )}
                          {fileName.replace(/^\d+-[a-z0-9]+-/, '')}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm truncate">{value}</div>
    </div>
  );
}
