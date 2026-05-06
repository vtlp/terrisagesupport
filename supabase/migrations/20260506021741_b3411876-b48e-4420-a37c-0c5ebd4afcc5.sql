
-- Enum
DO $$ BEGIN
  CREATE TYPE public.project_request_status AS ENUM (
    'PENDING_REVIEW','APPROVED','REJECTED','IMPORT_IN_PROGRESS','LIVE','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.project_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  external_request_id text,
  project_name text NOT NULL,
  location text,
  city text,
  representative_name text,
  representative_phone text,
  representative_email text,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.project_request_status NOT NULL DEFAULT 'PENDING_REVIEW',
  rejection_reason text,
  import_job_id uuid,
  crm_project_id uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  live_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_requests_external_unique UNIQUE (account_id, external_request_id)
);

CREATE INDEX IF NOT EXISTS project_requests_account_status_idx
  ON public.project_requests(account_id, status);
CREATE INDEX IF NOT EXISTS project_requests_status_idx
  ON public.project_requests(status);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.touch_project_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_project_requests_touch ON public.project_requests;
CREATE TRIGGER trg_project_requests_touch
BEFORE UPDATE ON public.project_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_project_requests_updated_at();

-- RLS
ALTER TABLE public.project_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access project_requests" ON public.project_requests;
CREATE POLICY "Staff full access project_requests"
ON public.project_requests
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- Auto-mark request LIVE when its linked import_job reaches IMPORTED
CREATE OR REPLACE FUNCTION public.sync_project_request_on_import_done()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request_id uuid;
  v_crm_project_id uuid;
BEGIN
  IF NEW.status = 'IMPORTED' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- look for a project_request that points to this job
    SELECT id INTO v_request_id
      FROM public.project_requests
     WHERE import_job_id = NEW.id
     LIMIT 1;

    IF v_request_id IS NOT NULL THEN
      -- pick up the most recent crm_project for this account from this job, if any
      SELECT id INTO v_crm_project_id
        FROM public.crm_projects
       WHERE source_job_id = NEW.id
       ORDER BY created_at DESC
       LIMIT 1;

      UPDATE public.project_requests
         SET status = 'LIVE',
             live_at = now(),
             crm_project_id = COALESCE(v_crm_project_id, crm_project_id)
       WHERE id = v_request_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_import_jobs_request_live ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_request_live
AFTER UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_project_request_on_import_done();
