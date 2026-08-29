import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    
    // If no signature, this is a direct call with session_id (from success page)
    let session: any;
    
    if (!sig) {
      // Direct call from client after successful payment
      const { session_id } = JSON.parse(body);
      if (!session_id) throw new Error("session_id is required");
      
      session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ error: "Payment not completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      // Stripe webhook
      // For now we handle direct calls; webhook signing can be added later
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const tenantId = session.metadata?.tenant_id;
    const userId = session.metadata?.user_id;
    const note = session.metadata?.note || "Paid via Stripe";
    const amount = session.amount_total / 100;

    if (!tenantId || !userId) throw new Error("Missing metadata");

    // Check if this session was already processed
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("note", `Stripe: ${session.id}`)
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({ success: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Fetch tenant details
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*, property:properties(name, address, user_id)")
      .eq("id", tenantId)
      .single();

    if (!tenant) throw new Error("Tenant not found");

    const paymentNote = note ? `Stripe: ${session.id} - ${note}` : `Stripe: ${session.id}`;

    // 1. Record payment
    const { error: paymentError } = await supabase.from("payments").insert({
      tenant_id: tenantId,
      user_id: tenant.property?.user_id || userId,
      amount,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "online_payment",
      note: paymentNote,
    });
    if (paymentError) console.error("Payment insert error:", paymentError);

    // 2. Update tenant balance
    const currentBalance = Number(tenant.balance || 0);
    const newBalance = currentBalance - amount;
    await supabase.from("tenants").update({ balance: newBalance }).eq("id", tenantId);

    // 3. Record in property_income
    const { error: incomeError } = await supabase.from("property_income").insert({
      property_id: tenant.property_id,
      user_id: tenant.property?.user_id || userId,
      unit_id: tenant.unit_id,
      amount,
      category: "Rent",
      frequency: "one-time",
      description: `Online payment by ${tenant.name}`,
    });
    if (incomeError) console.error("Income insert error:", incomeError);

    // 4. Save message for tenant (payment confirmation)
    const propertyManagerId = tenant.property?.user_id;
    const formattedAmount = `$${amount.toLocaleString()}`;
    const paymentDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const tenantMessageBody = `Your rent payment of ${formattedAmount} has been received successfully on ${paymentDate}. Thank you for your prompt payment!\n\nProperty: ${tenant.property?.name || "N/A"}\nPayment Method: Stripe Online Payment\nReference: ${session.id}`;

    await supabase.from("messages").insert({
      tenant_id: tenantId,
      user_id: propertyManagerId || userId,
      sender: "property_manager",
      channel: "email",
      subject: "Payment Received - Confirmation",
      body: tenantMessageBody,
      status: "sent",
    });

    // 5. Send emails via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const currentYear = new Date().getFullYear();

      const emailHtml = (recipientName: string, isAdmin: boolean) => `
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
          <h2 style="margin: 0 0 24px; font-size: 20px; font-weight: 600; color: #111827;">${recipientName}</h2>
          ${isAdmin 
            ? `<p style="font-size: 15px; color: #374151; line-height: 1.7;">A rent payment of <strong>${formattedAmount}</strong> has been received from <strong>${tenant.name}</strong> on ${paymentDate}.</p>
               <p style="font-size: 15px; color: #374151; line-height: 1.7;">Property: ${tenant.property?.name || "N/A"}<br/>Payment Method: Stripe Online Payment<br/>Reference: ${session.id}</p>`
            : `<p style="font-size: 15px; color: #374151; line-height: 1.7;">Your rent payment of <strong>${formattedAmount}</strong> has been received successfully on ${paymentDate}.</p>
               <p style="font-size: 15px; color: #374151; line-height: 1.7;">Property: ${tenant.property?.name || "N/A"}<br/>Payment Method: Stripe Online Payment<br/>Reference: ${session.id}</p>
               <p style="font-size: 15px; color: #374151;">Thank you for your prompt payment!</p>`
          }
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

      // Send to tenant
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Rentt AI <contact@rentt.ai>",
          to: [tenant.email],
          subject: `Payment Confirmation - ${formattedAmount}`,
          html: emailHtml(tenant.name, false),
        }),
      });

      // Send to property manager/admin
      if (propertyManagerId) {
        const { data: pmProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", propertyManagerId)
          .single();
        
        // Get PM email from auth
        const { data: pmUser } = await supabase.auth.admin.getUserById(propertyManagerId);
        
        if (pmUser?.user?.email) {
          const pmName = pmProfile ? `${pmProfile.first_name || ""} ${pmProfile.last_name || ""}`.trim() || "Property Manager" : "Property Manager";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Rentt AI <contact@rentt.ai>",
              to: [pmUser.user.email],
              subject: `Payment Received - ${tenant.name} - ${formattedAmount}`,
              html: emailHtml(pmName, true),
            }),
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[TENANT-PAYMENT-WEBHOOK] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
