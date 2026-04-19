-- Rename ticket code prefix from TKT- to ST- (Support Ticket)
CREATE OR REPLACE FUNCTION public.tickets_set_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ticket_code IS NULL THEN
    NEW.ticket_code := 'ST-' || LPAD(nextval('public.ticket_code_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END $$;

-- Backfill: rewrite existing TKT- prefixes to ST- (preserves number)
UPDATE public.tickets
   SET ticket_code = 'ST-' || SUBSTRING(ticket_code FROM 5)
 WHERE ticket_code LIKE 'TKT-%';