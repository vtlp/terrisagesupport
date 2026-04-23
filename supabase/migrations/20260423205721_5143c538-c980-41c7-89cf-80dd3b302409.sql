
-- ============================================================
-- 1. Extend account_billing_settings
-- ============================================================
ALTER TABLE public.account_billing_settings
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'IN';

UPDATE public.account_billing_settings
   SET current_period_end = next_renewal_at,
       current_period_start = CASE billing_cycle
         WHEN 'MONTHLY' THEN next_renewal_at - interval '1 month'
         WHEN 'QUARTERLY' THEN next_renewal_at - interval '3 months'
         ELSE next_renewal_at - interval '1 year'
       END,
       subscription_started_at = COALESCE(subscription_started_at, created_at)
 WHERE next_renewal_at IS NOT NULL AND current_period_end IS NULL;

-- ============================================================
-- 2. Extend account_seats
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.crm_seat_state AS ENUM (
    'INVITED','ACTIVE','TEMP_DEACTIVATED','DELETION_REQUESTED','DELETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.account_seats
  ADD COLUMN IF NOT EXISTS crm_state public.crm_seat_state NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_in_cycle BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_account_seats_state ON public.account_seats(account_id, crm_state);

-- ============================================================
-- 3. Extend account_invoices
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.invoice_kind AS ENUM ('CYCLE','PRORATION','RENEWAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.account_invoices
  ADD COLUMN IF NOT EXISTS kind public.invoice_kind NOT NULL DEFAULT 'CYCLE';

-- ============================================================
-- 4. seat_usage_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seat_usage_snapshots (
  account_id     UUID PRIMARY KEY,
  allocated      INT NOT NULL DEFAULT 0,
  reserved       INT NOT NULL DEFAULT 0,
  consumed       INT NOT NULL DEFAULT 0,
  available      INT NOT NULL DEFAULT 0,
  members        JSONB NOT NULL DEFAULT '[]'::jsonb,
  reported_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source         TEXT NOT NULL DEFAULT 'CRM',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seat_usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access seat_usage_snapshots" ON public.seat_usage_snapshots;
CREATE POLICY "Staff full access seat_usage_snapshots"
  ON public.seat_usage_snapshots FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS update_seat_usage_snapshots_updated_at ON public.seat_usage_snapshots;
CREATE TRIGGER update_seat_usage_snapshots_updated_at
  BEFORE UPDATE ON public.seat_usage_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. seat_change_events
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.seat_change_reason AS ENUM (
    'ONBOARDING','REQUEST_FULFILLED','RENEWAL_INCREASE','RENEWAL_DECREASE','MANUAL','SUPERUSER_TRANSFER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.seat_change_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL,
  delta            INT NOT NULL,
  new_total        INT NOT NULL,
  reason           public.seat_change_reason NOT NULL,
  effective_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  prorated_amount  NUMERIC NOT NULL DEFAULT 0,
  invoice_id       UUID,
  notes            TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seat_change_events_account ON public.seat_change_events(account_id, created_at DESC);

ALTER TABLE public.seat_change_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access seat_change_events" ON public.seat_change_events;
CREATE POLICY "Staff full access seat_change_events"
  ON public.seat_change_events FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ============================================================
-- 6. account_renewal_decisions
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.renewal_decision AS ENUM (
    'RENEW','RENEW_INCREASE','RENEW_DECREASE','CANCEL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.account_renewal_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  decision        public.renewal_decision NOT NULL,
  new_seats       INT,
  notes           TEXT,
  decided_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renewal_decisions_account ON public.account_renewal_decisions(account_id, created_at DESC);

ALTER TABLE public.account_renewal_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access account_renewal_decisions" ON public.account_renewal_decisions;
CREATE POLICY "Staff full access account_renewal_decisions"
  ON public.account_renewal_decisions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ============================================================
-- 7. superuser_transfers
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.superuser_transfer_status AS ENUM (
    'INITIATED','COMPLETED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.superuser_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL,
  from_seat_id        UUID,
  to_seat_id          UUID NOT NULL,
  status              public.superuser_transfer_status NOT NULL DEFAULT 'INITIATED',
  initiated_by        UUID,
  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  follow_up_event_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superuser_transfers_account ON public.superuser_transfers(account_id, initiated_at DESC);

ALTER TABLE public.superuser_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access superuser_transfers" ON public.superuser_transfers;
CREATE POLICY "Staff full access superuser_transfers"
  ON public.superuser_transfers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS update_superuser_transfers_updated_at ON public.superuser_transfers;
CREATE TRIGGER update_superuser_transfers_updated_at
  BEFORE UPDATE ON public.superuser_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. compute_proration
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_proration(_account_id UUID, _delta INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bs       public.account_billing_settings%ROWTYPE;
  v_days_remaining INT;
  v_cycle_days INT;
  v_amount   NUMERIC;
  v_gst      NUMERIC;
  v_total    NUMERIC;
BEGIN
  SELECT * INTO v_bs FROM public.account_billing_settings WHERE account_id = _account_id;
  IF NOT FOUND OR v_bs.current_period_end IS NULL OR v_bs.current_period_start IS NULL THEN
    RETURN jsonb_build_object('days_remaining',0,'cycle_days',0,'amount',0,'gst_amount',0,'total',0);
  END IF;

  v_cycle_days := GREATEST(1, EXTRACT(DAY FROM (v_bs.current_period_end - v_bs.current_period_start))::INT);
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_bs.current_period_end - now()))::INT);
  v_amount := ROUND(v_bs.seat_rate * _delta * v_days_remaining::NUMERIC / v_cycle_days, 2);
  v_gst := ROUND(v_amount * v_bs.gst_pct / 100, 2);
  v_total := v_amount + v_gst;

  RETURN jsonb_build_object(
    'days_remaining', v_days_remaining,
    'cycle_days', v_cycle_days,
    'seat_rate', v_bs.seat_rate,
    'delta', _delta,
    'amount', v_amount,
    'gst_pct', v_bs.gst_pct,
    'gst_amount', v_gst,
    'total', v_total
  );
END $$;

-- ============================================================
-- 9. apply_seat_delta
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_seat_delta(
  _account_id UUID,
  _delta INT,
  _reason public.seat_change_reason DEFAULT 'MANUAL',
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bs        public.account_billing_settings%ROWTYPE;
  v_new_total INT;
  v_event_id  UUID;
  v_invoice_id UUID;
  v_proration JSONB;
  v_amount    NUMERIC := 0;
  v_gst       NUMERIC := 0;
  v_total     NUMERIC := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'Delta must be non-zero'; END IF;

  SELECT * INTO v_bs FROM public.account_billing_settings WHERE account_id = _account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing settings missing'; END IF;

  v_new_total := GREATEST(0, v_bs.seats_purchased + _delta);

  UPDATE public.account_billing_settings
     SET seats_purchased = v_new_total, updated_at = now()
   WHERE account_id = _account_id;

  IF _delta > 0 AND v_bs.current_period_end IS NOT NULL AND v_bs.current_period_end > now() THEN
    v_proration := public.compute_proration(_account_id, _delta);
    v_amount := (v_proration->>'amount')::NUMERIC;
    v_gst    := (v_proration->>'gst_amount')::NUMERIC;
    v_total  := (v_proration->>'total')::NUMERIC;

    IF v_total > 0 THEN
      INSERT INTO public.account_invoices (
        account_id, kind, plan_name, seat_count, seat_rate, base_fee,
        subtotal, gst_pct, gst_amount, total, status, period_from, period_to,
        notes, created_by
      ) VALUES (
        _account_id, 'PRORATION', v_bs.plan_name, _delta, v_bs.seat_rate, 0,
        v_amount, v_bs.gst_pct, v_gst, v_total, 'DRAFT',
        now()::date, v_bs.current_period_end::date,
        'Mid-cycle proration: +' || _delta || ' seats × ' || (v_proration->>'days_remaining') || '/' || (v_proration->>'cycle_days') || ' days',
        auth.uid()
      ) RETURNING id INTO v_invoice_id;
    END IF;
  END IF;

  INSERT INTO public.seat_change_events (
    account_id, delta, new_total, reason, prorated_amount, invoice_id, notes, created_by
  ) VALUES (
    _account_id, _delta, v_new_total, _reason, v_total, v_invoice_id, _notes, auth.uid()
  ) RETURNING id INTO v_event_id;

  PERFORM public.log_activity('ACCOUNT', _account_id, 'SEAT_CHANGE',
    'Seats ' || CASE WHEN _delta > 0 THEN '+' ELSE '' END || _delta || ' (' || _reason || ')',
    jsonb_build_object('delta', _delta, 'new_total', v_new_total, 'reason', _reason, 'invoice_id', v_invoice_id, 'prorated_amount', v_total));

  RETURN v_event_id;
END $$;

-- ============================================================
-- 10. renew_subscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.renew_subscription(
  _account_id UUID,
  _decision public.renewal_decision,
  _new_seats INT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bs           public.account_billing_settings%ROWTYPE;
  v_new_period_start TIMESTAMPTZ;
  v_new_period_end   TIMESTAMPTZ;
  v_seats        INT;
  v_freed        INT := 0;
  v_chargeable   INT;
  v_subtotal     NUMERIC;
  v_gst          NUMERIC;
  v_total        NUMERIC;
  v_invoice_id   UUID;
  v_decision_id  UUID;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT * INTO v_bs FROM public.account_billing_settings WHERE account_id = _account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing settings missing'; END IF;

  INSERT INTO public.account_renewal_decisions (account_id, period_end, decision, new_seats, notes, decided_by)
  VALUES (_account_id, COALESCE(v_bs.current_period_end, now()), _decision, _new_seats, _notes, auth.uid())
  RETURNING id INTO v_decision_id;

  IF _decision = 'CANCEL' THEN
    UPDATE public.account_billing_settings
       SET status = 'CANCELLED'::subscription_status,
           cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
           cancellation_effective_at = COALESCE(v_bs.current_period_end, now()),
           auto_renew = false,
           updated_at = now()
     WHERE account_id = _account_id;
    RETURN v_decision_id;
  END IF;

  SELECT COUNT(*) INTO v_freed FROM public.account_seats
   WHERE account_id = _account_id AND crm_state = 'DELETED';

  v_seats := CASE
    WHEN _decision = 'RENEW' THEN GREATEST(0, v_bs.seats_purchased - v_freed)
    WHEN _decision IN ('RENEW_INCREASE','RENEW_DECREASE') THEN COALESCE(_new_seats, v_bs.seats_purchased)
    ELSE v_bs.seats_purchased
  END;

  v_new_period_start := COALESCE(v_bs.current_period_end, now());
  v_new_period_end := CASE v_bs.billing_cycle
    WHEN 'MONTHLY' THEN v_new_period_start + interval '1 month'
    WHEN 'QUARTERLY' THEN v_new_period_start + interval '3 months'
    ELSE v_new_period_start + interval '1 year'
  END;

  v_chargeable := GREATEST(0, v_seats - 3);
  v_subtotal := v_bs.base_fee + v_bs.seat_rate * v_chargeable;
  v_gst := ROUND(v_subtotal * v_bs.gst_pct / 100, 2);
  v_total := v_subtotal + v_gst;

  INSERT INTO public.account_invoices (
    account_id, kind, plan_name, seat_count, seat_rate, base_fee,
    subtotal, gst_pct, gst_amount, total, status, period_from, period_to,
    notes, created_by
  ) VALUES (
    _account_id, 'RENEWAL', v_bs.plan_name, v_seats, v_bs.seat_rate, v_bs.base_fee,
    v_subtotal, v_bs.gst_pct, v_gst, v_total, 'DRAFT',
    v_new_period_start::date, v_new_period_end::date,
    'Renewal · ' || _decision || ' · freed ' || v_freed || ' deleted seats',
    auth.uid()
  ) RETURNING id INTO v_invoice_id;

  DELETE FROM public.account_seats
   WHERE account_id = _account_id AND crm_state = 'DELETED';

  UPDATE public.account_seats
     SET deleted_in_cycle = false
   WHERE account_id = _account_id;

  UPDATE public.account_billing_settings
     SET seats_purchased = v_seats,
         current_period_start = v_new_period_start,
         current_period_end = v_new_period_end,
         next_renewal_at = v_new_period_end,
         status = 'ACTIVE'::subscription_status,
         updated_at = now()
   WHERE account_id = _account_id;

  INSERT INTO public.seat_change_events (account_id, delta, new_total, reason, invoice_id, notes, created_by)
  VALUES (_account_id, v_seats - v_bs.seats_purchased, v_seats,
          CASE WHEN v_seats > v_bs.seats_purchased THEN 'RENEWAL_INCREASE' ELSE 'RENEWAL_DECREASE' END,
          v_invoice_id,
          'Renewal: freed ' || v_freed || ' deleted seats',
          auth.uid());

  PERFORM public.log_activity('ACCOUNT', _account_id, 'STAGE_CHANGE',
    'Subscription renewed (' || _decision || ')',
    jsonb_build_object('new_seats', v_seats, 'freed', v_freed, 'invoice_id', v_invoice_id, 'period_end', v_new_period_end));

  RETURN v_decision_id;
END $$;

-- ============================================================
-- 11. initiate_superuser_transfer
-- ============================================================
CREATE OR REPLACE FUNCTION public.initiate_superuser_transfer(
  _account_id UUID,
  _from_seat_id UUID,
  _to_seat_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id UUID;
  v_account_name TEXT;
  v_from_name TEXT;
  v_to_name TEXT;
  v_event_ids UUID[] := ARRAY[]::UUID[];
  v_event_id UUID;
  v_user RECORD;
  v_followup_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT account_name INTO v_account_name FROM public.accounts WHERE id = _account_id;
  SELECT full_name INTO v_from_name FROM public.account_seats WHERE id = _from_seat_id;
  SELECT full_name INTO v_to_name FROM public.account_seats WHERE id = _to_seat_id;

  v_followup_at := date_trunc('day', now() + interval '1 day') + interval '10 hours';

  INSERT INTO public.superuser_transfers (account_id, from_seat_id, to_seat_id, initiated_by, notes)
  VALUES (_account_id, _from_seat_id, _to_seat_id, auth.uid(), _notes)
  RETURNING id INTO v_transfer_id;

  PERFORM public.create_notification(
    'ACCOUNT_STALLED'::public.notification_type,
    'Superuser transfer initiated · ' || COALESCE(v_account_name,'Account'),
    'From ' || COALESCE(v_from_name,'—') || ' → ' || COALESCE(v_to_name,'—'),
    'WARNING'::public.notification_severity,
    NULL,
    'ACCOUNT', _account_id,
    '/accounts/' || _account_id || '?tab=seats',
    'su_transfer_' || v_transfer_id
  );

  FOR v_user IN
    SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
     WHERE ur.role IN ('admin','support_agent')
  LOOP
    INSERT INTO public.calendar_events (
      title, event_type, scheduled_at, duration_min,
      assigned_to, created_by, related_entity_type, related_entity_id, notes
    ) VALUES (
      'Follow up: superuser transfer · ' || COALESCE(v_account_name,'Account'),
      'FOLLOW_UP'::calendar_event_type,
      v_followup_at,
      30,
      v_user.user_id,
      auth.uid(),
      'ACCOUNT',
      _account_id,
      'Auto-created. Verify ' || COALESCE(v_to_name,'new owner') || ' has accepted superuser role transferred from ' || COALESCE(v_from_name,'previous owner') || '.'
    ) RETURNING id INTO v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);
  END LOOP;

  UPDATE public.superuser_transfers
     SET follow_up_event_ids = v_event_ids
   WHERE id = v_transfer_id;

  PERFORM public.log_activity('ACCOUNT', _account_id, 'SEAT_CHANGE',
    'Superuser transfer initiated: ' || COALESCE(v_from_name,'—') || ' → ' || COALESCE(v_to_name,'—'),
    jsonb_build_object('transfer_id', v_transfer_id, 'follow_up_events', array_length(v_event_ids,1)));

  RETURN v_transfer_id;
END $$;

-- ============================================================
-- 12. Cron scan functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.scan_renewals_due()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_count INT := 0; v_days INT;
BEGIN
  FOR r IN
    SELECT bs.account_id, bs.current_period_end, a.account_name
      FROM public.account_billing_settings bs
      JOIN public.accounts a ON a.id = bs.account_id
     WHERE bs.current_period_end IS NOT NULL
       AND bs.status = 'ACTIVE'
       AND bs.current_period_end > now()
       AND bs.current_period_end <= now() + interval '14 days'
  LOOP
    v_days := EXTRACT(DAY FROM (r.current_period_end - now()))::INT;
    IF v_days IN (14, 7, 1) THEN
      PERFORM public.create_notification(
        'ACCOUNT_STALLED'::public.notification_type,
        'Renewal due in ' || v_days || ' day(s): ' || r.account_name,
        'Period ends ' || to_char(r.current_period_end, 'DD Mon YYYY'),
        CASE WHEN v_days = 1 THEN 'CRITICAL' ELSE 'WARNING' END::public.notification_severity,
        NULL, 'ACCOUNT', r.account_id,
        '/accounts/' || r.account_id || '?tab=billing',
        'renewal_' || r.account_id || '_' || v_days
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.scan_crm_sync_stale()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT a.id, a.account_name, s.reported_at
      FROM public.accounts a
      LEFT JOIN public.seat_usage_snapshots s ON s.account_id = a.id
     WHERE a.status = 'LIVE'
       AND (s.reported_at IS NULL OR s.reported_at < now() - interval '24 hours')
  LOOP
    PERFORM public.create_notification(
      'ACCOUNT_STALLED'::public.notification_type,
      'CRM sync stale: ' || r.account_name,
      CASE WHEN r.reported_at IS NULL THEN 'No usage report received'
           ELSE 'Last report ' || to_char(r.reported_at, 'DD Mon HH24:MI') END,
      'WARNING'::public.notification_severity,
      NULL, 'ACCOUNT', r.id,
      '/accounts/' || r.id || '?tab=seats',
      'crm_stale_' || r.id || '_' || to_char(date_trunc('day',now()),'YYYYMMDD')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ============================================================
-- 13. Recreate account_seat_capacity view (drop first to allow column changes)
-- ============================================================
DROP VIEW IF EXISTS public.account_seat_capacity CASCADE;

CREATE VIEW public.account_seat_capacity AS
SELECT
  a.id                                        AS account_id,
  a.account_name,
  bs.plan_name,
  bs.status                                   AS subscription_status,
  COALESCE(bs.seats_purchased, 0)             AS seats_purchased,
  COALESCE(s.consumed,
    (SELECT COUNT(*)::INT FROM public.account_seats x
      WHERE x.account_id = a.id AND x.is_active = true))  AS seats_used,
  COALESCE(s.reserved, 0)                     AS seats_reserved,
  GREATEST(0,
    COALESCE(bs.seats_purchased,0)
    - COALESCE(s.reserved,0)
    - COALESCE(s.consumed,
        (SELECT COUNT(*)::INT FROM public.account_seats x
          WHERE x.account_id = a.id AND x.is_active = true))
  )                                            AS seats_available,
  s.reported_at                                AS last_crm_sync_at
FROM public.accounts a
LEFT JOIN public.account_billing_settings bs ON bs.account_id = a.id
LEFT JOIN public.seat_usage_snapshots      s  ON s.account_id  = a.id;
