// Console → CRM: recent seat change events so CRM can react to admin adjustments.
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

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? '100')));

  let query = supabase
    .from('seat_change_events')
    .select('id, delta, new_total, reason, prorated_amount, effective_at, created_at, notes')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sinceParam) {
    const sinceDate = new Date(sinceParam);
    if (!isNaN(sinceDate.getTime())) query = query.gt('created_at', sinceDate.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    account_id: accountId,
    events: data ?? [],
    server_time: new Date().toISOString(),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
