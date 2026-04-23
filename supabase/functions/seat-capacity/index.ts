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

  const { data, error } = await supabase
    .from('account_seat_capacity')
    .select('seats_purchased, seats_used, seats_available, plan_name, subscription_status, account_name')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Account not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    account_id: accountId,
    account_name: data.account_name,
    purchased: data.seats_purchased,
    used: data.seats_used,
    available: data.seats_available,
    plan: data.plan_name,
    status: data.subscription_status,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
