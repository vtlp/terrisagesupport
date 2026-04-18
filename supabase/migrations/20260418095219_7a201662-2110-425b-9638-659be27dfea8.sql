
-- ============================================================================
-- LOOKUPS BACKEND (Module 3)
-- ============================================================================

CREATE TABLE public.lookup_cities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  state       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lookup_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cities" ON public.lookup_cities
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read cities" ON public.lookup_cities
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

INSERT INTO public.lookup_cities (name, state, sort_order) VALUES
  ('Mumbai','Maharashtra',1),('Pune','Maharashtra',2),('Bengaluru','Karnataka',3),
  ('Hyderabad','Telangana',4),('Chennai','Tamil Nadu',5),('Delhi','Delhi',6),
  ('Gurugram','Haryana',7),('Noida','Uttar Pradesh',8),('Kolkata','West Bengal',9),
  ('Ahmedabad','Gujarat',10),('Jaipur','Rajasthan',11),('Kochi','Kerala',12),
  ('Indore','Madhya Pradesh',13),('Lucknow','Uttar Pradesh',14),('Chandigarh','Chandigarh',15);

CREATE TABLE public.lookup_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  category    TEXT,
  color       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lookup_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tags" ON public.lookup_tags
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read tags" ON public.lookup_tags
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

INSERT INTO public.lookup_tags (name, category, sort_order) VALUES
  ('VIP','priority',1),('At risk','status',2),('Champion','status',3),
  ('Renewal due','billing',4),('Beta tester','program',5),('Reference customer','program',6);

CREATE TABLE public.lookup_portals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  website     TEXT,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lookup_portals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage portals" ON public.lookup_portals
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read portals" ON public.lookup_portals
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

INSERT INTO public.lookup_portals (key, name, website, sort_order) VALUES
  ('MAGICBRICKS','MagicBricks','https://www.magicbricks.com',1),
  ('99ACRES','99acres','https://www.99acres.com',2),
  ('HOUSING','Housing.com','https://housing.com',3),
  ('NOBROKER','NoBroker','https://www.nobroker.in',4),
  ('SQUAREYARDS','Square Yards','https://www.squareyards.com',5);

CREATE TABLE public.lookup_enquiry_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lookup_enquiry_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage enquiry_sources" ON public.lookup_enquiry_sources
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read enquiry_sources" ON public.lookup_enquiry_sources
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

INSERT INTO public.lookup_enquiry_sources (key, name, sort_order) VALUES
  ('LANDING_PAGE','Landing page',1),('META_ADS','Meta ads',2),('GOOGLE_ADS','Google ads',3),
  ('CP_REFERRAL','Channel partner referral',4),('WALK_IN','Walk-in',5),
  ('PHONE_CALL','Phone call',6),('WHATSAPP','WhatsApp',7),('EVENT','Event / expo',8),
  ('CHAMPION_REFERRAL','Champion referral',9),('OTHER','Other',10);

-- ============================================================================
-- REPORTS VIEWS (Module 4) — read-only roll-ups over existing data
-- ============================================================================

-- Pipeline funnel: count enquiries per stage
CREATE OR REPLACE VIEW public.v_pipeline_funnel AS
SELECT
  stage::TEXT AS stage,
  COUNT(*) AS enquiry_count,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '7 days')  AS last_7d,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days') AS last_30d
FROM public.enquiries
GROUP BY stage;

-- Account usage snapshot
CREATE OR REPLACE VIEW public.v_account_usage AS
SELECT
  a.id                           AS account_id,
  a.account_name,
  a.status::TEXT                 AS account_status,
  a.tenancy_type::TEXT           AS tenancy_type,
  a.city,
  COALESCE(b.plan_name,'Standard') AS plan_name,
  COALESCE(b.seats_purchased,0)  AS seats_purchased,
  (SELECT COUNT(*) FROM public.account_seats s WHERE s.account_id = a.id AND s.is_active) AS seats_used,
  a.created_at                   AS account_created_at,
  (SELECT MAX(created_at) FROM public.activity_log al WHERE al.entity_type = 'ACCOUNT' AND al.entity_id = a.id) AS last_activity_at
FROM public.accounts a
LEFT JOIN public.account_billing_settings b ON b.account_id = a.id;

-- Ticket SLA compliance
CREATE OR REPLACE VIEW public.v_ticket_sla_compliance AS
SELECT
  status::TEXT   AS status,
  priority::TEXT AS priority,
  COUNT(*)       AS ticket_count,
  COUNT(*) FILTER (
    WHERE first_response_at IS NOT NULL
      AND sla_first_response_at IS NOT NULL
      AND first_response_at <= sla_first_response_at
  ) AS first_response_met,
  COUNT(*) FILTER (
    WHERE resolved_at IS NOT NULL
      AND sla_resolution_at IS NOT NULL
      AND resolved_at <= sla_resolution_at
  ) AS resolution_met,
  COUNT(*) FILTER (WHERE first_response_at IS NULL AND status NOT IN ('CLOSED','RESOLVED')) AS awaiting_first_response
FROM public.tickets
GROUP BY status, priority;

-- Marketing performance roll-up
CREATE OR REPLACE VIEW public.v_marketing_performance AS
SELECT
  c.id                AS campaign_id,
  c.name              AS campaign_name,
  c.status::TEXT      AS status,
  ch.name             AS channel_name,
  c.budget,
  COALESCE(SUM(mc.amount),0)        AS spend,
  COALESCE(SUM(mc.impressions),0)   AS impressions,
  COALESCE(SUM(mc.clicks),0)        AS clicks,
  COALESCE(SUM(mc.leads),0)         AS leads,
  CASE WHEN COALESCE(SUM(mc.leads),0) > 0
       THEN ROUND(COALESCE(SUM(mc.amount),0) / SUM(mc.leads), 2)
       ELSE NULL END               AS cost_per_lead
FROM public.marketing_campaigns c
LEFT JOIN public.marketing_channels ch ON ch.id = c.channel_id
LEFT JOIN public.marketing_costs mc    ON mc.campaign_id = c.id
GROUP BY c.id, c.name, c.status, ch.name, c.budget;
