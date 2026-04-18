// Google Calendar one-way sync (CRM -> Google Calendar)
// Pushes a calendar_event to the connected Google account's primary calendar
// using the Lovable connector gateway.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_calendar';

interface SyncRequest {
  event_id: string;
  calendar_id?: string; // defaults to 'primary'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!GOOGLE_CALENDAR_API_KEY) {
      // Optional integration — silently skip if not connected
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Google Calendar not connected',
        code: 'NOT_CONNECTED',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
    const calendarId = body.calendar_id ?? 'primary';

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

    const gcalEvent = {
      summary: event.title,
      description: event.notes ?? '',
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    };

    const isUpdate = !!existing?.google_event_id;
    const url = isUpdate
      ? `${GATEWAY_URL}/calendars/${encodeURIComponent(calendarId)}/events/${existing!.google_event_id}`
      : `${GATEWAY_URL}/calendars/${encodeURIComponent(calendarId)}/events`;

    const gResp = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gcalEvent),
    });

    const gData = await gResp.json();

    if (!gResp.ok) {
      await supabase.from('calendar_event_sync').upsert({
        calendar_event_id: body.event_id,
        google_calendar_id: calendarId,
        sync_status: 'FAILED',
        sync_error: `Google API ${gResp.status}: ${JSON.stringify(gData)}`,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'calendar_event_id' });

      return new Response(JSON.stringify({
        error: `Google Calendar sync failed [${gResp.status}]`,
        details: gData,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('calendar_event_sync').upsert({
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('sync-calendar-event error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
