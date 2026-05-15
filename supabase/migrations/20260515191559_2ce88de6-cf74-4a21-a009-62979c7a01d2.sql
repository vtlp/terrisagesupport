-- Track which global job a tenant job was cloned from (or vice-versa).
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS origin_job_id uuid REFERENCES public.import_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS import_jobs_origin_idx ON public.import_jobs(origin_job_id);

-- When a tenant project import reaches IMPORTED, mirror it into the global Admin → Data list
-- (account_id = NULL) so support can re-link it elsewhere. Dedupes by builder+project name.
CREATE OR REPLACE FUNCTION public.trg_mirror_tenant_imported_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj_name text;
  v_builder_name text;
  v_existing uuid;
  v_new_id uuid;
BEGIN
  IF NEW.kind <> 'PROJECT' THEN RETURN NEW; END IF;
  IF NEW.status <> 'IMPORTED' THEN RETURN NEW; END IF;
  IF NEW.account_id IS NULL THEN RETURN NEW; END IF; -- already global
  IF (TG_OP = 'UPDATE' AND OLD.status = 'IMPORTED') THEN RETURN NEW; END IF;

  v_proj_name := COALESCE(
    (NEW.extracted_data #>> '{projectData,project_name}'),
    (NEW.representative_input ->> 'project_name'),
    NEW.label
  );
  v_builder_name := COALESCE(
    (NEW.extracted_data #>> '{projectData,builder_name}'),
    (NEW.representative_input ->> 'builder_name'),
    ''
  );

  IF v_proj_name IS NULL OR length(trim(v_proj_name)) = 0 THEN RETURN NEW; END IF;

  -- Dedupe: skip if a global job already mirrors this project
  SELECT id INTO v_existing
    FROM public.import_jobs
   WHERE account_id IS NULL
     AND kind = 'PROJECT'
     AND lower(coalesce(extracted_data #>> '{projectData,project_name}', label, '')) = lower(v_proj_name)
     AND lower(coalesce(extracted_data #>> '{projectData,builder_name}', '')) = lower(v_builder_name)
   LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  INSERT INTO public.import_jobs (
    account_id, kind, property_type, label, status,
    representative_input, extracted_data, summary,
    source_files_count, records_imported, records_total,
    imported_at, created_by, origin_job_id
  ) VALUES (
    NULL, NEW.kind, NEW.property_type,
    COALESCE(v_proj_name, NEW.label),
    'IMPORTED',
    NEW.representative_input,
    NEW.extracted_data,
    NEW.summary,
    NEW.source_files_count,
    NEW.records_imported,
    NEW.records_total,
    COALESCE(NEW.imported_at, now()),
    NEW.created_by,
    NEW.id
  ) RETURNING id INTO v_new_id;

  -- Clone configurations
  INSERT INTO public.import_project_configs (job_id, sort_order, data, source, confidence)
    SELECT v_new_id, sort_order, data, 'CLONED', confidence
      FROM public.import_project_configs
     WHERE job_id = NEW.id;

  -- Clone media (storage_path is shared; safe because storage objects are read-only siblings)
  INSERT INTO public.import_project_media (job_id, category, config_id, storage_path, external_url, caption, review_state, source, meta, confidence)
    SELECT v_new_id, category, NULL, storage_path, external_url, caption, review_state, 'CLONED', meta, confidence
      FROM public.import_project_media
     WHERE job_id = NEW.id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_import_jobs_mirror_to_global ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_mirror_to_global
AFTER INSERT OR UPDATE OF status ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.trg_mirror_tenant_imported_project();

-- RPC: link a global project to a tenant by cloning the global job into the tenant
CREATE OR REPLACE FUNCTION public.link_global_project_to_account(_global_job_id uuid, _account_id uuid, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src public.import_jobs%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT * INTO v_src FROM public.import_jobs WHERE id = _global_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source job not found'; END IF;
  IF v_src.account_id IS NOT NULL THEN RAISE EXCEPTION 'Source must be a global project (account_id null)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = _account_id) THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  INSERT INTO public.import_jobs (
    account_id, kind, property_type, label, status,
    representative_input, extracted_data, summary,
    source_files_count, notes, created_by, origin_job_id
  ) VALUES (
    _account_id, v_src.kind, v_src.property_type,
    v_src.label,
    'READY_TO_IMPORT',
    v_src.representative_input,
    v_src.extracted_data,
    v_src.summary,
    v_src.source_files_count,
    COALESCE(_notes, 'Linked from global project ' || _global_job_id::text),
    auth.uid(),
    v_src.id
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.import_project_configs (job_id, sort_order, data, source, confidence)
    SELECT v_new_id, sort_order, data, 'CLONED', confidence
      FROM public.import_project_configs WHERE job_id = _global_job_id;

  INSERT INTO public.import_project_media (job_id, category, config_id, storage_path, external_url, caption, review_state, source, meta, confidence)
    SELECT v_new_id, category, NULL, storage_path, external_url, caption, review_state, 'CLONED', meta, confidence
      FROM public.import_project_media WHERE job_id = _global_job_id;

  PERFORM public.log_activity('ACCOUNT', _account_id, 'FIELD_EDIT',
    'Linked global project: ' || COALESCE(v_src.label, _global_job_id::text),
    jsonb_build_object('global_job_id', _global_job_id, 'new_job_id', v_new_id));

  INSERT INTO public.import_activity (job_id, event, detail, actor_id)
    VALUES (v_new_id, 'linked_from_global',
            jsonb_build_object('global_job_id', _global_job_id, 'account_id', _account_id),
            auth.uid());

  RETURN v_new_id;
END $$;