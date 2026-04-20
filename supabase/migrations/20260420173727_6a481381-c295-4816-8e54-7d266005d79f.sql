
-- Extend trg_tickets_activity to also capture subject, description, category, type changes
CREATE OR REPLACE FUNCTION public.trg_tickets_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE changed JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'TICKET',
      'Ticket created: ' || NEW.subject,
      jsonb_build_object('priority', NEW.priority, 'status', NEW.status, 'category', NEW.category, 'type', NEW.type));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'STAGE_CHANGE',
      'Status: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
    IF NEW.status = 'RESOLVED' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    IF NEW.status = 'CLOSED'   AND NEW.closed_at   IS NULL THEN NEW.closed_at   := now(); END IF;
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    changed := changed || jsonb_build_object('priority', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    changed := changed || jsonb_build_object('assigned_to', jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
  END IF;
  IF NEW.queue_id IS DISTINCT FROM OLD.queue_id THEN
    changed := changed || jsonb_build_object('queue_id', jsonb_build_object('from', OLD.queue_id, 'to', NEW.queue_id));
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    changed := changed || jsonb_build_object('category', jsonb_build_object('from', OLD.category, 'to', NEW.category));
  END IF;
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    changed := changed || jsonb_build_object('type', jsonb_build_object('from', OLD.type, 'to', NEW.type));
  END IF;
  IF NEW.subject IS DISTINCT FROM OLD.subject THEN
    changed := changed || jsonb_build_object('subject', jsonb_build_object('from', OLD.subject, 'to', NEW.subject));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    changed := changed || jsonb_build_object('description', jsonb_build_object(
      'from_len', length(COALESCE(OLD.description, '')),
      'to_len',   length(COALESCE(NEW.description, ''))
    ));
  END IF;
  IF changed <> '{}'::jsonb THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'FIELD_EDIT', 'Ticket updated', changed);
  END IF;

  IF NEW.csat_rating IS DISTINCT FROM OLD.csat_rating AND NEW.csat_rating IS NOT NULL THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'TICKET',
      'CSAT submitted: ' || NEW.csat_rating || '/5',
      jsonb_build_object('rating', NEW.csat_rating, 'comment', NEW.csat_comment));
  END IF;

  RETURN NEW;
END $function$;

-- Log every ticket_message into activity_log
CREATE OR REPLACE FUNCTION public.trg_ticket_messages_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.log_activity(
    'TICKET',
    NEW.ticket_id,
    'NOTE',
    CASE WHEN NEW.is_internal THEN 'Internal note: ' ELSE 'Reply: ' END || LEFT(NEW.body, 120),
    jsonb_build_object('message_id', NEW.id, 'is_internal', NEW.is_internal, 'author_name', NEW.author_name)
  );
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS ticket_messages_activity ON public.ticket_messages;
CREATE TRIGGER ticket_messages_activity
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_messages_activity();
