// Pulls "show interest" leads from Terrisage and inserts them as enquiries.
// Uses the shared SEAT_SUPPORT_INTEGRATION_API_KEY. Paginates via cursor.
// Dedupes by payload.terrisage_show_interest_id so re-runs are idempotent.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { requireStaffOrService } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const normalisePhone = (s: string) => (s ?? '').replace(/\D/g, '');

interface ShowInterestItem {
  id: string;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  companyName?: string | null;
  message?: string | null;
  source?: string | null;
  createdAt?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const baseUrl = Deno.env.get('TERRISAGE_BASE_URL');
  const apiKey = Deno.env.get('SEAT_SUPPORT_INTEGRATION_API_KEY');
  if (!baseUrl || !apiKey) return json({ ok: false, error: 'INTEGRATION_NOT_CONFIGURED' }, 500);

  // Optional body: { source?: "WEBSITE"|"MOBILE", maxPages?: number }
  let filterSource: string | null = null;
  let maxPages = 20;
  if (req.method === 'POST') {
    try {
      const body = await req.json() as { source?: string; maxPages?: number };
      if (body?.source === 'WEBSITE' || body?.source === 'MOBILE') filterSource = body.source;
      if (typeof body?.maxPages === 'number' && body.maxPages > 0) maxPages = Math.min(body.maxPages, 50);
    } catch { /* ignore */ }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let fetched = 0, inserted = 0, duplicates = 0, skipped = 0, errors = 0;
  let cursor: string | null = null;
  const base = baseUrl.replace(/\/$/, '');

  try {
    for (let page = 0; page < maxPages; page++) {
      const url = new URL(`${base}/api/integrations/show-interests`);
      url.searchParams.set('limit', '100');
      if (filterSource) url.searchParams.set('source', filterSource);
      if (cursor) url.searchParams.set('cursor', cursor);

      const r = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      });
      if (!r.ok) {
        const body = await r.text();
        return json({ ok: false, error: `UPSTREAM_${r.status}`, detail: body.slice(0, 500) }, 502);
      }
      const payload = await r.json() as { ok?: boolean; items?: ShowInterestItem[]; nextCursor?: string | null; hasMore?: boolean };
      const items = Array.isArray(payload.items) ? payload.items : [];
      fetched += items.length;

      for (const item of items) {
        try {
          const externalId = (item.id ?? '').trim();
          if (!externalId) { skipped++; continue; }

          // Dedupe by external id stored in payload.
          const { data: existing } = await supabase
            .from('enquiries')
            .select('id')
            .contains('payload', { terrisage_show_interest_id: externalId } as never)
            .limit(1)
            .maybeSingle();
          if (existing) { duplicates++; continue; }

          const fullName = (item.name ?? '').trim();
          const phone = (item.phoneNumber ?? '').trim();
          const email = item.email ? String(item.email).trim() : null;
          const company = item.companyName ? String(item.companyName).trim() : null;
          const message = item.message ? String(item.message).trim() : '';
          const upstreamSource = item.source === 'MOBILE' ? 'Terrisage Mobile' : 'Landing Page';

          if (!fullName || normalisePhone(phone).length < 6) { skipped++; continue; }

          // Soft duplicate flag against existing phone in last 365 days.
          const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
          const digits = normalisePhone(phone);
          const { data: recent } = await supabase
            .from('enquiries')
            .select('id, phone, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(500);
          const duplicateOf = (recent ?? []).find(r => normalisePhone(r.phone) === digits)?.id ?? null;

          const { data: created, error: iErr } = await supabase.from('enquiries').insert({
            full_name: fullName,
            company_name: company,
            phone,
            email,
            source: upstreamSource,
            stage: 'NEW_ENQUIRY',
            is_duplicate_of: duplicateOf,
            created_at: item.createdAt ?? new Date().toISOString(),
            payload: {
              terrisage_show_interest_id: externalId,
              terrisage_source: item.source ?? null,
              initial_notes: message || null,
              origin: 'terrisage_show_interest',
              raw: item as unknown as Record<string, unknown>,
            },
          }).select('id').maybeSingle();
          if (iErr || !created) { errors++; continue; }

          if (message) {
            await supabase.from('enquiry_notes').insert({
              enquiry_id: created.id,
              note_text: message,
            } as never);
          }
          await supabase.rpc('log_activity', {
            _entity_type: 'ENQUIRY',
            _entity_id: created.id,
            _event_type: duplicateOf ? 'NOTE' : 'CREATE',
            _summary: duplicateOf
              ? `Terrisage ${item.source ?? 'show-interest'} (duplicate phone)`
              : `Enquiry imported from Terrisage ${item.source ?? 'show-interest'}`,
            _details: { external_id: externalId, source: item.source ?? null, duplicate_of: duplicateOf } as never,
          } as never).catch(() => {});

          inserted++;
        } catch (_e) {
          errors++;
        }
      }

      if (!payload.hasMore || !payload.nextCursor) break;
      cursor = payload.nextCursor;
    }
  } catch (e) {
    return json({ ok: false, error: 'FETCH_FAILED', detail: (e as Error).message }, 502);
  }

  try {
    await supabase.from('activity_log').insert({
      entity_type: 'system',
      entity_id: '00000000-0000-0000-0000-000000000000',
      event_type: 'IMPORT',
      summary: `Terrisage show-interests pull: fetched ${fetched}, inserted ${inserted}, duplicates ${duplicates}, skipped ${skipped}, errors ${errors}`,
      details: { kind: 'SHOW_INTERESTS_PULL', fetched, inserted, duplicates, skipped, errors, source: filterSource } as never,
    });
  } catch (_) { /* ignore */ }

  return json({ ok: true, fetched, inserted, duplicates, skipped, errors });
});
