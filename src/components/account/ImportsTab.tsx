import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, Loader2, Trash2, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Type = 'LISTINGS' | 'LEADS' | 'CONTACTS' | 'OTHER';
type Status = 'UPLOADED' | 'MAPPING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface ImportRow {
  id: string; import_type: Type; file_name: string; storage_path: string;
  size_bytes: number | null; row_count: number | null; status: Status;
  error_log: string | null; created_at: string;
}

const TYPE_LABELS: Record<Type, string> = { LISTINGS: 'Listings', LEADS: 'Leads', CONTACTS: 'Contacts', OTHER: 'Other' };
const STATUS_COLORS: Record<Status, string> = {
  UPLOADED: 'bg-muted text-muted-foreground',
  MAPPING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  PROCESSING: 'bg-primary/15 text-primary',
  COMPLETED: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/15 text-destructive',
};

const fmtBytes = (n: number | null) => {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export function ImportsTab({ accountId }: { accountId: string }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<Type>('LISTINGS');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('data_imports').select('*').eq('account_id', accountId).order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as ImportRow[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    if (!file) { toast.error('Please choose a file'); return; }
    setBusy(true);
    const ext = file.name.split('.').pop();
    const path = `imports/${accountId}/${type}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('kb-files').upload(path, file);
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('data_imports').insert({
      account_id: accountId, import_type: type, file_name: file.name,
      storage_path: path, size_bytes: file.size, status: 'UPLOADED', created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('File uploaded. Mapping queued.');
    setOpen(false); setFile(null); setType('LISTINGS');
    load();
  };

  const markComplete = async (r: ImportRow) => {
    const rowCount = prompt('Enter number of rows imported:', r.row_count?.toString() ?? '0');
    if (rowCount === null) return;
    const n = Number(rowCount);
    if (isNaN(n)) { toast.error('Invalid number'); return; }
    const { error } = await supabase.from('data_imports').update({ status: 'COMPLETED', row_count: n }).eq('id', r.id);
    if (error) toast.error(error.message); else { toast.success('Marked complete'); load(); }
  };

  const remove = async (r: ImportRow) => {
    if (!confirm(`Delete import "${r.file_name}"?`)) return;
    await supabase.storage.from('kb-files').remove([r.storage_path]);
    const { error } = await supabase.from('data_imports').delete().eq('id', r.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from('kb-files').createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Bulk imports</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Upload</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No imports yet. Upload a CSV or XLSX file to begin.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded p-3 gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm truncate">{r.file_name}</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[r.import_type]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtBytes(r.size_bytes)} {r.row_count !== null && `· ${r.row_count} rows`} · {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                  </div>
                  {r.error_log && <p className="text-xs text-destructive mt-1">{r.error_log}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => download(r.storage_path)}>Download</Button>
                  {r.status !== 'COMPLETED' && (
                    <Button variant="ghost" size="sm" onClick={() => markComplete(r)}><CheckCircle2 className="h-4 w-4 text-success" /></Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload data file</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Import type</Label>
              <Select value={type} onValueChange={v => setType(v as Type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as Type[]).map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>File (CSV or XLSX)</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={upload} disabled={busy || !file}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
