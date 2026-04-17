const AGENCY_KEY = "terrisage_agency_onboarding";
const BUILDER_KEY = "terrisage_builder_onboarding";

export type OnboardingType = "agency" | "builder";

function getKey(type: OnboardingType) {
  return type === "agency" ? AGENCY_KEY : BUILDER_KEY;
}

export function saveDraft(type: OnboardingType, data: any, currentStep: number) {
  try {
    const payload = { data, currentStep, savedAt: new Date().toISOString() };
    localStorage.setItem(getKey(type), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(type: OnboardingType): { data: any; currentStep: number; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(getKey(type));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraft(type: OnboardingType) {
  localStorage.removeItem(getKey(type));
}
