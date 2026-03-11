import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";
import { analyzeWebsiteMarkup, qualifyLead } from "../_shared/lead-intel.ts";
import { loadLeadById } from "../_shared/prospector.ts";

async function fetchWebsiteAnalysis(website: string | null | undefined) {
  if (!website) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(website, {
      headers: {
        "User-Agent": "OCULOPS-OS/1.0 (+https://oculops.os)",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const html = await response.text();
    return analyzeWebsiteMarkup(website, html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await readJson<{
      lead_id?: string;
      lead?: Record<string, unknown>;
    }>(req);

    const lead = body.lead_id ? await loadLeadById(body.lead_id) : body.lead;
    if (!lead) {
      return errorResponse("lead_id or lead payload is required");
    }

    const analysis = (lead.raw_payload as Record<string, unknown> | undefined)?.analysis
      || await fetchWebsiteAnalysis(typeof lead.website === "string" ? lead.website : null);
    const qualification = await qualifyLead(lead, analysis as any);

    let updatedLead = null;
    if (body.lead_id) {
      const { data, error } = await admin
        .from("prospector_leads")
        .update({
          status: qualification.status,
          score: qualification.aiScore,
          ai_score: qualification.aiScore,
          ai_reasoning: qualification.reasoning,
          estimated_deal_value: qualification.estimatedDealValue,
          social_profiles: qualification.socialProfiles,
          tech_stack: qualification.techStack,
          email: qualification.email,
          role: qualification.role,
          contact_name: qualification.contactName,
          raw_payload: {
            ...(lead.raw_payload as Record<string, unknown> || {}),
            analysis,
            qualification,
          },
          data: {
            ...(lead.data as Record<string, unknown> || {}),
            analysis,
            qualification,
          },
        })
        .eq("id", body.lead_id)
        .select()
        .single();

      if (error) throw error;
      updatedLead = data;
    }

    // Emit lead.qualified event if score >= 72
    if (qualification.aiScore >= 72 && body.lead_id) {
      try {
        await admin.from("event_log").insert({
          event_type: "lead.qualified",
          payload: {
            lead_id: body.lead_id,
            score: qualification.aiScore,
            status: qualification.status,
            contact_name: qualification.contactName,
            email: qualification.email,
            estimated_deal_value: qualification.estimatedDealValue,
          },
          user_id: (lead as Record<string, unknown>).user_id || null,
        });
      } catch (eventError) {
        console.error("[ai-qualifier] Failed to emit lead.qualified:", eventError);
      }
    }

    return jsonResponse({
      ok: true,
      qualification,
      lead: updatedLead,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Qualification failed", 500);
  }
});
