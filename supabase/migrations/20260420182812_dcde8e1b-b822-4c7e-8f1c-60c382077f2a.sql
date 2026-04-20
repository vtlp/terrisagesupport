-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedules with the same names (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('scan-upcoming-events');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('scan-overdue-events');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('scan-demo-not-completed');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('mark-stalled-accounts');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Schedule all four scanners every 15 minutes
SELECT cron.schedule('scan-upcoming-events',    '*/15 * * * *', $$SELECT public.scan_upcoming_events();$$);
SELECT cron.schedule('scan-overdue-events',     '*/15 * * * *', $$SELECT public.scan_overdue_events();$$);
SELECT cron.schedule('scan-demo-not-completed', '*/15 * * * *', $$SELECT public.scan_demo_not_completed();$$);
SELECT cron.schedule('mark-stalled-accounts',   '*/15 * * * *', $$SELECT public.mark_stalled_accounts();$$);