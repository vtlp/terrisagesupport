-- 1) Lock down onboarding_submissions: remove anon SELECT, replace with secure RPC
DROP POLICY IF EXISTS "Anon can check link lock" ON public.onboarding_submissions;
REVOKE SELECT ON public.onboarding_submissions FROM anon;

CREATE OR REPLACE FUNCTION public.check_submission_lock(_enquiry_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT submitted_at
  FROM public.onboarding_submissions
  WHERE enquiry_id = _enquiry_id
    AND status <> 'REJECTED'
  ORDER BY submitted_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_submission_lock(uuid) TO anon, authenticated;

-- 2) Add staff guard to mark_stalled_accounts
CREATE OR REPLACE FUNCTION public.mark_stalled_accounts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH updated AS (
    UPDATE public.accounts
       SET status = 'STALLED_ONBOARDING',
           updated_at = now()
     WHERE status = 'ONBOARDING_IN_PROGRESS'
       AND created_at < (now() - interval '7 days')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

-- 3) Remove activity_log from realtime publication (no UI subscribers; leaks internal events)
ALTER PUBLICATION supabase_realtime DROP TABLE public.activity_log;