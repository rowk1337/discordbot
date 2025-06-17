import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // Get request body
    const { recipient, subject, content, setup_url, user_name } = await req.json();

    // Validate required fields
    if (!recipient || !setup_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create email content if not provided
    const emailContent = content || `Hello ${user_name || "there"},

Thank you for joining our application. To complete your account setup, please click the link below:

${setup_url}

This link will expire in 7 days. If you did not request this account, please ignore this email.

Best regards,
The PayTracker Team`;

    const emailSubject = subject || "Complete Your Account Setup";

    // For now, we'll log the email attempt since no email service is configured
    // In a production environment, you would integrate with a service like Resend, SendGrid, etc.
    console.log("Email would be sent to:", recipient);
    console.log("Subject:", emailSubject);
    console.log("Content:", emailContent);

    // Log the email attempt in the database
    const { error: logError } = await supabase.from("email_logs").insert({
      recipient_email: recipient,
      subject: emailSubject,
      content: emailContent,
      status: "pending", // Mark as pending since we're not actually sending
      sent_at: null, // No sent time since we're not sending
    });

    if (logError) {
      console.error("Error logging email:", logError);
    }

    // Return success response indicating the email was "queued" for sending
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email queued for sending. Setup link is available for manual sharing.",
        note: "Email service not configured - setup link should be shared manually"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});