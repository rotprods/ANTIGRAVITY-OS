/**
 * OCULOPS — Agent Brain v2
 *
 * Upgrade de agent-brain.ts con:
 *   1. Planning phase  — GPT produce un plan antes de ejecutar
 *   2. Policy check    — verifica permisos antes de cada skill write
 *   3. Anti-loop       — detecta si el mismo skill se llama >3 veces
 *   4. Audit trail     — escribe audit_log + reasoning_trace al finalizar
 *   5. 6 skills nuevas — plan_write, policy_check, audit_log_write,
 *                        reasoning_trace_store, incident_create, metrics_query
 *
 * Compatible con la interfaz de agent-brain.ts (BrainInput / BrainOutput).
 *
 * Usage:
 *   import { runBrain } from "../_shared/agent-brain-v2.ts";
 *   const result = await runBrain({ agent: "sentinel", goal: "Monitor health" });
 */

import { admin } from "./supabase.ts";
import { checkPolicy, detectLoop } from "./policy-engine.ts";
import { SKILLS, executeSkill, getRiskLevel } from "./agent-skills.ts";

const OPENAI_KEY = () => Deno.env.get("OPENAI_API_KEY") || "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainInput {
  agent: string;
  goal: string;
  context?: Record<string, unknown>;
  systemPromptExtra?: string;
  maxRounds?: number;
  model?: string;
  sessionId?: string;
  skipPolicyCheck?: boolean;
}

export interface BrainOutput {
  ok: boolean;
  status: "completed" | "awaiting_approval" | "escalated" | "failed";
  agent: string;
  goal: string;
  answer: string;
  skills_used: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  rounds: number;
  trace_id?: string;
  blocked_skills: string[];
  loop_detected: boolean;
}
// ─── Planning Phase ───────────────────────────────────────────────────────────
// Ask GPT to produce a brief plan before executing skills.
// Returns a string plan for inclusion in the system prompt.

async function generatePlan(
  agent: string,
  goal: string,
  context: Record<string, unknown>,
  model: string,
): Promise<string> {
  const key = OPENAI_KEY();
  if (!key) return "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are ${agent.toUpperCase()}, an autonomous AI agent in OCULOPS. Before executing, produce a brief execution plan.`,
          },
          {
            role: "user",
            content: `Goal: ${goal}\nContext summary: ${JSON.stringify(context).slice(0, 500)}\n\nRespond with a concise numbered plan (max 5 steps). Each step: what skill to use and why. Be specific.`,
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

// ─── Main: runBrain ───────────────────────────────────────────────────────────

export async function runBrain(input: BrainInput): Promise<BrainOutput> {
  const {
    agent,
    goal,
    context = {},
    systemPromptExtra = "",
    maxRounds = 6,
    model = "gpt-4o",
    sessionId,
    skipPolicyCheck = false,
  } = input;

  const key = OPENAI_KEY();
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const startMs = Date.now();
  const skillsUsed: BrainOutput["skills_used"] = [];
  const blockedSkills: string[] = [];
  const skillCallHistory: Record<string, number> = {};
  let loopDetected = false;
  let finalAnswer = "";
  let rounds = 0;
  let outputStatus: BrainOutput["status"] = "completed";
  let traceId: string | undefined;

  // ── 1. Create reasoning trace (open) ──────────────────────────────────────
  const { data: traceRow } = await admin.from("reasoning_traces").insert({
    agent,
    goal,
    status: "running",
    session_id: sessionId || null,
  }).select("id").single().catch(() => ({ data: null }));
  traceId = traceRow?.id;

  // ── 2. Planning phase ─────────────────────────────────────────────────────
  const plan = await generatePlan(agent, goal, context, model);

  // ── 3. Build system prompt ────────────────────────────────────────────────
  const systemPrompt = `You are ${agent.toUpperCase()}, an autonomous AI agent inside OCULOPS — a Growth Operating System for a Spanish AI agency.

Your current GOAL: ${goal}

${plan ? `YOUR EXECUTION PLAN:\n${plan}\n\nFollow this plan. Execute each step using the appropriate skill.` : ""}

You have HANDS — skills you can call to take real actions:
- Read and write CRM data (contacts, deals, tasks, signals, alerts)
- Fetch real-time external data from 6,898+ APIs
- Search the web, fetch URLs
- Store and recall memories (knowledge base)
- Query metrics (agent runs, pipeline value, open alerts)
- Send Telegram notifications (requires approval for some agents)
- Call other agents
- Generate emails, proposals, and content
- Create incidents for anomalies
- Request human approval for high-risk actions

Rules:
- Follow the plan. Don't skip steps.
- Be proactive. ACT, don't just analyze.
- If blocked by policy, use approval_request.
- Store important findings in memory.
- When done, provide a clear summary of what changed.
${systemPromptExtra}`;

  const messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Context:\n${JSON.stringify(context, null, 2)}\n\nExecute your goal now.` },
  ];

  // ── 4. Execution loop ─────────────────────────────────────────────────────
  while (rounds < maxRounds) {
    rounds++;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        tools: SKILLS,
        tool_choice: "auto",
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      outputStatus = "failed";
      break;
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) break;

    messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });

    // No tool calls → final answer
    if (!msg.tool_calls?.length) {
      finalAnswer = msg.content || "";
      break;
    }

    // Execute each tool call
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* ok */ }

      const skillName = call.function.name;

      // ── Anti-loop check ──────────────────────────────────────────────────
      if (detectLoop(skillCallHistory, skillName)) {
        loopDetected = true;
        // Create incident and break
        await admin.from("incidents").insert({
          severity: "medium",
          agent,
          description: `Loop detected: skill '${skillName}' called ${skillCallHistory[skillName]} times`,
          trace_id: traceId || null,
        }).catch(() => {});

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "Loop detected — this skill has been called too many times. Stop and summarize what you found." }),
        });
        continue;
      }

      // ── Policy check ─────────────────────────────────────────────────────
      if (!skipPolicyCheck && getRiskLevel(skillName) >= 1) {
        const policy = await checkPolicy(agent, skillName, args);
        if (!policy.allowed) {
          blockedSkills.push(skillName);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ blocked: true, reason: policy.reason }),
          });
          continue;
        }

        // High-risk skill that requires approval → use approval_request instead
        if (policy.requires_approval) {
          outputStatus = "awaiting_approval";
          const approvalResult = await executeSkill("approval_request", {
            skill: skillName,
            description: `Agent ${agent} wants to execute ${skillName}`,
            payload: args,
            urgency: "medium",
          }, agent, traceId);

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ approval_requested: true, ...approvalResult as object }),
          });
          skillsUsed.push({ name: "approval_request", args: { for_skill: skillName }, result: approvalResult });
          continue;
        }
      }

      // ── Execute skill ────────────────────────────────────────────────────
      const result = await executeSkill(skillName, args, agent, traceId).catch((e) => ({ error: String(e) }));
      skillsUsed.push({ name: skillName, args, result });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    // Break if loop detected
    if (loopDetected) {
      outputStatus = "escalated";
      break;
    }
  }

  const durationMs = Date.now() - startMs;

  // ── 5. Close reasoning trace ──────────────────────────────────────────────
  if (traceId) {
    try {
      await admin.from("reasoning_traces").update({
        plan: plan || null,
        steps: skillsUsed,
        status: outputStatus,
        rounds,
        duration_ms: durationMs,
      }).eq("id", traceId);
    } catch (e) {
      console.error("Trace update failed:", e);
    }
  }

  // ── 6. Audit log — final entry ────────────────────────────────────────────
  try {
  await admin.from("audit_logs").insert({
    agent,
    event_type: `brain_${outputStatus}`,
    payload: {
      goal,
      skills_count: skillsUsed.length,
      blocked_count: blockedSkills.length,
      rounds,
      duration_ms: durationMs,
      loop_detected: loopDetected,
    },
    trace_id: traceId || null,
  });
  } catch (e) {
    console.error("Audit log failed:", e);
  }

  return {
    ok: outputStatus === "completed" || outputStatus === "awaiting_approval",
    status: outputStatus,
    agent,
    goal,
    answer: finalAnswer,
    skills_used: skillsUsed,
    rounds,
    trace_id: traceId,
    blocked_skills: blockedSkills,
    loop_detected: loopDetected,
  };
}
