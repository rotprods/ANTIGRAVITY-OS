import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// HUNTER — Lead Qualification + Strategic Brief (merged: Hunter + Strategist)
// Actions: cycle (qualify + brief top leads) | qualify_only | strategy_only
//
// v2: Uses agent-brain-v2 for post-qualification reasoning.
//     Core flow: load leads → qualifyLead → buildStrategicBrief → brain reasoning
//     (store insights, create signals, decide outreach strategy).
// ═══════════════════════════════════════════════════════════════════════════════

import { runBrain } from "../_shared/agent-brain-v2.ts";
import { qualifyLead, buildStrategicBrief } from "../_shared/lead-intel.ts";
import { compact, errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const AGENT_CODE = "hunter";

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

  const startTime = Date.now();

  try {
    const body = await readJson<{
      action?: string;
      scan_id?: string;
      user_id?: string;
      limit?: number;
      task_id?: string;
    }>(req);

    const action = body.action || "cycle";
    const limit = Math.max(1, Math.min(20, body.limit || 3));
    const { task_id } = body;

    // ── Agent lifecycle: start ──
    const { data: agent } = await admin
      .from("agent_registry")
      .select("*")
      .eq("code_name", AGENT_CODE)
      .single();
    if (!agent) throw new Error("Agent not found");

    await admin
      .from("agent_registry")
      .update({ status: "running", last_run_at: new Date().toISOString() })
      .eq("id", agent.id);

    if (task_id)
      await admin
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task_id);

    // ── 1. Load candidate leads ──
    const leads = await loadCandidateLeads({
      scanId: body.scan_id || null,
      userId: body.user_id || null,
      limit,
    });

    // ── 2. Qualify each lead (deterministic + AI scoring) ──
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

    // ── 3. Strategic Brief for top qualified leads (score >= 72) ──
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

    // ── 4. Brain-v2: post-qualification reasoning ──
    const brainResult = await runBrain({
      agent: "hunter",
      goal: `Analyze the lead qualification results and take strategic action:

1. Review the ${qualified.length} qualified leads. Identify patterns: which sectors score highest? Which have the best deal potential?
2. For the top ${briefs.length} briefed leads, assess if they should go to OUTREACH immediately or need more research.
3. Store a qualification summary in memory (store_memory): sector patterns, avg score, avg deal value, best lead.
4. If any lead scores above 85 with deal value >€3000, create a signal about this high-value opportunity.
5. If the overall batch quality is low (avg score <50), create a task to refine the prospecting zone.

Provide a concise summary of findings and recommended next actions.`,
      context: {
        total_reviewed: qualified.length,
        qualified_count: qualified.filter(l => (l.ai_score || 0) >= 72).length,
        briefs_generated: briefs.length,
        avg_score: qualified.length > 0
          ? Math.round(qualified.reduce((s, l) => s + (l.ai_score || 0), 0) / qualified.length)
          : 0,
        avg_deal_value: qualified.length > 0
          ? Math.round(qualified.reduce((s, l) => s + (l.estimated_deal_value || 0), 0) / qualified.length)
          : 0,
        top_leads: shortlist.slice(0, 5).map((l) => ({
          name: l.name,
          score: l.ai_score,
          value: l.estimated_deal_value,
          category: l.category,
          has_brief: briefs.some((b) => b.lead_id === l.id),
        })),
        briefs_summary: briefs.map((b) => ({
          name: b.lead_name,
          channel: b.brief.recommended_channel,
          positioning: b.brief.positioning?.slice(0, 100),
        })),
      },
      systemPromptExtra: `You are HUNTER: the qualifier. You separate gold from noise.
Be data-driven. Reference actual scores, sectors, and deal values from the context.
Think about ROI — which leads will close fastest with the highest value?`,
      maxRounds: 3,
    }).catch((e) => ({
      ok: false,
      answer: `Brain error: ${e.message}`,
      skills_used: [] as Array<{ name: string; args: Record<string, unknown>; result: unknown }>,
      rounds: 0,
      trace_id: undefined as string | undefined,
    }));

    const result = {
      total_reviewed: qualified.length,
      qualified_count: qualified.filter(lead => (lead.ai_score || 0) >= 72).length,
      briefs_generated: briefs.length,
      shortlist,
      brain: {
        analysis: brainResult.answer,
        skills_used: brainResult.skills_used?.length || 0,
        rounds: brainResult.rounds || 0,
        trace_id: brainResult.trace_id,
      },
    };

    // ── Agent lifecycle: close ──
    const duration = Date.now() - startTime;
    await admin
      .from("agent_registry")
      .update({
        status: "online",
        total_runs: (agent.total_runs || 0) + 1,
        avg_duration_ms: Math.round(
          ((agent.avg_duration_ms || 0) * (agent.total_runs || 0) + duration) /
            ((agent.total_runs || 0) + 1),
        ),
      })
      .eq("id", agent.id);

    if (task_id)
      await admin
        .from("agent_tasks")
        .update({ status: "completed", result, completed_at: new Date().toISOString() })
        .eq("id", task_id);

    await admin.from("agent_logs").insert({
      agent_id: agent.id,
      agent_code_name: AGENT_CODE,
      task_id,
      action,
      input: body,
      output: result,
      duration_ms: duration,
    });

    return jsonResponse({
      success: true,
      agent: AGENT_CODE,
      ...result,
      duration_ms: duration,
    });
  } catch (error) {
    await admin
      .from("agent_registry")
      .update({ status: "error" })
      .eq("code_name", AGENT_CODE);
    return errorResponse(error instanceof Error ? error.message : "HUNTER failed", 500);
  }
});
