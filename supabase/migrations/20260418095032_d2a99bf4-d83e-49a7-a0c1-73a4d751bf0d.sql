
-- ============================================================================
-- TICKETS BACKEND (Module 1)
-- ============================================================================

-- 1. ENUMS ------------------------------------------------------------------
CREATE TYPE public.ticket_priority AS ENUM ('P1','P2','P3','P4');
CREATE TYPE public.ticket_status   AS ENUM ('OPEN','PENDING_CUSTOMER','PENDING_INTERNAL','RESOLVED','CLOSED');
CREATE TYPE public.ticket_type     AS ENUM ('INCIDENT','QUESTION','TASK','FEEDBACK');
CREATE TYPE public.ticket_category AS ENUM (
  'LISTINGS_INVENTORY','BILLING_PLAN','API_INTEGRATIONS','ONBOARDING_MIGRATION',
  'SECURITY_ACCESS','COMPLIANCE_LEGAL','PERFORMANCE_RELIABILITY','OTHER'
);

-- Add TICKET event type to activity log enum
ALTER TYPE public.activity_event_type ADD VALUE IF NOT EXISTS 'TICKET';

-- 2. QUEUES -----------------------------------------------------------------
CREATE TABLE public.ticket_queues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  default_assignee UUID,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access ticket_queues" ON public.ticket_queues
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

INSERT INTO public.ticket_queues (key, name, description, sort_order) VALUES
  ('GENERAL',    'General support',          'Default catch-all queue', 0),
  ('BILLING',    'Billing & invoicing',      'Invoices, payments, plan changes', 1),
  ('ONBOARDING', 'Onboarding & migration',   'New accounts, data imports', 2),
  ('TECH',       'Technical & API',          'Bugs, integrations, performance', 3),
  ('COMPLIANCE', 'Compliance & legal',       'KYC, RERA, GST queries', 4);

-- 3. TICKETS ----------------------------------------------------------------
CREATE SEQUENCE public.ticket_code_seq START 1;

CREATE TABLE public.tickets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code          TEXT UNIQUE,
  subject              TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  type                 public.ticket_type     NOT NULL DEFAULT 'INCIDENT',
  category             public.ticket_category NOT NULL DEFAULT 'OTHER',
  priority             public.ticket_priority NOT NULL DEFAULT 'P3',
  status               public.ticket_status   NOT NULL DEFAULT 'OPEN',
  queue_id             UUID REFERENCES public.ticket_queues(id) ON DELETE SET NULL,
  assigned_to          UUID,
  account_id           UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  requester_name       TEXT NOT NULL,
  requester_email      TEXT,
  requester_phone      TEXT,
  market_city          TEXT,
  tags                 TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sla_first_response_at TIMESTAMPTZ,
  sla_resolution_at    TIMESTAMPTZ,
  first_response_at    TIMESTAMPTZ,
  resolved_at          TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  resolution_code      TEXT,
  resolution_notes     TEXT,
  csat_rating          INT CHECK (csat_rating BETWEEN 1 AND 5),
  csat_comment         TEXT,
  related_entity_type  TEXT,
  related_entity_id    UUID,
  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_status     ON public.tickets(status);
CREATE INDEX idx_tickets_priority   ON public.tickets(priority);
CREATE INDEX idx_tickets_assigned   ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_account    ON public.tickets(account_id);
CREATE INDEX idx_tickets_queue      ON public.tickets(queue_id);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access tickets" ON public.tickets
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- ticket_code auto-fill (TKT-000123)
CREATE OR REPLACE FUNCTION public.tickets_set_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ticket_code IS NULL THEN
    NEW.ticket_code := 'TKT-' || LPAD(nextval('public.ticket_code_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tickets_set_code_trg
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tickets_set_code();

-- updated_at maintenance
CREATE TRIGGER tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity-log trigger
CREATE OR REPLACE FUNCTION public.trg_tickets_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'TICKET',
      'Ticket created: ' || NEW.subject,
      jsonb_build_object('priority', NEW.priority, 'status', NEW.status, 'category', NEW.category));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'STAGE_CHANGE',
      'Status: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
    -- auto stamps
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
  IF changed <> '{}'::jsonb THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'FIELD_EDIT', 'Ticket updated', changed);
  END IF;

  IF NEW.csat_rating IS DISTINCT FROM OLD.csat_rating AND NEW.csat_rating IS NOT NULL THEN
    PERFORM public.log_activity('TICKET', NEW.id, 'TICKET',
      'CSAT submitted: ' || NEW.csat_rating || '/5',
      jsonb_build_object('rating', NEW.csat_rating, 'comment', NEW.csat_comment));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tickets_activity_ins
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_tickets_activity();

CREATE TRIGGER tickets_activity_upd
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_tickets_activity();

-- 4. TICKET MESSAGES (thread) -----------------------------------------------
CREATE TABLE public.ticket_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id   UUID,
  author_name TEXT,
  body        TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access ticket_messages" ON public.ticket_messages
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Stamp first_response_at on first non-internal staff message
CREATE OR REPLACE FUNCTION public.trg_ticket_first_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_internal = false THEN
    UPDATE public.tickets
      SET first_response_at = COALESCE(first_response_at, now()),
          updated_at = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ticket_messages_first_response
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_first_response();

-- 5. TICKET ATTACHMENTS -----------------------------------------------------
CREATE TABLE public.ticket_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  message_id    UUID REFERENCES public.ticket_messages(id) ON DELETE SET NULL,
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    BIGINT,
  uploaded_by   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_attachments_ticket ON public.ticket_attachments(ticket_id);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access ticket_attachments" ON public.ticket_attachments
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 6. STORAGE BUCKET (private) -----------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read ticket attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket-attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload ticket attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update ticket attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ticket-attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete ticket attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-attachments' AND public.is_staff(auth.uid()));
