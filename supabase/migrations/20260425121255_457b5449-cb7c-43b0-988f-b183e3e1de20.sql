CREATE OR REPLACE VIEW public.account_seat_capacity
WITH (security_invoker=true) AS
SELECT
  a.id AS account_id,
  a.account_name,
  bs.plan_name,
  bs.status AS subscription_status,
  COALESCE(s.allocated, bs.seats_purchased, 0) AS seats_purchased,
  COALESCE(s.consumed, (
    SELECT count(*)::integer
    FROM account_seats x
    WHERE x.account_id = a.id AND x.is_active = true
  )) AS seats_used,
  COALESCE(s.reserved, 0) AS seats_reserved,
  GREATEST(
    0,
    COALESCE(s.allocated, bs.seats_purchased, 0)
      - COALESCE(s.reserved, 0)
      - COALESCE(s.consumed, (
          SELECT count(*)::integer
          FROM account_seats x
          WHERE x.account_id = a.id AND x.is_active = true
        ))
  ) AS seats_available,
  s.reported_at AS last_crm_sync_at
FROM accounts a
LEFT JOIN account_billing_settings bs ON bs.account_id = a.id
LEFT JOIN seat_usage_snapshots s ON s.account_id = a.id;