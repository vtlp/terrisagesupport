// Helpers for project-request lifecycle actions used by the UI.
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type ProjectRequest = Tables<'project_requests'>;
export type ProjectRequestStatus = ProjectRequest['status'];

export const STATUS_LABEL: Record<ProjectRequestStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IMPORT_IN_PROGRESS: 'Import in progress',
  LIVE: 'Live',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<ProjectRequestStatus, string> = {
  PENDING_REVIEW: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  APPROVED: 'bg-primary/15 text-primary',
  REJECTED: 'bg-destructive/15 text-destructive',
  IMPORT_IN_PROGRESS: 'bg-primary/15 text-primary',
  LIVE: 'bg-success/15 text-success',
  CANCELLED: 'bg-muted text-muted-foreground',
};

async function notifyCrm(requestId: string) {
  try {
    await supabase.functions.invoke('project-request-status-callback', { body: { requestId } });
  } catch (e) {
    console.warn('CRM callback failed', e);
  }
}

async function logActivity(accountId: string, summary: string, details: Record<string, unknown>) {
  await supabase.from('activity_log').insert({
    entity_type: 'account', entity_id: accountId,
    event_type: 'STATUS_CHANGE', summary, details: details as never,
  });
}

export async function approveRequest(req: ProjectRequest, userId: string | null) {
  const { error } = await supabase.from('project_requests')
    .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq('id', req.id);
  if (error) throw error;
  await logActivity(req.account_id, `Project request approved: ${req.project_name}`, { kind: 'PROJECT_REQUEST_APPROVED', request_id: req.id });
  notifyCrm(req.id);
}

export async function rejectRequest(req: ProjectRequest, reason: string, userId: string | null) {
  const { error } = await supabase.from('project_requests')
    .update({ status: 'REJECTED', rejection_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq('id', req.id);
  if (error) throw error;
  await logActivity(req.account_id, `Project request rejected: ${req.project_name}`, { kind: 'PROJECT_REQUEST_REJECTED', request_id: req.id, reason });
  notifyCrm(req.id);
}

export async function cancelRequest(req: ProjectRequest, userId: string | null) {
  const { error } = await supabase.from('project_requests')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancelled_by: userId })
    .eq('id', req.id);
  if (error) throw error;
  await logActivity(req.account_id, `Project request cancelled: ${req.project_name}`, { kind: 'PROJECT_REQUEST_CANCELLED', request_id: req.id });
  notifyCrm(req.id);
}

/**
 * Convert an APPROVED request into an import_jobs row (kind=PROJECT) and link them.
 * Returns the new import job id.
 */
export async function startImportFromRequest(req: ProjectRequest, userId: string | null): Promise<string> {
  const { data: job, error: jErr } = await supabase
    .from('import_jobs')
    .insert({
      account_id: req.account_id,
      kind: 'PROJECT',
      property_type: 'APARTMENT',
      label: req.project_name,
      notes: req.notes ?? null,
      status: 'DRAFT',
      created_by: userId,
      summary: {
        source: 'PROJECT_REQUEST',
        project_request_id: req.id,
        location: req.location,
        representative_name: req.representative_name,
        representative_phone: req.representative_phone,
        representative_email: req.representative_email,
      } as never,
    }).select('id').single();
  if (jErr || !job) throw jErr ?? new Error('Could not create import job');

  const { error: uErr } = await supabase.from('project_requests')
    .update({ status: 'IMPORT_IN_PROGRESS', import_job_id: job.id })
    .eq('id', req.id);
  if (uErr) throw uErr;

  await logActivity(req.account_id, `Started import for project request: ${req.project_name}`, {
    kind: 'PROJECT_REQUEST_IMPORT_STARTED', request_id: req.id, import_job_id: job.id,
  });
  notifyCrm(req.id);
  return job.id;
}
