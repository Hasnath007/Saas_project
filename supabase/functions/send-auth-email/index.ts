import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }




    const body = await req.json();
    const { to, type, firstName } = body;

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["welcome", "login"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = firstName || "there";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    let subject: string;
    let htmlBody: string;

    if (type === "welcome") {
      subject = "Welcome to Rentt AI! 🎉";
      htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,hsl(207,70%,40%) 0%,hsl(199,87%,68%) 100%);padding:40px 40px 30px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:8px;">
              <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:20px;">📋</span>
              </div>
              <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Rentt AI</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#0a0a0a;">Welcome aboard, ${name}! 🚀</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Your account has been created successfully. You're now ready to manage your properties smarter with AI-powered insights.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#0a0a0a;">Here's what you can do:</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:4px 0;font-size:14px;color:#374151;">✅ &nbsp; Add and manage your properties</td></tr>
                  <tr><td style="padding:4px 0;font-size:14px;color:#374151;">✅ &nbsp; Track tenants and lease details</td></tr>
                  <tr><td style="padding:4px 0;font-size:14px;color:#374151;">✅ &nbsp; Monitor income and expenses</td></tr>
                  <tr><td style="padding:4px 0;font-size:14px;color:#374151;">✅ &nbsp; Get AI-powered portfolio insights</td></tr>
                </table>
              </td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="background:hsl(207,70%,40%);border-radius:10px;text-align:center;">
                <a href="https://renttai.lovable.app/" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">Go to Dashboard →</a>
              </td></tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">
              If you have any questions, just reply to this email. We're here to help!
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© ${now.getFullYear()} Rentt AI · Property Management Made Smarter</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    } else {
      subject = "New sign-in to your Rentt AI account";
      htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,hsl(207,70%,40%) 0%,hsl(199,87%,68%) 100%);padding:40px 40px 30px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:8px;">
              <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:20px;">📋</span>
              </div>
              <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Rentt AI</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#0a0a0a;">Hi ${name} 👋</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              We noticed a new sign-in to your Rentt AI account. Here are the details:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;width:80px;">Date</td>
                    <td style="padding:6px 0;font-size:14px;color:#0a0a0a;font-weight:500;">${dateStr}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;">Time</td>
                    <td style="padding:6px 0;font-size:14px;color:#0a0a0a;font-weight:500;">${timeStr}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#6b7280;">Account</td>
                    <td style="padding:6px 0;font-size:14px;color:#0a0a0a;font-weight:500;">${to}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
              If this was you, no action is needed. If you didn't sign in, please reset your password immediately.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="background:hsl(207,70%,40%);border-radius:10px;text-align:center;">
                <a href="https://renttai.lovable.app/" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">Go to Dashboard →</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© ${now.getFullYear()} Rentt AI · Property Management Made Smarter</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@rentt.ai",
        to: [to],
        subject,
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
