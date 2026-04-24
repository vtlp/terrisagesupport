CREATE OR REPLACE FUNCTION public.log_activity(
  _entity_type text,
  _entity_id uuid,
  _event_type activity_event_type,
  _summary text,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  INSERT INTO public.activity_log (entity_type, entity_id, event_type, summary, details, actor_id)
  VALUES (_entity_type, _entity_id, _event_type, _summary, COALESCE(_details, '{}'::jsonb), auth.uid());
END;
$function$;