-- 1. Queue members for round-robin assignment
CREATE TABLE IF NOT EXISTS public.ticket_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.ticket_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(queue_id, user_id)
);

ALTER TABLE public.ticket_queue_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access queue_members"
  ON public.ticket_queue_members FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Track last-assigned member per queue for round-robin
ALTER TABLE public.ticket_queues
  ADD COLUMN IF NOT EXISTS last_assigned_user_id UUID,
  ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;

-- 2. Round-robin trigger on ticket insert/update
CREATE OR REPLACE FUNCTION public.tickets_round_robin_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_user UUID;
  v_default UUID;
BEGIN
  -- Only act when queue is set and no assignee chosen
  IF NEW.queue_id IS NULL OR NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Pick next active member after the last_assigned_user_id (round robin by sort_order, id)
  SELECT m.user_id INTO v_next_user
  FROM public.ticket_queue_members m
  JOIN public.ticket_queues q ON q.id = m.queue_id
  WHERE m.queue_id = NEW.queue_id
    AND m.is_active = true
    AND (q.last_assigned_user_id IS NULL OR (m.sort_order, m.id::text) > (
      SELECT (m2.sort_order, m2.id::text)
      FROM public.ticket_queue_members m2
      WHERE m2.queue_id = q.id AND m2.user_id = q.last_assigned_user_id
    ))
  ORDER BY m.sort_order, m.id
  LIMIT 1;

  -- Wrap around to first member if none after
  IF v_next_user IS NULL THEN
    SELECT m.user_id INTO v_next_user
    FROM public.ticket_queue_members m
    WHERE m.queue_id = NEW.queue_id AND m.is_active = true
    ORDER BY m.sort_order, m.id
    LIMIT 1;
  END IF;

  -- Fallback to queue default
  IF v_next_user IS NULL THEN
    SELECT default_assignee INTO v_default FROM public.ticket_queues WHERE id = NEW.queue_id;
    v_next_user := v_default;
  END IF;

  IF v_next_user IS NOT NULL THEN
    NEW.assigned_to := v_next_user;
    UPDATE public.ticket_queues
      SET last_assigned_user_id = v_next_user,
          last_assigned_at = now()
      WHERE id = NEW.queue_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tickets_round_robin ON public.tickets;
CREATE TRIGGER trg_tickets_round_robin
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_round_robin_assign();

-- 3. Activity log for attachments (so they appear in ticket history)
CREATE OR REPLACE FUNCTION public.trg_ticket_attachments_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('TICKET', NEW.ticket_id, 'TICKET',
      'Attachment uploaded: ' || NEW.file_name,
      jsonb_build_object('attachment_id', NEW.id, 'file_name', NEW.file_name, 'op', 'INSERT'));
  ELSIF TG_OP = 'UPDATE' AND NEW.file_name IS DISTINCT FROM OLD.file_name THEN
    PERFORM public.log_activity('TICKET', NEW.ticket_id, 'FIELD_EDIT',
      'Attachment renamed: ' || OLD.file_name || ' → ' || NEW.file_name,
      jsonb_build_object('attachment_id', NEW.id, 'from', OLD.file_name, 'to', NEW.file_name));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('TICKET', OLD.ticket_id, 'TICKET',
      'Attachment removed: ' || OLD.file_name,
      jsonb_build_object('attachment_id', OLD.id, 'file_name', OLD.file_name, 'op', 'DELETE'));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_ticket_attachments_activity ON public.ticket_attachments;
CREATE TRIGGER trg_ticket_attachments_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_attachments
  FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_attachments_activity();