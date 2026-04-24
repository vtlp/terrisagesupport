-- Tighten the onboarding link lock so a rejected submission also blocks the
-- old link. Staff must explicitly regenerate a new onboarding link, which
-- bumps onboarding_pack_sent_at and re-opens submissions on the new link only.
CREATE OR REPLACE FUNCTION public.check_submission_lock(_enquiry_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.submitted_at
  FROM public.onboarding_submissions s
  JOIN public.enquiries e ON e.id = s.enquiry_id
  WHERE s.enquiry_id = _enquiry_id
    AND (e.onboarding_pack_sent_at IS NULL OR s.submitted_at >= e.onboarding_pack_sent_at)
  ORDER BY s.submitted_at DESC
  LIMIT 1;
$function$;