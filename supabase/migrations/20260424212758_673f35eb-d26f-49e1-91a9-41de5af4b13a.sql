-- Snapshots table
CREATE TABLE public.account_usage_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  dau INTEGER NOT NULL DEFAULT 0,
  wau INTEGER NOT NULL DEFAULT 0,
  mau INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  follow_ups INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'terrisage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

CREATE INDEX idx_aus_account_date ON public.account_usage_snapshots(account_id, snapshot_date DESC);
CREATE INDEX idx_aus_date ON public.account_usage_snapshots(snapshot_date DESC);

ALTER TABLE public.account_usage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view snapshots"
ON public.account_usage_snapshots FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert snapshots"
ON public.account_usage_snapshots FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update snapshots"
ON public.account_usage_snapshots FOR UPDATE
USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_aus_updated_at
BEFORE UPDATE ON public.account_usage_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_usage_snapshots;
ALTER TABLE public.account_usage_snapshots REPLICA IDENTITY FULL;

-- Retention: keep last 365 days
CREATE OR REPLACE FUNCTION public.cleanup_usage_snapshots()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM public.account_usage_snapshots
   WHERE snapshot_date < (CURRENT_DATE - INTERVAL '365 days');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;