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
  purpose?: 'INITIAL' | 'RENEWAL' | 'TRIAL_CONVERSION';
  plan_name: string;
  billing_cycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
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
    if ((purpose === 'RENEWAL' || purpose === 'TRIAL_CONVERSION') && !body.account_id) {
      return new Response(JSON.stringify({ success: false, error: `account_id required for ${purpose} purpose` }), {
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

    let rzpJson: { id: string; short_url: string };
    if (useDummy) {
      const id = `plink_dummy_${Date.now().toString(36)}`;
      rzpJson = { id, short_url: `https://rzp.io/test/${id}` };
      console.log('Razorpay credentials missing — issuing dummy payment link', { id, purpose });
    } else {
      const amountPaise = Math.round(body.total * 100);
      const auth = btoa(`${keyId}:${keySecret}`);

      const refId = (purpose === 'RENEWAL' || purpose === 'TRIAL_CONVERSION')
        ? `acc_${body.account_id}_${purpose.toLowerCase()}_${Date.now()}`
        : `enq_${body.enquiry_id}_${Date.now()}`;

      const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          accept_partial: false,
          expire_by: Math.floor(expiresAt.getTime() / 1000),
          description: `${body.plan_name} · ${body.seats} seat(s) · ${body.billing_cycle}${purpose === 'RENEWAL' ? ' · Renewal' : purpose === 'TRIAL_CONVERSION' ? ' · Trial conversion' : ''}`,
          customer: {
            name: body.customer.name,
            email: body.customer.email,
            contact: body.customer.phone,
          },
          notify: { sms: !!body.customer.phone, email: !!body.customer.email },
          reminder_enable: true,
          reference_id: refId,
          notes: {
            purpose,
            enquiry_id: body.enquiry_id ?? '',
            account_id: body.account_id ?? '',
            plan: body.plan_name,
            cycle: body.billing_cycle,
            seats: String(body.seats),
          },
        }),
      });
      const parsed = await rzpRes.json();
      if (!rzpRes.ok) {
        console.error('Razorpay request failed', { status: rzpRes.status, body: parsed });
        if (purpose === 'INITIAL' && body.enquiry_id) {
          await admin.from('enquiry_notes').insert({
            enquiry_id: body.enquiry_id,
            author_id: user.id,
            note_text: `[Payment] Link generation failed – ${parsed?.error?.description || 'Razorpay request failed'}`,
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
        note_text: `[Payment] ${useDummy ? 'Dummy test link sent' : 'Link sent'} ${fmtINR(body.total)} – ${payment.short_url}`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ENQUIRY', entity_id: body.enquiry_id, event_type: 'FIELD_EDIT',
        summary: `[Payment] Link generated ${fmtINR(body.total)}`,
        details: { module: 'billing', link_id: payment.link_id, seats: body.seats, total: body.total },
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
        renewal_paid_at: null,
        renewal_payment_reference: null,
      }).eq('account_id', body.account_id);

      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Renewal] Payment link generated ${fmtINR(body.total)}`,
        details: { module: 'renewal', link_id: payment.link_id, seats: body.seats, total: body.total },
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
        trial_paid_at: null,
        trial_payment_reference: null,
      }).eq('account_id', body.account_id);

      await admin.from('account_notes').insert({
        account_id: body.account_id,
        note_text: `[Trial] Conversion link generated ${fmtINR(body.total)} · ${payment.short_url}`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Trial] Conversion link generated ${fmtINR(body.total)}`,
        details: { module: 'trial', link_id: payment.link_id, seats: body.seats, total: body.total },
      });

      return new Response(JSON.stringify({ success: true, payment }), {
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
