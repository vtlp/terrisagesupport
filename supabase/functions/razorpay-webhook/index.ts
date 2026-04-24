// Razorpay webhook receiver. Verifies signature with RAZORPAY_WEBHOOK_SECRET,
// then branches on `notes.purpose`:
//   - 'INITIAL' (default): flips enquiry payload payment.status to PAID
//     and mirrors a PAID invoice on the account if already converted.
//   - 'RENEWAL': marks renewal_link_status PAID on account_billing_settings,
//     calls renew_subscription RPC to roll the period forward and create the
//     PAID renewal invoice, then clears the open renewal-link fields.
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
    const linkObj = (event.payload as { payment_link?: { entity?: Record<string, unknown> } } | undefined)?.payment_link?.entity ?? {};
    const linkId = linkObj.id as string | undefined;
    const notes = (linkObj.notes ?? {}) as Record<string, string>;
    const purpose = (notes.purpose as 'INITIAL' | 'RENEWAL' | 'TRIAL_CONVERSION' | undefined) ?? 'INITIAL';
    const enquiryId = notes.enquiry_id;
    const accountIdNote = notes.account_id;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const nowIso = new Date().toISOString();

    // Handle cancelled / expired explicitly so the source row reflects reality.
    if (event.event === 'payment_link.cancelled' || event.event === 'payment_link.expired') {
      const newStatus = event.event === 'payment_link.cancelled' ? 'CANCELLED' : 'EXPIRED';

      if (purpose === 'INITIAL' && enquiryId) {
        const { data: enq } = await admin.from('enquiries').select('payload').eq('id', enquiryId).maybeSingle();
        const payload = (enq?.payload ?? {}) as Record<string, unknown>;
        const payment = (payload.payment ?? {}) as Record<string, unknown>;
        await admin.from('enquiries').update({
          payload: { ...payload, payment: { ...payment, status: newStatus } },
        }).eq('id', enquiryId);
        await admin.from('activity_log').insert({
          entity_type: 'ENQUIRY', entity_id: enquiryId, event_type: 'FIELD_EDIT',
          summary: `[Payment] Link ${newStatus.toLowerCase()} (Razorpay)`,
          details: { module: 'billing', link_id: linkId },
        });
      } else if (purpose === 'RENEWAL' && accountIdNote) {
        await admin.from('account_billing_settings').update({ renewal_link_status: newStatus }).eq('account_id', accountIdNote);
        await admin.from('activity_log').insert({
          entity_type: 'ACCOUNT', entity_id: accountIdNote, event_type: 'FIELD_EDIT',
          summary: `[Renewal] Link ${newStatus.toLowerCase()} (Razorpay)`,
          details: { module: 'renewal', link_id: linkId },
        });
      } else if (purpose === 'TRIAL_CONVERSION' && accountIdNote) {
        await admin.from('account_billing_settings').update({ trial_link_status: newStatus }).eq('account_id', accountIdNote);
        await admin.from('activity_log').insert({
          entity_type: 'ACCOUNT', entity_id: accountIdNote, event_type: 'FIELD_EDIT',
          summary: `[Trial] Link ${newStatus.toLowerCase()} (Razorpay)`,
          details: { module: 'trial', link_id: linkId },
        });
      } else if (purpose === 'SEAT_UPSELL' && accountIdNote && linkId) {
        await admin.from('seat_upsell_links').update({ status: newStatus })
          .eq('account_id', accountIdNote).eq('link_id', linkId);
        await admin.from('activity_log').insert({
          entity_type: 'ACCOUNT', entity_id: accountIdNote, event_type: 'FIELD_EDIT',
          summary: `[Seat upsell] Link ${newStatus.toLowerCase()} (Razorpay)`,
          details: { module: 'seat_upsell', link_id: linkId },
        });
      }

      return new Response(JSON.stringify({ success: true, handled: newStatus }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (event.event !== 'payment_link.paid') {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- RENEWAL PAID branch ----------
    if (purpose === 'RENEWAL' && accountIdNote) {
      const { data: settings } = await admin.from('account_billing_settings')
        .select('renewal_link_seats, seats_purchased, current_period_end')
        .eq('account_id', accountIdNote).maybeSingle();
      const newSeats = Number(settings?.renewal_link_seats ?? 0);
      const currentSeats = Number(settings?.seats_purchased ?? 0);
      const decision = newSeats === 0 || newSeats === currentSeats
        ? 'RENEW'
        : newSeats > currentSeats ? 'RENEW_INCREASE' : 'RENEW_DECREASE';

      const { error: rpcErr } = await admin.rpc('renew_subscription', {
        _account_id: accountIdNote,
        _decision: decision,
        _new_seats: decision === 'RENEW' ? null : newSeats,
        _notes: `Razorpay renewal payment received · ${linkId ?? ''}`,
      });
      if (rpcErr) console.error('renew_subscription failed', rpcErr);

      // Mark the open renewal-link fields PAID and clear them so the next cycle
      // starts fresh.
      await admin.from('account_billing_settings').update({
        renewal_link_status: 'PAID',
        renewal_paid_at: nowIso,
        renewal_payment_reference: linkId ?? null,
      }).eq('account_id', accountIdNote);

      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: accountIdNote, event_type: 'FIELD_EDIT',
        summary: '[Renewal] Payment received via Razorpay',
        details: { module: 'renewal', link_id: linkId, decision, seats: newSeats },
      });

      return new Response(JSON.stringify({ success: true, branch: 'RENEWAL' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- TRIAL_CONVERSION PAID branch ----------
    if (purpose === 'TRIAL_CONVERSION' && accountIdNote) {
      const { data: settings } = await admin.from('account_billing_settings')
        .select('trial_link_seats, seats_purchased, billing_cycle, plan_name, base_fee, seat_rate, gst_pct, trial_link_amount')
        .eq('account_id', accountIdNote).maybeSingle();

      const trialSeats = Number(settings?.trial_link_seats ?? 0);
      const newSeats = trialSeats > 0 ? trialSeats : Number(settings?.seats_purchased ?? 0);
      const cycle = (settings?.billing_cycle as string) ?? 'ANNUAL';
      const planName = (settings?.plan_name as string) ?? 'Standard';
      const baseFee = Number(settings?.base_fee ?? 33000);
      const seatRate = Number(settings?.seat_rate ?? 7000);
      const gstPct = Number(settings?.gst_pct ?? 18);
      const subtotal = baseFee + seatRate * Math.max(newSeats - 3, 0);
      const gstAmount = (subtotal * gstPct) / 100;
      const totalCalc = subtotal + gstAmount;
      const total = Number(settings?.trial_link_amount ?? totalCalc);

      // Compute period start (now) and end (now + cycle).
      const periodStart = new Date();
      const periodEnd = new Date(periodStart);
      if (cycle === 'MONTHLY') periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (cycle === 'QUARTERLY') periodEnd.setMonth(periodEnd.getMonth() + 3);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      // Flip account out of trial → active, stamp lifecycle dates,
      // sync seats_purchased to whatever was paid for, and clear the trial-link state.
      await admin.from('account_billing_settings').update({
        status: 'ACTIVE',
        seats_purchased: newSeats,
        subscription_started_at: periodStart.toISOString(),
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_renewal_at: periodEnd.toISOString(),
        trial_link_status: 'PAID',
        trial_paid_at: nowIso,
        trial_payment_reference: linkId ?? null,
      }).eq('account_id', accountIdNote);

      // Mirror the PAID invoice (dedupe by link id in notes).
      const dedupeKey = linkId ?? '';
      if (dedupeKey) {
        const { data: existing } = await admin
          .from('account_invoices')
          .select('id')
          .eq('account_id', accountIdNote)
          .eq('status', 'PAID')
          .ilike('notes', `%${dedupeKey}%`)
          .limit(1).maybeSingle();
        if (!existing) {
          await admin.from('account_invoices').insert({
            account_id: accountIdNote,
            plan_name: planName,
            seat_count: newSeats,
            seat_rate: seatRate,
            base_fee: baseFee,
            subtotal,
            gst_pct: gstPct,
            gst_amount: gstAmount,
            total,
            status: 'PAID',
            kind: 'CYCLE',
            issued_at: nowIso,
            paid_at: nowIso,
            period_from: periodStart.toISOString().substring(0, 10),
            period_to: periodEnd.toISOString().substring(0, 10),
            notes: `Razorpay trial conversion · ${linkId ?? '—'}`,
          });
        }
      }

      // Tick the "Collect trial conversion payment" checklist item if present.
      await admin.from('account_checklist_items').update({
        is_done: true, done_at: nowIso,
      }).eq('account_id', accountIdNote)
        .eq('label', 'Collect trial conversion payment')
        .eq('is_done', false);

      await admin.from('account_notes').insert({
        account_id: accountIdNote,
        note_text: `[Trial] Conversion payment received via Razorpay · subscription now ACTIVE`,
      });
      await admin.from('activity_log').insert({
        entity_type: 'ACCOUNT', entity_id: accountIdNote, event_type: 'FIELD_EDIT',
        summary: '[Trial] Conversion payment received · activated',
        details: { module: 'trial', link_id: linkId, seats: newSeats, total },
      });

      // Emit a TRIAL_CONVERTED seat-change event so the connected CRM picks up
      // the TRIAL → ACTIVE transition through /seat-events without polling
      // /account-profile. delta = 0 because seats_purchased is unchanged here
      // (any seat-count change at conversion is reflected via newSeats above
      // and surfaced through /seat-capacity).
      await admin.from('seat_change_events').insert({
        account_id: accountIdNote,
        delta: 0,
        new_total: newSeats,
        reason: 'TRIAL_CONVERTED',
        effective_at: nowIso,
        prorated_amount: 0,
        notes: `Trial conversion via Razorpay · ${linkId ?? '—'}`,
      });

      return new Response(JSON.stringify({ success: true, branch: 'TRIAL_CONVERSION' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- INITIAL PAID branch (existing behaviour) ----------
    if (!enquiryId) {
      return new Response(JSON.stringify({ success: true, ignored: 'no enquiry_id' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: enq } = await admin
      .from('enquiries')
      .select('payload, converted_account_id')
      .eq('id', enquiryId)
      .maybeSingle();
    const payload = (enq?.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment ?? {}) as Record<string, unknown>;
    const nextPayment = { ...payment, status: 'PAID', paid_at: nowIso, link_id: payment.link_id ?? linkId };
    await admin.from('enquiries').update({ payload: { ...payload, payment: nextPayment } }).eq('id', enquiryId);

    await admin.from('activity_log').insert({
      entity_type: 'ENQUIRY', entity_id: enquiryId, event_type: 'FIELD_EDIT',
      summary: '[Payment] Marked Paid via Razorpay webhook',
      details: { module: 'billing', link_id: payment.link_id ?? linkId },
    });

    // Mirror PAID invoice onto the account when already converted.
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
          issued_at: (payment.created_at as string) || nowIso,
          paid_at: nowIso,
          notes: `Razorpay payment link · ${shortUrl || linkId || '—'}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, branch: 'INITIAL' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
