-- Allow multiple onboarding submissions per enquiry across regenerated links.
-- The lock should only fire when a submission has been received AFTER the
-- most recent link (re)generation. Earlier submissions are preserved as
-- historical versions for staff to compare.
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
    AND s.status <> 'REJECTED'
    AND (e.onboarding_pack_sent_at IS NULL OR s.submitted_at >= e.onboarding_pack_sent_at)
  ORDER BY s.submitted_at DESC
  LIMIT 1;
$function$;