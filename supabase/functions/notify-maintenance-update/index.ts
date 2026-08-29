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

    // Authenticate the caller (property manager)
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const { requestId, updateType, newStatus, vendorName, changes } = await req.json();
    if (!requestId || !updateType) throw new Error("Missing required fields");

    // Use service role client for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the maintenance request with property, unit, and tenant info
    const { data: request, error: reqError } = await supabase
      .from("maintenance_requests")
      .select(`
        *,
        properties:property_id (name),
        units:unit_id (unit_number, current_tenant)
      `)
      .eq("id", requestId)
      .single();

    if (reqError || !request) throw new Error("Maintenance request not found");

    // Find the tenant by property_id and unit_id to get their email
    const query = supabase
      .from("tenants")
      .select("id, name, email")
      .eq("property_id", request.property_id)
      .eq("status", "active");

    if (request.unit_id) {
      query.eq("unit_id", request.unit_id);
    }

    const { data: tenant } = await query.maybeSingle();

    if (!tenant || !tenant.email) {
      // No tenant to notify — still return success
      return new Response(JSON.stringify({ success: true, message: "No tenant to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Build update description
    let updateDescription = "";
    let subjectLine = "";

    switch (updateType) {
      case "status_change":
        const statusLabel = newStatus === "in_progress" ? "In Progress" : newStatus === "completed" ? "Completed" : "Pending";
        updateDescription = `The status of your maintenance request has been updated to <strong>${statusLabel}</strong>.`;
        subjectLine = `Maintenance Update: Status changed to ${statusLabel}`;
        break;
      case "vendor_assigned":
        updateDescription = `A vendor has been assigned to your maintenance request: <strong>${vendorName || "A vendor"}</strong>.`;
        subjectLine = `Maintenance Update: Vendor Assigned`;
        break;
      case "edited":
        updateDescription = `Your maintenance request has been updated by the property manager.`;
        if (changes) {
          updateDescription += `<br/><br/>Changes: ${changes}`;
        }
        subjectLine = `Maintenance Update: Request Updated`;
        break;
      default:
        updateDescription = `Your maintenance request has been updated.`;
        subjectLine = `Maintenance Update`;
    }

    const propertyName = (request.properties as any)?.name || "N/A";
    const unitNumber = (request.units as any)?.unit_number || "N/A";
    const formattedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const currentYear = new Date().getFullYear();
    const statusColor = request.status === "completed" ? "#22c55e" : request.status === "in_progress" ? "#f59e0b" : "#3b82f6";

    // Save message in messages table
    const messageBody = `Maintenance Update\n\nRequest: ${request.title}\n${updateDescription.replace(/<[^>]*>/g, '')}\nProperty: ${propertyName}\nUnit: ${unitNumber}\nDate: ${formattedDate}`;

    await supabase.from("messages").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      sender: "property_manager",
      channel: "email",
      subject: subjectLine,
      body: messageBody,
      status: "sent",
    });

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
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
          <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #111827;">${tenant.name}</h2>
          <p style="font-size: 15px; color: #374151; line-height: 1.7;">${updateDescription}</p>
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Request</td><td style="padding: 10px 12px; font-size: 14px; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb;">${request.title}</td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Status</td><td style="padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #e5e7eb;"><span style="background-color: ${statusColor}; color: #ffffff; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: capitalize;">${request.status === "in_progress" ? "In Progress" : request.status}</span></td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Property</td><td style="padding: 10px 12px; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${propertyName}</td></tr>
            <tr><td style="padding: 10px 12px; font-size: 14px; color: #6b7280;">Unit</td><td style="padding: 10px 12px; font-size: 14px; color: #111827;">${unitNumber}</td></tr>
          </table>
          <p style="font-size: 13px; color: #9ca3af; margin-top: 16px;">Updated on ${formattedDate}</p>
        </td></tr>
        <tr><td style="background-color: #ffffff; padding: 0 40px;"><hr style="border: none; border-top: 1px solid #e5e7eb;" /></td></tr>
        <tr><td style="background-color: #ffffff; border-radius: 0 0 12px 12px; padding: 24px 40px; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Sent via Rentt AI &mdash; Smart Property Management</p>
          <p style="margin: 0; font-size: 11px; color: #d1d5db;">&copy; ${currentYear} Rentt AI. All rights reserved.</p>
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
          to: [tenant.email],
          subject: subjectLine,
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
    console.error("[NOTIFY-MAINTENANCE-UPDATE] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
