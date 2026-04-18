-- Enforce single successful onboarding submission per enquiry link.
-- A non-rejected submission (PENDING_REVIEW or APPROVED) locks the link.
-- A REJECTED submission frees the link so a fresh submit is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_onboarding_submission_active_per_enquiry
  ON public.onboarding_submissions (enquiry_id)
  WHERE enquiry_id IS NOT NULL AND status <> 'REJECTED';