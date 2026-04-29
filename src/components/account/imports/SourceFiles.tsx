import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, Image as ImageIcon, Video, FileSpreadsheet, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ImportFile, FileCategory, fmtBytes, guessFileCategory, logActivity } from './shared';
import { useUser } from '@/context/UserContext';

interface Props {
  jobId: string;
  accountId: string;
  accept?: string;
  allowedCategories?: FileCategory[];
  onChange?: () => void;
}

const CATEGORY_ICON: Record<FileCategory, typeof FileText> = {
  BROCHURE: FileText, IMAGE: ImageIcon, VIDEO: Video, DOCUMENT: FileText,
  CSV: FileSpreadsheet, FLOOR_PLAN: ImageIcon, LOGO: ImageIcon, OTHER: FileText,
};
const CATEGORY_LABEL: Record<FileCategory, string> = {
  BROCHURE: 'Brochures', IMAGE: 'Images', VIDEO: 'Videos', DOCUMENT: 'Documents',
  CSV: 'Spreadsheets', FLOOR_PLAN: 'Floor plans', LOGO: 'Logos', OTHER: 'Other',
};

export function SourceFiles({ jobId, accountId, accept, allowedCategories, onChange }: Props) {
  const { currentUser } = useUser();
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('import_files').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setFiles((data ?? []) as ImportFile[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      const cat = guessFileCategory(file.type, file.name);
      if (allowedCategories && !allowedCategories.includes(cat) && !allowedCategories.includes('OTHER')) {
        toast.error(`${file.name}: file type not allowed here`);
        continue;
      }
      const path = `${accountId}/${jobId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('import-files').upload(path, file);
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
      const { error } = await supabase.from('import_files').insert([{
        job_id: jobId, category: cat, name: file.name, storage_path: path,
        mime_type: file.type, size_bytes: file.size, state: 'UPLOADED',
        uploaded_by: currentUser?.user_id ?? null,
      }]);
      if (error) { toast.error(error.message); continue; }
      uploaded++;
    }
    if (uploaded > 0) {
      // bump count on the job
      await supabase.rpc('execute_sql' as never).then(() => {}, () => {}); // no-op safeguard
      const { count } = await supabase.from('import_files').select('id', { count: 'exact', head: true }).eq('job_id', jobId);
      await supabase.from('import_jobs').update({ source_files_count: count ?? 0 }).eq('id', jobId);
      await logActivity(supabase, jobId, 'files_uploaded', { count: uploaded });
      toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? 's' : ''}`);
      onChange?.();
    }
    setBusy(false);
    load();
  };

  const remove = async (f: ImportFile) => {
    if (!confirm(`Remove ${f.name}?`)) return;
    await supabase.storage.from('import-files').remove([f.storage_path]);
    await supabase.from('import_files').delete().eq('id', f.id);
    const { count } = await supabase.from('import_files').select('id', { count: 'exact', head: true }).eq('job_id', jobId);
    await supabase.from('import_jobs').update({ source_files_count: count ?? 0 }).eq('id', jobId);
    await logActivity(supabase, jobId, 'file_removed', { name: f.name });
    onChange?.();
    load();
  };

  const download = async (f: ImportFile) => {
    const { data, error } = await supabase.storage.from('import-files').createSignedUrl(f.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  const grouped: Partial<Record<FileCategory, ImportFile[]>> = {};
  files.forEach(f => {
    const c = f.category as FileCategory;
    grouped[c] = grouped[c] || [];
    grouped[c]!.push(f);
  });

  return (
    <div className="space-y-3">
      <label className="block">
        <input type="file" multiple accept={accept} className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
        <div className="border-2 border-dashed rounded-md p-5 text-center hover:border-primary cursor-pointer transition-colors">
          {busy ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
            <>
              <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-sm">Click to upload or drop files here</div>
              <div className="text-xs text-muted-foreground mt-0.5">{accept || 'Any file type'}</div>
            </>
          )}
        </div>
      </label>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No files uploaded yet.</p>
      ) : (
        <div className="space-y-3">
          {(Object.keys(grouped) as FileCategory[]).map(cat => {
            const Icon = CATEGORY_ICON[cat];
            return (
              <div key={cat}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  {CATEGORY_LABEL[cat]} <Badge variant="outline" className="ml-1 text-[10px]">{grouped[cat]!.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {grouped[cat]!.map(f => (
                    <div key={f.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{fmtBytes(f.size_bytes)} · {f.state}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => download(f)}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
