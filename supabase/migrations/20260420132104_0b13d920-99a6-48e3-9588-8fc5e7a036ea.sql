-- 1. Add contact_type enum (alphabetical)
CREATE TYPE public.contact_type AS ENUM (
  'Adviser/Mentor',
  'Champion (non user)',
  'CRM CP',
  'Investor',
  'Media/PR',
  'Potential Hire',
  'Prospect Customer',
  'Strategic Partner',
  'Vendor/Service Provider',
  'VIP'
);

-- 2. Add referral_status enum (alphabetical)
CREATE TYPE public.referral_status AS ENUM (
  'Closed',
  'In Process',
  'New',
  'Paid',
  'Pending',
  'Referred',
  'Rejected'
);

-- 3. Extend marketing_contacts
ALTER TABLE public.marketing_contacts
  ADD COLUMN contact_type public.contact_type NOT NULL DEFAULT 'Prospect Customer',
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX idx_marketing_contacts_type ON public.marketing_contacts(contact_type);

-- 4. Migrate marketing_champions → marketing_contacts
INSERT INTO public.marketing_contacts (name, company, title, city, notes, contact_type, created_by, created_at)
SELECT name, company, role, city, notes, 'Champion (non user)'::contact_type, created_by, created_at
FROM public.marketing_champions;

-- 5. Migrate marketing_referrals referrer info → marketing_contacts (only if referrer not already present)
INSERT INTO public.marketing_contacts (name, phone, email, city, notes, contact_type, created_by, created_at)
SELECT DISTINCT ON (referrer_name, COALESCE(referrer_phone,''), COALESCE(referrer_email,''))
  referrer_name, referrer_phone, referrer_email, city, notes, 'CRM CP'::contact_type, created_by, created_at
FROM public.marketing_referrals r
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_contacts c
  WHERE lower(c.name) = lower(r.referrer_name)
    AND COALESCE(c.email,'') = COALESCE(r.referrer_email,'')
);

-- 6. New referral records table
CREATE TABLE public.marketing_referral_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE RESTRICT,
  referral_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.referral_status NOT NULL DEFAULT 'New',
  seats_referred integer NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 0,
  price_per_seat numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_records_contact ON public.marketing_referral_records(contact_id);
CREATE INDEX idx_referral_records_status ON public.marketing_referral_records(status);

ALTER TABLE public.marketing_referral_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access referral_records"
  ON public.marketing_referral_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read referral_records"
  ON public.marketing_referral_records FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

CREATE TRIGGER update_referral_records_updated_at
  BEFORE UPDATE ON public.marketing_referral_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Drop old tables
DROP TABLE public.marketing_champions;
DROP TABLE public.marketing_referrals;

-- 8. Storage bucket for contact attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('contact-attachments', 'contact-attachments', false);

CREATE POLICY "Staff read contact attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contact-attachments' AND is_staff(auth.uid()));

CREATE POLICY "Admins upload contact attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contact-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update contact attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contact-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete contact attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contact-attachments' AND has_role(auth.uid(), 'admin'::app_role));