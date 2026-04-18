UPDATE public.enquiries
SET onboarding_form_link = regexp_replace(
      onboarding_form_link,
      '^https?://[^/]+(/onboarding/.*)$',
      'https://terrisagesupport.lovable.app\1'
    ),
    updated_at = now()
WHERE onboarding_form_link ~ '(lovableproject\.com|id-preview--.*lovable\.app|localhost|127\.0\.0\.1)';