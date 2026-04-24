-- Seat upsell links: pro-rated mid-cycle billing for approved seat requests
CREATE TABLE public.seat_upsell_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  seat_request_id UUID NOT NULL,
  seats_extra INTEGER NOT NULL,
  per_seat_rate NUMERIC NOT NULL DEFAULT 0,
  days_remaining INTEGER NOT NULL,
  days_in_cycle INTEGER NOT NULL,
  prorated_subtotal NUMERIC NOT NULL DEFAULT 0,
  gst_pct NUMERIC NOT NULL DEFAULT 18,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  link_id TEXT,
  short_url TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED',
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_reference TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seat_upsell_links_account ON public.seat_upsell_links(account_id);
CREATE INDEX idx_seat_upsell_links_request ON public.seat_upsell_links(seat_request_id);
CREATE INDEX idx_seat_upsell_links_status ON public.seat_upsell_links(status);

ALTER TABLE public.seat_upsell_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access seat_upsell_links"
ON public.seat_upsell_links
FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER update_seat_upsell_links_updated_at
BEFORE UPDATE ON public.seat_upsell_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();