ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS tenant_id text;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_tenant_id_unique
ON public.accounts (tenant_id)
WHERE tenant_id IS NOT NULL;