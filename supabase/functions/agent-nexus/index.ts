import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { runBrain } from "../_shared/agent-brain-v2.ts";
import { errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const AGENT_CODE = "nexus";

// ═══════════════════════════════════════════════════════════════════════════════
// NEXUS — Director Agent (hierarchy_level: 0)
//
// The top-level orchestrator that decomposes complex business goals into
// multi-agent plans and coordinates execution across the OCULOPS ecosystem.
//
// NEXUS does NOT touch CRM directly or send notifications.
// It only: plans, delegates (call_agent), stores/recalls memory, queries metrics.
//
// Escalation path: copilot (human in the loop)
// ═══════════════════════════════════════════════════════════════════════════════

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
      goal?: string;
      context?: Record<string, unknown>;
      task_id?: string;
      user_id?: string;
    }>(req);

    const action = body.action || "orchestrate";
    const { task_id } = body;

    // ── Agent lifecycle: start ──
    const { data: agent } = await admin
      .from("agent_registry")
      .select("*")
      .eq("code_name", AGENT_CODE)
      .single();
    if (!agent) throw new Error("Agent not found in registry");

    await admin
      .from("agent_registry")
      .update({ status: "running", last_run_at: new Date().toISOString() })
      .eq("id", agent.id);

    if (task_id)
      await admin
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task_id);

    let result: Record<string, unknown> = {};

    if (action === "orchestrate") {
      const goal = body.goal;
      if (!goal) throw new Error("Missing 'goal' — NEXUS needs a business objective to decompose");

      // ── 1. Gather system state for context ──
      const [metricsRes, agentsRes, recentPlansRes] = await Promise.all([
        admin.rpc("get_daily_briefing_data").catch(() => ({ data: null })),
        admin.from("agent_registry").select("code_name, status, total_runs, last_run_at").order("code_name"),
        admin.from("knowledge_entries")
          .select("title, content, created_at")
          .eq("category", "plan")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const systemState = {
        briefing: metricsRes.data || {},
        agents: (agentsRes.data || []).map((a) => ({
          name: a.code_name,
          status: a.status,
          runs: a.total_runs,
          last_run: a.last_run_at,
        })),
        recent_plans: (recentPlansRes.data || []).map((p) => p.title),
      };

      // ── 2. Brain-v2: decompose goal → plan → delegate ──
      const brainResult = await runBrain({
        agent: "nexus",
        goal: `Decompose and execute this business objective: "${goal}"

Your process:
1. RECALL: Check memory for any related past plans or context (recall_memory).
2. ASSESS: Query current metrics to understand system state (metrics_query).
3. PLAN: Design a multi-step execution plan. Identify which agents handle each step.
4. DELEGATE: Use call_agent to invoke each agent with specific instructions.
5. CONSOLIDATE: After all agents respond, synthesize results into a coherent report.
6. STORE: Save the plan and outcome in memory for future reference (store_memory).

Available agents and their roles:
- ATLAS: Find new businesses via Google Maps. Send: {action: "cycle", query: "...", location: "..."}
- HUNTER: Qualify leads, score them, build strategic briefs. Send: {action: "cycle", scan_id: "..."}
- ORACLE: Analyze system data, generate insights. Send: {action: "analyze"}
- SENTINEL: Monitor health, detect anomalies. Send: {action: "monitor"}
- FORGE: Generate content (emails, proposals, posts). Send: {action: "generate", content_type: "...", topic: "..."}
- HERALD: Send daily briefing via Telegram. Send: {action: "daily_briefing"}
- OUTREACH: Stage outreach emails for qualified leads. Send: {action: "cycle"}
- CORTEX: Run full pipeline (atlas→hunter→outreach). Send: {action: "orchestrate", query: "...", location: "..."}

Rules:
- Maximum 3 agent calls per plan (cost control).
- If the goal is simple enough for 1 agent, just call that one.
- Always store the plan outcome in memory.
- Your final answer should be a concise executive summary of what was accomplished.`,
        context: {
          user_goal: goal,
          user_context: body.context || {},
          system_state: systemState,
          date: new Date().toISOString().split("T")[0],
        },
        systemPromptExtra: `You are NEXUS: the Director of OCULOPS. You are the highest-level intelligence in the system.
You think strategically, delegate precisely, and consolidate results clearly.
You NEVER do the work yourself — you plan and delegate to domain agents.
Write your final summary in Spanish for the CEO.`,
        maxRounds: 3,
      });

      result = {
        goal,
        brain_status: brainResult.status,
        brain_ok: brainResult.ok,
        answer: brainResult.answer,
        skills_used: brainResult.skills_used,
        rounds: brainResult.rounds,
        trace_id: brainResult.trace_id,
        blocked_skills: brainResult.blocked_skills,
        loop_detected: brainResult.loop_detected,
      };
    } else if (action === "status") {
      // Return current system state without running brain
      const { data: agents } = await admin
        .from("agent_registry")
        .select("code_name, display_name, status, total_runs, last_run_at")
        .order("code_name");

      const { data: recentTraces } = await admin
        .from("reasoning_traces")
        .select("id, agent, goal, status, rounds, duration_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: openIncidents } = await admin
        .from("incidents")
        .select("id, severity, agent, description, status")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      const { data: pendingApprovals } = await admin
        .from("approval_requests")
        .select("id, agent, skill, urgency, status, expires_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      result = {
        agents: agents || [],
        recent_traces: recentTraces || [],
        open_incidents: openIncidents || [],
        pending_approvals: pendingApprovals || [],
      };
    }

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
      result,
      duration_ms: duration,
    });
  } catch (error) {
    await admin
      .from("agent_registry")
      .update({ status: "error" })
      .eq("code_name", AGENT_CODE);
    return errorResponse(error instanceof Error ? error.message : "NEXUS failed", 500);
  }
});
