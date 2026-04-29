// Shared types, constants, and helpers for the Imports module.
import type { Tables } from '@/integrations/supabase/types';

export type ImportKind = 'PROJECT' | 'SECONDARY_PROPERTY' | 'LEAD';
export type ImportStatus =
  | 'DRAFT' | 'FILES_UPLOADING' | 'EXTRACTION_QUEUED' | 'EXTRACTING'
  | 'EXTRACTION_FAILED' | 'NEEDS_REVIEW' | 'VALIDATION_FAILED'
  | 'READY_TO_IMPORT' | 'IMPORTING' | 'IMPORTED' | 'PARTIALLY_IMPORTED'
  | 'FAILED' | 'ARCHIVED';
export type PropertyType = 'APARTMENT' | 'VILLA' | 'PLOT';
export type FileCategory = 'BROCHURE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'CSV' | 'FLOOR_PLAN' | 'LOGO' | 'OTHER';
export type MediaCategory = 'LOGO' | 'GALLERY' | 'FLOOR_PLAN' | 'BROCHURE' | 'VIDEO' | 'DOCUMENT' | 'OTHER';
export type MediaReview = 'PENDING' | 'CORRECT' | 'INCORRECT' | 'DUPLICATE' | 'NEEDS_RECROP';
export type RowState = 'PENDING' | 'VALID' | 'WARNING' | 'INVALID' | 'IMPORTED' | 'FAILED' | 'SKIPPED';

export type ImportJob = Tables<'import_jobs'>;
export type ImportFile = Tables<'import_files'>;
export type ImportActivity = Tables<'import_activity'>;
export type ImportConfig = Tables<'import_project_configs'>;
export type ImportMedia = Tables<'import_project_media'>;
export type ImportRow = Tables<'import_record_rows'>;

export const KIND_LABEL: Record<ImportKind, string> = {
  PROJECT: 'Project',
  SECONDARY_PROPERTY: 'Secondary market property',
  LEAD: 'Lead',
};

export const STATUS_LABEL: Record<ImportStatus, string> = {
  DRAFT: 'Draft',
  FILES_UPLOADING: 'Files uploading',
  EXTRACTION_QUEUED: 'Extraction queued',
  EXTRACTING: 'Extracting',
  EXTRACTION_FAILED: 'Extraction failed',
  NEEDS_REVIEW: 'Needs review',
  VALIDATION_FAILED: 'Validation failed',
  READY_TO_IMPORT: 'Ready to import',
  IMPORTING: 'Importing',
  IMPORTED: 'Imported',
  PARTIALLY_IMPORTED: 'Partially imported',
  FAILED: 'Failed',
  ARCHIVED: 'Archived',
};

export const STATUS_TONE: Record<ImportStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  FILES_UPLOADING: 'bg-primary/15 text-primary',
  EXTRACTION_QUEUED: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  EXTRACTING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  EXTRACTION_FAILED: 'bg-destructive/15 text-destructive',
  NEEDS_REVIEW: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  VALIDATION_FAILED: 'bg-destructive/15 text-destructive',
  READY_TO_IMPORT: 'bg-primary/15 text-primary',
  IMPORTING: 'bg-primary/15 text-primary',
  IMPORTED: 'bg-success/15 text-success',
  PARTIALLY_IMPORTED: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  FAILED: 'bg-destructive/15 text-destructive',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  APARTMENT: 'Apartment',
  VILLA: 'Villa',
  PLOT: 'Plot',
};

export const fmtBytes = (n: number | null | undefined) => {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const guessFileCategory = (mime: string | null, name: string): FileCategory => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime?.startsWith('image/')) return 'IMAGE';
  if (mime?.startsWith('video/')) return 'VIDEO';
  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') return 'CSV';
  if (ext === 'pdf') return 'BROCHURE';
  return 'DOCUMENT';
};

import type { supabase as SupabaseClient } from '@/integrations/supabase/client';
export async function logActivity(
  client: typeof SupabaseClient,
  jobId: string,
  event: string,
  detail: Record<string, unknown> = {},
  actorId?: string | null,
) {
  await client.from('import_activity').insert({ job_id: jobId, event, detail, actor_id: actorId ?? null });
}
