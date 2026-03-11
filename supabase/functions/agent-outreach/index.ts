import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { runAgentTask } from "../_shared/agents.ts";
import { errorResponse, handleCors, jsonResponse, readJson, compact } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

function inferEmailFromWebsite(website: string | null | undefined) {
  const value = compact(website);
  if (!value) return null;

  try {
    const hostname = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./i, "");
    return `info@${hostname}`;
  } catch {
    return null;
  }
}

function buildEmailDraft(lead: Record<string, unknown>) {
  const name = compact(lead.contact_name) || compact(lead.name) || "equipo";
  const company = compact(lead.name) || compact(lead.business_name) || "tu negocio";
  const niche = compact(lead.category) || "local";
  const subject = `Idea rápida para escalar ${company}`;
  const html_body = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <p>Hola ${name.split(/\s+/)[0]},</p>
      <p>He analizado ${company} con Atlas y veo una oportunidad clara para automatizar captación, respuesta y seguimiento comercial.</p>
      <p>El potencial estimado para este tipo de negocio está alrededor de <strong>${lead.estimated_deal_value || 1500}€/mes</strong> si se conecta web, canal de mensajería y CRM en el mismo flujo.</p>
      <p>Si tiene sentido, te enseño en 10 minutos qué montar primero y dónde está el mayor retorno.</p>
      <p>Un saludo,<br/>Roberto</p>
    </div>
  `.trim();

  return {
    niche,
    subject,
    html_body,
  };
}

async function existingQueueRow(leadId: string) {
  const { data, error } = await admin
    .from("outreach_queue")
    .select("*")
    .eq("lead_id", leadId)
    .in("status", ["staged", "approved", "sent", "replied"])
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function stageOutreachForLead(lead: Record<string, unknown>) {
  const recipientEmail = compact(lead.email) || inferEmailFromWebsite(compact(lead.website));
  if (!recipientEmail) return null;

  const existing = await existingQueueRow(String(lead.id));
  if (existing) return existing;

  const draft = buildEmailDraft(lead);
  const { data, error } = await admin
    .from("outreach_queue")
    .insert({
      lead_id: lead.id,
      contact_id: lead.contact_id || null,
      template_type: "cold",
      niche: draft.niche,
      recipient_name: compact(lead.contact_name) || compact(lead.name),
      recipient_email: recipientEmail,
      subject: draft.subject,
      html_body: draft.html_body,
      status: "staged",
    })
    .select("*, prospector_leads(*)")
    .single();

  if (error) throw error;
  return data;
}

async function loadLeadsForOutreach(userId: string | null, limit: number, niche?: string | null) {
  let query = admin
    .from("prospector_leads")
    .select("*")
    .in("status", ["qualified", "pursuing", "promoted"])
    .order("ai_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);
  else query = query.is("user_id", null);
  if (niche) query = query.ilike("category", `%${niche}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function listEmails(status: string) {
  const { data, error } = await admin
    .from("outreach_queue")
    .select("*, prospector_leads(*)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getStats() {
  const { data, error } = await admin
    .from("outreach_queue")
    .select("status");

  if (error) throw error;
  const rows = data || [];

  return {
    staged: rows.filter(row => row.status === "staged").length,
    approved: rows.filter(row => row.status === "approved").length,
    sent: rows.filter(row => row.status === "sent").length,
    replied: rows.filter(row => row.status === "replied").length,
    total: rows.length,
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<{
      action?: string;
      id?: string;
      status?: string;
      niche?: string;
      user_id?: string;
      limit?: number;
    }>(req);

    const action = body.action || "list";

    if (action === "list") {
      return jsonResponse({
        ok: true,
        emails: await listEmails(body.status || "staged"),
      });
    }

    if (action === "stats") {
      return jsonResponse({
        ok: true,
        stats: await getStats(),
      });
    }

    if (action === "approve") {
      const { data, error } = await admin
        .from("outreach_queue")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", body.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ ok: true, email: data });
    }

    if (action === "skip") {
      const { data, error } = await admin
        .from("outreach_queue")
        .update({
          status: "skipped",
        })
        .eq("id", body.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ ok: true, email: data });
    }

    if (action === "send") {
      // Send an approved outreach email via messaging-dispatch or send-email fallback
      const { data: email, error: fetchError } = await admin
        .from("outreach_queue")
        .select("*")
        .eq("id", body.id)
        .eq("status", "approved")
        .single();

      if (fetchError || !email) {
        return errorResponse("Approved email not found", 404);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      // Try send-email (Resend) as fallback for cold outreach
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: email.recipient_email,
          subject: email.subject,
          html: email.html_body,
          outreach_queue_id: email.id,
        }),
      });

      const sendResult = await sendRes.json();

      if (!sendRes.ok) {
        return errorResponse(sendResult.error || "Send failed", 502);
      }

      return jsonResponse({ ok: true, sent: true, result: sendResult });
    }

    if (action === "batch_approve") {
      let query = admin
        .from("outreach_queue")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("status", "staged");

      if (body.niche) query = query.eq("niche", body.niche);
      const { data, error } = await query.select();
      if (error) throw error;

      return jsonResponse({
        ok: true,
        approved_count: (data || []).length,
      });
    }

    const generated = await runAgentTask({
      codeName: "outreach",
      action,
      title: `OUTREACH ${action}`,
      payload: body as Record<string, unknown>,
      handler: async () => {
        const leads = await loadLeadsForOutreach(body.user_id || null, Math.max(1, Math.min(30, body.limit || 12)), body.niche || null);
        const staged = [];

        for (const lead of leads) {
          const item = await stageOutreachForLead(lead);
          if (item) staged.push(item);
        }

        return {
          staged_count: staged.length,
          emails: staged,
        };
      },
    });

    return jsonResponse(generated);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "OUTREACH failed", 500);
  }
});
