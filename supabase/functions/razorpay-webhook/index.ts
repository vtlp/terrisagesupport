// Razorpay webhook receiver. Verifies signature with RAZORPAY_WEBHOOK_SECRET,
// flips enquiry payload payment.status to PAID on `payment_link.paid`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-razorpay-signature',
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: 'Webhook secret not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await req.text();
    const sig = req.headers.get('x-razorpay-signature') ?? '';
    const expected = await hmacSha256Hex(secret, raw);
    if (sig !== expected) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(raw) as { event?: string; payload?: Record<string, unknown> };
    if (event.event !== 'payment_link.paid') {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const linkObj = (event.payload as { payment_link?: { entity?: Record<string, unknown> } } | undefined)?.payment_link?.entity ?? {};
    const linkId = linkObj.id as string | undefined;
    const notes = (linkObj.notes ?? {}) as Record<string, string>;
    const enquiryId = notes.enquiry_id;
    if (!enquiryId) {
      return new Response(JSON.stringify({ success: true, ignored: 'no enquiry_id' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: enq } = await admin.from('enquiries').select('payload').eq('id', enquiryId).maybeSingle();
    const payload = (enq?.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment ?? {}) as Record<string, unknown>;
    const nextPayment = { ...payment, status: 'PAID', paid_at: new Date().toISOString(), link_id: payment.link_id ?? linkId };
    await admin.from('enquiries').update({ payload: { ...payload, payment: nextPayment } }).eq('id', enquiryId);

    await admin.from('activity_log').insert({
      entity_type: 'ENQUIRY', entity_id: enquiryId, event_type: 'FIELD_EDIT',
      summary: '[Payment] Marked Paid via Razorpay webhook',
      details: { link_id: payment.link_id ?? linkId },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
