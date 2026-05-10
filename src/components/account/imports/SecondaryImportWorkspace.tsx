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
import { UpyardJobProgress, UpyardSnapshot } from './UpyardJobProgress';
import { useUser } from '@/context/UserContext';

export function SecondaryImportWorkspace({ job, onChange }: { job: ImportJob; onChange?: () => void }) {
  const { currentUser } = useUser();
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const validation = (job.validation || {}) as { upyardJobId?: string; tenantId?: string };
  const [upyardJobId, setUpyardJobId] = useState<string | null>(validation.upyardJobId ?? null);
  const [tenantId, setTenantId] = useState<string | null>(validation.tenantId ?? null);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const { data: files } = await supabase.from('import_files').select('*').eq('job_id', job.id).eq('category', 'CSV').limit(1);
      if (!files?.length) { setHeaders([]); setPreviewRows([]); return; }
      const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(files[0].storage_path, 60);
      if (!signed) return;
      const { headers: hs, rows } = await parseTabularFile(signed.signedUrl, files[0].name);
      setHeaders(hs);
      setPreviewRows(rows);
    } catch (_) { /* noop */ } finally { setLoadingPreview(false); }
  }, [job.id]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const runImport = async () => {
    setImporting(true);
    try {
      const { data: files } = await supabase.from('import_files').select('*').eq('job_id', job.id).limit(1);
      if (!files?.length) { toast.error('Upload a file first'); return; }
      const filePath = files[0].storage_path;

      await supabase.from('import_jobs').update({ status: 'IMPORTING', records_total: previewRows.length }).eq('id', job.id);

      const { data, error } = await supabase.functions.invoke('terrisage-onboarding-import', {
        body: { jobId: job.id, accountId: job.account_id, kind: 'SECONDARY_PROPERTY', filePath },
      });
      if (error || !data?.ok) {
        const msg = (data && (data.detail?.error?.message || data.error)) || error?.message || 'Upstream error';
        toast.error(`Import failed: ${msg}`);
        await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
        await logActivity(supabase, job.id, 'import_failed', { error: msg, response: data }, currentUser?.user_id);
        onChange?.();
        return;
      }

      const { tenantId: tId, upyardJobId: uId } = data as { tenantId: string; upyardJobId: string };
      setTenantId(tId);
      setUpyardJobId(uId);
      await supabase.from('import_jobs').update({
        validation: { ...(job.validation as object || {}), tenantId: tId, upyardJobId: uId } as never,
      }).eq('id', job.id);
      await logActivity(supabase, job.id, 'upyard_import_queued', { tenantId: tId, upyardJobId: uId }, currentUser?.user_id);
      toast.success(`Queued at UpYard (${uId.slice(0, 8)})`);
      onChange?.();
    } finally {
      setImporting(false);
    }
  };

  const handleTerminal = async (snap: UpyardSnapshot) => {
    if (snap.status === 'SUCCEEDED') {
      await supabase.from('import_jobs').update({
        records_imported: snap.inserted ?? 0,
        records_total: snap.totalRows ?? previewRows.length,
        records_failed: 0,
        status: 'IMPORTED',
        imported_at: new Date().toISOString(),
      }).eq('id', job.id);
      await logActivity(supabase, job.id, 'import_completed', { upyardJobId, inserted: snap.inserted, report: snap.reportJson }, currentUser?.user_id);
      toast.success(`Imported ${snap.inserted ?? 0} properties via UpYard`);
    } else if (snap.status === 'FAILED') {
      await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
      await logActivity(supabase, job.id, 'import_failed', { upyardJobId, failureCode: snap.failureCode, report: snap.reportJson }, currentUser?.user_id);
      toast.error(`UpYard import failed: ${snap.failureCode ?? 'unknown'}`);
    }
    onChange?.();
  };

  const isTerminal = job.status === 'IMPORTED' || job.status === 'FAILED';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Secondary market property import</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{job.label || `Job ${job.id.slice(0, 8)}`}</p>
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
            <SourceFiles jobId={job.id} accountId={job.account_id} onChange={() => { onChange?.(); loadPreview(); }} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-3">
          {tenantId && upyardJobId && (
            <UpyardJobProgress
              tenantId={tenantId}
              upyardJobId={upyardJobId}
              active={!isTerminal}
              onTerminal={handleTerminal}
            />
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="font-medium">{previewRows.length}</span> rows detected from {headers.length} columns
                </div>
                <Button onClick={runImport} disabled={importing || previewRows.length === 0 || isTerminal || job.status === 'IMPORTING'}>
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
