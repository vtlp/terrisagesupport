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

// Convert a File to a base64 data URL so it can be stored inside the JSON
// draft (localStorage cannot hold raw File objects).
export function fileToDataUrl(file: File): Promise<{ name: string; type: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: String(reader.result) });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function filesToSerializable(files: File[]) {
  return Promise.all(files.map(fileToDataUrl));
}

export function serializableToFiles(items: { name: string; type: string; dataUrl: string }[] | undefined): File[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map((it) => {
      try {
        const [meta, b64] = it.dataUrl.split(",");
        const mime = /data:(.*?);base64/.exec(meta)?.[1] || it.type || "application/octet-stream";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], it.name, { type: mime });
      } catch {
        return null;
      }
    })
    .filter((f): f is File => f !== null);
}
