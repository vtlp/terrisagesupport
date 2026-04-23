// Console → CRM: subscription/profile metadata for the calling account.
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

  const { data: acct } = await supabase
    .from('accounts')
    .select('account_name, account_code, owner_name, owner_email, owner_phone, status, tenancy_type, city')
    .eq('id', accountId)
    .maybeSingle();

  const { data: bs } = await supabase
    .from('account_billing_settings')
    .select('plan_name, billing_cycle, base_fee, seat_rate, gst_pct, country, status, auto_renew, subscription_started_at, current_period_start, current_period_end, next_renewal_at, seats_purchased, cancellation_requested_at, cancellation_effective_at')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!acct) {
    return new Response(JSON.stringify({ error: 'Account not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    account_id: accountId,
    account: acct,
    subscription: bs ?? null,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
