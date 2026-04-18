// Shared billing math used by Account Billing and the Razorpay payment link dialog.

export interface BillingBreakdown {
  baseFee: number;
  perSeatRate: number;
  seats: number;
  gstPct: number;
  subtotal: number;
  gstAmount: number;
  total: number;
}

export function calcBilling(
  baseFee: number,
  perSeatRate: number,
  seats: number,
  gstPct: number,
): BillingBreakdown {
  const safe = (n: number) => (Number.isFinite(n) ? Number(n) : 0);
  const b = safe(baseFee);
  const r = safe(perSeatRate);
  const s = Math.max(0, Math.floor(safe(seats)));
  const g = Math.max(0, safe(gstPct));
  const subtotal = b + r * s;
  const gstAmount = (subtotal * g) / 100;
  const total = subtotal + gstAmount;
  return { baseFee: b, perSeatRate: r, seats: s, gstPct: g, subtotal, gstAmount, total };
}

export const fmtINR = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
