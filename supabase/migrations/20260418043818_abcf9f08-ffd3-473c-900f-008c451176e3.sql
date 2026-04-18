-- 1. Add seats_purchased to billing settings
ALTER TABLE public.account_billing_settings
  ADD COLUMN IF NOT EXISTS seats_purchased INTEGER NOT NULL DEFAULT 0;

-- 2. Seat request status enum
DO $$ BEGIN
  CREATE TYPE public.seat_request_status AS ENUM ('PENDING','APPROVED','REJECTED','FULFILLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Seat requests table
CREATE TABLE IF NOT EXISTS public.seat_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  requested_by_email TEXT,
  requested_seats INTEGER NOT NULL CHECK (requested_seats > 0),
  status public.seat_request_status NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seat_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access seat_requests" ON public.seat_requests;
CREATE POLICY "Staff full access seat_requests"
  ON public.seat_requests FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_seat_requests_account ON public.seat_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON public.seat_requests(status);

DROP TRIGGER IF EXISTS trg_seat_requests_updated_at ON public.seat_requests;
CREATE TRIGGER trg_seat_requests_updated_at
  BEFORE UPDATE ON public.seat_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Account API keys (hashed)
CREATE TABLE IF NOT EXISTS public.account_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'CRM integration',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.account_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access api_keys" ON public.account_api_keys;
CREATE POLICY "Staff full access api_keys"
  ON public.account_api_keys FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_account_api_keys_account ON public.account_api_keys(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_api_keys_hash ON public.account_api_keys(key_hash);

-- 5. Seat capacity view
CREATE OR REPLACE VIEW public.account_seat_capacity
WITH (security_invoker = true)
AS
SELECT
  a.id AS account_id,
  a.account_name,
  COALESCE(b.seats_purchased, 0) AS seats_purchased,
  COALESCE((SELECT COUNT(*) FROM public.account_seats s WHERE s.account_id = a.id AND s.is_active = true), 0)::INT AS seats_used,
  GREATEST(COALESCE(b.seats_purchased, 0) - COALESCE((SELECT COUNT(*) FROM public.account_seats s WHERE s.account_id = a.id AND s.is_active = true), 0)::INT, 0) AS seats_available,
  COALESCE(b.plan_name, 'Standard') AS plan_name,
  COALESCE(b.status, 'ACTIVE'::subscription_status) AS subscription_status
FROM public.accounts a
LEFT JOIN public.account_billing_settings b ON b.account_id = a.id;

-- 6. Activity log triggers for seat_requests
CREATE OR REPLACE FUNCTION public.trg_seat_requests_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'SEAT_CHANGE',
      'Seat request: +' || NEW.requested_seats || ' seats',
      jsonb_build_object('request_id', NEW.id, 'requested_seats', NEW.requested_seats, 'status', NEW.status, 'requested_by_email', NEW.requested_by_email));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('ACCOUNT', NEW.account_id, 'SEAT_CHANGE',
      'Seat request ' || NEW.status || ' (+' || NEW.requested_seats || ')',
      jsonb_build_object('request_id', NEW.id, 'from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seat_requests_activity ON public.seat_requests;
CREATE TRIGGER trg_seat_requests_activity
  AFTER INSERT OR UPDATE ON public.seat_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_seat_requests_activity();

-- 7. RPC: validate API key (used by edge functions). Returns account_id if valid.
CREATE OR REPLACE FUNCTION public.validate_account_api_key(_key_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account_id UUID;
BEGIN
  UPDATE public.account_api_keys
    SET last_used_at = now()
    WHERE key_hash = _key_hash AND is_active = true AND revoked_at IS NULL
    RETURNING account_id INTO v_account_id;
  RETURN v_account_id;
END $$;

-- 8. RPC: fulfil seat request (atomic: bumps purchased + marks fulfilled)
CREATE OR REPLACE FUNCTION public.fulfil_seat_request(_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_req public.seat_requests%ROWTYPE;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO v_req FROM public.seat_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status = 'FULFILLED' THEN RAISE EXCEPTION 'Already fulfilled'; END IF;

  -- Ensure billing settings row exists, then bump
  INSERT INTO public.account_billing_settings (account_id, seats_purchased)
  VALUES (v_req.account_id, v_req.requested_seats)
  ON CONFLICT (account_id) DO UPDATE
    SET seats_purchased = public.account_billing_settings.seats_purchased + v_req.requested_seats,
        updated_at = now();

  UPDATE public.seat_requests
    SET status = 'FULFILLED',
        decided_by = auth.uid(),
        decided_at = COALESCE(decided_at, now()),
        fulfilled_at = now(),
        updated_at = now()
    WHERE id = _request_id;
END $$;

-- Ensure unique constraint on billing settings account_id (needed for ON CONFLICT)
DO $$ BEGIN
  ALTER TABLE public.account_billing_settings ADD CONSTRAINT account_billing_settings_account_id_key UNIQUE (account_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;