-- Update convert_enquiry_to_account to also copy categorized notes from onboarding form
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

  INSERT INTO public.account_billing_settings (account_id, seats_purchased)
  VALUES (v_account_id, v_seats_required)
  ON CONFLICT (account_id) DO UPDATE
    SET seats_purchased = EXCLUDED.seats_purchased,
        updated_at = now();

  v_checklist := ARRAY[
    'Welcome call completed',
    'Branding assets uploaded',
    'Team seats activated',
    'Portal integrations configured',
    'First listing imported',
    'Go-live confirmed'
  ];
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
    VALUES (_enquiry_id, auth.uid(), 'Converted to account.');
  INSERT INTO public.account_notes (account_id, author_id, note_text)
    VALUES (v_account_id, auth.uid(), '[System] Account created from approved onboarding submission.');

  -- Categorized notes from onboarding form (prefix [Category] used by UI for badge grouping)
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