-- The trg_notify_submission trigger fires on anon inserts to onboarding_submissions
-- and calls create_notification(), which inserts into public.notifications.
-- Even though create_notification is SECURITY DEFINER, RLS still applies to the
-- target table, and the notifications INSERT policy requires is_staff(auth.uid()).
-- For anon submissions auth.uid() is NULL, so the insert is blocked and surfaces
-- as "new row violates row-level security policy" on onboarding_submissions.
--
-- Fix: bypass RLS inside create_notification (it's already SECURITY DEFINER and
-- only callable from server-side trigger/staff code paths).

CREATE OR REPLACE FUNCTION public.create_notification(
  _type notification_type,
  _title text,
  _body text DEFAULT NULL::text,
  _severity notification_severity DEFAULT 'INFO'::notification_severity,
  _user_id uuid DEFAULT NULL::uuid,
  _entity_type text DEFAULT NULL::text,
  _entity_id uuid DEFAULT NULL::uuid,
  _link_path text DEFAULT NULL::text,
  _dedupe_key text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, severity, title, body, entity_type, entity_id, link_path, dedupe_key)
  VALUES (_user_id, _type, _severity, _title, _body, _entity_type, _entity_id, _link_path, _dedupe_key)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;