
CREATE OR REPLACE FUNCTION public.trg_account_notes_revive_stalled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.accounts
     SET status = CASE WHEN status = 'STALLED_ONBOARDING'
                       THEN 'ONBOARDING_IN_PROGRESS'::account_status
                       ELSE status END,
         updated_at = now()
   WHERE id = NEW.account_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS account_notes_revive_stalled ON public.account_notes;
CREATE TRIGGER account_notes_revive_stalled
AFTER INSERT ON public.account_notes
FOR EACH ROW EXECUTE FUNCTION public.trg_account_notes_revive_stalled();

-- Also revive on seat changes, checklist updates, verifications
CREATE OR REPLACE FUNCTION public.trg_account_revive_stalled_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_account_id UUID;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);
  IF v_account_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.accounts
     SET status = CASE WHEN status = 'STALLED_ONBOARDING'
                       THEN 'ONBOARDING_IN_PROGRESS'::account_status
                       ELSE status END,
         updated_at = now()
   WHERE id = v_account_id;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS account_seats_revive_stalled ON public.account_seats;
CREATE TRIGGER account_seats_revive_stalled
AFTER INSERT OR UPDATE ON public.account_seats
FOR EACH ROW EXECUTE FUNCTION public.trg_account_revive_stalled_generic();

DROP TRIGGER IF EXISTS account_checklist_revive_stalled ON public.account_checklist_items;
CREATE TRIGGER account_checklist_revive_stalled
AFTER UPDATE ON public.account_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.trg_account_revive_stalled_generic();
