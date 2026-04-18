-- Remove sensitive tables from realtime publication to prevent broadcasting
-- profile (emails, names) and role data to all authenticated subscribers.
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;