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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { email, type } = body;

    if (!email || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["signup", "password_reset"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid OTP type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invalidate any existing unused codes for this email+type
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("email", email.toLowerCase())
      .eq("type", type)
      .eq("used", false);

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        email: email.toLowerCase(),
        code,
        type,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to generate OTP" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentYear = new Date().getFullYear();
    const isSignup = type === "signup";

    const subject = isSignup
      ? "Verify your email – Rentt AI"
      : "Password reset code – Rentt AI";

    const heading = isSignup
      ? "Verify Your Email"
      : "Reset Your Password";

    const description = isSignup
      ? "Thanks for signing up! Enter this verification code to activate your account."
      : "We received a request to reset your password. Use the code below to proceed.";

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a6bab,#5bb8e8);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Rentt AI</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:0.5px;">Property Management</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;">
            <h2 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;">${heading}</h2>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">${description}</p>
            <!-- OTP Code -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#f0f7ff;border:2px dashed #1a6bab;border-radius:12px;padding:24px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Verification Code</p>
                  <p style="margin:0;font-size:36px;font-weight:700;color:#1a6bab;letter-spacing:8px;font-family:monospace;">${code}</p>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">
              This code expires in <strong>10 minutes</strong>. If you didn't request this, please ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#ffffff;border-radius:0 0 12px 12px;padding:24px 40px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Sent via Rentt AI &mdash; Smart Property Management</p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">&copy; ${currentYear} Rentt AI. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
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
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    console.log("📧 send-otp: Sending email to:", email);
    console.log("📧 send-otp: From address: onboarding@rentt.ai");
    console.log("📧 send-otp: Response status:", resendRes.status);

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ error: resendData.message || "Failed to send OTP" }),
        { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
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
