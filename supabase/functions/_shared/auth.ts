// Shared auth guard for internal sync endpoints.
// Allows requests that either:
//   (a) Carry the service-role key as Bearer (used by pg_cron / server-to-server), OR
//   (b) Are made by a signed-in staff user (admin or support_agent).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface AuthOk { ok: true }
export interface AuthFail { ok: false; status: number; error: string }
export type AuthResult = AuthOk | AuthFail;

export async function requireStaffOrService(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<AuthResult> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const token = header.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  // Service role bypass (pg_cron, internal callers).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return { ok: true };

  // Otherwise it must be a signed-in staff user.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: isStaff, error: rpcErr } = await supabaseAdmin
    .rpc("is_staff", { _user_id: data.user.id });
  if (rpcErr) return { ok: false, status: 500, error: "AUTH_CHECK_FAILED" };
  if (!isStaff) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true };
}
