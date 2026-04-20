
-- Notifications table for persisted, actionable notifications
CREATE TYPE public.notification_type AS ENUM (
  'EVENT_DUE','EVENT_OVERDUE','REMINDER',
  'ENQUIRY_SUBMISSION','SLA_BREACH','ACCOUNT_STALLED',
  'DEMO_NOT_COMPLETED','SEAT_REQUEST','TICKET_ASSIGNED',
  'TICKET_UPDATED','EXTERNAL','GENERAL'
);

CREATE TYPE public.notification_severity AS ENUM ('INFO','WARNING','CRITICAL');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                       -- NULL = broadcast to all staff
  type public.notification_type NOT NULL,
  severity public.notification_severity NOT NULL DEFAULT 'INFO',
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  link_path TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  dedupe_key TEXT,                    -- prevents duplicate notifications
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notifications_dedupe_uniq
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX notifications_broadcast_unread_idx
  ON public.notifications (is_read, created_at DESC) WHERE user_id IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "Staff update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "Staff insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Helper to create notifications (idempotent via dedupe_key)
CREATE OR REPLACE FUNCTION public.create_notification(
  _type public.notification_type,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _severity public.notification_severity DEFAULT 'INFO',
  _user_id UUID DEFAULT NULL,
  _entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL,
  _link_path TEXT DEFAULT NULL,
  _dedupe_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, severity, title, body, entity_type, entity_id, link_path, dedupe_key)
  VALUES (_user_id, _type, _severity, _title, _body, _entity_type, _entity_id, _link_path, _dedupe_key)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Mark notifications read
CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids UUID[] DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_count INT;
BEGIN
  IF _ids IS NULL THEN
    UPDATE public.notifications
       SET is_read = true, read_at = now()
     WHERE is_read = false
       AND (user_id IS NULL OR user_id = auth.uid());
  ELSE
    UPDATE public.notifications
       SET is_read = true, read_at = now()
     WHERE id = ANY(_ids)
       AND (user_id IS NULL OR user_id = auth.uid());
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- TRIGGERS to fire notifications

-- Seat request created
CREATE OR REPLACE FUNCTION public.trg_notify_seat_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_acct TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
    SELECT account_name INTO v_acct FROM public.accounts WHERE id = NEW.account_id;
    PERFORM public.create_notification(
      'SEAT_REQUEST',
      'Seat request: +' || NEW.requested_seats || ' seats',
      COALESCE(v_acct,'Account') || COALESCE(' · ' || NEW.requested_by_email,''),
      'WARNING', NULL, 'ACCOUNT', NEW.account_id,
      '/accounts/' || NEW.account_id || '?tab=seats',
      'seat_req_' || NEW.id
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_seat_request ON public.seat_requests;
CREATE TRIGGER notify_seat_request AFTER INSERT ON public.seat_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_seat_request();

-- Account stalled
CREATE OR REPLACE FUNCTION public.trg_notify_account_stalled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'STALLED_ONBOARDING' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_notification(
      'ACCOUNT_STALLED', 'Onboarding stalled: ' || NEW.account_name,
      'No progress in 7+ days', 'WARNING', NULL, 'ACCOUNT', NEW.id,
      '/accounts/' || NEW.id, 'acct_stalled_' || NEW.id
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_account_stalled ON public.accounts;
CREATE TRIGGER notify_account_stalled AFTER INSERT OR UPDATE OF status ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_account_stalled();

-- Onboarding submission received
CREATE OR REPLACE FUNCTION public.trg_notify_submission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_name FROM public.enquiries WHERE id = NEW.enquiry_id;
    PERFORM public.create_notification(
      'ENQUIRY_SUBMISSION', 'Onboarding form submitted',
      COALESCE(v_name,'Enquiry') || ' · pending review', 'INFO', NULL, 'ENQUIRY',
      NEW.enquiry_id,
      CASE WHEN NEW.enquiry_id IS NOT NULL THEN '/enquiries/' || NEW.enquiry_id ELSE NULL END,
      'submission_' || NEW.id
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_submission ON public.onboarding_submissions;
CREATE TRIGGER notify_submission AFTER INSERT ON public.onboarding_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_submission();

-- Ticket assigned / SLA breach / urgent updates
CREATE OR REPLACE FUNCTION public.trg_notify_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(
        'TICKET_ASSIGNED',
        'Ticket assigned: ' || COALESCE(NEW.ticket_code, LEFT(NEW.id::TEXT,8)),
        NEW.subject, 
        CASE WHEN NEW.priority IN ('P1','P2') THEN 'CRITICAL' ELSE 'INFO' END::public.notification_severity,
        NEW.assigned_to, 'TICKET', NEW.id, '/tickets/' || NEW.id,
        'ticket_assign_' || NEW.id || '_' || NEW.assigned_to::TEXT
      );
    END IF;
  END IF;
  -- SLA breach detection
  IF NEW.sla_resolution_at IS NOT NULL AND NEW.sla_resolution_at < now()
     AND NEW.status NOT IN ('RESOLVED','CLOSED')
     AND (TG_OP = 'INSERT' OR OLD.sla_resolution_at IS DISTINCT FROM NEW.sla_resolution_at OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_notification(
      'SLA_BREACH',
      'SLA breached: ' || COALESCE(NEW.ticket_code, LEFT(NEW.id::TEXT,8)),
      NEW.subject, 'CRITICAL', NEW.assigned_to, 'TICKET', NEW.id,
      '/tickets/' || NEW.id, 'sla_' || NEW.id
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_ticket ON public.tickets;
CREATE TRIGGER notify_ticket AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_ticket();

-- Calendar event scheduled (assigned to someone)
CREATE OR REPLACE FUNCTION public.trg_notify_calendar_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID) THEN
    PERFORM public.create_notification(
      'EVENT_DUE',
      'Event scheduled: ' || NEW.title,
      to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD Mon, HH24:MI') || ' UTC',
      'INFO', NEW.assigned_to, 'CALENDAR_EVENT', NEW.id,
      CASE 
        WHEN NEW.related_entity_type = 'ENQUIRY' THEN '/enquiries/' || NEW.related_entity_id
        WHEN NEW.related_entity_type = 'ACCOUNT' THEN '/accounts/' || NEW.related_entity_id
        ELSE '/calendar' END,
      'event_assign_' || NEW.id
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_calendar_event ON public.calendar_events;
CREATE TRIGGER notify_calendar_event AFTER INSERT ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_calendar_event();

-- Function to compute overdue events and emit notifications (callable / on-demand)
CREATE OR REPLACE FUNCTION public.scan_overdue_events()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id, title, scheduled_at, assigned_to, related_entity_type, related_entity_id
    FROM public.calendar_events
    WHERE status = 'SCHEDULED'
      AND scheduled_at < now()
      AND scheduled_at > now() - interval '30 days'
  LOOP
    PERFORM public.create_notification(
      'EVENT_OVERDUE',
      'Overdue event: ' || r.title,
      'Scheduled ' || to_char(r.scheduled_at, 'DD Mon HH24:MI'),
      'WARNING', r.assigned_to, 'CALENDAR_EVENT', r.id,
      CASE
        WHEN r.related_entity_type = 'ENQUIRY' THEN '/enquiries/' || r.related_entity_id
        WHEN r.related_entity_type = 'ACCOUNT' THEN '/accounts/' || r.related_entity_id
        ELSE '/calendar' END,
      'overdue_' || r.id::TEXT || '_' || to_char(date_trunc('day', now()),'YYYYMMDD')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
