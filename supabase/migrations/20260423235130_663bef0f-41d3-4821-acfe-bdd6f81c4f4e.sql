-- Grant base-table privileges so RLS policies on onboarding_submissions actually take effect.
-- Without these GRANTs, Postgres rejects the request with "permission denied for table"
-- before RLS is even evaluated.
GRANT INSERT, SELECT ON public.onboarding_submissions TO anon, authenticated;