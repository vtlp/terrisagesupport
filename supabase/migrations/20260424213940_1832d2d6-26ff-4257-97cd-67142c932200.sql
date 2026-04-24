ALTER TABLE public.account_usage_snapshots
ADD COLUMN IF NOT EXISTS feature_usage jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.account_usage_snapshots.feature_usage IS
'Per-feature adoption percentages from Terrisage. Keys: enquiry_capture, convert_to_lead, manual_leads, creating_tasks, task_types, channel_partner. Values: 0-100 integers representing % of active users in that account who used the feature in the snapshot window.';