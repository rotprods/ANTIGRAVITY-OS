import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "OCULOPS <noreply@oculops.com>";

// ── Branded OCULOPS welcome email ──
function buildWelcomeHTML(name: string): string {
  const displayName = name || "Operator";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:32px 0;text-align:center;">
          <div style="display:inline-block;background:#0D0D0D;border:1px solid #2A2A2A;padding:12px 24px;">
            <span style="font-size:24px;font-weight:800;color:#FFD400;letter-spacing:0.1em;">OCULOPS</span>
            <span style="font-size:12px;color:#9CA3AF;margin-left:12px;letter-spacing:0.2em;">OS v10</span>
          </div>
        </td></tr>

        <!-- Gold accent line -->
        <tr><td style="height:1px;background:linear-gradient(to right,transparent,#FFD400,transparent);"></td></tr>

        <!-- Main content -->
        <tr><td style="padding:48px 32px;background:#0D0D0D;border:1px solid #2A2A2A;border-top:none;">
          <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#fff;letter-spacing:-0.02em;">
            Welcome, <span style="color:#FFD400;font-weight:700;">${displayName}</span>
          </h1>
          <p style="margin:0 0 32px;font-size:14px;color:#9CA3AF;line-height:1.6;">
            Your OCULOPS account is now active. The Autonomous Growth Operating System is ready to deploy.
          </p>

          <!-- Status KPIs -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="padding:16px;background:#000;border:1px solid #2A2A2A;width:33%;text-align:center;">
                <div style="font-size:10px;color:#9CA3AF;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">STATUS</div>
                <div style="font-size:16px;font-weight:700;color:#FFD400;">ACTIVE</div>
              </td>
              <td style="padding:16px;background:#000;border:1px solid #2A2A2A;border-left:none;width:33%;text-align:center;">
                <div style="font-size:10px;color:#9CA3AF;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">AGENTS</div>
                <div style="font-size:16px;font-weight:700;color:#fff;">STANDBY</div>
              </td>
              <td style="padding:16px;background:#000;border:1px solid #2A2A2A;border-left:none;width:33%;text-align:center;">
                <div style="font-size:10px;color:#9CA3AF;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">CLEARANCE</div>
                <div style="font-size:16px;font-weight:700;color:#fff;">FULL</div>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="https://oculops.com" style="display:inline-block;background:#FFD400;color:#000;font-size:13px;font-weight:700;letter-spacing:0.1em;text-decoration:none;padding:14px 40px;text-transform:uppercase;">
                LAUNCH COMMAND CENTER &rarr;
              </a>
            </td></tr>
          </table>

          <p style="margin:32px 0 0;font-size:12px;color:#4B5563;line-height:1.6;">
            Your AI agents are waiting for initialization. Set up your organization, configure your first agent, and start autonomous operations.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px;text-align:center;">
          <p style="margin:0;font-size:10px;color:#4B5563;letter-spacing:0.15em;text-transform:uppercase;">
            OCULOPS &mdash; AUTONOMOUS GROWTH OPERATING SYSTEM
          </p>
          <p style="margin:8px 0 0;font-size:10px;color:#374151;">
            This email was sent because you created an OCULOPS account.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const payload = await req.json();

    // Support both database webhook payload and direct calls
    const record = payload.record || payload;
    const email = record.email;
    const fullName = record.raw_user_meta_data?.full_name || record.full_name || "";
    const userId = record.id || record.user_id;

    if (!email) {
      return errorResponse("No email provided");
    }

    if (!RESEND_API_KEY) {
      return errorResponse("RESEND_API_KEY not configured", 500);
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "Welcome to OCULOPS — Your Command Center Awaits",
        html: buildWelcomeHTML(fullName),
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend API error ${resendRes.status}: ${err}`);
    }

    const result = await resendRes.json();

    // Log to event_log
    await admin.from("event_log").insert({
      event_type: "user.welcome_email_sent",
      payload: { user_id: userId, email, resend_id: result.id },
    });

    return jsonResponse({ ok: true, email, resend_id: result.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Welcome email failed";
    return errorResponse(message, 500);
  }
});
