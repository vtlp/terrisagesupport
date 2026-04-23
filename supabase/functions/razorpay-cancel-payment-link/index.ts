// Cancel a Razorpay payment link. Staff-only. Updates the source row
// (enquiry payload OR account_billing_settings renewal fields) and logs activity.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Body {
  link_id: string;
  purpose: 'INITIAL' | 'RENEWAL';
  enquiry_id?: string;
  account_id?: string;
}

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
    if (!body?.link_id || !body?.purpose) {
      return new Response(JSON.stringify({ success: false, error: 'link_id and purpose are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const useDummy = !keyId || !keySecret || body.link_id.startsWith('plink_dummy_');

    if (!useDummy) {
      const auth = btoa(`${keyId}:${keySecret}`);
      const rzpRes = await fetch(`https://api.razorpay.com/v1/payment_links/${body.link_id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      });
      if (!rzpRes.ok) {
        const parsed = await rzpRes.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: parsed?.error?.description || 'Razorpay cancel failed' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const cancelledAt = new Date().toISOString();

    if (body.purpose === 'INITIAL' && body.enquiry_id) {
      const { data: enq } = await admin.from('enquiries').select('payload').eq('id', body.enquiry_id).maybeSingle();
      const payload = (enq?.payload ?? {}) as Record<string, unknown>;
      const payment = (payload.payment ?? {}) as Record<string, unknown>;
      const next = { ...payment, status: 'CANCELLED', cancelled_at: cancelledAt };
      await admin.from('enquiries').update({ payload: { ...payload, payment: next } }).eq('id', body.enquiry_id);
      await admin.from('activity_log').insert({
        entity_type: 'ENQUIRY', entity_id: body.enquiry_id, event_type: 'FIELD_EDIT',
        summary: '[Payment] Link cancelled',
        details: { module: 'billing', link_id: body.link_id },
      });
    } else if (body.purpose === 'RENEWAL' && body.account_id) {
      await admin.from('account_billing_settings').update({
        renewal_link_status: 'CANCELLED',
      }).eq('account_id', body.account_id);
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: '[Renewal] Payment link cancelled',
        details: { module: 'renewal', link_id: body.link_id },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('razorpay-cancel-payment-link error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
