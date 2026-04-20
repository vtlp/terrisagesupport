// Exchanges a Google OAuth authorization code for a refresh token
// and stores it in integration_settings.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

interface ExchangeRequest {
  code: string;
  redirect_uri: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin
    const { data: roles } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ExchangeRequest;
    if (!body.code || !body.redirect_uri) {
      return new Response(JSON.stringify({ error: 'code and redirect_uri are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to read secret credentials
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings, error: sErr } = await admin
      .from('integration_settings')
      .select('*')
      .eq('provider', 'google_calendar')
      .maybeSingle();

    if (sErr || !settings?.google_client_id || !settings?.google_client_secret) {
      return new Response(JSON.stringify({ error: 'Google Client ID/Secret not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange code -> tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: body.code,
        client_id: settings.google_client_id,
        client_secret: settings.google_client_secret,
        redirect_uri: body.redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.refresh_token) {
      console.error('Token exchange failed', tokenData);
      return new Response(JSON.stringify({
        error: 'Token exchange failed. Make sure prompt=consent and access_type=offline were used.',
        details: tokenData,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get user info to capture the connected email
    let connectedEmail: string | null = null;
    try {
      const uiResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const uiData = await uiResp.json();
      connectedEmail = uiData.email ?? null;
    } catch (_e) { /* ignore */ }

    await admin.from('integration_settings').update({
      google_refresh_token: tokenData.refresh_token,
      google_account_email: connectedEmail,
      connected_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq('provider', 'google_calendar');

    return new Response(JSON.stringify({ success: true, email: connectedEmail }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('google-oauth-callback error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
