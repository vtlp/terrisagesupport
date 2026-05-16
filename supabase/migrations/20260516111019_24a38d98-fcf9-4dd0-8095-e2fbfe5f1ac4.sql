CREATE TABLE IF NOT EXISTS public.import_job_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  notes text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid,
  UNIQUE (job_id, account_id)
);

CREATE INDEX IF NOT EXISTS import_job_account_links_job_idx ON public.import_job_account_links(job_id);
CREATE INDEX IF NOT EXISTS import_job_account_links_account_idx ON public.import_job_account_links(account_id);

ALTER TABLE public.import_job_account_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access import_job_account_links"
  ON public.import_job_account_links
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));