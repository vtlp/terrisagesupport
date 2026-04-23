// Console → CRM read: subscription metadata for the CRM admin screen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-account-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = req.headers.get('x-account-api-key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing x-account-api-key' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const keyHash = await sha256Hex(apiKey);
  const { data: accountId, error: vErr } = await supabase.rpc('validate_account_api_key', { _key_hash: keyHash });
  if (vErr || !accountId) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: acct } = await supabase
    .from('accounts')
    .select('id, account_code, account_name, owner_name, owner_email, owner_phone, city, status, tenancy_type, created_at')
    .eq('id', accountId).maybeSingle();

  const { data: bs } = await supabase
    .from('account_billing_settings')
    .select('plan_name, billing_cycle, gst_pct, country, status, subscription_started_at, current_period_start, current_period_end, next_renewal_at, auto_renew, cancellation_requested_at, cancellation_effective_at')
    .eq('account_id', accountId).maybeSingle();

  return new Response(JSON.stringify({ account: acct, subscription: bs }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
