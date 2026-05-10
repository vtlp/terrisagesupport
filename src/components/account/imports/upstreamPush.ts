import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type EntityType = 'leads' | 'properties';

async function pollUntilTerminal(accountId: string, jobId: string, label: string) {
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
        const inserted = data.data?.inserted ?? '?';
        toast.success(`Terrisage accepted ${inserted} ${label}`);
        return;
      }
      if (status === 'FAILED') {
        const code = data.data?.failureCode ?? 'unknown';
        toast.error(`Terrisage rejected ${label}: ${code}`);
        return;
      }
    } catch (_) { /* keep polling */ }
  }
  toast.message(`Terrisage ${label} push still processing - check Activity tab later.`);
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
      toast.error(`Terrisage push failed: ${error.message}`);
      onChange?.();
      return;
    }
    if (!data?.ok) {
      if (data?.error === 'NO_TENANT') {
        toast.message('Local rows saved. Account is not yet linked to an Terrisage tenant - push skipped.');
      } else {
        toast.error(`Terrisage push failed: ${data?.error ?? 'unknown'}${data?.detail ? ` (${data.detail})` : ''}`);
      }
      onChange?.();
      return;
    }
    toast.success(`Submitted to Terrisage (job ${String(data.upstreamJobId ?? '').slice(0, 8)}). Polling…`);
    onChange?.();
    pollUntilTerminal(accountId, jobId, entityType).then(() => onChange?.());
  } catch (e) {
    toast.error(`Terrisage push failed: ${(e as Error).message}`);
  }
}
