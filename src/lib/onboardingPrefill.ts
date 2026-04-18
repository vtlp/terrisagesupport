/**
 * Reads enquiry-driven prefill values from the onboarding link URL.
 * The CRM injects these as query params when generating the link, so the
 * customer sees their owner name / phone / email / team size already filled
 * (and locked) on the form.
 */
export interface OnboardingPrefill {
  fullName: string | null;
  phone: string | null;
  mobileCode: string | null;
  email: string | null;
  teamSize: string | null;
}

export function readOnboardingPrefill(): OnboardingPrefill {
  if (typeof window === "undefined") {
    return { fullName: null, phone: null, mobileCode: null, email: null, teamSize: null };
  }
  const p = new URLSearchParams(window.location.search);
  const rawPhone = (p.get("phone") ?? "").trim();
  let mobileCode: string | null = null;
  let phone: string | null = null;
  if (rawPhone) {
    // Phone may arrive as "+919876543210" or "9876543210". Split when prefixed.
    const m = rawPhone.match(/^(\+\d{1,4})?(\d{6,15})$/);
    if (m) {
      mobileCode = m[1] || null;
      phone = m[2].slice(-10);
    } else {
      phone = rawPhone.replace(/\D/g, "").slice(-10) || null;
    }
  }
  const teamSize = (p.get("team_size") ?? "").trim();
  return {
    fullName: (p.get("name") ?? "").trim() || null,
    phone,
    mobileCode,
    email: (p.get("email") ?? "").trim() || null,
    teamSize: teamSize && Number(teamSize) > 0 ? teamSize : null,
  };
}
