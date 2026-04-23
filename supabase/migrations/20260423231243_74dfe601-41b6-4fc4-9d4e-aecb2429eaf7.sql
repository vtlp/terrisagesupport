-- 1. Extend subscription_status enum with TRIAL
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'TRIAL';

-- 2. Add trial + trial-link fields onto account_billing_settings
ALTER TABLE public.account_billing_settings
  ADD COLUMN IF NOT EXISTS trial_starts_at date,
  ADD COLUMN IF NOT EXISTS trial_ends_at date,
  ADD COLUMN IF NOT EXISTS trial_link_id text,
  ADD COLUMN IF NOT EXISTS trial_link_short_url text,
  ADD COLUMN IF NOT EXISTS trial_link_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_link_currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS trial_link_seats integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_link_status text,
  ADD COLUMN IF NOT EXISTS trial_link_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_link_outdated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_payment_reference text,
  ADD COLUMN IF NOT EXISTS trial_email_draft_subject text,
  ADD COLUMN IF NOT EXISTS trial_email_draft_body text,
  ADD COLUMN IF NOT EXISTS trial_email_last_drafted_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_last_sent_at timestamptz;

-- 3. Update conversion RPC: respect TRIAL_FIRST mode
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_account(_enquiry_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enquiry public.enquiries%ROWTYPE;
  v_submission public.onboarding_submissions%ROWTYPE;
  v_account_id UUID;
  v_member JSONB;
  v_project JSONB;
  v_checklist TEXT[];
  v_label TEXT;
  v_idx INT := 0;
  v_payload JSONB;
  v_seats_required INT := 0;
  v_member_count INT := 0;
  v_text TEXT;
  v_proj_name TEXT;
  v_payment JSONB;
  v_breakdown JSONB;
  v_plan_name TEXT;
  v_cycle TEXT;
  v_base_fee NUMERIC;
  v_seat_rate NUMERIC;
  v_gst_pct NUMERIC;
  v_seats_purchased INT;
  v_invoice_seats INT;
  v_subtotal NUMERIC;
  v_gst_amount NUMERIC;
  v_total NUMERIC;
  v_paid_at TIMESTAMPTZ;
  v_short_url TEXT;
  v_next_renewal TIMESTAMPTZ;
  v_mode TEXT;
  v_trial_start DATE;
  v_trial_end DATE;
  v_status public.subscription_status;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO v_enquiry FROM public.enquiries WHERE id = _enquiry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enquiry not found'; END IF;

  SELECT * INTO v_submission FROM public.onboarding_submissions
    WHERE enquiry_id = _enquiry_id AND status = 'APPROVED'
    ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved onboarding submission required'; END IF;

  v_payload := v_submission.payload;

  INSERT INTO public.accounts (
    account_name, city, tenancy_type, status,
    owner_name, owner_phone, owner_email,
    gst_number, pan_number, rera_number, website,
    source_enquiry_id, source_submission_id, payload
  ) VALUES (
    COALESCE(v_payload->>'company_name', v_enquiry.company_name, v_enquiry.full_name),
    COALESCE(v_payload->>'city', v_payload #>> '{company,city}', v_payload #>> '{company,head_office_city}', v_enquiry.city),
    v_submission.tenancy_type,
    'ONBOARDING_IN_PROGRESS',
    COALESCE(v_payload->>'owner_name', v_enquiry.full_name),
    COALESCE(v_payload->>'owner_phone', v_enquiry.phone),
    COALESCE(v_payload->>'owner_email', v_enquiry.email),
    v_payload->>'gst_number',
    v_payload->>'pan_number',
    COALESCE(v_payload->>'rera_number', v_payload #>> '{company,rera_id}'),
    v_payload->>'website',
    v_enquiry.id,
    v_submission.id,
    v_payload
  ) RETURNING id INTO v_account_id;

  IF jsonb_typeof(v_payload->'team_members') = 'array' THEN
    FOR v_member IN SELECT * FROM jsonb_array_elements(v_payload->'team_members')
    LOOP
      INSERT INTO public.account_seats (account_id, full_name, email, phone, role, is_active)
      VALUES (
        v_account_id,
        COALESCE(v_member->>'full_name', v_member->>'name', 'Member'),
        v_member->>'email',
        v_member->>'phone',
        v_member->>'role',
        true
      );
      v_member_count := v_member_count + 1;
    END LOOP;
  END IF;

  v_seats_required := GREATEST(
    COALESCE(NULLIF((v_payload #>> '{team,seats_required}'), '')::INT, 0),
    v_member_count
  );

  v_payment   := COALESCE(v_enquiry.payload->'payment', '{}'::jsonb);
  v_breakdown := COALESCE(v_payment->'breakdown', '{}'::jsonb);
  v_mode      := COALESCE(NULLIF(v_payment->>'mode', ''), 'PAY_BEFORE_ACCOUNT');

  v_plan_name       := COALESCE(NULLIF(v_breakdown->>'plan_name', ''), 'Standard');
  v_cycle           := COALESCE(NULLIF(v_breakdown->>'billing_cycle', ''), 'ANNUAL');
  v_base_fee        := COALESCE(NULLIF(v_breakdown->>'base_fee', '')::NUMERIC, 33000);
  v_seat_rate       := COALESCE(NULLIF(v_breakdown->>'per_seat_rate', '')::NUMERIC, 7000);
  v_gst_pct         := COALESCE(NULLIF(v_breakdown->>'gst_pct', '')::NUMERIC, 18);
  v_invoice_seats   := COALESCE(NULLIF(v_breakdown->>'seats', '')::INT, v_seats_required);
  v_seats_purchased := COALESCE(NULLIF(v_breakdown->>'seats', '')::INT, v_seats_required);

  -- Trial dates (only set when mode = TRIAL_FIRST)
  v_trial_start := NULLIF(v_payment #>> '{trial,start}', '')::DATE;
  v_trial_end   := NULLIF(v_payment #>> '{trial,end}',   '')::DATE;

  -- Status: TRIAL if mode is trial-first, otherwise ACTIVE
  v_status := CASE WHEN v_mode = 'TRIAL_FIRST' THEN 'TRIAL'::public.subscription_status
                   ELSE 'ACTIVE'::public.subscription_status END;

  -- next_renewal: from trial end (trial-first) or from now + cycle (pay-first)
  v_next_renewal := CASE
    WHEN v_mode = 'TRIAL_FIRST' AND v_trial_end IS NOT NULL THEN v_trial_end::timestamptz
    WHEN v_cycle = 'MONTHLY'    THEN now() + interval '1 month'
    WHEN v_cycle = 'QUARTERLY'  THEN now() + interval '3 months'
    ELSE now() + interval '1 year'
  END;

  INSERT INTO public.account_billing_settings (
    account_id, plan_name, billing_cycle, base_fee, seat_rate, gst_pct,
    seats_purchased, status, next_renewal_at,
    trial_starts_at, trial_ends_at
  ) VALUES (
    v_account_id, v_plan_name, v_cycle::billing_cycle, v_base_fee, v_seat_rate, v_gst_pct,
    v_seats_purchased, v_status, v_next_renewal,
    v_trial_start, v_trial_end
  )
  ON CONFLICT (account_id) DO UPDATE
    SET plan_name = EXCLUDED.plan_name,
        billing_cycle = EXCLUDED.billing_cycle,
        base_fee = EXCLUDED.base_fee,
        seat_rate = EXCLUDED.seat_rate,
        gst_pct = EXCLUDED.gst_pct,
        seats_purchased = EXCLUDED.seats_purchased,
        status = EXCLUDED.status,
        trial_starts_at = EXCLUDED.trial_starts_at,
        trial_ends_at = EXCLUDED.trial_ends_at,
        next_renewal_at = COALESCE(public.account_billing_settings.next_renewal_at, EXCLUDED.next_renewal_at),
        updated_at = now();

  -- PAID invoice mirror only for pay-first flow
  IF v_mode <> 'TRIAL_FIRST' AND (v_payment->>'status') = 'PAID' THEN
    v_subtotal   := COALESCE(NULLIF(v_breakdown->>'subtotal', '')::NUMERIC,    v_base_fee + v_seat_rate * GREATEST(v_invoice_seats - 3, 0));
    v_gst_amount := COALESCE(NULLIF(v_breakdown->>'gst_amount', '')::NUMERIC,  v_subtotal * v_gst_pct / 100);
    v_total      := COALESCE(NULLIF(v_breakdown->>'total', '')::NUMERIC,       v_subtotal + v_gst_amount);
    v_paid_at    := COALESCE(NULLIF(v_payment->>'paid_at', '')::TIMESTAMPTZ,   now());
    v_short_url  := v_payment->>'short_url';

    INSERT INTO public.account_invoices (
      account_id, plan_name, seat_count, seat_rate, base_fee,
      subtotal, gst_pct, gst_amount, total, status,
      issued_at, paid_at, notes, created_by
    ) VALUES (
      v_account_id, v_plan_name, v_invoice_seats, v_seat_rate, v_base_fee,
      v_subtotal, v_gst_pct, v_gst_amount, v_total, 'PAID',
      COALESCE(NULLIF(v_payment->>'created_at', '')::TIMESTAMPTZ, v_paid_at), v_paid_at,
      'Razorpay payment link · ' || COALESCE(v_short_url, v_payment->>'link_id', '—'),
      auth.uid()
    );
  END IF;

  -- Seed checklist (with extra trial item when applicable)
  v_checklist := ARRAY[
    'Welcome call completed',
    'Branding assets uploaded',
    'Team seats activated',
    'Portal integrations configured',
    'First listing imported',
    'Go-live confirmed'
  ];
  IF v_mode = 'TRIAL_FIRST' THEN
    v_checklist := ARRAY['Collect trial conversion payment'] || v_checklist;
  END IF;
  FOREACH v_label IN ARRAY v_checklist LOOP
    INSERT INTO public.account_checklist_items (account_id, label, sort_order)
    VALUES (v_account_id, v_label, v_idx);
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.enquiries
    SET stage = 'ACCOUNT_CREATED',
        converted_account_id = v_account_id,
        updated_at = now()
    WHERE id = _enquiry_id;

  INSERT INTO public.enquiry_notes (enquiry_id, author_id, note_text)
    VALUES (_enquiry_id, auth.uid(),
      CASE WHEN v_mode = 'TRIAL_FIRST'
           THEN 'Converted to account on trial.'
           ELSE 'Converted to account.' END);
  INSERT INTO public.account_notes (account_id, author_id, note_text)
    VALUES (v_account_id, auth.uid(),
      CASE WHEN v_mode = 'TRIAL_FIRST'
           THEN '[System] Account created on trial from approved onboarding submission.'
           ELSE '[System] Account created from approved onboarding submission.' END);

  v_text := NULLIF(TRIM(COALESCE(v_payload->>'notes', '')), '');
  IF v_text IS NOT NULL THEN
    INSERT INTO public.account_notes (account_id, author_id, note_text)
      VALUES (v_account_id, auth.uid(), '[Onboarding] ' || v_text);
  END IF;

  v_text := NULLIF(TRIM(COALESCE(v_payload #>> '{lead_import,notes}', '')), '');
  IF v_text IS NOT NULL THEN
    INSERT INTO public.account_notes (account_id, author_id, note_text)
      VALUES (v_account_id, auth.uid(), '[Lead import] ' || v_text);
  END IF;

  v_text := NULLIF(TRIM(COALESCE(v_payload #>> '{property_import,notes}', '')), '');
  IF v_text IS NOT NULL THEN
    INSERT INTO public.account_notes (account_id, author_id, note_text)
      VALUES (v_account_id, auth.uid(), '[Property import] ' || v_text);
  END IF;

  IF jsonb_typeof(v_payload->'projects') = 'array' THEN
    FOR v_project IN SELECT * FROM jsonb_array_elements(v_payload->'projects')
    LOOP
      v_text := NULLIF(TRIM(COALESCE(v_project->>'additionalNotes', '')), '');
      IF v_text IS NOT NULL THEN
        v_proj_name := COALESCE(NULLIF(TRIM(v_project->>'projectName'), ''), 'Project');
        INSERT INTO public.account_notes (account_id, author_id, note_text)
          VALUES (v_account_id, auth.uid(), '[Project: ' || v_proj_name || '] ' || v_text);
      END IF;
    END LOOP;
  END IF;

  RETURN v_account_id;
END;
$function$;