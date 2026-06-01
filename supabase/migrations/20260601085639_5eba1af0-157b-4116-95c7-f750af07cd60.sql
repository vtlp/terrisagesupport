
-- 1. Set explicit search_path on functions that were missing it.
ALTER FUNCTION public.touch_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.touch_project_requests_updated_at() SET search_path TO 'public';

-- 2. Revoke anon EXECUTE on all SECURITY DEFINER functions in public,
--    except the two RPCs that must be callable by anonymous onboarding visitors.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT IN ('submit_onboarding_public','check_submission_lock')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',   r.sig);
  END LOOP;
END $$;
