import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { runBrain } from "../_shared/agent-brain-v2.ts";
import { checkRateLimit, errorResponse, handleCors, jsonResponse, readJson, requireBearerAuth } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT-RUNNER — Generic runtime for vault-imported agents
//
// Any agent registered in `agent_definitions` can be executed through this
// single edge function. No need for individual edge functions per agent.
//
// POST /agent-runner
// { "agent": "seo-specialist", "goal": "...", "context": {...} }
//
// The runner:
// 1. Loads agent definition from DB (system_prompt, skills, policies)
// 2. Injects into runBrain() with full governance (policy, audit, anti-loop)
// 3. Tracks lifecycle (running → online/error) + logs execution
// ═══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  const isServiceRoleInvocation = Boolean(SERVICE_ROLE_KEY) && bearerToken === SERVICE_ROLE_KEY;

  let userId: string | null = null;
  if (isServiceRoleInvocation) {
    userId = "service-role";
  } else {
    const auth = await requireBearerAuth(req);
    if (auth.error) return auth.error;
    userId = auth.userId || null;
  }

  // ── Rate limit: 10 agent runs/min per user ──
  if (!checkRateLimit(userId || "anonymous", 10, 60_000)) {
    return errorResponse("Rate limit exceeded — max 10 agent runs per minute", 429);
  }

  const startTime = Date.now();

  try {
    const body = await readJson<{
      agent: string;
      goal?: string;
      context?: Record<string, unknown>;
      task_id?: string;
      action?: string;
      org_id?: string;
    }>(req);

    const { agent: agentCode, goal, context = {}, task_id, action, org_id } = body;

    if (!agentCode) {
      return errorResponse("Missing 'agent' — specify the agent code_name to run", 400);
    }

    // ── 1. Load agent definition ──
    const { data: agentDef, error: defError } = await admin
      .from("agent_definitions")
      .select("*")
      .eq("code_name", agentCode)
      .eq("is_active", true)
      .single();

    if (defError || !agentDef) {
      return errorResponse(`Agent '${agentCode}' not found or inactive`, 404);
    }

    // ── 2. Mark running ──
    await admin
      .from("agent_definitions")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", agentDef.id);

    if (task_id) {
      await admin
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task_id);
    }

    // ── 3. Build goal ──
    const finalGoal = goal || agentDef.goal_template || `Execute your primary function as ${agentDef.display_name}.`;

    // ── 4. Run brain with agent definition ──
    const brainResult = await runBrain({
      agent: agentCode,
      goal: finalGoal,
      context: {
        ...context,
        action: action || "execute",
        date: new Date().toISOString().split("T")[0],
      },
      systemPromptExtra: agentDef.system_prompt,
      maxRounds: agentDef.max_rounds || 4,
      model: agentDef.model || "gpt-4o-mini",
      org_id,
    });

    const duration = Date.now() - startTime;

    // ── 5. Update stats ──
    const newTotalRuns = (agentDef.total_runs || 0) + 1;
    await admin
      .from("agent_definitions")
      .update({
        total_runs: newTotalRuns,
        avg_duration_ms: Math.round(
          ((agentDef.avg_duration_ms || 0) * (agentDef.total_runs || 0) + duration) / newTotalRuns,
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentDef.id);

    if (task_id) {
      await admin
        .from("agent_tasks")
        .update({
          status: brainResult.ok ? "completed" : "failed",
          result: brainResult,
          completed_at: new Date().toISOString(),
        })
        .eq("id", task_id);
    }

    // ── 6. Log execution ──
    await admin.from("agent_logs").insert({
      agent_code_name: agentCode,
      action: action || "execute",
      input: { goal: finalGoal, context },
      output: {
        answer: brainResult.answer?.slice(0, 2000),
        skills_used: brainResult.skills_used?.length || 0,
        rounds: brainResult.rounds,
        status: brainResult.status,
        trace_id: brainResult.trace_id,
      },
      duration_ms: duration,
      org_id: org_id ?? null,
    });

    return jsonResponse({
      success: brainResult.ok,
      agent: agentCode,
      display_name: agentDef.display_name,
      answer: brainResult.answer,
      status: brainResult.status,
      skills_used: brainResult.skills_used,
      rounds: brainResult.rounds,
      trace_id: brainResult.trace_id,
      blocked_skills: brainResult.blocked_skills,
      loop_detected: brainResult.loop_detected,
      duration_ms: duration,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Agent runner failed", 500);
  }
});
