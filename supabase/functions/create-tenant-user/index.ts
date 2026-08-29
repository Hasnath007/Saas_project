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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is authenticated and has admin/property_manager role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the requesting user has admin or property_manager role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "User role not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (roleData.role !== "admin" && roleData.role !== "property_manager") {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, password, firstName, lastName, propertyName, propertyAddress } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating tenant account for: ${email}`);

    // First check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    let userId: string | null = null;
    let isExistingUser = false;
    
    if (!listError && existingUsers) {
      const existingUser = existingUsers.users.find(u => u.email === email);
      if (existingUser) {
        console.log(`User already exists with ID: ${existingUser.id}, updating password`);
        isExistingUser = true;
        userId = existingUser.id;
        
        // Update the existing user's password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName || existingUser.user_metadata?.first_name || "",
            last_name: lastName || existingUser.user_metadata?.last_name || "",
          },
        });
        
        if (updateError) {
          console.error("Error updating user:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // If user doesn't exist, create new one
    if (!isExistingUser) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName || "",
          last_name: lastName || "",
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`User created with ID: ${newUser.user.id}`);
      userId = newUser.user.id;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Failed to create or find user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete any existing role for this user (in case profile trigger created one)
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // Set the user role to tenant
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "tenant",
      });

    if (roleInsertError) {
      console.error("Error setting user role:", roleInsertError);
      // Don't fail the whole operation, just log the error
    }

    console.log(`Tenant role assigned successfully for user: ${userId}`);

    // Send welcome email with credentials
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const tenantName = `${firstName || ""} ${lastName || ""}`.trim() || "Tenant";
      const currentYear = new Date().getFullYear();
      const loginUrl = "https://renttai.lovable.app/login";

      const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <!-- Header -->
        <tr><td style="background: linear-gradient(135deg, #1a6bab, #5bb8e8); border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Rentt AI</h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); letter-spacing: 0.5px;">Property Management</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background-color: #ffffff; padding: 40px;">
          <p style="margin: 0 0 6px; font-size: 14px; color: #6b7280;">Welcome!</p>
          <h2 style="margin: 0 0 24px; font-size: 22px; font-weight: 600; color: #111827;">Hello, ${tenantName}! 🎉</h2>
          
          <p style="font-size: 15px; color: #374151; line-height: 1.7; margin: 0 0 20px;">
            Great news! Your property manager has granted you access to the <strong>Rentt AI Tenant Portal</strong>. 
            You can now view your lease details, payment history, submit maintenance requests, and more — all in one place.
          </p>

          ${propertyName || propertyAddress ? `
          <div style="background-color: #f0f9ff; border-left: 4px solid #1a6bab; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 0 0 24px;">
            <p style="margin: 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Your Property</p>
            <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #111827;">${propertyName || ""}${propertyAddress ? ` — ${propertyAddress}` : ""}</p>
          </div>
          ` : ""}

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #111827;">Your Login Credentials</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 100px;">Email:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #111827;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 100px;">Password:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #111827;">${password}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #ef4444; margin: 0 0 24px;">
            ⚠️ For your security, please change your password after your first login.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding: 0 0 24px;">
              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1a6bab, #5bb8e8); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">
                Log In to Your Portal →
              </a>
            </td></tr>
          </table>

          <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0;">
            If you have any questions, feel free to reach out to your property manager directly through the portal's communications feature.
          </p>
        </td></tr>
        <!-- Divider -->
        <tr><td style="background-color: #ffffff; padding: 0 40px;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" /></td></tr>
        <!-- Footer -->
        <tr><td style="background-color: #ffffff; border-radius: 0 0 12px 12px; padding: 24px 40px; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Sent via Rentt AI — Smart Property Management</p>
          <p style="margin: 0; font-size: 11px; color: #d1d5db;">© ${currentYear} Rentt AI. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [email],
            subject: "Welcome to Rentt AI — Your Tenant Portal Access",
            html: htmlBody,
          }),
        });

        if (!resendRes.ok) {
          const errData = await resendRes.json();
          console.error("Failed to send welcome email:", errData);
        } else {
          console.log("Welcome email sent successfully to:", email);
        }
      } catch (emailErr) {
        console.error("Error sending welcome email:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isExistingUser ? "Tenant account updated successfully" : "Tenant account created successfully",
        userId: userId 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
