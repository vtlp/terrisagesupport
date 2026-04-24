CREATE OR REPLACE FUNCTION public.submit_onboarding_public(
  _tenancy_type public.tenancy_type,
  _payload jsonb,
  _enquiry_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_submitted_at timestamptz;
  v_locked_at timestamptz;
BEGIN
  IF _payload IS NULL OR _payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'Submission payload is required' USING ERRCODE = 'P0001';
  END IF;

  IF _enquiry_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.enquiries WHERE id = _enquiry_id) THEN
      RAISE EXCEPTION 'Invalid or expired onboarding link' USING ERRCODE = 'P0002';
    END IF;

    v_locked_at := public.check_submission_lock(_enquiry_id);
    IF v_locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'This onboarding form has already been submitted for this link.' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  INSERT INTO public.onboarding_submissions (tenancy_type, payload, enquiry_id)
  VALUES (_tenancy_type, _payload, _enquiry_id)
  RETURNING id, submitted_at INTO v_id, v_submitted_at;

  RETURN jsonb_build_object('id', v_id, 'submitted_at', v_submitted_at);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_onboarding_public(public.tenancy_type, jsonb, uuid) TO anon, authenticated;