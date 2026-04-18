import { supabase } from "@/integrations/supabase/client";

export type Tenancy = "AGENCY_BROKERAGE_CONSULTANCY" | "BUILDER_DEVELOPER";

const BUCKET = "onboarding-uploads";

export async function uploadFiles(files: File[], folder: string): Promise<string[]> {
  if (!files || files.length === 0) return [];
  const paths: string[] = [];
  for (const file of files) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      console.error("Onboarding upload failed", { path, file: file.name, error });
      throw new Error(`Could not upload "${file.name}": ${error.message}`);
    }
    paths.push(path);
  }
  return paths;
}

export class AlreadySubmittedError extends Error {
  submittedAt?: string;
  constructor(message: string, submittedAt?: string) {
    super(message);
    this.name = "AlreadySubmittedError";
    this.submittedAt = submittedAt;
  }
}

/**
 * Check if the onboarding link (enquiry_id) has already been used for a
 * successful (non-rejected) submission. Returns the submitted_at timestamp
 * when locked, or null when the link is still open.
 */
export async function checkSubmissionLock(enquiryId: string | null): Promise<string | null> {
  if (!enquiryId) return null;
  const { data, error } = await supabase
    .from("onboarding_submissions")
    .select("submitted_at,status")
    .eq("enquiry_id", enquiryId)
    .neq("status", "REJECTED")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("checkSubmissionLock failed", error);
    return null;
  }
  return data?.submitted_at ?? null;
}

export async function submitOnboarding(
  tenancy: Tenancy,
  payload: Record<string, unknown>,
  enquiryId: string | null,
) {
  // Pre-check: refuse if link is already locked. The DB unique index is the
  // authoritative guard; this just gives a friendlier error before insert.
  if (enquiryId) {
    const lockedAt = await checkSubmissionLock(enquiryId);
    if (lockedAt) {
      throw new AlreadySubmittedError(
        "This onboarding form has already been submitted for this link.",
        lockedAt,
      );
    }
  }

  const { data, error } = await supabase
    .from("onboarding_submissions")
    .insert({ tenancy_type: tenancy, payload: payload as never, enquiry_id: enquiryId })
    .select("id")
    .single();
  if (error) {
    console.error("Onboarding submission insert failed", error);
    // Postgres unique-violation code = 23505. Surfaces when two submissions race.
    if ((error as { code?: string }).code === "23505") {
      throw new AlreadySubmittedError(
        "This onboarding form has already been submitted for this link.",
      );
    }
    throw new Error(`Submission failed: ${error.message}`);
  }
  return data.id as string;
}

export function getEnquiryIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("enquiry_id");
}
