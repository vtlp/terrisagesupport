// Public webhook to ingest enquiries submitted on the Terrisage landing page.
//
// Auth: shared secret via header `X-Webhook-Secret` matching LANDING_ENQUIRY_WEBHOOK_SECRET.
//
// Body (JSON):
// {
//   full_name: string,           // required
//   phone: string,               // required (with country code, e.g. "+919812345678")
//   company_name?: string,
//   email?: string,
//   city?: string,
//   tenancy_type?: "AGENCY_BROKERAGE_CONSULTANCY" | "BUILDER_DEVELOPER",
//   source?: string,             // default "Landing page"
//   whatsapp_enabled?: boolean,
//   notes?: string,              // initial notes
//   payload?: Record<string, unknown>
// }
//
// Behaviour: always inserts a new enquiry. If a recent (<= 365 days) enquiry exists
// with the same phone digits, flags the new row via is_duplicate_of and logs activity.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const TENANCIES = new Set(['AGENCY_BROKERAGE_CONSULTANCY', 'BUILDER_DEVELOPER']);
const normalisePhone = (s: string) => (s ?? '').replace(/\D/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const expectedSecret = Deno.env.get('LANDING_ENQUIRY_WEBHOOK_SECRET');
  if (!expectedSecret) return json({ ok: false, error: 'CONFIGURATION_ERROR' }, 500);
  const provided = req.headers.get('x-webhook-secret') ?? '';
  if (provided !== expectedSecret) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'INVALID_JSON' }, 400); }

  const fullName = String(body.full_name ?? body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const companyName = String(body.company_name ?? body.company ?? '').trim();
  const email = body.email ? String(body.email).trim() : null;
  const city = body.city ? String(body.city).trim() : null;
  let tenancyType = body.tenancy_type ? String(body.tenancy_type).toUpperCase() : null;
  if (tenancyType && !TENANCIES.has(tenancyType)) tenancyType = null;
  const source = (body.source ? String(body.source).trim() : '') || 'Landing page';
  const notes = body.notes ? String(body.notes).trim() : '';
  const whatsappEnabled = body.whatsapp_enabled === undefined ? true : Boolean(body.whatsapp_enabled);
  const extraPayload = (body.payload && typeof body.payload === 'object') ? body.payload as Record<string, unknown> : {};

  if (!fullName) return json({ ok: false, error: 'MISSING_FIELD', field: 'full_name' }, 400);
  if (!email) return json({ ok: false, error: 'MISSING_FIELD', field: 'email' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
  if (!phone || normalisePhone(phone).length < 6) return json({ ok: false, error: 'INVALID_PHONE' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Duplicate detection: same phone digits within last 365 days
  const digits = normalisePhone(phone);
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('enquiries')
    .select('id, phone, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  const duplicateOf = (recent ?? []).find(r => normalisePhone(r.phone) === digits)?.id ?? null;

  const { data: inserted, error } = await supabase.from('enquiries').insert({
    full_name: fullName,
    company_name: companyName || null,
    phone,
    email,
    city,
    tenancy_type: tenancyType,
    source,
    stage: 'NEW_ENQUIRY',
    is_duplicate_of: duplicateOf,
    payload: {
      ...extraPayload,
      whatsapp_enabled: whatsappEnabled,
      initial_notes: notes || null,
      origin: 'landing_page_webhook',
    },
  }).select('id').maybeSingle();

  if (error || !inserted) return json({ ok: false, error: error?.message ?? 'INSERT_FAILED' }, 500);

  const enquiryId = inserted.id as string;

  if (notes) {
    await supabase.from('enquiry_notes').insert({ enquiry_id: enquiryId, note_text: notes });
  }

  await supabase.rpc('log_activity', {
    _entity_type: 'ENQUIRY',
    _entity_id: enquiryId,
    _event_type: duplicateOf ? 'NOTE' : 'CREATE',
    _summary: duplicateOf ? 'Landing page enquiry (duplicate phone)' : 'Enquiry submitted from landing page',
    _details: { source, duplicate_of: duplicateOf } as never,
  } as never).catch(() => {});

  return json({ ok: true, id: enquiryId, duplicate_of: duplicateOf });
});
