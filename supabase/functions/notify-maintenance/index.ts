import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const { title, description, priority, propertyName, unitNumber, tenantName } = await req.json();
    if (!title || !description) throw new Error("Missing required fields");

    // Use service role client for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the tenant record to find property manager
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, property_id, property:properties(user_id, name, address)")
      .eq("email", user.email)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tenant) throw new Error("Tenant record not found");

    const propertyManagerId = (tenant.property as any)?.user_id;
    if (!propertyManagerId) throw new Error("Property manager not found");

    // Get PM email and profile
    const { data: pmUser } = await supabase.auth.admin.getUserById(propertyManagerId);
    const { data: pmProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", propertyManagerId)
      .single();

    const pmEmail = pmUser?.user?.email;
    const pmName = pmProfile ? `${pmProfile.first_name || ""} ${pmProfile.last_name || ""}`.trim() || "Property Manager" : "Property Manager";
    const displayPropertyName = propertyName || (tenant.property as any)?.name || "N/A";
    const displayUnit = unitNumber ? `Unit ${unitNumber}` : "N/A";
    const displayTenant = tenantName || user.email;
    const formattedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    // 1. Save message in messages table
    const messageBody = `New Maintenance Request Submitted\n\nTitle: ${title}\nDescription: ${description}\nPriority: ${priority || "medium"}\nProperty: ${displayPropertyName}\nUnit: ${displayUnit}\nSubmitted by: ${displayTenant}\nDate: ${formattedDate}`;

    await supabase.from("messages").insert({
      tenant_id: tenant.id,
      user_id: propertyManagerId,
      sender: "tenant",
      channel: "email",
      subject: `Maintenance Request: ${title}`,
      body: messageBody,
      status: "sent",
    });

    // 2. Send email to PM via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY && pmEmail) {
      const currentYear = new Date().getFullYear();
      const priorityColor = priority === "high" ? "#dc2626" : priority === "medium" ? "#f59e0b" : "#22c55e";

      const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
        <tr><td style="background: linear-gradient(135deg, #1a6bab, #5bb8e8); border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">Rentt AI</h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">Property Management</p>
        </td></tr>
        <tr><td style="background-color: #ffffff; padding: 40px;">
          <p style="margin: 0 0 6px; font-size: 14px; color: #6b7280;">Hello,</p>
          <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #111827;">${pmName}</h2>
          <p style="font-size: 15px; color: #374151; line-height: 1.7;">A new maintenance request has been submitted by <strong>${displayTenant}</strong>.</p>
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Title</td><td style="padding: 10px 12px; font-size: 14px; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb;">${title}</td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Priority</td><td style="padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #e5e7eb;"><span style="background-color: ${priorityColor}; color: #ffffff; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: capitalize;">${priority || "medium"}</span></td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Property</td><td style="padding: 10px 12px; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${displayPropertyName}</td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Unit</td><td style="padding: 10px 12px; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${displayUnit}</td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280;">Description</td><td style="padding: 10px 12px; font-size: 14px; color: #111827;">${description}</td></tr>
          </table>
          <p style="font-size: 13px; color: #9ca3af; margin-top: 16px;">Submitted on ${formattedDate}</p>
        </td></tr>
        <tr><td style="background-color: #ffffff; padding: 0 40px;"><hr style="border: none; border-top: 1px solid #e5e7eb;" /></td></tr>
        <tr><td style="background-color: #ffffff; border-radius: 0 0 12px 12px; padding: 24px 40px; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Sent via Rentt AI — Smart Property Management</p>
          <p style="margin: 0; font-size: 11px; color: #d1d5db;">© ${currentYear} Rentt AI. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to: [pmEmail],
          subject: `New Maintenance Request: ${title} - ${displayTenant}`,
          html: htmlBody,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[NOTIFY-MAINTENANCE] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
