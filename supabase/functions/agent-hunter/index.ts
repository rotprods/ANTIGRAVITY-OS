import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// HUNTER — Lead Qualification + Strategic Brief (merged: Hunter + Strategist)
// Actions: cycle (qualify + brief top leads) | qualify_only | strategy_only
// ═══════════════════════════════════════════════════════════════════════════════

import { runAgentTask, sendAgentMessage } from "../_shared/agents.ts";
import { qualifyLead, buildStrategicBrief } from "../_shared/lead-intel.ts";
import { compact, errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

async function loadCandidateLeads({
  scanId,
  userId,
  limit,
}: {
  scanId?: string | null;
  userId?: string | null;
  limit: number;
}) {
  let query = admin
    .from("prospector_leads")
    .select("*")
    .neq("status", "dismissed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (scanId) query = query.eq("scan_id", scanId);
  if (userId) query = query.eq("user_id", userId);
  else query = query.is("user_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
      scan_id?: string;
      user_id?: string;
      limit?: number;
    }>(req);

    const action = body.action || "cycle";
    const limit = Math.max(1, Math.min(50, body.limit || 15));

    const result = await runAgentTask({
      codeName: "hunter",
      action,
      title: `HUNTER ${action}`,
      payload: body as Record<string, unknown>,
      handler: async () => {
        const leads = await loadCandidateLeads({
          scanId: body.scan_id || null,
          userId: body.user_id || null,
          limit,
        });

        const qualified = [];

        for (const lead of leads) {
          const qualification = await qualifyLead(lead);
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
              email: qualification.email || lead.email || null,
              role: qualification.role || lead.role || null,
              contact_name: qualification.contactName || lead.contact_name || null,
              raw_payload: {
                ...(lead.raw_payload as Record<string, unknown> || {}),
                qualification,
              },
              data: {
                ...(lead.data as Record<string, unknown> || {}),
                qualification,
              },
            })
            .eq("id", lead.id)
            .select()
            .single();

          if (error) throw error;
          qualified.push(data);
        }

        const shortlist = [...qualified]
          .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
          .slice(0, 10);

        // ── Strategic Brief (merged from Strategist) ──
        // Auto-brief top qualified leads (score >= 72)
        const briefedLeads = shortlist.filter(l => (l.ai_score || 0) >= 72);
        const briefs = [];

        for (const lead of briefedLeads.slice(0, 5)) {
          try {
            const brief = await buildStrategicBrief(lead);
            await admin
              .from("prospector_leads")
              .update({
                ai_reasoning: [
                  compact(lead.ai_reasoning),
                  brief.positioning,
                  ...(brief.pain_points || []),
                ].filter(Boolean).join(" "),
                raw_payload: {
                  ...(lead.raw_payload as Record<string, unknown> || {}),
                  strategist: brief,
                },
                data: {
                  ...(lead.data as Record<string, unknown> || {}),
                  strategist: brief,
                },
              })
              .eq("id", lead.id);
            briefs.push({ lead_id: lead.id, lead_name: lead.name, brief });
          } catch {
            // Brief failed for this lead — continue with others
          }
        }

        if (briefs.length > 0) {
          await sendAgentMessage("hunter", "outreach", "Qualified leads with strategic briefs ready", {
            leads: briefs.map(b => ({
              lead_id: b.lead_id,
              recommended_channel: b.brief.recommended_channel,
            })),
          });
        }

        return {
          total_reviewed: qualified.length,
          qualified_count: qualified.filter(lead => (lead.ai_score || 0) >= 72).length,
          briefs_generated: briefs.length,
          shortlist,
        };
      },
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "HUNTER failed", 500);
  }
});
