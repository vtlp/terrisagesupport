-- Function: auto-mark accounts as STALLED_ONBOARDING when stuck >7 days
CREATE OR REPLACE FUNCTION public.mark_stalled_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.mark_stalled_accounts() TO authenticated;