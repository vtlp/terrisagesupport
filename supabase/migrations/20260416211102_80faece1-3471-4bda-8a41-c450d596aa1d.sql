
-- =========================================================================
-- 1. ACTIVITY LOG
-- =========================================================================
CREATE TYPE public.activity_event_type AS ENUM (
  'STAGE_CHANGE','FIELD_EDIT','NOTE','CALENDAR_EVENT','SEAT_CHANGE',
  'CHECKLIST','SUBMISSION','CONVERSION','VERIFICATION','INVOICE','IMPORT'
);

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ENQUIRY','ACCOUNT')),
  entity_id UUID NOT NULL,
  event_type public.activity_event_type NOT NULL,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access activity_log" ON public.activity_log
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- 2. ACCOUNT VERIFICATIONS
-- =========================================================================
CREATE TYPE public.verification_kind AS ENUM ('PAN','GST','RERA','BANK','IDENTITY');
CREATE TYPE public.verification_status AS ENUM ('PENDING','VERIFIED','REJECTED');

CREATE TABLE public.account_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind public.verification_kind NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'PENDING',
  reference_no TEXT,
  notes TEXT,
  proof_storage_path TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, kind)
);
CREATE INDEX idx_verifications_account ON public.account_verifications(account_id);

ALTER TABLE public.account_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access verifications" ON public.account_verifications
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_verifications_updated_at
  BEFORE UPDATE ON public.account_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. BILLING SETTINGS + INVOICES
-- =========================================================================
CREATE TYPE public.billing_cycle AS ENUM ('MONTHLY','QUARTERLY','ANNUAL');
CREATE TYPE public.subscription_status AS ENUM ('ACTIVE','PAUSED','CANCELLED','OVERDUE');
CREATE TYPE public.invoice_status AS ENUM ('DRAFT','SENT','PAID','OVERDUE','CANCELLED');

CREATE TABLE public.account_billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'Standard',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'MONTHLY',
  base_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  seat_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_pct NUMERIC(5,2) NOT NULL DEFAULT 18,
  next_renewal_at TIMESTAMPTZ,
  status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access billing_settings" ON public.account_billing_settings
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER update_billing_settings_updated_at
  BEFORE UPDATE ON public.account_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.account_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_no TEXT,
  period_from DATE,
  period_to DATE,
  plan_name TEXT,
  seat_count INTEGER NOT NULL DEFAULT 0,
  seat_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_pct NUMERIC(5,2) NOT NULL DEFAULT 18,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'DRAFT',
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_account ON public.account_invoices(account_id, issued_at DESC);
ALTER TABLE public.account_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access invoices" ON public.account_invoices
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.account_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 4. DATA IMPORTS
-- =========================================================================
CREATE TYPE public.import_type AS ENUM ('LISTINGS','LEADS','CONTACTS','OTHER');
CREATE TYPE public.import_status AS ENUM ('UPLOADED','MAPPING','PROCESSING','COMPLETED','FAILED');

CREATE TABLE public.data_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  import_type public.import_type NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  row_count INTEGER,
  status public.import_status NOT NULL DEFAULT 'UPLOADED',
  mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_log TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_imports_account ON public.data_imports(account_id, created_at DESC);
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access data_imports" ON public.data_imports
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER update_imports_updated_at
  BEFORE UPDATE ON public.data_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 5. CALENDAR EVENT SYNC
-- =========================================================================
CREATE TABLE public.calendar_event_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id UUID NOT NULL UNIQUE REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  google_event_id TEXT,
  google_calendar_id TEXT,
  synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_event_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access calendar_sync" ON public.calendar_event_sync
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER update_sync_updated_at
  BEFORE UPDATE ON public.calendar_event_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 6. STORAGE BUCKET FOR VERIFICATION PROOFS
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('verification-proofs', 'verification-proofs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read verification proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-proofs' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload verification proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-proofs' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update verification proofs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-proofs' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete verification proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'verification-proofs' AND public.is_staff(auth.uid()));

-- =========================================================================
-- 7. ACTIVITY LOG TRIGGERS
-- =========================================================================

-- Helper: log entry
CREATE OR REPLACE FUNCTION public.log_activity(
  _entity_type TEXT, _entity_id UUID, _event_type public.activity_event_type,
  _summary TEXT, _details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log (entity_type, entity_id, event_type, summary, details, actor_id)
  VALUES (_entity_type, _entity_id, _event_type, _summary, COALESCE(_details, '{}'::jsonb), auth.uid());
END;
$$;

-- Enquiries
CREATE OR REPLACE FUNCTION public.trg_enquiries_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ENQUIRY', NEW.id, 'STAGE_CHANGE',
      'Enquiry created', jsonb_build_object('stage', NEW.stage));
    RETURN NEW;
  END IF;
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM public.log_activity('ENQUIRY', NEW.id, 'STAGE_CHANGE',
      'Stage: ' || OLD.stage || ' → ' || NEW.stage,
      jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    changed := changed || jsonb_build_object('assigned_to', jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
  END IF;
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    changed := changed || jsonb_build_object('full_name', jsonb_build_object('from', OLD.full_name, 'to', NEW.full_name));
  END IF;
  IF NEW.company_name IS DISTINCT FROM OLD.company_name THEN
    changed := changed || jsonb_build_object('company_name', jsonb_build_object('from', OLD.company_name, 'to', NEW.company_name));
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    changed := changed || jsonb_build_object('phone', jsonb_build_object('from', OLD.phone, 'to', NEW.phone));
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    changed := changed || jsonb_build_object('email', jsonb_build_object('from', OLD.email, 'to', NEW.email));
  END IF;
  IF NEW.city IS DISTINCT FROM OLD.city THEN
    changed := changed || jsonb_build_object('city', jsonb_build_object('from', OLD.city, 'to', NEW.city));
  END IF;
  IF NEW.tenancy_type IS DISTINCT FROM OLD.tenancy_type THEN
    changed := changed || jsonb_build_object('tenancy_type', jsonb_build_object('from', OLD.tenancy_type, 'to', NEW.tenancy_type));
  END IF;
  IF changed <> '{}'::jsonb THEN
    PERFORM public.log_activity('ENQUIRY', NEW.id, 'FIELD_EDIT', 'Enquiry details updated', changed);
  END IF;
  IF NEW.converted_account_id IS DISTINCT FROM OLD.converted_account_id AND NEW.converted_account_id IS NOT NULL THEN
    PERFORM public.log_activity('ENQUIRY', NEW.id, 'CONVERSION',
      'Converted to account', jsonb_build_object('account_id', NEW.converted_account_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enquiries_activity
  AFTER INSERT OR UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.trg_enquiries_activity();

-- Accounts
CREATE OR REPLACE FUNCTION public.trg_accounts_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ACCOUNT', NEW.id, 'STAGE_CHANGE',
      'Account created', jsonb_build_object('status', NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('ACCOUNT', NEW.id, 'STAGE_CHANGE',
      'Status: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.account_name IS DISTINCT FROM OLD.account_name THEN
    changed := changed || jsonb_build_object('account_name', jsonb_build_object('from', OLD.account_name, 'to', NEW.account_name));
  END IF;
  IF NEW.gst_number IS DISTINCT FROM OLD.gst_number THEN
    changed := changed || jsonb_build_object('gst_number', jsonb_build_object('from', OLD.gst_number, 'to', NEW.gst_number));
  END IF;
  IF NEW.pan_number IS DISTINCT FROM OLD.pan_number THEN
    changed := changed || jsonb_build_object('pan_number', jsonb_build_object('from', OLD.pan_number, 'to', NEW.pan_number));
  END IF;
  IF NEW.rera_number IS DISTINCT FROM OLD.rera_number THEN
    changed := changed || jsonb_build_object('rera_number', jsonb_build_object('from', OLD.rera_number, 'to', NEW.rera_number));
  END IF;
  IF NEW.owner_email IS DISTINCT FROM OLD.owner_email THEN
    changed := changed || jsonb_build_object('owner_email', jsonb_build_object('from', OLD.owner_email, 'to', NEW.owner_email));
  END IF;
  IF NEW.owner_phone IS DISTINCT FROM OLD.owner_phone THEN
    changed := changed || jsonb_build_object('owner_phone', jsonb_build_object('from', OLD.owner_phone, 'to', NEW.owner_phone));
  END IF;
  IF changed <> '{}'::jsonb THEN
    PERFORM public.log_activity('ACCOUNT', NEW.id, 'FIELD_EDIT', 'Account details updated', changed);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_accounts_activity
  AFTER INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_accounts_activity();

-- Notes
CREATE OR REPLACE FUNCTION public.trg_enquiry_notes_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_activity('ENQUIRY', NEW.enquiry_id, 'NOTE',
    LEFT(NEW.note_text, 120), jsonb_build_object('note', NEW.note_text));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enquiry_notes_activity
  AFTER INSERT ON public.enquiry_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_enquiry_notes_activity();

CREATE OR REPLACE FUNCTION public.trg_account_notes_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'NOTE',
    LEFT(NEW.note_text, 120), jsonb_build_object('note', NEW.note_text));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_account_notes_activity
  AFTER INSERT ON public.account_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_account_notes_activity();

-- Calendar events (logs to related entity if any)
CREATE OR REPLACE FUNCTION public.trg_calendar_events_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  IF r.related_entity_type IN ('ENQUIRY','ACCOUNT') AND r.related_entity_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.log_activity(r.related_entity_type, r.related_entity_id, 'CALENDAR_EVENT',
        'Event scheduled: ' || NEW.title,
        jsonb_build_object('event_id', NEW.id, 'title', NEW.title, 'scheduled_at', NEW.scheduled_at, 'event_type', NEW.event_type, 'op', 'INSERT'));
    ELSIF TG_OP = 'UPDATE' THEN
      PERFORM public.log_activity(r.related_entity_type, r.related_entity_id, 'CALENDAR_EVENT',
        'Event updated: ' || NEW.title,
        jsonb_build_object('event_id', NEW.id, 'title', NEW.title, 'op', 'UPDATE'));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.log_activity(r.related_entity_type, r.related_entity_id, 'CALENDAR_EVENT',
        'Event removed: ' || OLD.title,
        jsonb_build_object('event_id', OLD.id, 'op', 'DELETE'));
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_calendar_events_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_calendar_events_activity();

-- Seats
CREATE OR REPLACE FUNCTION public.trg_account_seats_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'SEAT_CHANGE',
      'Seat added: ' || NEW.full_name,
      jsonb_build_object('seat_id', NEW.id, 'name', NEW.full_name, 'role', NEW.role, 'op', 'INSERT'));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'SEAT_CHANGE',
        CASE WHEN NEW.is_active THEN 'Seat reactivated: ' ELSE 'Seat deactivated: ' END || NEW.full_name,
        jsonb_build_object('seat_id', NEW.id, 'is_active', NEW.is_active));
    ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.full_name IS DISTINCT FROM OLD.full_name THEN
      PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'SEAT_CHANGE',
        'Seat updated: ' || NEW.full_name,
        jsonb_build_object('seat_id', NEW.id, 'role', NEW.role));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('ACCOUNT', OLD.account_id, 'SEAT_CHANGE',
      'Seat removed: ' || OLD.full_name,
      jsonb_build_object('seat_id', OLD.id, 'op', 'DELETE'));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_account_seats_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.account_seats
  FOR EACH ROW EXECUTE FUNCTION public.trg_account_seats_activity();

-- Checklist
CREATE OR REPLACE FUNCTION public.trg_checklist_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_done IS DISTINCT FROM OLD.is_done THEN
    PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'CHECKLIST',
      CASE WHEN NEW.is_done THEN 'Checked: ' ELSE 'Unchecked: ' END || NEW.label,
      jsonb_build_object('item_id', NEW.id, 'is_done', NEW.is_done));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_checklist_activity
  AFTER UPDATE ON public.account_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_checklist_activity();

-- Submissions (log on enquiry)
CREATE OR REPLACE FUNCTION public.trg_submissions_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.enquiry_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ENQUIRY', NEW.enquiry_id, 'SUBMISSION',
      'Onboarding form submitted', jsonb_build_object('submission_id', NEW.id, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('ENQUIRY', NEW.enquiry_id, 'SUBMISSION',
      'Submission ' || NEW.status, jsonb_build_object('submission_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_submissions_activity
  AFTER INSERT OR UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_submissions_activity();

-- Verifications
CREATE OR REPLACE FUNCTION public.trg_verifications_activity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'VERIFICATION',
      NEW.kind || ' verification: ' || NEW.status,
      jsonb_build_object('kind', NEW.kind, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'VERIFICATION',
      NEW.kind || ' marked ' || NEW.status,
      jsonb_build_object('kind', NEW.kind, 'from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_verifications_activity
  AFTER INSERT OR UPDATE ON public.account_verifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_verifications_activity();
