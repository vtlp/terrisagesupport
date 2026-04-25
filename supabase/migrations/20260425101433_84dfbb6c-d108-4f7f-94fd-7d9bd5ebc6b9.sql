
-- 1. Force onboarding submissions to go through the SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Public can submit onboarding" ON public.onboarding_submissions;
REVOKE INSERT ON public.onboarding_submissions FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_public(public.tenancy_type, jsonb, uuid) TO anon, authenticated;

-- 2. Tighten onboarding-uploads storage path scoping
DROP POLICY IF EXISTS "Public upload onboarding" ON storage.objects;
CREATE POLICY "Public upload onboarding (scoped)"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'onboarding-uploads'
    AND name ~ '^(agency|builder)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  );

-- 3. View runs with caller's permissions
ALTER VIEW public.account_seat_capacity SET (security_invoker = true);

-- 4. Relocate pg_net out of public (drop+recreate; it is currently unused)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 5. Restrict realtime channel subscriptions to staff only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff only realtime access" ON realtime.messages;
CREATE POLICY "Staff only realtime access"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
