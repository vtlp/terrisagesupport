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
  // Uses a SECURITY DEFINER RPC so the anon role never gets direct SELECT on
  // onboarding_submissions (which would expose PII payloads).
  const { data, error } = await supabase.rpc("check_submission_lock", {
    _enquiry_id: enquiryId,
  });
  if (error) {
    console.warn("checkSubmissionLock failed", error);
    return null;
  }
  return (data as string | null) ?? null;
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

  // Use SECURITY DEFINER RPC so the anonymous role never needs SELECT on
  // `enquiries` (private PII) to satisfy the FK check on `onboarding_submissions`.
  const { error } = await supabase.rpc("submit_onboarding_public", {
    _tenancy_type: tenancy,
    _payload: payload as never,
    _enquiry_id: enquiryId,
  });

  if (error) {
    console.error("Onboarding submission insert failed", error);
    const code = (error as { code?: string }).code;
    const message = error.message || "";
    // Friendly mapping for our explicit RAISE codes + race-condition unique violation.
    if (code === "P0003" || code === "23505" || /already been submitted/i.test(message)) {
      throw new AlreadySubmittedError(
        "This onboarding form has already been submitted for this link.",
      );
    }
    if (code === "P0002" || /invalid or expired/i.test(message)) {
      throw new Error("This onboarding link is invalid or has expired. Please contact support.");
    }
    throw new Error(`Submission failed: ${error.message}`);
  }
}

export function getEnquiryIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("enquiry_id");
}
