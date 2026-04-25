// Razorpay payment link creation. Staff-only.
// Branches on `purpose`:
//   - 'INITIAL' (default): writes payment metadata onto enquiries.payload.payment
//   - 'RENEWAL': writes renewal_* metadata onto account_billing_settings
// In both cases, the Razorpay link carries `notes.purpose` so the webhook can
// route the PAID event to the right table.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Body {
  enquiry_id?: string;
  account_id?: string;
  seat_request_id?: string;
  purpose?: 'INITIAL' | 'RENEWAL' | 'TRIAL_CONVERSION' | 'SEAT_UPSELL';
  plan_name: string;
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';
  seats: number;
  base_fee: number;
  per_seat_rate: number;
  gst_pct: number;
  subtotal: number;
  gst_amount: number;
  total: number;
  customer: { name: string; email?: string; phone?: string };
  expires_in_days?: number;
  notes?: string;
  prorata?: { days_remaining: number; days_in_cycle: number };
  subscription_start_at?: string;
  subscription_end_at?: string;
}

const fmtINR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isStaff } = await admin.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden — staff only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    const purpose = body.purpose ?? 'INITIAL';

    if (purpose === 'INITIAL' && !body.enquiry_id) {
      return new Response(JSON.stringify({ success: false, error: 'enquiry_id required for INITIAL purpose' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if ((purpose === 'RENEWAL' || purpose === 'TRIAL_CONVERSION' || purpose === 'SEAT_UPSELL') && !body.account_id) {
      return new Response(JSON.stringify({ success: false, error: `account_id required for ${purpose} purpose` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (purpose === 'SEAT_UPSELL' && !body.seat_request_id) {
      return new Response(JSON.stringify({ success: false, error: 'seat_request_id required for SEAT_UPSELL purpose' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!body?.total || body.total <= 0 || !body?.customer?.name) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const useDummy = !keyId || !keySecret;

    const expiresAt = body.expires_in_days
      ? new Date(Date.now() + body.expires_in_days * 86400_000)
      : new Date(Date.now() + 30 * 86400_000);

    // Generate a sequential, human-readable order number (e.g. TS-ORD-000042).
    // Used as Razorpay reference_id and persisted in our DB for full traceability.
    let orderNo = '';
    {
      const { data: ordData, error: ordErr } = await admin.rpc('next_payment_order_no');
      if (ordErr || !ordData) {
        console.error('next_payment_order_no failed', ordErr);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to generate order number' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      orderNo = String(ordData);
    }

    let rzpJson: { id: string; short_url: string };
    if (useDummy) {
      const id = `plink_dummy_${Date.now().toString(36)}`;
      rzpJson = { id, short_url: `https://rzp.io/test/${id}` };
      console.log('Razorpay credentials missing — issuing dummy payment link', { id, purpose, orderNo });
    } else {
      const amountPaise = Math.round(body.total * 100);
      const auth = btoa(`${keyId}:${keySecret}`);

      const descSuffix = purpose === 'RENEWAL' ? ' · Renewal'
        : purpose === 'TRIAL_CONVERSION' ? ' · Trial conversion'
        : purpose === 'SEAT_UPSELL' ? ' · Seat upsell (pro-rata)'
        : '';

      const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          accept_partial: false,
          expire_by: Math.floor(expiresAt.getTime() / 1000),
          description: `${orderNo} · ${body.plan_name} · ${body.seats} seat(s) · ${body.billing_cycle}${descSuffix}`,
          // Customer block — flows onto the resulting payment record in Razorpay dashboard
          customer: {
            name: body.customer.name,
            email: body.customer.email || undefined,
            contact: body.customer.phone || undefined,
          },
          notify: { sms: !!body.customer.phone, email: !!body.customer.email },
          reminder_enable: true,
          // Sequential order number — surfaces on Razorpay dashboard as Reference ID
          reference_id: orderNo,
          // Notes — visible under the "Notes" section of every payment in Razorpay dashboard,
          // and searchable. We enrich with app metadata + customer details so support staff
          // can reconcile any payment without leaving the Razorpay screen.
          notes: {
            app_name: 'Terrisage Support',
            app_id: 'terrisage-support',
            order_no: orderNo,
            purpose,
            enquiry_id: body.enquiry_id ?? '',
            account_id: body.account_id ?? '',
            seat_request_id: body.seat_request_id ?? '',
            plan: body.plan_name,
            cycle: body.billing_cycle,
            seats: String(body.seats),
            customer_name: body.customer.name,
            customer_email: body.customer.email ?? '',
            customer_phone: body.customer.phone ?? '',
          },
        }),
      });
      const parsed = await rzpRes.json();
      if (!rzpRes.ok) {
        console.error('Razorpay request failed', { status: rzpRes.status, body: parsed, orderNo });
        if (purpose === 'INITIAL' && body.enquiry_id) {
          await admin.from('enquiry_notes').insert({
            enquiry_id: body.enquiry_id,
            author_id: user.id,
            note_text: `[Payment] Link generation failed (${orderNo}) – ${parsed?.error?.description || 'Razorpay request failed'}`,
          });
        }
        return new Response(
          JSON.stringify({ success: false, error: parsed?.error?.description || 'Razorpay request failed' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      rzpJson = { id: parsed.id, short_url: parsed.short_url };
    }

    const createdAtIso = new Date().toISOString();
    const expiresAtIso = expiresAt.toISOString();

    const payment = {
      link_id: rzpJson.id,
      short_url: rzpJson.short_url,
      order_no: orderNo,
      reference_id: orderNo,
      amount: body.total,
      currency: 'INR' as const,
      status: 'CREATED' as const,
      mode: undefined as string | undefined,
      breakdown: {
        plan_name: body.plan_name,
        billing_cycle: body.billing_cycle,
        base_fee: body.base_fee,
        per_seat_rate: body.per_seat_rate,
        seats: body.seats,
        gst_pct: body.gst_pct,
        subtotal: body.subtotal,
        gst_amount: body.gst_amount,
        total: body.total,
      },
      subscription: body.subscription_start_at && body.subscription_end_at
        ? { start_at: body.subscription_start_at, end_at: body.subscription_end_at }
        : undefined,
      created_at: createdAtIso,
      expires_at: expiresAtIso,
      outdated: false,
    };

    if (purpose === 'INITIAL' && body.enquiry_id) {
      const { data: enq } = await admin
        .from('enquiries')
        .select('payload')
        .eq('id', body.enquiry_id)
        .maybeSingle();
      const existingPayload = (enq?.payload ?? {}) as Record<string, unknown>;
      const existingPayment = (existingPayload.payment ?? {}) as Record<string, unknown>;
      // Preserve mode/trial that may have been set on the enquiry.
      const merged = {
        ...payment,
        mode: existingPayment.mode ?? 'PAY_BEFORE_ACCOUNT',
        trial: existingPayment.trial,
      };
      await admin.from('enquiries').update({
        payload: { ...existingPayload, payment: merged },
      }).eq('id', body.enquiry_id);

      await admin.from('enquiry_notes').insert({
        enquiry_id: body.enquiry_id,
        author_id: user.id,
        note_text: `[Payment] ${useDummy ? 'Dummy test link sent' : 'Link sent'} ${fmtINR(body.total)} · Order ${orderNo} – ${payment.short_url}`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ENQUIRY', entity_id: body.enquiry_id, event_type: 'FIELD_EDIT',
        summary: `[Payment] Link generated ${fmtINR(body.total)} · ${orderNo}`,
        details: { module: 'billing', order_no: orderNo, link_id: payment.link_id, seats: body.seats, total: body.total },
      });

      return new Response(JSON.stringify({ success: true, payment: merged }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (purpose === 'RENEWAL' && body.account_id) {
      await admin.from('account_billing_settings').update({
        renewal_link_id: payment.link_id,
        renewal_link_short_url: payment.short_url,
        renewal_link_amount: payment.amount,
        renewal_link_seats: body.seats,
        renewal_link_currency: 'INR',
        renewal_link_status: 'CREATED',
        renewal_link_created_at: createdAtIso,
        renewal_link_expires_at: expiresAtIso,
        renewal_link_outdated: false,
        renewal_order_no: orderNo,
        renewal_paid_at: null,
        renewal_payment_reference: null,
      }).eq('account_id', body.account_id);

      await admin.from('account_notes').insert({
        account_id: body.account_id,
        note_text: `[Renewal] Payment link generated ${fmtINR(body.total)} · Order ${orderNo} · ${payment.short_url}`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Renewal] Payment link generated ${fmtINR(body.total)} · ${orderNo}`,
        details: { module: 'renewal', order_no: orderNo, link_id: payment.link_id, seats: body.seats, total: body.total },
      });

      return new Response(JSON.stringify({ success: true, payment }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (purpose === 'TRIAL_CONVERSION' && body.account_id) {
      await admin.from('account_billing_settings').update({
        trial_link_id: payment.link_id,
        trial_link_short_url: payment.short_url,
        trial_link_amount: payment.amount,
        trial_link_seats: body.seats,
        trial_link_currency: 'INR',
        trial_link_status: 'CREATED',
        trial_link_created_at: createdAtIso,
        trial_link_expires_at: expiresAtIso,
        trial_link_outdated: false,
        trial_order_no: orderNo,
        trial_paid_at: null,
        trial_payment_reference: null,
      }).eq('account_id', body.account_id);

      await admin.from('account_notes').insert({
        account_id: body.account_id,
        note_text: `[Trial] Conversion link generated ${fmtINR(body.total)} · Order ${orderNo} · ${payment.short_url}`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Trial] Conversion link generated ${fmtINR(body.total)} · ${orderNo}`,
        details: { module: 'trial', order_no: orderNo, link_id: payment.link_id, seats: body.seats, total: body.total },
      });

      return new Response(JSON.stringify({ success: true, payment }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (purpose === 'SEAT_UPSELL' && body.account_id && body.seat_request_id) {
      const { data: inserted, error: upErr } = await admin.from('seat_upsell_links').insert({
        account_id: body.account_id,
        seat_request_id: body.seat_request_id,
        seats_extra: body.seats,
        per_seat_rate: body.per_seat_rate,
        days_remaining: body.prorata?.days_remaining ?? 0,
        days_in_cycle: body.prorata?.days_in_cycle ?? 0,
        prorated_subtotal: body.subtotal,
        gst_pct: body.gst_pct,
        gst_amount: body.gst_amount,
        total: body.total,
        link_id: payment.link_id,
        short_url: payment.short_url,
        order_no: orderNo,
        status: 'CREATED',
        expires_at: expiresAtIso,
        created_by: user.id,
      }).select('id').maybeSingle();
      if (upErr) console.error('seat_upsell_links insert failed', upErr);

      await admin.from('account_notes').insert({
        account_id: body.account_id,
        note_text: `[Seat upsell] Pro-rata link generated ${fmtINR(body.total)} for +${body.seats} seat(s) · Order ${orderNo} · ${payment.short_url}`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Seat upsell] Pro-rata link generated ${fmtINR(body.total)} · ${orderNo}`,
        details: { module: 'seat_upsell', order_no: orderNo, link_id: payment.link_id, seats: body.seats, total: body.total, seat_request_id: body.seat_request_id, upsell_link_id: inserted?.id },
      });

      return new Response(JSON.stringify({ success: true, payment, upsell_link_id: inserted?.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unhandled purpose' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('razorpay-create-payment-link error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
