import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ImportJob, STATUS_LABEL, STATUS_TONE, ImportStatus, ImportRow, RowState, logActivity } from './shared';
import { SourceFiles } from './SourceFiles';
import { ActivityLog } from './ActivityLog';
import { useUser } from '@/context/UserContext';

const LEAD_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'budget', label: 'Budget', required: false },
  { key: 'interested_localities', label: 'Interested localities', required: false },
  { key: 'interested_projects', label: 'Interested projects', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

const ROW_TONE: Record<RowState, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  VALID: 'bg-success/15 text-success',
  WARNING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  INVALID: 'bg-destructive/15 text-destructive',
  IMPORTED: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/15 text-destructive',
  SKIPPED: 'bg-muted text-muted-foreground',
};

const NONE = '__none__';

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (l: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const cells = split(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
  return { headers, rows };
}

const normalizePhone = (p: string) => p.replace(/[^\d+]/g, '');

export function LeadImportWorkspace({ job, onChange }: { job: ImportJob; onChange?: () => void }) {
  const { currentUser } = useUser();
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>(((job.mapping as Record<string, string>) || {}));
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    const { data } = await supabase.from('import_record_rows').select('*').eq('job_id', job.id).order('row_index');
    setRows((data ?? []) as ImportRow[]);
    setLoadingRows(false);
  }, [job.id]);

  useEffect(() => { loadRows(); }, [loadRows]);

  // Pull headers from first uploaded CSV file
  useEffect(() => {
    (async () => {
      const { data: files } = await supabase.from('import_files').select('*').eq('job_id', job.id).eq('category', 'CSV').limit(1);
      if (!files || files.length === 0) { setHeaders([]); return; }
      const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(files[0].storage_path, 60);
      if (!signed) return;
      try {
        const res = await fetch(signed.signedUrl);
        const text = await res.text();
        const { headers: hs } = parseCSV(text);
        setHeaders(hs);
      } catch (e) {
        // ignore
      }
    })();
  }, [job.id]);

  const parseFile = async () => {
    setParsing(true);
    const { data: files } = await supabase.from('import_files').select('*').eq('job_id', job.id).eq('category', 'CSV').limit(1);
    if (!files || files.length === 0) { toast.error('Upload a CSV first'); setParsing(false); return; }
    const { data: signed } = await supabase.storage.from('import-files').createSignedUrl(files[0].storage_path, 60);
    const res = await fetch(signed!.signedUrl);
    const text = await res.text();
    const { headers: hs, rows: parsed } = parseCSV(text);
    setHeaders(hs);

    // Validate per-row
    const phoneSeen = new Set<string>();
    const insertRows = parsed.map((r, idx) => {
      const data: Record<string, string> = {};
      LEAD_FIELDS.forEach(f => {
        const sourceCol = mapping[f.key];
        if (sourceCol && sourceCol !== NONE) data[f.key] = r[sourceCol] ?? '';
      });
      const errors: string[] = [];
      const warnings: string[] = [];
      LEAD_FIELDS.filter(f => f.required).forEach(f => {
        if (!data[f.key]) errors.push(`Missing ${f.label}`);
      });
      if (data.phone) {
        const p = normalizePhone(data.phone);
        if (p.replace(/^\+?91/, '').length < 10) errors.push('Phone too short');
        if (phoneSeen.has(p)) warnings.push('Duplicate phone in file');
        phoneSeen.add(p);
        data.phone = p;
      }
      const state: RowState = errors.length > 0 ? 'INVALID' : warnings.length > 0 ? 'WARNING' : 'VALID';
      return {
        job_id: job.id, row_index: idx, data: data as never,
        errors: errors as never, warnings: warnings as never, state,
      };
    });

    await supabase.from('import_record_rows').delete().eq('job_id', job.id);
    if (insertRows.length) {
      const { error } = await supabase.from('import_record_rows').insert(insertRows);
      if (error) toast.error(error.message);
    }

    const total = insertRows.length;
    const invalid = insertRows.filter(r => r.state === 'INVALID').length;
    const valid = total - invalid;

    await supabase.from('import_jobs').update({
      mapping: mapping as never,
      records_total: total,
      status: invalid === 0 && valid > 0 ? 'READY_TO_IMPORT' : invalid > 0 && valid === 0 ? 'VALIDATION_FAILED' : 'NEEDS_REVIEW',
      validation: { total, valid, invalid, warnings: insertRows.filter(r => r.state === 'WARNING').length } as never,
    }).eq('id', job.id);
    await logActivity(supabase, job.id, 'rows_parsed', { total, valid, invalid });
    setParsing(false);
    toast.success(`Parsed ${total} rows`);
    onChange?.();
    loadRows();
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const { data: files } = await supabase.from('import_files').select('*').eq('job_id', job.id).limit(1);
      if (!files?.length) { toast.error('Upload a file first'); setImporting(false); return; }
      const filePath = files[0].storage_path;

      await supabase.from('import_jobs').update({ status: 'IMPORTING' }).eq('id', job.id);

      const { data, error } = await supabase.functions.invoke('terrisage-onboarding-import', {
        body: { jobId: job.id, accountId: job.account_id, kind: 'LEAD', filePath },
      });
      if (error || !data?.ok) {
        const msg = (data && (data.detail?.error?.message || data.error)) || error?.message || 'Upstream error';
        toast.error(`Import failed: ${msg}`);
        await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
        await logActivity(supabase, job.id, 'import_failed', { error: msg, response: data }, currentUser?.user_id);
        setImporting(false); onChange?.(); return;
      }

      const { tenantId, upyardJobId } = data as { tenantId: string; upyardJobId: string };
      await logActivity(supabase, job.id, 'upyard_import_queued', { tenantId, upyardJobId }, currentUser?.user_id);
      toast.success(`Queued at UpYard (job ${upyardJobId.slice(0, 8)})`);

      // Poll status
      let final: { status?: string; inserted?: number; totalRows?: number; failureCode?: string; reportJson?: unknown } | null = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const { data: st } = await supabase.functions.invoke('terrisage-onboarding-import?action=status', {
          body: { tenantId, upyardJobId },
        });
        const p = (st?.payload ?? {}) as { status?: string };
        if (p.status === 'SUCCEEDED' || p.status === 'FAILED') { final = p as never; break; }
      }
      if (!final) {
        toast.message('Still processing at UpYard. Refresh later for final status.');
        await logActivity(supabase, job.id, 'upyard_import_pending', { upyardJobId }, currentUser?.user_id);
      } else if (final.status === 'SUCCEEDED') {
        await supabase.from('import_jobs').update({
          records_imported: final.inserted ?? 0, records_total: final.totalRows ?? rows.length, records_failed: 0,
          status: 'IMPORTED', imported_at: new Date().toISOString(),
        }).eq('id', job.id);
        await logActivity(supabase, job.id, 'import_completed', { upyardJobId, inserted: final.inserted, report: final.reportJson }, currentUser?.user_id);
        toast.success(`Imported ${final.inserted ?? 0} leads via UpYard`);
      } else {
        await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', job.id);
        await logActivity(supabase, job.id, 'import_failed', { upyardJobId, failureCode: final.failureCode, report: final.reportJson }, currentUser?.user_id);
        toast.error(`UpYard import failed: ${final.failureCode ?? 'unknown'}`);
      }
    } finally {
      setImporting(false); onChange?.(); loadRows();
    }
  };

  const summary = useMemo(() => ({
    total: rows.length,
    valid: rows.filter(r => r.state === 'VALID').length,
    warning: rows.filter(r => r.state === 'WARNING').length,
    invalid: rows.filter(r => r.state === 'INVALID').length,
    imported: rows.filter(r => r.state === 'IMPORTED').length,
  }), [rows]);

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
          <TabsTrigger value="mapping">Mapping</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <Card><CardContent className="pt-4">
            <SourceFiles jobId={job.id} accountId={job.account_id} accept=".csv,.xlsx,.xls" allowedCategories={['CSV', 'OTHER']} onChange={onChange} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card><CardContent className="pt-4 space-y-3">
            {headers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload a CSV in the Source file tab to detect columns.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Map your CSV columns to lead fields. Phone is the primary identifier.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {LEAD_FIELDS.map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-sm font-medium">
                        {f.label} {f.required && <span className="text-destructive">*</span>}
                      </label>
                      <Select value={mapping[f.key] || NONE} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— Not mapped —</SelectItem>
                          {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <Button onClick={parseFile} disabled={parsing}>
                  {parsing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <PlayCircle className="h-4 w-4 mr-1" /> Parse and validate
                </Button>
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="font-medium">{summary.total}</span> rows ·{' '}
                  <CheckCircle2 className="h-3 w-3 inline text-success" /> {summary.valid} valid ·{' '}
                  <AlertTriangle className="h-3 w-3 inline text-amber-600" /> {summary.warning} warnings ·{' '}
                  <XCircle className="h-3 w-3 inline text-destructive" /> {summary.invalid} invalid
                  {summary.imported > 0 && <> · <span className="text-success font-medium">{summary.imported} imported</span></>}
                </div>
                <Button onClick={runImport} disabled={importing || summary.valid + summary.warning === 0 || job.status === 'IMPORTED'}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm and import
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRows ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Parse a file to see rows here.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-1.5">#</th>
                        <th className="text-left px-2 py-1.5">Status</th>
                        {LEAD_FIELDS.map(f => <th key={f.key} className="text-left px-2 py-1.5">{f.label}</th>)}
                        <th className="text-left px-2 py-1.5">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map(r => {
                        const d = r.data as Record<string, string>;
                        const errs = (r.errors as string[]) || [];
                        const warns = (r.warnings as string[]) || [];
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="px-2 py-1 text-muted-foreground">{r.row_index + 1}</td>
                            <td className="px-2 py-1"><Badge className={`text-[10px] ${ROW_TONE[r.state as RowState]}`}>{r.state}</Badge></td>
                            {LEAD_FIELDS.map(f => <td key={f.key} className="px-2 py-1 truncate max-w-[140px]">{d[f.key] ?? ''}</td>)}
                            <td className="px-2 py-1 text-[11px]">
                              {errs.map(e => <div key={e} className="text-destructive">{e}</div>)}
                              {warns.map(w => <div key={w} className="text-amber-600">{w}</div>)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rows.length > 200 && <p className="text-xs text-muted-foreground p-2">Showing first 200 of {rows.length} rows.</p>}
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
