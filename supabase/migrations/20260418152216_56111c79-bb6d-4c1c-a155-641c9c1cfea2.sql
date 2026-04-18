UPDATE public.profiles
SET full_name = 'Pranay Lanka', updated_at = now()
WHERE id = 'a5cc7168-dca8-498a-b547-89c8dac76717';

-- Also mirror to auth metadata via a no-op safe update of the corresponding auth user is not possible from SQL,
-- but the admin-update-user function and live-profile subscription will keep it in sync from the UI going forward.