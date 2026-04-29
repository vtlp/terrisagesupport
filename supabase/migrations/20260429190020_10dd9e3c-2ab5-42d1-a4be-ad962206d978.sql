-- =========================================================
-- Extraction service: dedicated tables for the brochure
-- extraction backend. Lives alongside the existing import_*
-- tables (which still drive the Imports UI). Designed to be
-- powered by an external Python worker via HMAC-signed callbacks.
-- =========================================================

-- Job lifecycle states (full state machine)
DO $$ BEGIN
  CREATE TYPE public.extraction_job_status AS ENUM (
    'DRAFT',
    'QUEUED',
    'PREPROCESSING',
    'EXTRACTING',
    'NEEDS_REVIEW',
    'FAILED',
    'READY_TO_IMPORT',
    'IMPORTED',
    'PARTIALLY_IMPORTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.extraction_property_type AS ENUM ('APARTMENT','VILLA','PLOT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.extraction_file_type AS ENUM (
    'BROCHURE','LAYOUT','IMAGE','VIDEO','ADDITIONAL_DOCUMENT','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- extraction_jobs ----------
CREATE TABLE IF NOT EXISTS public.extraction_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL,
  tenancy_type    text,
  import_type     text NOT NULL DEFAULT 'PROJECT',
  property_type   public.extraction_property_type,
  status          public.extraction_job_status NOT NULL DEFAULT 'DRAFT',
  simulate_mode   boolean NOT NULL DEFAULT false,
  result_summary  jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings_count  integer NOT NULL DEFAULT 0,
  errors_count    integer NOT NULL DEFAULT 0,
  pages_processed integer NOT NULL DEFAULT 0,
  floorplans_detected integer NOT NULL DEFAULT 0,
  started_at      timestamptz,
  finished_at     timestamptz,
  retry_count     integer NOT NULL DEFAULT 0,
  last_error      text,
  worker_job_ref  text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_account ON public.extraction_jobs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON public.extraction_jobs(status);

-- ---------- extraction_files ----------
CREATE TABLE IF NOT EXISTS public.extraction_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  file_type     public.extraction_file_type NOT NULL DEFAULT 'OTHER',
  mime_type     text,
  size_bytes    bigint,
  page_count    integer,
  uploaded_by   uuid,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extraction_files_job ON public.extraction_files(job_id);

-- ---------- extraction_results ----------
-- One row per job (the latest normalized result). Worker overwrites on retry.
CREATE TABLE IF NOT EXISTS public.extraction_results (
  job_id                  uuid PRIMARY KEY REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  project_data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration_data      jsonb NOT NULL DEFAULT '[]'::jsonb,
  floorplans              jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_assets            jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents               jsonb NOT NULL DEFAULT '[]'::jsonb,
  amenities               jsonb NOT NULL DEFAULT '[]'::jsonb,
  proximity_matrix        jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_banks          jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields          jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions             jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_warnings     jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  plot_config_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_ocr                 jsonb,
  summary                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---------- extraction_activity_log ----------
CREATE TABLE IF NOT EXISTS public.extraction_activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  event_message text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extraction_activity_job ON public.extraction_activity_log(job_id, created_at DESC);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_extraction_jobs_updated ON public.extraction_jobs;
CREATE TRIGGER trg_extraction_jobs_updated
  BEFORE UPDATE ON public.extraction_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_extraction_results_updated ON public.extraction_results;
CREATE TRIGGER trg_extraction_results_updated
  BEFORE UPDATE ON public.extraction_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- RLS ----------
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access extraction_jobs" ON public.extraction_jobs;
CREATE POLICY "Staff full access extraction_jobs" ON public.extraction_jobs
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff full access extraction_files" ON public.extraction_files;
CREATE POLICY "Staff full access extraction_files" ON public.extraction_files
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff full access extraction_results" ON public.extraction_results;
CREATE POLICY "Staff full access extraction_results" ON public.extraction_results
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff full access extraction_activity_log" ON public.extraction_activity_log;
CREATE POLICY "Staff full access extraction_activity_log" ON public.extraction_activity_log
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- ---------- Storage bucket for extraction sources/outputs ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('extraction-files', 'extraction-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff read extraction-files" ON storage.objects;
CREATE POLICY "Staff read extraction-files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'extraction-files' AND is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff write extraction-files" ON storage.objects;
CREATE POLICY "Staff write extraction-files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'extraction-files' AND is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update extraction-files" ON storage.objects;
CREATE POLICY "Staff update extraction-files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'extraction-files' AND is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete extraction-files" ON storage.objects;
CREATE POLICY "Staff delete extraction-files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'extraction-files' AND is_staff(auth.uid()));