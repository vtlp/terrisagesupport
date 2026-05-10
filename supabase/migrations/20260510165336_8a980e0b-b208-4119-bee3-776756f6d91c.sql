
-- Drop narrow triggers from previous migration; replace with one universal trigger on activity_log
DROP TRIGGER IF EXISTS account_notes_revive_stalled ON public.account_notes;
DROP TRIGGER IF EXISTS account_seats_revive_stalled ON public.account_seats;
DROP TRIGGER IF EXISTS account_checklist_revive_stalled ON public.account_checklist_items;
DROP FUNCTION IF EXISTS public.trg_account_notes_revive_stalled();
DROP FUNCTION IF EXISTS public.trg_account_revive_stalled_generic();

CREATE OR REPLACE FUNCTION public.trg_activity_revive_stalled_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.entity_type = 'ACCOUNT' AND NEW.entity_id IS NOT NULL THEN
    UPDATE public.accounts
       SET status = CASE WHEN status = 'STALLED_ONBOARDING'
                         THEN 'ONBOARDING_IN_PROGRESS'::account_status
                         ELSE status END,
           updated_at = now()
     WHERE id = NEW.entity_id
       AND status IN ('STALLED_ONBOARDING','ONBOARDING_IN_PROGRESS');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS activity_revive_stalled_account ON public.activity_log;
CREATE TRIGGER activity_revive_stalled_account
AFTER INSERT ON public.activity_log
FOR EACH ROW EXECUTE FUNCTION public.trg_activity_revive_stalled_account();
