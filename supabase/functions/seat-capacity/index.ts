import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-account-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = req.headers.get('x-account-api-key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing x-account-api-key header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const keyHash = await sha256Hex(apiKey);
  const { data: accountId, error: keyErr } = await supabase.rpc('validate_account_api_key', { _key_hash: keyHash });
  if (keyErr || !accountId) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const [capRes, bsRes, acctRes, snapRes, reqRes] = await Promise.all([
    supabase.from('account_seat_capacity').select('*').eq('account_id', accountId).maybeSingle(),
    supabase.from('account_billing_settings').select('*').eq('account_id', accountId).maybeSingle(),
    supabase.from('accounts').select('account_name, owner_name, city').eq('id', accountId).maybeSingle(),
    supabase.from('seat_usage_snapshots').select('reserved, consumed, reported_at').eq('account_id', accountId).maybeSingle(),
    supabase.from('seat_requests').select('requested_seats').eq('account_id', accountId).in('status', ['PENDING', 'APPROVED']),
  ]);

  if (!capRes.data) {
    return new Response(JSON.stringify({ error: 'Account not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const requested = (reqRes.data ?? []).reduce((s, r: { requested_seats: number }) => s + (r.requested_seats || 0), 0);

  return new Response(JSON.stringify({
    account_id: accountId,
    account_name: capRes.data.account_name,
    owner_name: acctRes.data?.owner_name ?? null,
    country: bsRes.data?.country ?? 'IN',
    plan: capRes.data.plan_name,
    status: capRes.data.subscription_status,
    cycle: bsRes.data?.billing_cycle ?? null,
    auto_renew: bsRes.data?.auto_renew ?? true,
    current_period_start: bsRes.data?.current_period_start ?? null,
    current_period_end: bsRes.data?.current_period_end ?? null,
    allocated: capRes.data.seats_purchased ?? 0,
    reserved: snapRes.data?.reserved ?? 0,
    consumed: snapRes.data?.consumed ?? capRes.data.seats_used ?? 0,
    available: capRes.data.seats_available ?? 0,
    requested,
    last_crm_sync_at: snapRes.data?.reported_at ?? null,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
