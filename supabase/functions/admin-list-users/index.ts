import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create user client to verify the requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the requesting user is an admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleError || !roleData || roleData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can list users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all users from auth.users using admin API
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("Error fetching auth users:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Fetch user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("*");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    // Combine data
    const usersWithDetails = authUsers.users.map(authUser => {
      const profile = profiles?.find(p => p.user_id === authUser.id);
      const userRole = roles?.find(r => r.user_id === authUser.id);
      
      return {
        id: userRole?.id || authUser.id,
        user_id: authUser.id,
        email: authUser.email || "N/A",
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        role: userRole?.role || "property_manager",
        created_at: userRole?.created_at || authUser.created_at,
      };
    });

    return new Response(
      JSON.stringify({ users: usersWithDetails }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
