-- 1. New scanner: renewals due within 14 days
CREATE OR REPLACE FUNCTION public.scan_renewals_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT a.id, a.account_name, bs.next_renewal_at, bs.seats_purchased
      FROM public.account_billing_settings bs
      JOIN public.accounts a ON a.id = bs.account_id
     WHERE bs.status = 'ACTIVE'
       AND bs.auto_renew = true
       AND bs.next_renewal_at IS NOT NULL
       AND bs.next_renewal_at > now()
       AND bs.next_renewal_at <= now() + interval '14 days'
  LOOP
    PERFORM public.create_notification(
      'ACCOUNT_STALLED'::public.notification_type,
      'Renewal due: ' || r.account_name,
      'Renews ' || to_char(r.next_renewal_at, 'DD Mon') || ' · ' || r.seats_purchased || ' seats',
      'WARNING'::public.notification_severity,
      NULL, 'ACCOUNT', r.id,
      '/accounts/' || r.id || '?tab=billing',
      'renewal_due_' || r.id || '_' || to_char(date_trunc('day', now()),'YYYYMMDD')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- 2. Allow cron (no auth.uid()) to invoke staleness scanner
CREATE OR REPLACE FUNCTION public.scan_crm_sync_stale()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      'crm_stale_' || r.id || '_' || to_char(date_trunc('day', now()),'YYYYMMDD')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- 3. Wrapper that runs all scanners and is safe for cron (bypasses is_staff check)
CREATE OR REPLACE FUNCTION public.cron_run_scanners()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_upcoming INT;
  v_overdue INT;
  v_demo INT;
  v_stale INT;
  v_stalled INT;
BEGIN
  v_upcoming := public.scan_upcoming_events();
  v_overdue  := public.scan_overdue_events();
  v_demo     := public.scan_demo_not_completed();
  v_stale    := public.scan_crm_sync_stale();
  -- Mark stalled accounts (>7 days in onboarding) — bypass is_staff for cron
  UPDATE public.accounts
     SET status = 'STALLED_ONBOARDING', updated_at = now()
   WHERE status = 'ONBOARDING_IN_PROGRESS'
     AND created_at < (now() - interval '7 days');
  GET DIAGNOSTICS v_stalled = ROW_COUNT;
  RETURN jsonb_build_object(
    'upcoming', v_upcoming,
    'overdue', v_overdue,
    'demo_not_completed', v_demo,
    'crm_stale', v_stale,
    'newly_stalled', v_stalled,
    'ran_at', now()
  );
END $$;

CREATE OR REPLACE FUNCTION public.cron_scan_renewals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.scan_renewals_due();
END $$;

-- 4. Schedule via pg_cron (idempotent: unschedule first if exists)
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Remove old jobs with these names if present
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname IN ('scanners-15min', 'renewals-hourly')
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'scanners-15min',
    '*/15 * * * *',
    $cmd$ SELECT public.cron_run_scanners(); $cmd$
  );

  PERFORM cron.schedule(
    'renewals-hourly',
    '0 * * * *',
    $cmd$ SELECT public.cron_scan_renewals(); $cmd$
  );
END $$;