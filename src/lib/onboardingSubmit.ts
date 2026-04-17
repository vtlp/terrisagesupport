import { supabase } from "@/integrations/supabase/client";

export type Tenancy = "AGENCY_BROKERAGE_CONSULTANCY" | "BUILDER_DEVELOPER";

const BUCKET = "onboarding-uploads";

export async function uploadFiles(files: File[], folder: string): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function submitOnboarding(
  tenancy: Tenancy,
  payload: Record<string, unknown>,
  enquiryId: string | null,
) {
  const { data, error } = await supabase
    .from("onboarding_submissions")
    .insert({ tenancy_type: tenancy, payload: payload as never, enquiry_id: enquiryId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export function getEnquiryIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("enquiry_id");
}
