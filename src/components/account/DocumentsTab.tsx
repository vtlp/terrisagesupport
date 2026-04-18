import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, FileBadge, Loader2, ExternalLink, FolderOpen, Database, Building2, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type DocCategory = 'Company logo' | 'Project brochure' | 'Property images' | 'Bulk imports' | 'Lead import files' | 'Property import files';

interface DocItem {
  path: string;
  category: DocCategory;
  projectName?: string;
}

interface Props {
  payload: Record<string, unknown>;
}

export function DocumentsTab({ payload }: Props) {
  const [signing, setSigning] = useState<string | null>(null);

  const docs: DocItem[] = useMemo(() => {
    const out: DocItem[] = [];
    const company = (payload?.company as { logo_paths?: string[] } | undefined) ?? {};
    (company.logo_paths ?? []).forEach((p) => out.push({ path: p, category: 'Company logo' }));

    const projects = (payload?.projects as Array<{ projectName?: string; project_name?: string; brochurePaths?: string[] }> | undefined) ?? [];
    projects.forEach((proj, i) => {
      const projectName = proj.projectName || proj.project_name || `Project ${i + 1}`;
      (proj.brochurePaths ?? []).forEach((p) => out.push({ path: p, category: 'Project brochure', projectName }));
    });

    // New unified bulk imports section (current onboarding form)
    const bulkImports = (payload?.bulk_imports as { paths?: string[] } | undefined) ?? {};
    (bulkImports.paths ?? []).forEach((p) => out.push({ path: p, category: 'Bulk imports' }));

    // Legacy keys — kept so older submissions still render their files
    const propertyImport = (payload?.property_import as { image_paths?: string[]; file_paths?: string[] } | undefined) ?? {};
    (propertyImport.image_paths ?? []).forEach((p) => out.push({ path: p, category: 'Property images' }));
    (propertyImport.file_paths ?? []).forEach((p) => out.push({ path: p, category: 'Property import files' }));

    const leadImport = (payload?.lead_import as { file_paths?: string[] } | undefined) ?? {};
    (leadImport.file_paths ?? []).forEach((p) => out.push({ path: p, category: 'Lead import files' }));

    return out;
  }, [payload]);

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

  if (docs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No documents were uploaded during onboarding.
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const groups = docs.reduce<Record<string, DocItem[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d);
    return acc;
  }, {});

  const iconFor = (cat: string) => {
    if (cat === 'Company logo') return <FileBadge className="h-4 w-4 text-primary" />;
    if (cat === 'Project brochure') return <FileText className="h-4 w-4 text-primary" />;
    if (cat === 'Lead import files') return <Database className="h-4 w-4 text-primary" />;
    if (cat === 'Property import files') return <Building2 className="h-4 w-4 text-primary" />;
    return <ImageIcon className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {iconFor(cat)}
              {cat}
              <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((d) => {
                const fileName = d.path.split('/').pop() ?? d.path;
                const cleanName = fileName.replace(/^\d+-[a-z0-9]+-/, '');
                return (
                  <div key={d.path} className="flex items-center justify-between border rounded p-2.5 gap-2 flex-wrap">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{cleanName}</div>
                        {d.projectName && (
                          <div className="text-xs text-muted-foreground">{d.projectName}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openFile(d.path)}
                      disabled={signing === d.path}
                    >
                      {signing === d.path ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      )}
                      Open
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
