// Poll Razorpay for the latest status of a single payment link and mirror it
// back onto the enquiry payload or account_billing_settings. Staff-only.
// Used by the manual "Refresh status" button on both the enquiry payment panel
// and the account renewal sub-card.
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

// Razorpay link statuses → our internal status enum
function mapRzpStatus(s: string): string {
  switch ((s || '').toLowerCase()) {
    case 'paid': return 'PAID';
    case 'cancelled': return 'CANCELLED';
    case 'expired': return 'EXPIRED';
    case 'partially_paid': return 'PENDING';
    case 'created':
    case 'issued':
    default: return 'CREATED';
  }
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

    let status = 'CREATED';
    let paidAt: string | null = null;

    if (!useDummy) {
      const auth = btoa(`${keyId}:${keySecret}`);
      const rzpRes = await fetch(`https://api.razorpay.com/v1/payment_links/${body.link_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!rzpRes.ok) {
        const parsed = await rzpRes.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: false, error: parsed?.error?.description || 'Razorpay fetch failed' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const parsed = await rzpRes.json() as { status?: string; paid_at?: number };
      status = mapRzpStatus(parsed.status ?? '');
      if (status === 'PAID' && parsed.paid_at) {
        paidAt = new Date(parsed.paid_at * 1000).toISOString();
      }
    }

    if (body.purpose === 'INITIAL' && body.enquiry_id) {
      const { data: enq } = await admin.from('enquiries').select('payload').eq('id', body.enquiry_id).maybeSingle();
      const payload = (enq?.payload ?? {}) as Record<string, unknown>;
      const payment = (payload.payment ?? {}) as Record<string, unknown>;
      const next = { ...payment, status, ...(paidAt ? { paid_at: paidAt } : {}) };
      await admin.from('enquiries').update({ payload: { ...payload, payment: next } }).eq('id', body.enquiry_id);
      await admin.from('activity_log').insert({
        entity_type: 'ENQUIRY', entity_id: body.enquiry_id, event_type: 'FIELD_EDIT',
        summary: `[Payment] Status refreshed → ${status}`,
        details: { module: 'billing', link_id: body.link_id, status },
      });
      return new Response(JSON.stringify({ success: true, status, paid_at: paidAt }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.purpose === 'RENEWAL' && body.account_id) {
      const update: Record<string, unknown> = { renewal_link_status: status };
      if (paidAt) update.renewal_paid_at = paidAt;
      await admin.from('account_billing_settings').update(update).eq('account_id', body.account_id);
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Renewal] Link status refreshed → ${status}`,
        details: { module: 'renewal', link_id: body.link_id, status },
      });
      return new Response(JSON.stringify({ success: true, status, paid_at: paidAt }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Missing target id for purpose' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('razorpay-link-status error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
