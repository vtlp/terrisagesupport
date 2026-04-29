-- ============ ENUMS ============
CREATE TYPE public.import_kind AS ENUM ('PROJECT','SECONDARY_PROPERTY','LEAD');
CREATE TYPE public.import_job_status AS ENUM (
  'DRAFT','FILES_UPLOADING','EXTRACTION_QUEUED','EXTRACTING','EXTRACTION_FAILED',
  'NEEDS_REVIEW','VALIDATION_FAILED','READY_TO_IMPORT','IMPORTING','IMPORTED',
  'PARTIALLY_IMPORTED','FAILED','ARCHIVED'
);
CREATE TYPE public.import_property_type AS ENUM ('APARTMENT','VILLA','PLOT');
CREATE TYPE public.import_file_category AS ENUM (
  'BROCHURE','IMAGE','VIDEO','DOCUMENT','CSV','FLOOR_PLAN','LOGO','OTHER'
);
CREATE TYPE public.import_file_state AS ENUM ('UPLOADED','PROCESSING','PROCESSED','FAILED');
CREATE TYPE public.import_media_category AS ENUM (
  'LOGO','GALLERY','FLOOR_PLAN','BROCHURE','VIDEO','DOCUMENT','OTHER'
);
CREATE TYPE public.import_media_review AS ENUM ('PENDING','CORRECT','INCORRECT','DUPLICATE','NEEDS_RECROP');
CREATE TYPE public.import_row_state AS ENUM ('PENDING','VALID','WARNING','INVALID','IMPORTED','FAILED','SKIPPED');

-- ============ TABLES ============
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  kind public.import_kind NOT NULL,
  status public.import_job_status NOT NULL DEFAULT 'DRAFT',
  label TEXT,
  notes TEXT,
  property_type public.import_property_type,
  representative_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_files_count INTEGER NOT NULL DEFAULT 0,
  records_total INTEGER NOT NULL DEFAULT 0,
  records_imported INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  extraction_started_at TIMESTAMPTZ,
  extraction_finished_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_jobs_account ON public.import_jobs(account_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);

CREATE TABLE public.import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  category public.import_file_category NOT NULL DEFAULT 'OTHER',
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  state public.import_file_state NOT NULL DEFAULT 'UPLOADED',
  error TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_files_job ON public.import_files(job_id);

CREATE TABLE public.import_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  actor_id UUID,
  event TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_activity_job ON public.import_activity(job_id);

CREATE TABLE public.import_project_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'EXTRACTED', -- EXTRACTED | MANUAL
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_configs_job ON public.import_project_configs(job_id);

CREATE TABLE public.import_project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  category public.import_media_category NOT NULL DEFAULT 'GALLERY',
  storage_path TEXT,
  external_url TEXT,
  caption TEXT,
  config_id UUID REFERENCES public.import_project_configs(id) ON DELETE SET NULL,
  review_state public.import_media_review NOT NULL DEFAULT 'PENDING',
  source TEXT NOT NULL DEFAULT 'EXTRACTED',
  confidence NUMERIC,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_media_job ON public.import_project_media(job_id);

CREATE TABLE public.import_record_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  state public.import_row_state NOT NULL DEFAULT 'PENDING',
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_rows_job ON public.import_record_rows(job_id);

-- ============ CRM mirror tables (Support Console-local) ============
CREATE TABLE public.crm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  property_type public.import_property_type,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_projects_account ON public.crm_projects(account_id);

CREATE TABLE public.crm_project_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.crm_project_configs(id) ON DELETE SET NULL,
  category public.import_media_category NOT NULL DEFAULT 'GALLERY',
  storage_path TEXT,
  external_url TEXT,
  caption TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_secondary_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_secondary_account ON public.crm_secondary_properties(account_id);

CREATE TABLE public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_leads_account ON public.crm_leads(account_id);
CREATE INDEX idx_crm_leads_phone ON public.crm_leads(phone);

-- ============ updated_at triggers ============
CREATE TRIGGER trg_import_jobs_updated BEFORE UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_configs_updated BEFORE UPDATE ON public.import_project_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_media_updated BEFORE UPDATE ON public.import_project_media
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crm_projects_updated BEFORE UPDATE ON public.crm_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_project_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_record_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_project_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_secondary_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access import_jobs" ON public.import_jobs FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access import_files" ON public.import_files FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access import_activity" ON public.import_activity FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access import_configs" ON public.import_project_configs FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access import_media" ON public.import_project_media FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access import_rows" ON public.import_record_rows FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access crm_projects" ON public.crm_projects FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access crm_project_configs" ON public.crm_project_configs FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access crm_project_media" ON public.crm_project_media FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access crm_secondary" ON public.crm_secondary_properties FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff full access crm_leads" ON public.crm_leads FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('import-files','import-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read import-files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'import-files' AND is_staff(auth.uid()));
CREATE POLICY "Staff write import-files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'import-files' AND is_staff(auth.uid()));
CREATE POLICY "Staff update import-files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'import-files' AND is_staff(auth.uid()));
CREATE POLICY "Staff delete import-files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'import-files' AND is_staff(auth.uid()));