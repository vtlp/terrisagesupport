// Google Calendar one-way sync (CRM -> Google Calendar)
// Uses OAuth credentials configured in Admin → Integrations.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

interface SyncRequest {
  event_id: string;
  calendar_id?: string;
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`Failed to refresh access token: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
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

    const body = (await req.json()) as SyncRequest;
    if (!body.event_id) {
      return new Response(JSON.stringify({ error: 'event_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read settings via service role
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: settings } = await admin
      .from('integration_settings')
      .select('*')
      .eq('provider', 'google_calendar')
      .maybeSingle();

    if (!settings?.google_client_id || !settings?.google_client_secret || !settings?.google_refresh_token) {
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Google Calendar not connected',
        code: 'NOT_CONNECTED',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const calendarId = body.calendar_id ?? settings.google_calendar_id ?? 'primary';

    const { data: event, error: evErr } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', body.event_id)
      .maybeSingle();

    if (evErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabase
      .from('calendar_event_sync')
      .select('*')
      .eq('calendar_event_id', body.event_id)
      .maybeSingle();

    const startTime = new Date(event.scheduled_at);
    const endTime = new Date(startTime.getTime() + (event.duration_min ?? 30) * 60 * 1000);

    // Look up assigned agent name (best-effort) for filterable titles
    let agentName: string | null = null;
    if (event.assigned_to) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', event.assigned_to)
        .maybeSingle();
      agentName = profile?.full_name?.trim() || profile?.email?.split('@')[0] || null;
    }

    // Build filter-friendly title: [TYPE] Original title · Agent
    const typePrefix = event.event_type ? `[${event.event_type}] ` : '';
    const agentSuffix = agentName ? ` · ${agentName}` : '';
    const summary = `${typePrefix}${event.title}${agentSuffix}`;

    // Enrich description with structured metadata for in-Google searches
    const descriptionLines = [
      event.notes ?? '',
      '',
      '— Terrisage CRM —',
      `Type: ${event.event_type ?? 'OTHER'}`,
      agentName ? `Assigned: ${agentName}` : null,
      event.related_entity_type && event.related_entity_id
        ? `Linked: ${event.related_entity_type} ${event.related_entity_id}`
        : null,
    ].filter(Boolean).join('\n');

    const gcalEvent = {
      summary,
      description: descriptionLines,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    };

    const accessToken = await getAccessToken(
      settings.google_client_id,
      settings.google_client_secret,
      settings.google_refresh_token,
    );

    const isUpdate = !!existing?.google_event_id;
    const url = isUpdate
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existing!.google_event_id}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const gResp = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gcalEvent),
    });

    const gData = await gResp.json();

    if (!gResp.ok) {
      await admin.from('calendar_event_sync').upsert({
        calendar_event_id: body.event_id,
        google_calendar_id: calendarId,
        sync_status: 'FAILED',
        sync_error: `Google API ${gResp.status}: ${JSON.stringify(gData)}`,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'calendar_event_id' });
      console.error('Google Calendar sync failed', { status: gResp.status, body: gData });
      return new Response(JSON.stringify({ error: 'Google Calendar sync failed' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('calendar_event_sync').upsert({
      calendar_event_id: body.event_id,
      google_event_id: gData.id,
      google_calendar_id: calendarId,
      sync_status: 'SYNCED',
      sync_error: null,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'calendar_event_id' });

    return new Response(JSON.stringify({
      success: true,
      google_event_id: gData.id,
      html_link: gData.htmlLink,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('sync-calendar-event error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
