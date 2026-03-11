import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
  outreach_queue_id?: string;
}

async function sendViaResend(payload: SendEmailPayload) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured — set in Supabase secrets");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: payload.from || "OCULOPS <noreply@oculops.com>",
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.reply_to || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }

  return await res.json();
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<SendEmailPayload>(req);

    if (!body.to || !body.subject || !body.html) {
      return errorResponse("to, subject, and html are required");
    }

    const result = await sendViaResend(body);

    // Update outreach_queue status if linked
    if (body.outreach_queue_id) {
      await admin
        .from("outreach_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: { resend_id: result.id },
        })
        .eq("id", body.outreach_queue_id);
    }

    return jsonResponse({
      ok: true,
      provider: "resend",
      id: result.id,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Email send failed",
      500,
    );
  }
});
