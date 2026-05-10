
ALTER TABLE public.project_requests
  ADD COLUMN IF NOT EXISTS requested_by_tenant_id text,
  ADD COLUMN IF NOT EXISTS requested_by_agent_id text,
  ADD COLUMN IF NOT EXISTS requested_by_agent_name text,
  ADD COLUMN IF NOT EXISTS requested_by_agent_phone text,
  ADD COLUMN IF NOT EXISTS requested_by_agent_email text,
  ADD COLUMN IF NOT EXISTS approved_by_agent_id text,
  ADD COLUMN IF NOT EXISTS approved_by_agent_name text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS terrisage_status text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
