// CRM → Console: upsert seat usage snapshot for the calling account.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-account-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const isInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

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

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const allocated = Number(body.allocated);
  const consumed = Number(body.consumed);
  const reserved = Number(body.reserved ?? 0);
  const available = Number(body.available ?? Math.max(0, allocated - consumed - reserved));

  if (![allocated, consumed, reserved, available].every(isInt)) {
    return new Response(JSON.stringify({ error: 'allocated, consumed, reserved, available must be integers >= 0' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const members = Array.isArray(body.members) ? body.members.slice(0, 5000) : [];

  // Upsert one row per account_id
  const { error: upErr } = await supabase
    .from('seat_usage_snapshots')
    .upsert({
      account_id: accountId,
      allocated,
      consumed,
      reserved,
      available,
      members,
      reported_at: new Date().toISOString(),
      source: 'CRM',
    }, { onConflict: 'account_id' });

  if (upErr) {
    return new Response(JSON.stringify({ error: upErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
