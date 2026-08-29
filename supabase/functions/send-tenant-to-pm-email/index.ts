import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { subject, message, tenantName, pmUserId, propertyName } = body;

    if (!subject || !message || !pmUserId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subject, message, pmUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subject.length > 200 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Subject or message exceeds maximum length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up PM email using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pmUser, error: pmError } = await serviceClient.auth.admin.getUserById(pmUserId);
    if (pmError || !pmUser?.user?.email) {
      console.error("Could not find PM email:", pmError);
      return new Response(JSON.stringify({ error: "Could not find property manager email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pmEmail = pmUser.user.email;
    const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
    const currentYear = new Date().getFullYear();

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #1a6bab, #5bb8e8); border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Rentt AI</h1>
              <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.85); letter-spacing: 0.5px;">Tenant Message</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 40px 32px;">
              <p style="margin: 0 0 6px; font-size: 14px; color: #6b7280;">New message from tenant:</p>
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">${tenantName || 'Tenant'}</h2>
              ${propertyName ? `<p style="margin: 0 0 24px; font-size: 13px; color: #6b7280;">Property: ${propertyName}</p>` : ''}
              <div style="background-color: #f9fafb; border-left: 4px solid #1a6bab; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #374151;">Subject: ${subject}</p>
                <div style="line-height: 1.7; font-size: 15px; color: #374151;">${escapedMessage}</div>
              </div>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">Log in to your dashboard to reply to this message.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; border-radius: 0 0 12px 12px; padding: 24px 40px 32px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">Sent via Rentt AI &mdash; Smart Property Management</p>
              <p style="margin: 0; font-size: 11px; color: #d1d5db;">&copy; ${currentYear} Rentt AI. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [pmEmail],
        subject: `[Tenant Message] ${subject}`,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ error: resendData.message || "Failed to send email" }),
        { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
