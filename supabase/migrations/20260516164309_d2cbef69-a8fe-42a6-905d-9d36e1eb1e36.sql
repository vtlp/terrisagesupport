CREATE TABLE IF NOT EXISTS public.terrisage_amenity_master (
  amenity_id uuid PRIMARY KEY,
  code text,
  display_name text NOT NULL,
  category text,
  property_type text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_terrisage_amenity_property ON public.terrisage_amenity_master(property_type);
CREATE INDEX IF NOT EXISTS idx_terrisage_amenity_display ON public.terrisage_amenity_master(lower(display_name));

ALTER TABLE public.terrisage_amenity_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read terrisage_amenity_master" ON public.terrisage_amenity_master;
CREATE POLICY "Staff read terrisage_amenity_master"
  ON public.terrisage_amenity_master FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));