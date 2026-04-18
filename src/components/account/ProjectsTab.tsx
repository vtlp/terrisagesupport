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
}

export function ProjectsTab({ payload }: Props) {
  const projects = (payload?.projects as ProjectRecord[] | undefined) ?? [];
  const [signing, setSigning] = useState<string | null>(null);

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

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No projects were captured during onboarding.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
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
