
-- 1. marketing_targets
CREATE TABLE public.marketing_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  tenancy_type public.tenancy_type NOT NULL,
  q1 INT NOT NULL DEFAULT 0,
  q2 INT NOT NULL DEFAULT 0,
  q3 INT NOT NULL DEFAULT 0,
  q4 INT NOT NULL DEFAULT 0,
  total_target INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, tenancy_type)
);
ALTER TABLE public.marketing_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_targets" ON public.marketing_targets
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_targets" ON public.marketing_targets
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX idx_marketing_targets_year_tenancy ON public.marketing_targets(year, tenancy_type);
CREATE TRIGGER trg_marketing_targets_updated_at BEFORE UPDATE ON public.marketing_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. marketing_settings (singleton)
CREATE TABLE public.marketing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_spend_override NUMERIC NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_settings" ON public.marketing_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_settings" ON public.marketing_settings
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE TRIGGER trg_marketing_settings_updated_at BEFORE UPDATE ON public.marketing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.marketing_settings (total_spend_override) VALUES (0);

-- 3. marketing_referrals
CREATE TABLE public.marketing_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_name TEXT NOT NULL,
  referrer_phone TEXT,
  referrer_email TEXT,
  referred_company TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_referrals" ON public.marketing_referrals
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_referrals" ON public.marketing_referrals
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX idx_marketing_referrals_city ON public.marketing_referrals(LOWER(city));
CREATE TRIGGER trg_marketing_referrals_updated_at BEFORE UPDATE ON public.marketing_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. marketing_contacts
CREATE TABLE public.marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_contacts" ON public.marketing_contacts
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_contacts" ON public.marketing_contacts
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX idx_marketing_contacts_city ON public.marketing_contacts(LOWER(city));
CREATE TRIGGER trg_marketing_contacts_updated_at BEFORE UPDATE ON public.marketing_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. marketing_champions
CREATE TABLE public.marketing_champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  reach INT NOT NULL DEFAULT 0,
  city TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_champions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_champions" ON public.marketing_champions
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_champions" ON public.marketing_champions
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX idx_marketing_champions_city ON public.marketing_champions(LOWER(city));
CREATE TRIGGER trg_marketing_champions_updated_at BEFORE UPDATE ON public.marketing_champions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. marketing_events
CREATE TABLE public.marketing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  location TEXT,
  city TEXT,
  event_date DATE,
  attendees INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_events" ON public.marketing_events
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_events" ON public.marketing_events
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX idx_marketing_events_city ON public.marketing_events(LOWER(city));
CREATE TRIGGER trg_marketing_events_updated_at BEFORE UPDATE ON public.marketing_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. marketing_cost_items
CREATE TYPE public.marketing_cost_item_type AS ENUM ('ONLINE','OFFLINE');
CREATE TABLE public.marketing_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  cost_type public.marketing_cost_item_type NOT NULL,
  spend_date DATE,
  city TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_cost_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_cost_items" ON public.marketing_cost_items
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_cost_items" ON public.marketing_cost_items
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX idx_marketing_cost_items_type_date ON public.marketing_cost_items(cost_type, spend_date);
CREATE INDEX idx_marketing_cost_items_city ON public.marketing_cost_items(LOWER(city));
CREATE TRIGGER trg_marketing_cost_items_updated_at BEFORE UPDATE ON public.marketing_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
