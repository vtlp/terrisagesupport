
-- =====================================================================
-- 1. ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'support_agent');

CREATE TYPE public.enquiry_stage AS ENUM (
  'NEW_ENQUIRY','CONTACTED','DEMO_SCHEDULED','DEMO_COMPLETED',
  'ONBOARDING_PACK_SENT','ACCOUNT_CREATED','LOST'
);

CREATE TYPE public.tenancy_type AS ENUM (
  'AGENCY_BROKERAGE_CONSULTANCY','BUILDER_DEVELOPER'
);

CREATE TYPE public.account_status AS ENUM (
  'LIVE','ONBOARDING_IN_PROGRESS','STALLED_ONBOARDING','DEACTIVATED'
);

CREATE TYPE public.calendar_event_type AS ENUM (
  'DEMO','FOLLOW_UP','CALL_BACK','CHECK_IN','ONBOARDING','OTHER'
);

CREATE TYPE public.calendar_event_status AS ENUM (
  'SCHEDULED','COMPLETED','CANCELLED','NO_SHOW'
);

CREATE TYPE public.submission_status AS ENUM (
  'PENDING_REVIEW','APPROVED','REJECTED'
);

-- =====================================================================
-- 2. TIMESTAMP HELPER
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 3. PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 4. ROLES (separate table — never on profiles)
-- =====================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','support_agent')
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies
CREATE POLICY "Staff can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- user_roles policies
CREATE POLICY "Staff can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- 5. ENQUIRIES
-- =====================================================================
CREATE TABLE public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  company_name TEXT,
  tenancy_type public.tenancy_type,
  source TEXT,
  stage public.enquiry_stage NOT NULL DEFAULT 'NEW_ENQUIRY',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  demo_scheduled_at TIMESTAMPTZ,
  demo_completed_at TIMESTAMPTZ,
  onboarding_pack_sent BOOLEAN NOT NULL DEFAULT false,
  onboarding_pack_sent_at TIMESTAMPTZ,
  onboarding_form_link TEXT,
  converted_account_id UUID,
  lost_reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_enquiries_stage ON public.enquiries(stage);
CREATE INDEX idx_enquiries_assigned ON public.enquiries(assigned_to);
CREATE TRIGGER enquiries_updated_at BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff full access enquiries" ON public.enquiries
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.enquiry_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enquiry_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_enquiry_notes_enquiry ON public.enquiry_notes(enquiry_id);
CREATE POLICY "Staff full access enquiry_notes" ON public.enquiry_notes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================================
-- 6. CALENDAR
-- =====================================================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_type public.calendar_event_type NOT NULL DEFAULT 'OTHER',
  status public.calendar_event_status NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 30,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_calendar_scheduled ON public.calendar_events(scheduled_at);
CREATE INDEX idx_calendar_assigned ON public.calendar_events(assigned_to);
CREATE TRIGGER calendar_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Staff full access calendar" ON public.calendar_events
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================================
-- 7. KNOWLEDGE BASE
-- =====================================================================
CREATE TABLE public.kb_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.kb_folders(id) ON DELETE CASCADE,
  bucket_key TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kb_folders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER kb_folders_updated_at BEFORE UPDATE ON public.kb_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Staff full access kb_folders" ON public.kb_folders
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.kb_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.kb_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kb_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access kb_files" ON public.kb_files
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_kb_articles_bucket ON public.kb_articles(bucket_key);
CREATE TRIGGER kb_articles_updated_at BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Staff full access kb_articles" ON public.kb_articles
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================================
-- 8. ONBOARDING SUBMISSIONS (public can insert)
-- =====================================================================
CREATE TABLE public.onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
  tenancy_type public.tenancy_type NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'PENDING_REVIEW',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_onboarding_enquiry ON public.onboarding_submissions(enquiry_id);
CREATE TRIGGER onboarding_updated_at BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Public can submit onboarding" ON public.onboarding_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can read submissions" ON public.onboarding_submissions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update submissions" ON public.onboarding_submissions
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete submissions" ON public.onboarding_submissions
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- =====================================================================
-- 9. ACCOUNTS
-- =====================================================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT UNIQUE,
  account_name TEXT NOT NULL,
  city TEXT,
  tenancy_type public.tenancy_type NOT NULL,
  status public.account_status NOT NULL DEFAULT 'ONBOARDING_IN_PROGRESS',
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  gst_number TEXT,
  pan_number TEXT,
  rera_number TEXT,
  website TEXT,
  source_enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
  source_submission_id UUID REFERENCES public.onboarding_submissions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_accounts_status ON public.accounts(status);
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Staff full access accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.account_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_seats ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_seats_account ON public.account_seats(account_id);
CREATE TRIGGER seats_updated_at BEFORE UPDATE ON public.account_seats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Staff full access seats" ON public.account_seats
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.account_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_account_notes_account ON public.account_notes(account_id);
CREATE POLICY "Staff full access account_notes" ON public.account_notes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.account_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_checklist_account ON public.account_checklist_items(account_id);
CREATE TRIGGER checklist_updated_at BEFORE UPDATE ON public.account_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Staff full access checklist" ON public.account_checklist_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================================
-- 10. CONVERSION RPC (atomic)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_account(_enquiry_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enquiry public.enquiries%ROWTYPE;
  v_submission public.onboarding_submissions%ROWTYPE;
  v_account_id UUID;
  v_member JSONB;
  v_checklist TEXT[];
  v_label TEXT;
  v_idx INT := 0;
  v_payload JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = _enquiry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enquiry not found'; END IF;

  SELECT * INTO v_submission FROM public.onboarding_submissions
    WHERE enquiry_id = _enquiry_id AND status = 'APPROVED'
    ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved onboarding submission required'; END IF;

  v_payload := v_submission.payload;

  INSERT INTO public.accounts (
    account_name, city, tenancy_type, status,
    owner_name, owner_phone, owner_email,
    gst_number, pan_number, rera_number, website,
    source_enquiry_id, source_submission_id, payload
  ) VALUES (
    COALESCE(v_payload->>'company_name', v_enquiry.company_name, v_enquiry.full_name),
    COALESCE(v_payload->>'city', v_enquiry.city),
    v_submission.tenancy_type,
    'ONBOARDING_IN_PROGRESS',
    COALESCE(v_payload->>'owner_name', v_enquiry.full_name),
    COALESCE(v_payload->>'owner_phone', v_enquiry.phone),
    COALESCE(v_payload->>'owner_email', v_enquiry.email),
    v_payload->>'gst_number',
    v_payload->>'pan_number',
    v_payload->>'rera_number',
    v_payload->>'website',
    v_enquiry.id,
    v_submission.id,
    v_payload
  ) RETURNING id INTO v_account_id;

  -- Seats from team_members
  IF jsonb_typeof(v_payload->'team_members') = 'array' THEN
    FOR v_member IN SELECT * FROM jsonb_array_elements(v_payload->'team_members')
    LOOP
      INSERT INTO public.account_seats (account_id, full_name, email, phone, role, is_active)
      VALUES (
        v_account_id,
        COALESCE(v_member->>'full_name', v_member->>'name', 'Member'),
        v_member->>'email',
        v_member->>'phone',
        v_member->>'role',
        true
      );
    END LOOP;
  END IF;

  -- Default checklist
  v_checklist := ARRAY[
    'Welcome call completed',
    'Branding assets uploaded',
    'Team seats activated',
    'Portal integrations configured',
    'First listing imported',
    'Go-live confirmed'
  ];
  FOREACH v_label IN ARRAY v_checklist LOOP
    INSERT INTO public.account_checklist_items (account_id, label, sort_order)
    VALUES (v_account_id, v_label, v_idx);
    v_idx := v_idx + 1;
  END LOOP;

  -- Update enquiry
  UPDATE public.enquiries
    SET stage = 'ACCOUNT_CREATED',
        converted_account_id = v_account_id,
        updated_at = now()
    WHERE id = _enquiry_id;

  -- Timeline notes
  INSERT INTO public.enquiry_notes (enquiry_id, author_id, note_text)
    VALUES (_enquiry_id, auth.uid(), 'Converted to account.');
  INSERT INTO public.account_notes (account_id, author_id, note_text)
    VALUES (v_account_id, auth.uid(), 'Account created from approved onboarding submission.');

  RETURN v_account_id;
END;
$$;

-- =====================================================================
-- 11. STORAGE BUCKETS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('kb-files','kb-files', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('onboarding-uploads','onboarding-uploads', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read kb-files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'kb-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff write kb-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kb-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update kb-files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'kb-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete kb-files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'kb-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Public upload onboarding" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'onboarding-uploads');
CREATE POLICY "Staff read onboarding uploads" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'onboarding-uploads' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete onboarding uploads" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'onboarding-uploads' AND public.is_staff(auth.uid()));
