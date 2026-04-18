import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Briefcase, Home, Tag } from 'lucide-react';

interface Props {
  payload: Record<string, unknown>;
}

const labelize = (val?: string | null) =>
  (val ?? '').toString().replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function OnboardingFactsCard({ payload }: Props) {
  const company = (payload?.company as Record<string, unknown> | undefined) ?? {};
  const tagline = (company.tagline as string | undefined)?.trim();
  const businessArea = (company.business_area as string | undefined)?.trim();
  const propertyTypeFocus = (company.property_type_focus as string | undefined)?.trim();

  const hasAny = tagline || businessArea || propertyTypeFocus;
  if (!hasAny) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          From onboarding form
        </CardTitle>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
        {tagline && (
          <Fact icon={<Tag className="h-3.5 w-3.5" />} label="Company tagline">
            <p className="text-sm italic">&ldquo;{tagline}&rdquo;</p>
          </Fact>
        )}
        {businessArea && (
          <Fact icon={<Briefcase className="h-3.5 w-3.5" />} label="Business area">
            <Badge variant="outline" className="text-xs">{labelize(businessArea)}</Badge>
          </Fact>
        )}
        {propertyTypeFocus && (
          <Fact icon={<Home className="h-3.5 w-3.5" />} label="Property type focus">
            <Badge variant="outline" className="text-xs">{labelize(propertyTypeFocus)}</Badge>
          </Fact>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div>{children}</div>
    </div>
  );
}
