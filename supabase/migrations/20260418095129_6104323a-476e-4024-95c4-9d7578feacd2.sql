
-- ============================================================================
-- MARKETING BACKEND (Module 2)
-- ============================================================================

-- 1. ENUMS ------------------------------------------------------------------
CREATE TYPE public.marketing_channel_type AS ENUM ('PAID','ORGANIC','REFERRAL','DIRECT','EVENT','OTHER');
CREATE TYPE public.marketing_cost_type    AS ENUM ('CPM','CPC','CPL','FIXED','RETAINER');
CREATE TYPE public.campaign_status        AS ENUM ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED');
CREATE TYPE public.content_status         AS ENUM ('IDEA','DRAFT','SCHEDULED','PUBLISHED','ARCHIVED');
CREATE TYPE public.governance_decision    AS ENUM ('PENDING','APPROVED','CHANGES_REQUESTED','REJECTED');

-- 2. CHANNELS ---------------------------------------------------------------
CREATE TABLE public.marketing_channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  channel_type public.marketing_channel_type NOT NULL DEFAULT 'PAID',
  default_cost_type public.marketing_cost_type,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_channels" ON public.marketing_channels
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_channels" ON public.marketing_channels
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

INSERT INTO public.marketing_channels (key, name, channel_type, default_cost_type, sort_order) VALUES
  ('META_ADS',    'Meta Ads',       'PAID',     'CPC', 1),
  ('GOOGLE_ADS',  'Google Ads',     'PAID',     'CPC', 2),
  ('ORGANIC_SEO', 'Organic search', 'ORGANIC',  NULL,  3),
  ('WHATSAPP',    'WhatsApp',       'DIRECT',   'FIXED', 4),
  ('REFERRAL',    'Channel partner referral', 'REFERRAL', 'CPL', 5),
  ('EVENT',       'Events & expos', 'EVENT',    'FIXED', 6);

-- 3. LEAD SOURCES -----------------------------------------------------------
CREATE TABLE public.lead_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  channel_id  UUID REFERENCES public.marketing_channels(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access lead_sources" ON public.lead_sources
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read lead_sources" ON public.lead_sources
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- 4. CAMPAIGNS --------------------------------------------------------------
CREATE TABLE public.marketing_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  objective    TEXT,
  channel_id   UUID REFERENCES public.marketing_channels(id) ON DELETE SET NULL,
  status       public.campaign_status NOT NULL DEFAULT 'DRAFT',
  start_date   DATE,
  end_date     DATE,
  budget       NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'INR',
  owner_id     UUID,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_status     ON public.marketing_campaigns(status);
CREATE INDEX idx_campaigns_channel    ON public.marketing_campaigns(channel_id);
CREATE INDEX idx_campaigns_dates      ON public.marketing_campaigns(start_date, end_date);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access campaigns" ON public.marketing_campaigns
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read campaigns" ON public.marketing_campaigns
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE TRIGGER campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. CAMPAIGN COSTS ---------------------------------------------------------
CREATE TABLE public.marketing_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  cost_type    public.marketing_cost_type NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'INR',
  impressions  INT,
  clicks       INT,
  leads        INT,
  period_from  DATE,
  period_to    DATE,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketing_costs_campaign ON public.marketing_costs(campaign_id);
ALTER TABLE public.marketing_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access marketing_costs" ON public.marketing_costs
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read marketing_costs" ON public.marketing_costs
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- 6. UTM LINKS --------------------------------------------------------------
CREATE TABLE public.utm_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  destination   TEXT NOT NULL,
  utm_source    TEXT NOT NULL,
  utm_medium    TEXT NOT NULL,
  utm_campaign  TEXT NOT NULL,
  utm_content   TEXT,
  utm_term      TEXT,
  full_url      TEXT NOT NULL,
  short_code    TEXT UNIQUE,
  click_count   INT NOT NULL DEFAULT 0,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access utm_links" ON public.utm_links
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read utm_links" ON public.utm_links
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- 7. CONTENT CALENDAR -------------------------------------------------------
CREATE TABLE public.content_calendar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  format       TEXT,
  channel_id   UUID REFERENCES public.marketing_channels(id) ON DELETE SET NULL,
  campaign_id  UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  status       public.content_status NOT NULL DEFAULT 'IDEA',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  owner_id     UUID,
  body_text    TEXT,
  asset_path   TEXT,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_calendar_scheduled ON public.content_calendar(scheduled_at);
CREATE INDEX idx_content_calendar_status    ON public.content_calendar(status);
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access content_calendar" ON public.content_calendar
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read content_calendar" ON public.content_calendar
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE TRIGGER content_calendar_updated_at
BEFORE UPDATE ON public.content_calendar
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. GOVERNANCE / APPROVALS -------------------------------------------------
CREATE TABLE public.marketing_governance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('CAMPAIGN','CONTENT')),
  entity_id     UUID NOT NULL,
  submitted_by  UUID,
  approver_id   UUID,
  decision      public.governance_decision NOT NULL DEFAULT 'PENDING',
  decision_notes TEXT,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_governance_entity ON public.marketing_governance(entity_type, entity_id);
ALTER TABLE public.marketing_governance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access governance" ON public.marketing_governance
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read governance" ON public.marketing_governance
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

CREATE TRIGGER governance_updated_at
BEFORE UPDATE ON public.marketing_governance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
