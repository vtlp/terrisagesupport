// Shared billing math used by Account Billing and the Razorpay payment link dialog.

export interface BillingBreakdown {
  baseFee: number;
  perSeatRate: number;
  seats: number;
  includedSeats: number;
  chargeableSeats: number;
  gstPct: number;
  subtotal: number;
  gstAmount: number;
  total: number;
}

/**
 * Pricing rule: base fee covers the first `includedSeats` seats (default 3).
 * Any seat beyond that is charged at `perSeatRate`.
 * Example: 30 seats → 33000 + 27 × 7000 + GST.
 */
export function calcBilling(
  baseFee: number,
  perSeatRate: number,
  seats: number,
  gstPct: number,
  includedSeats = 3,
): BillingBreakdown {
  const safe = (n: number) => (Number.isFinite(n) ? Number(n) : 0);
  const b = safe(baseFee);
  const r = safe(perSeatRate);
  const s = Math.max(0, Math.floor(safe(seats)));
  const inc = Math.max(0, Math.floor(safe(includedSeats)));
  const g = Math.max(0, safe(gstPct));
  const chargeable = Math.max(0, s - inc);
  const subtotal = b + r * chargeable;
  const gstAmount = (subtotal * g) / 100;
  const total = subtotal + gstAmount;
  return {
    baseFee: b,
    perSeatRate: r,
    seats: s,
    includedSeats: inc,
    chargeableSeats: chargeable,
    gstPct: g,
    subtotal,
    gstAmount,
    total,
  };
}

export const fmtINR = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
