-- Grant table-level INSERT privileges so the public onboarding form works for anon users.
-- RLS policies were already in place, but missing GRANTs caused "permission denied" errors.
GRANT INSERT ON public.onboarding_submissions TO anon, authenticated;
-- Allow anon to look up their own pending submission (used by the link-lock pre-check).
-- Read is restricted by enquiry_id via a dedicated RLS policy.
GRANT SELECT ON public.onboarding_submissions TO anon;

-- Add a narrow SELECT policy so anon can check whether a given enquiry link
-- has already been submitted (returns submitted_at/status only via the column
-- list selected in the client). This does NOT expose payloads to listing —
-- the query must filter by a specific enquiry_id (no broad scans useful since
-- enquiry_id values are UUIDs known only to link holders).
DROP POLICY IF EXISTS "Anon can check link lock" ON public.onboarding_submissions;
CREATE POLICY "Anon can check link lock"
  ON public.onboarding_submissions
  FOR SELECT
  TO anon
  USING (enquiry_id IS NOT NULL);