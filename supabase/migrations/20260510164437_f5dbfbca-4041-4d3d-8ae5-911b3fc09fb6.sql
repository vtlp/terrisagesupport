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
       AND updated_at < (now() - interval '7 days')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;