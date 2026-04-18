// One-off seed: creates the initial admin user. Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SEED_EMAIL = "connecttolpk@gmail.com";
const SEED_PASSWORD = "Welcow@1661";
const SEED_NAME = "Admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Check if user exists
    const { data: list } = await admin.auth.admin.listUsers();
    let user = list.users.find((u) => u.email === SEED_EMAIL);

    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: SEED_NAME },
      });
      if (error) throw error;
      user = created.user!;
    }

    // Ensure profile EXISTS — but never overwrite a user-edited full_name.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await admin.from("profiles").insert({
        id: user.id, full_name: SEED_NAME, email: SEED_EMAIL, is_active: true,
      });
    } else {
      // Only patch email/is_active; preserve full_name as-is.
      await admin.from("profiles")
        .update({ email: SEED_EMAIL, is_active: true })
        .eq("id", user.id);
    }

    // Ensure admin role
    await admin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "admin" },
        { onConflict: "user_id,role" }
      );

    return new Response(
      JSON.stringify({ ok: true, user_id: user.id, email: SEED_EMAIL }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
