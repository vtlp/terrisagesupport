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

interface MemberPayload {
  external_id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  permissions?: string[];
  state: 'INVITED' | 'ACTIVE' | 'TEMP_DEACTIVATED' | 'DELETION_REQUESTED' | 'DELETED';
  invited_at?: string | null;
  invitation_expires_at?: string | null;
  activated_at?: string | null;
  last_active_at?: string | null;
  is_superuser?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }),
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

  let body: { as_of?: string; members?: MemberPayload[] };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const members = Array.isArray(body.members) ? body.members : [];
  const now = new Date();

  // Compute aggregates
  const reserved = members.filter(m =>
    m.state === 'INVITED' &&
    (!m.invitation_expires_at || new Date(m.invitation_expires_at) > now)
  ).length;
  const consumed = members.filter(m =>
    ['ACTIVE', 'TEMP_DEACTIVATED', 'DELETION_REQUESTED', 'DELETED'].includes(m.state)
  ).length;

  // Read allocation from billing settings
  const { data: bs } = await supabase.from('account_billing_settings')
    .select('seats_purchased').eq('account_id', accountId).maybeSingle();
  const allocated = bs?.seats_purchased ?? 0;
  const available = Math.max(0, allocated - reserved - consumed);

  // Upsert snapshot
  const reportedAt = body.as_of ?? now.toISOString();
  await supabase.from('seat_usage_snapshots').upsert({
    account_id: accountId,
    allocated,
    reserved,
    consumed,
    available,
    members: members,
    reported_at: reportedAt,
    source: 'CRM',
  }, { onConflict: 'account_id' });

  // Mirror member roster into account_seats (best-effort by external_id or email)
  for (const m of members) {
    const matchKey = m.external_id ? { external_id: m.external_id } : (m.email ? { email: m.email } : null);
    if (!matchKey) continue;

    const { data: existing } = await supabase.from('account_seats')
      .select('id')
      .eq('account_id', accountId)
      .match(matchKey)
      .maybeSingle();

    const row = {
      account_id: accountId,
      external_id: m.external_id ?? null,
      full_name: m.full_name,
      email: m.email ?? null,
      phone: m.phone ?? null,
      role: m.role ?? null,
      permissions: m.permissions ?? [],
      crm_state: m.state,
      invitation_expires_at: m.invitation_expires_at ?? null,
      last_active_at: m.last_active_at ?? null,
      is_superuser: !!m.is_superuser,
      is_active: m.state === 'ACTIVE' || m.state === 'TEMP_DEACTIVATED',
      deleted_in_cycle: m.state === 'DELETED',
    };

    if (existing) {
      await supabase.from('account_seats').update(row).eq('id', existing.id);
    } else {
      await supabase.from('account_seats').insert(row);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    account_id: accountId,
    allocated, reserved, consumed, available,
    over_capacity: consumed > allocated,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
