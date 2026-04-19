// Razorpay payment link creation. Staff-only. Persists payment metadata onto the
// enquiry payload and appends a categorized enquiry note for traceability.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Body {
  enquiry_id: string;
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
  notes?: string;
}

const fmtINR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Verify caller is a logged-in staff member.
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
    if (!body?.enquiry_id || !body?.total || body.total <= 0 || !body?.customer?.name) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const useDummy = !keyId || !keySecret;

    let rzpJson: { id: string; short_url: string };
    if (useDummy) {
      // Test-mode fallback: generates a dummy payment link so staff can rehearse
      // the flow before Razorpay credentials are wired up. Replace by setting
      // RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets.
      const id = `plink_dummy_${Date.now().toString(36)}`;
      rzpJson = {
        id,
        short_url: `https://rzp.io/test/${id}`,
      };
      console.log('Razorpay credentials missing — issuing dummy payment link', { id });
    } else {

    const amountPaise = Math.round(body.total * 100);
    const auth = btoa(`${keyId}:${keySecret}`);

    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        accept_partial: false,
        description: `${body.plan_name} · ${body.seats} seat(s) · ${body.billing_cycle}`,
        customer: {
          name: body.customer.name,
          email: body.customer.email,
          contact: body.customer.phone,
        },
        notify: { sms: !!body.customer.phone, email: !!body.customer.email },
        reminder_enable: true,
        reference_id: `enq_${body.enquiry_id}_${Date.now()}`,
        notes: {
          enquiry_id: body.enquiry_id,
          plan: body.plan_name,
          cycle: body.billing_cycle,
          seats: String(body.seats),
        },
      }),
    });
    const rzpJson = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error('Razorpay request failed', { status: rzpRes.status, body: rzpJson });
      return new Response(
        JSON.stringify({ success: false, error: rzpJson?.error?.description || 'Razorpay request failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payment = {
      link_id: rzpJson.id as string,
      short_url: rzpJson.short_url as string,
      amount: body.total,
      currency: 'INR' as const,
      status: 'CREATED' as const,
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
      created_at: new Date().toISOString(),
    };

    // Merge into existing enquiry payload.
    const { data: enq } = await admin
      .from('enquiries')
      .select('payload')
      .eq('id', body.enquiry_id)
      .maybeSingle();
    const nextPayload = { ...(enq?.payload as Record<string, unknown> ?? {}), payment };
    await admin.from('enquiries').update({ payload: nextPayload }).eq('id', body.enquiry_id);

    // Categorized note for the timeline grouping in Notes panel.
    await admin.from('enquiry_notes').insert({
      enquiry_id: body.enquiry_id,
      author_id: user.id,
      note_text: `[Payment] Link sent ${fmtINR(body.total)} – ${payment.short_url}`,
    });

    return new Response(JSON.stringify({ success: true, payment }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('razorpay-create-payment-link error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
