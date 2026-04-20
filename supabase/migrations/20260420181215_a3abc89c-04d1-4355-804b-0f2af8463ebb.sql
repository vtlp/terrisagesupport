-- Phase 3: Marketing audit + extra notifications

-- ── Marketing activity triggers (log to activity_log under MARKETING entity) ──
CREATE OR REPLACE FUNCTION public.trg_marketing_contacts_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
      'Contact added: ' || NEW.name,
      jsonb_build_object('module','contacts','contact_type', NEW.contact_type, 'op','INSERT'));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
      'Contact updated: ' || NEW.name,
      jsonb_build_object('module','contacts','op','UPDATE'));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('MARKETING', OLD.id, 'FIELD_EDIT',
      'Contact removed: ' || OLD.name,
      jsonb_build_object('module','contacts','op','DELETE'));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.trg_marketing_events_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'CALENDAR_EVENT',
      'Marketing event added: ' || NEW.event_name,
      jsonb_build_object('module','events','city',NEW.city,'event_date',NEW.event_date,'op','INSERT'));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'CALENDAR_EVENT',
      'Marketing event updated: ' || NEW.event_name,
      jsonb_build_object('module','events','op','UPDATE'));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('MARKETING', OLD.id, 'CALENDAR_EVENT',
      'Marketing event removed: ' || OLD.event_name,
      jsonb_build_object('module','events','op','DELETE'));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.trg_marketing_cost_items_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
      'Cost added: ' || NEW.title || ' (₹' || NEW.amount || ')',
      jsonb_build_object('module','costs','cost_type',NEW.cost_type,'amount',NEW.amount,'op','INSERT'));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
        'Cost updated: ' || NEW.title || ' (₹' || OLD.amount || ' → ₹' || NEW.amount || ')',
        jsonb_build_object('module','costs','from',OLD.amount,'to',NEW.amount,'op','UPDATE'));
    ELSE
      PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
        'Cost edited: ' || NEW.title,
        jsonb_build_object('module','costs','op','UPDATE'));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('MARKETING', OLD.id, 'FIELD_EDIT',
      'Cost removed: ' || OLD.title,
      jsonb_build_object('module','costs','op','DELETE'));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.trg_marketing_referrals_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
      'Referral added (' || NEW.seats_referred || ' seats, ' || NEW.status || ')',
      jsonb_build_object('module','referrals','status',NEW.status,'seats',NEW.seats_referred,'op','INSERT'));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'STAGE_CHANGE',
      'Referral status: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('module','referrals','from',OLD.status,'to',NEW.status));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('MARKETING', OLD.id, 'FIELD_EDIT',
      'Referral removed', jsonb_build_object('module','referrals','op','DELETE'));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.trg_marketing_targets_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
      'Target set: ' || NEW.tenancy_type || ' ' || NEW.year || ' = ' || NEW.total_target,
      jsonb_build_object('module','targets','year',NEW.year,'tenancy_type',NEW.tenancy_type,'total',NEW.total_target,'op','INSERT'));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('MARKETING', NEW.id, 'FIELD_EDIT',
      'Target updated: ' || NEW.tenancy_type || ' ' || NEW.year,
      jsonb_build_object('module','targets',
        'q1', jsonb_build_object('from',OLD.q1,'to',NEW.q1),
        'q2', jsonb_build_object('from',OLD.q2,'to',NEW.q2),
        'q3', jsonb_build_object('from',OLD.q3,'to',NEW.q3),
        'q4', jsonb_build_object('from',OLD.q4,'to',NEW.q4),
        'total', jsonb_build_object('from',OLD.total_target,'to',NEW.total_target)
      ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS marketing_contacts_activity ON public.marketing_contacts;
CREATE TRIGGER marketing_contacts_activity
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_contacts_activity();

DROP TRIGGER IF EXISTS marketing_events_activity ON public.marketing_events;
CREATE TRIGGER marketing_events_activity
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_events
FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_events_activity();

DROP TRIGGER IF EXISTS marketing_cost_items_activity ON public.marketing_cost_items;
CREATE TRIGGER marketing_cost_items_activity
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_cost_items
FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_cost_items_activity();

DROP TRIGGER IF EXISTS marketing_referrals_activity ON public.marketing_referral_records;
CREATE TRIGGER marketing_referrals_activity
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_referral_records
FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_referrals_activity();

DROP TRIGGER IF EXISTS marketing_targets_activity ON public.marketing_targets;
CREATE TRIGGER marketing_targets_activity
AFTER INSERT OR UPDATE ON public.marketing_targets
FOR EACH ROW EXECUTE FUNCTION public.trg_marketing_targets_activity();

-- ── Demo not completed notification (24h after scheduled, no completion) ──
CREATE OR REPLACE FUNCTION public.scan_demo_not_completed()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id, full_name, demo_scheduled_at, assigned_to
    FROM public.enquiries
    WHERE demo_scheduled_at IS NOT NULL
      AND demo_scheduled_at < now() - interval '1 day'
      AND demo_completed_at IS NULL
      AND stage NOT IN ('LOST','CONVERTED','ACCOUNT_CREATED')
      AND demo_scheduled_at > now() - interval '14 days'
  LOOP
    PERFORM public.create_notification(
      'DEMO_NOT_COMPLETED',
      'Demo not marked complete: ' || r.full_name,
      'Scheduled ' || to_char(r.demo_scheduled_at,'DD Mon HH24:MI'),
      'WARNING', r.assigned_to, 'ENQUIRY', r.id,
      '/enquiries/' || r.id,
      'demo_nc_' || r.id || '_' || to_char(date_trunc('day',now()),'YYYYMMDD')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ── Upcoming event notification (event due within 1h) ──
CREATE OR REPLACE FUNCTION public.scan_upcoming_events()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id, title, scheduled_at, assigned_to, related_entity_type, related_entity_id, event_type
    FROM public.calendar_events
    WHERE status = 'SCHEDULED'
      AND scheduled_at > now()
      AND scheduled_at <= now() + interval '1 hour'
  LOOP
    PERFORM public.create_notification(
      CASE WHEN r.event_type IN ('FOLLOW_UP','CALL_BACK','CHECK_IN') THEN 'REMINDER_DUE' ELSE 'EVENT_DUE' END::public.notification_type,
      'Coming up: ' || r.title,
      to_char(r.scheduled_at,'DD Mon HH24:MI'),
      'INFO', r.assigned_to, 'CALENDAR_EVENT', r.id,
      CASE
        WHEN r.related_entity_type = 'ENQUIRY' THEN '/enquiries/' || r.related_entity_id
        WHEN r.related_entity_type = 'ACCOUNT' THEN '/accounts/' || r.related_entity_id
        ELSE '/calendar' END,
      'upcoming_' || r.id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
