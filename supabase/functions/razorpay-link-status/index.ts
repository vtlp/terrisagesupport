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
  purpose: 'INITIAL' | 'RENEWAL' | 'TRIAL_CONVERSION' | 'SEAT_UPSELL';
  enquiry_id?: string;
  account_id?: string;
  upsell_link_id?: string;
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
      // Mirror status into both `status` (user-visible badge) and `razorpay_status`
      // (separate pill so the manual override and the API-reported state can be
      // compared at a glance).
      const next = {
        ...payment,
        status,
        razorpay_status: status,
        razorpay_status_checked_at: new Date().toISOString(),
        ...(paidAt ? { paid_at: paidAt } : {}),
      };
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

    if (body.purpose === 'TRIAL_CONVERSION' && body.account_id) {
      const update: Record<string, unknown> = { trial_link_status: status };
      if (paidAt) update.trial_paid_at = paidAt;
      await admin.from('account_billing_settings').update(update).eq('account_id', body.account_id);
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Trial] Link status refreshed → ${status}`,
        details: { module: 'trial', link_id: body.link_id, status },
      });
      return new Response(JSON.stringify({ success: true, status, paid_at: paidAt }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.purpose === 'SEAT_UPSELL' && body.account_id) {
      const update: Record<string, unknown> = { status };
      if (paidAt) update.paid_at = paidAt;
      await admin.from('seat_upsell_links').update(update)
        .eq('account_id', body.account_id).eq('link_id', body.link_id);

      // Mirror an invoice entry on terminal states so finance always has a row
      // (PAID / FAILED). Idempotent via dedupe on link_id in notes. Note: the
      // webhook is the source of truth for fulfilment side-effects (seat counts,
      // seat_change_events). Here we only ensure the invoice row exists.
      if (status === 'PAID' || status === 'CANCELLED' || status === 'EXPIRED') {
        const { data: link } = await admin.from('seat_upsell_links')
          .select('seats_extra, prorated_subtotal, gst_pct, gst_amount, total')
          .eq('account_id', body.account_id).eq('link_id', body.link_id).maybeSingle();
        if (link) {
          const { data: existing } = await admin.from('account_invoices').select('id')
            .eq('account_id', body.account_id)
            .ilike('notes', `%${body.link_id}%`)
            .limit(1).maybeSingle();
          if (!existing) {
            const { data: bs } = await admin.from('account_billing_settings')
              .select('plan_name, seat_rate, current_period_start, current_period_end')
              .eq('account_id', body.account_id).maybeSingle();
            const invStatus = status === 'PAID' ? 'PAID' : 'FAILED';
            const nowIso = new Date().toISOString();
            await admin.from('account_invoices').insert({
              account_id: body.account_id,
              plan_name: bs?.plan_name ?? 'Standard',
              seat_count: link.seats_extra,
              seat_rate: Number(bs?.seat_rate ?? 0),
              base_fee: 0,
              subtotal: Number(link.prorated_subtotal),
              gst_pct: Number(link.gst_pct),
              gst_amount: Number(link.gst_amount),
              total: Number(link.total),
              status: invStatus,
              kind: 'PRORATION',
              issued_at: nowIso,
              paid_at: invStatus === 'PAID' ? (paidAt ?? nowIso) : null,
              period_from: bs?.current_period_start ? new Date(bs.current_period_start).toISOString().substring(0, 10) : null,
              period_to: bs?.current_period_end ? new Date(bs.current_period_end).toISOString().substring(0, 10) : null,
              notes: `Razorpay seat upsell ${status.toLowerCase()} · +${link.seats_extra} seat(s) · ${body.link_id}`,
            });
          }
        }
      }

      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: body.account_id, event_type: 'FIELD_EDIT',
        summary: `[Seat upsell] Link status refreshed → ${status}`,
        details: { module: 'seat_upsell', link_id: body.link_id, status },
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
