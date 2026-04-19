-- The previous unique index blocked ANY second non-rejected submission per enquiry,
-- which conflicts with the regenerate-link / multi-version submission flow.
-- We rely on check_submission_lock() (which respects onboarding_pack_sent_at) for
-- in-window duplicate prevention instead.
DROP INDEX IF EXISTS public.uniq_onboarding_submission_active_per_enquiry;