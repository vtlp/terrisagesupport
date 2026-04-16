import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateBody {
  user_id: string;
  full_name?: string;
  role?: "admin" | "support_agent";
  is_active?: boolean;
  password?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user)
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow)
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const body = (await req.json()) as UpdateBody;
    if (!body.user_id)
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (body.full_name !== undefined || body.is_active !== undefined) {
      const patch: Record<string, unknown> = {};
      if (body.full_name !== undefined) patch.full_name = body.full_name;
      if (body.is_active !== undefined) patch.is_active = body.is_active;
      await admin.from("profiles").update(patch).eq("id", body.user_id);
    }

    if (body.role) {
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      await admin
        .from("user_roles")
        .insert({ user_id: body.user_id, role: body.role });
    }

    if (body.password) {
      await admin.auth.admin.updateUserById(body.user_id, {
        password: body.password,
      });
    }

    if (body.is_active === false) {
      await admin.auth.admin.updateUserById(body.user_id, {
        ban_duration: "876000h",
      });
    } else if (body.is_active === true) {
      await admin.auth.admin.updateUserById(body.user_id, {
        ban_duration: "none",
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
