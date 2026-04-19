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
    const { data: enq } = await admin
      .from('enquiries')
      .select('payload, converted_account_id')
      .eq('id', enquiryId)
      .maybeSingle();
    const payload = (enq?.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment ?? {}) as Record<string, unknown>;
    const paidAtIso = new Date().toISOString();
    const nextPayment = { ...payment, status: 'PAID', paid_at: paidAtIso, link_id: payment.link_id ?? linkId };
    await admin.from('enquiries').update({ payload: { ...payload, payment: nextPayment } }).eq('id', enquiryId);

    await admin.from('activity_log').insert({
      entity_type: 'ENQUIRY', entity_id: enquiryId, event_type: 'FIELD_EDIT',
      summary: '[Payment] Marked Paid via Razorpay webhook',
      details: { link_id: payment.link_id ?? linkId },
    });

    // If the enquiry is already converted to an account, mirror this as a PAID invoice
    // on the account so the Billing tab reflects the Razorpay payment immediately.
    const accountId = enq?.converted_account_id as string | null | undefined;
    if (accountId) {
      const breakdown = (payment.breakdown ?? {}) as Record<string, unknown>;
      const planName = (breakdown.plan_name as string) || 'Standard';
      const baseFee = Number(breakdown.base_fee ?? 33000);
      const seatRate = Number(breakdown.per_seat_rate ?? 7000);
      const seats = Number(breakdown.seats ?? 0);
      const gstPct = Number(breakdown.gst_pct ?? 18);
      const subtotal = Number(breakdown.subtotal ?? baseFee + seatRate * Math.max(seats - 3, 0));
      const gstAmount = Number(breakdown.gst_amount ?? (subtotal * gstPct) / 100);
      const total = Number(breakdown.total ?? subtotal + gstAmount);
      const shortUrl = (payment.short_url as string) || '';
      const dedupeKey = shortUrl || (linkId ?? '');

      const { data: existing } = await admin
        .from('account_invoices')
        .select('id')
        .eq('account_id', accountId)
        .eq('status', 'PAID')
        .ilike('notes', `%${dedupeKey}%`)
        .limit(1)
        .maybeSingle();

      if (!existing && dedupeKey) {
        await admin.from('account_invoices').insert({
          account_id: accountId,
          plan_name: planName,
          seat_count: seats,
          seat_rate: seatRate,
          base_fee: baseFee,
          subtotal,
          gst_pct: gstPct,
          gst_amount: gstAmount,
          total,
          status: 'PAID',
          issued_at: (payment.created_at as string) || paidAtIso,
          paid_at: paidAtIso,
          notes: `Razorpay payment link · ${shortUrl || linkId || '—'}`,
        });
      }
    }

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
