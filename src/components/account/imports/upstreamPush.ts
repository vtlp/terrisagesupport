import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type EntityType = 'leads' | 'properties';

async function markFailed(jobId: string, message: string) {
  await supabase.from('import_jobs').update({ status: 'FAILED' }).eq('id', jobId);
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'import_failed', detail: { source: 'terrisage', message } as never,
  }]);
}

async function markImported(jobId: string, inserted: number | null) {
  const patch: Record<string, unknown> = {
    status: 'IMPORTED',
    imported_at: new Date().toISOString(),
    records_failed: 0,
  };
  if (typeof inserted === 'number') patch.records_imported = inserted;
  await supabase.from('import_jobs').update(patch).eq('id', jobId);
  await supabase.from('import_activity').insert([{
    job_id: jobId, event: 'import_completed', detail: { source: 'terrisage', inserted } as never,
  }]);
}

async function pollUntilTerminal(accountId: string, jobId: string, label: string, onChange?: () => void) {
  const start = Date.now();
  const maxMs = 2 * 60 * 1000;
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const { data, error } = await supabase.functions.invoke('terrisage-onboarding-ingest', {
        body: { action: 'poll', accountId, jobId },
      });
      if (error || !data?.ok) continue;
      const status = data.status as string;
      if (status === 'SUCCEEDED') {
        const inserted = (data.data?.inserted ?? null) as number | null;
        await markImported(jobId, inserted);
        toast.success(`Terrisage accepted ${inserted ?? '?'} ${label}. Import successful.`);
        onChange?.();
        return;
      }
      if (status === 'FAILED') {
        const code = data.data?.failureCode ?? data.data?.error ?? 'unknown';
        const msg = data.data?.message ?? data.data?.detail ?? '';
        const full = msg ? `${code}: ${msg}` : String(code);
        await markFailed(jobId, full);
        toast.error(`Terrisage rejected ${label}: ${full}`);
        onChange?.();
        return;
      }
    } catch (_) { /* keep polling */ }
  }
  toast.message(`Terrisage ${label} push still processing - check Activity tab later.`);
  onChange?.();
}

export async function pushToUpstream(
  entityType: EntityType,
  jobId: string,
  accountId: string,
  onChange?: () => void,
) {
  try {
    const { data, error } = await supabase.functions.invoke('terrisage-onboarding-ingest', {
      body: { action: 'import', accountId, jobId, entityType },
    });
    if (error) {
      await markFailed(jobId, error.message);
      toast.error(`Import failed - Terrisage push error: ${error.message}`);
      onChange?.();
      return;
    }
    if (!data?.ok) {
      const detail = data?.detail ? ` (${data.detail})` : '';
      const msg = `${data?.error ?? 'unknown'}${detail}`;
      await markFailed(jobId, msg);
      toast.error(`Import failed - Terrisage rejected: ${msg}`);
      onChange?.();
      return;
    }
    toast.message(`Submitted to Terrisage (job ${String(data.upstreamJobId ?? '').slice(0, 8)}). Waiting for confirmation…`);
    onChange?.();
    pollUntilTerminal(accountId, jobId, entityType, onChange);
  } catch (e) {
    const msg = (e as Error).message;
    await markFailed(jobId, msg);
    toast.error(`Import failed - Terrisage push error: ${msg}`);
    onChange?.();
  }
}
