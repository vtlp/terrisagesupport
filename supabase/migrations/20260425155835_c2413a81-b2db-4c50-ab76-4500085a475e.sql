-- Sequence for payment order numbers
CREATE SEQUENCE IF NOT EXISTS public.payment_order_no_seq START 1;

-- Helper to generate the next formatted order number, e.g. TS-ORD-000042
CREATE OR REPLACE FUNCTION public.next_payment_order_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'TS-ORD-' || LPAD(nextval('public.payment_order_no_seq')::TEXT, 6, '0');
END $$;

-- Persist order numbers for renewal and trial conversion links on billing settings
ALTER TABLE public.account_billing_settings
  ADD COLUMN IF NOT EXISTS renewal_order_no TEXT,
  ADD COLUMN IF NOT EXISTS trial_order_no TEXT;

-- Persist order number for seat upsell links
ALTER TABLE public.seat_upsell_links
  ADD COLUMN IF NOT EXISTS order_no TEXT;

CREATE INDEX IF NOT EXISTS idx_seat_upsell_links_order_no ON public.seat_upsell_links(order_no);
CREATE INDEX IF NOT EXISTS idx_billing_renewal_order_no ON public.account_billing_settings(renewal_order_no);
CREATE INDEX IF NOT EXISTS idx_billing_trial_order_no ON public.account_billing_settings(trial_order_no);