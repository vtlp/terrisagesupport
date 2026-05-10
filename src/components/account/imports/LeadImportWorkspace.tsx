import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImportJob, STATUS_LABEL, STATUS_TONE, ImportStatus, logActivity, parseTabularFile } from './shared';
import { SourceFiles } from './SourceFiles';
import { ActivityLog } from './ActivityLog';
import { pushToUpstream } from './upstreamPush';
import { useUser } from '@/context/UserContext';

const PHONE_KEYS = ['phone', 'mobile', 'contact', 'phone_number', 'mobile_number'];

function pickPhone(row: Record<string, string>): string | null {
  for (const k of Object.keys(row)) {
    if (PHONE_KEYS.includes(k.toLowerCase().replace(/\s+/g, '_'))) {
      const v = (row[k] ?? '').replace(/[^\d+]/g, '');
      if (v) return v;
    }
  }
  return null;
}

export function LeadImportWorkspace({ job, onChange }: { job: ImportJob; onChange?: () => void }) {
  const { currentUser } = useUser();
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const { data: files } = await supabase.from('import_files').select('*').eq('job_id', job.id).eq('category', 'CSV').order('created_at', { ascending: false }).limit(1);
      if (!files?.length) { setHeaders([]); setPreviewRows([]); return; }
      const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(files[0].storage_path, 60);
      if (!signed) return;
      const bust = `${signed.signedUrl}${signed.signedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const { headers: hs, rows } = await parseTabularFile(bust, files[0].name);
      setHeaders(hs);
      setPreviewRows(rows);
    } catch (_) { /* noop */ } finally { setLoadingPreview(false); }
  }, [job.id]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const runImport = async () => {
    if (previewRows.length === 0) { toast.error('No rows to import'); return; }
    setImporting(true);
    try {
      await supabase.from('import_jobs').update({ status: 'IMPORTING', records_total: previewRows.length }).eq('id', job.id);

      const records = previewRows.map(r => ({
        account_id: job.account_id,
        source_job_id: job.id,
        phone: pickPhone(r),
        data: r as never,
        created_by: currentUser?.user_id ?? null,
      }));

      const { error, count } = await supabase.from('crm_leads').insert(records, { count: 'exact' });
      if (error) {
        toast.error(`Import failed: ${error.message}`);
        await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
        await logActivity(supabase, job.id, 'import_failed', { error: error.message }, currentUser?.user_id);
        onChange?.();
        return;
      }

      const inserted = count ?? records.length;
      await supabase.from('import_jobs').update({
        records_imported: inserted,
        records_failed: 0,
      }).eq('id', job.id);
      await logActivity(supabase, job.id, 'rows_parsed', { inserted, stage: 'local_insert' }, currentUser?.user_id);
      toast.message(`${inserted} leads staged locally. Awaiting Terrisage confirmation…`);
      onChange?.();
      pushToUpstream('leads', job.id, job.account_id, onChange);
    } finally {
      setImporting(false);
    }
  };

  const isTerminal = job.status === 'IMPORTED' || job.status === 'FAILED';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Lead import</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {job.label || `Job ${job.id.slice(0, 8)}`} · created {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
            <Badge className={`text-[10px] ${STATUS_TONE[job.status as ImportStatus]}`}>{STATUS_LABEL[job.status as ImportStatus]}</Badge>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Source file</TabsTrigger>
          <TabsTrigger value="review">Review and import</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <Card><CardContent className="pt-4">
            <SourceFiles jobId={job.id} accountId={job.account_id} accept=".csv,.xlsx,.xls" allowedCategories={['CSV', 'OTHER']} onChange={() => { onChange?.(); loadPreview(); }} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="font-medium">{previewRows.length}</span> rows detected from {headers.length} columns
                  {job.records_imported > 0 && <> · <span className="text-success font-medium">{job.records_imported} imported</span></>}
                </div>
                <Button onClick={runImport} disabled={importing || previewRows.length === 0 || isTerminal}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm and import
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : previewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Upload a file in the Source file tab to preview rows.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-1.5">#</th>
                        {headers.map(h => <th key={h} className="text-left px-2 py-1.5 whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 200).map((r, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                          {headers.map(h => <td key={h} className="px-2 py-1 truncate max-w-[180px]">{r[h] ?? ''}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewRows.length > 200 && <p className="text-xs text-muted-foreground p-2">Showing first 200 of {previewRows.length} rows.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="pt-4"><ActivityLog jobId={job.id} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
