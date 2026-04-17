-- Link an enquiry to the original it duplicates (nullable)
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS is_duplicate_of uuid NULL REFERENCES public.enquiries(id) ON DELETE SET NULL;

-- Index for fast duplicate-phone lookups (digits-only normalisation)
CREATE INDEX IF NOT EXISTS idx_enquiries_phone_digits
  ON public.enquiries ((regexp_replace(coalesce(phone,''), '\D', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_enquiries_is_duplicate_of
  ON public.enquiries (is_duplicate_of);