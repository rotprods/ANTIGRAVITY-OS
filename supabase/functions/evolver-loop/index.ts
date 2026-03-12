/**
 * OCULOPS — EVOLVER Loop (self-contained, no SDK imports)
 *
 * Autonomous agent self-improvement inspired by karpathy/autoresearch.
 * Uses raw fetch() against Supabase REST + Anthropic API — zero bundling needed.
 *
 * Protocol (runs nightly at 02:00 UTC via pg_cron):
 *   1. SELECT target agent (oldest last_evaluated_at from agent_definitions)
 *   2. Compute baseline score from last 30 days of reasoning_traces
 *   3. Generate 3 system_prompt mutations via Claude claude-opus-4-6
 *   4. Judge mutations: Claude scores each vs observed failure patterns
 *   5. Best mutation Δ > 3% → KEEP / else DISCARD (autoresearch protocol)
 *   6. Log to agent_experiments + reasoning_traces
 *   7. If EVOLVER_AUTO_APPLY=true → UPDATE agent_definitions (else: shadow mode)
 *   8. Telegram summary
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
 *      CRON_SECRET, EVOLVER_AUTO_APPLY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const ENV = {
  supabaseUrl:     () => Deno.env.get("SUPABASE_URL") ?? "",
  serviceRole:     () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  anthropicKey:    () => Deno.env.get("ANTHROPIC_API_KEY") ?? "",
  cronSecret:      () => Deno.env.get("CRON_SECRET") ?? "",
  autoApply:       () => Deno.env.get("EVOLVER_AUTO_APPLY") === "true",
  telegramToken:   () => Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "",
  telegramChatId:  () => Deno.env.get("TELEGRAM_CHAT_ID") ?? "",
};

const CLAUDE_MODEL          = "claude-opus-4-6-20251101";
const IMPROVEMENT_THRESHOLD = 0.03;  // 3% minimum to keep a mutation

// ─── Supabase REST helpers ────────────────────────────────────────────────────

function sbHeaders() {
  return {
    "Content-Type":  "application/json",
    "apikey":        ENV.serviceRole(),
    "Authorization": `Bearer ${ENV.serviceRole()}`,
    "Prefer":        "return=representation",
  };
}

async function sbGet(table: string, params: Record<string, string>): Promise<unknown[]> {
  const qs = new URLSearchParams({ ...params, select: params.select ?? "*" });
  const res = await fetch(`${ENV.supabaseUrl()}/rest/v1/${table}?${qs}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${ENV.supabaseUrl()}/rest/v1/${table}`, {
    method:  "POST",
    headers: sbHeaders(),
    body:    JSON.stringify(row),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(table: string, filter: Record<string, string>, updates: Record<string, unknown>): Promise<void> {
  const qs = new URLSearchParams(filter);
  await fetch(`${ENV.supabaseUrl()}/rest/v1/${table}?${qs}`, {
    method:  "PATCH",
    headers: sbHeaders(),
    body:    JSON.stringify(updates),
  });
}

// ─── Anthropic Claude helper ──────────────────────────────────────────────────

async function callClaude(system: string, user: string, maxTokens = 1500): Promise<string> {
  const key = ENV.anthropicKey();
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         key,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// ─── Step 1: Select target agent ──────────────────────────────────────────────

async function selectTarget(): Promise<{ agent_id: string; system_prompt: string } | null> {
  const rows = await sbGet("agent_definitions", {
    select:              "agent_id,system_prompt,last_evaluated_at",
    system_prompt:       "not.is.null",
    order:               "last_evaluated_at.asc.nullsfirst",
    limit:               "1",
  }) as Array<{ agent_id: string; system_prompt: string }>;

  return rows[0] ?? null;
}

// ─── Step 2: Baseline metrics ─────────────────────────────────────────────────

interface AgentMetrics {
  total_runs:      number;
  completion_rate: number;
  blocked_rate:    number;
  avg_rounds:      number;
  efficiency:      number;
  baseline_score:  number;
}

async function computeBaseline(agentId: string): Promise<AgentMetrics> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const rows = await sbGet("reasoning_traces", {
    select:     "status,rounds,blocked_skills",
    agent:      `eq.${agentId}`,
    created_at: `gte.${since}`,
  }) as Array<{ status: string; rounds: number; blocked_skills: string[] | null }>;

  if (rows.length === 0) {
    return { total_runs: 0, completion_rate: 0.5, blocked_rate: 0, avg_rounds: 3, efficiency: 0.33, baseline_score: 0.5 };
  }

  const completed   = rows.filter((r) => r.status === "completed").length;
  const blockedRuns = rows.filter((r) => Array.isArray(r.blocked_skills) && r.blocked_skills.length > 0).length;
  const avgRounds   = rows.reduce((s, r) => s + (r.rounds || 3), 0) / rows.length;

  const completionRate = completed / rows.length;
  const blockedRate    = blockedRuns / rows.length;
  const efficiency     = Math.max(0, 1 - (avgRounds - 1) / 9);

  // Composite: completion 50% + efficiency 30% + non-blocked 20%
  const baselineScore = completionRate * 0.5 + efficiency * 0.3 + (1 - blockedRate) * 0.2;

  return {
    total_runs:      rows.length,
    completion_rate: Math.round(completionRate * 1000) / 1000,
    blocked_rate:    Math.round(blockedRate * 1000) / 1000,
    avg_rounds:      Math.round(avgRounds * 100) / 100,
    efficiency:      Math.round(efficiency * 1000) / 1000,
    baseline_score:  Math.round(baselineScore * 1000) / 1000,
  };
}

// ─── Step 3: Generate mutations ───────────────────────────────────────────────

interface Mutation { description: string; system_prompt: string; }

async function generateMutations(agentId: string, currentPrompt: string, m: AgentMetrics): Promise<Mutation[]> {
  const raw = await callClaude(
    `You are an expert AI prompt engineer. Generate improved system_prompt variants for an autonomous agent.
SIMPLICITY rule: a 1% gain that adds 200+ tokens of vague instructions is NOT worth it. Prefer shorter, clearer prompts.
Output ONLY a valid JSON array — no markdown fences, no explanation.`,
    `Agent: ${agentId.toUpperCase()}

Current system_prompt:
"""
${currentPrompt}
"""

Performance (last 30 days):
- Completion rate: ${(m.completion_rate * 100).toFixed(1)}%
- Avg rounds: ${m.avg_rounds} (target ≤4)
- Blocked skill rate: ${(m.blocked_rate * 100).toFixed(1)}%
- Baseline score: ${m.baseline_score.toFixed(3)}/1.000

Generate exactly 3 distinct mutations, each targeting a specific weakness.
Return JSON array:
[{"description":"one-line change summary","system_prompt":"full improved prompt"},...]`,
    3000,
  );

  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("no JSON array");
    return JSON.parse(match[0]) as Mutation[];
  } catch {
    return [{
      description: "Trim verbosity, add explicit success criteria",
      system_prompt: currentPrompt.replace(/\n{3,}/g, "\n\n").trim() +
        "\n\nSuccess: complete goal in ≤4 rounds with zero blocked skills.",
    }];
  }
}

// ─── Step 4: Judge mutations ───────────────────────────────────────────────────

interface JudgeResult { best_mutation_index: number; scores: number[]; reasoning: string; }

async function judgeMutations(
  agentId: string,
  currentPrompt: string,
  mutations: Mutation[],
  m: AgentMetrics,
): Promise<JudgeResult> {
  const mutList = mutations
    .map((mu, i) => `Mutation ${i + 1} — "${mu.description}":\n"""\n${mu.system_prompt}\n"""`)
    .join("\n\n");

  const raw = await callClaude(
    `You are a rigorous AI quality judge. Score system_prompt variants for autonomous agents.
Consider: clarity, conciseness, specificity, alignment with the agent's observed failures.
Output ONLY valid JSON — no markdown.`,
    `Agent: ${agentId.toUpperCase()}

BASELINE:
"""${currentPrompt}"""

Failure patterns:
- Completion: ${(m.completion_rate * 100).toFixed(1)}% | Rounds: ${m.avg_rounds} | Blocked: ${(m.blocked_rate * 100).toFixed(1)}%
- Baseline score: ${m.baseline_score.toFixed(3)}

CANDIDATES:
${mutList}

Score each (0.0–1.0). Pick the best or -1 if none beats baseline.
JSON: {"scores":[0.XX,0.XX,0.XX],"best_mutation_index":0,"reasoning":"brief explanation"}`,
    600,
  );

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    return JSON.parse(match[0]) as JudgeResult;
  } catch {
    return { best_mutation_index: -1, scores: mutations.map(() => 0), reasoning: "Judge parse error" };
  }
}

// ─── Step 5: Telegram summary ─────────────────────────────────────────────────

async function telegram(text: string): Promise<void> {
  const token  = ENV.telegramToken();
  const chatId = ENV.telegramChatId();
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  }).catch(() => {});
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const cs   = ENV.cronSecret();
  if (cs && auth !== `Bearer ${cs}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const t0        = Date.now();
  const autoApply = ENV.autoApply();

  // Resolve org_id
  let orgId: string | null = null;
  try {
    const orgs = await sbGet("organizations", { select: "id", order: "created_at.asc", limit: "1" }) as Array<{ id: string }>;
    orgId = orgs[0]?.id ?? null;
  } catch { /* ok */ }

  // Open reasoning trace
  let traceId: string | null = null;
  try {
    const tr = await sbInsert("reasoning_traces", {
      agent: "evolver", goal: "Autonomous nightly self-improvement run", status: "running", org_id: orgId,
    });
    traceId = (tr as { id?: string })?.id ?? null;
  } catch { /* ok */ }

  try {
    // 1. Select target
    const target = await selectTarget();
    if (!target) {
      if (traceId) await sbPatch("reasoning_traces", { id: `eq.${traceId}` }, {
        status: "completed", answer: "No eligible agents", duration_ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({ ok: true, message: "No eligible agents" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { agent_id, system_prompt } = target;

    // 2. Baseline
    const metrics = await computeBaseline(agent_id);

    // 3. Mutations
    const mutations = await generateMutations(agent_id, system_prompt, metrics);

    // 4. Judge
    const judgment   = await judgeMutations(agent_id, system_prompt, mutations, metrics);
    const bestIdx    = judgment.best_mutation_index;
    const bestScore  = bestIdx >= 0 ? (judgment.scores[bestIdx] ?? 0) : 0;
    const delta      = bestScore - metrics.baseline_score;
    const improved   = bestIdx >= 0 && delta >= IMPROVEMENT_THRESHOLD;
    const bestMut    = bestIdx >= 0 ? mutations[bestIdx] : null;

    // 5. Keep / Discard / Shadow
    let expStatus: string;

    if (!improved || !bestMut) {
      expStatus = "discarded";
    } else if (autoApply) {
      expStatus = "kept";
      // Apply prompt update
      await sbPatch("agent_definitions", { agent_id: `eq.${agent_id}` }, {
        system_prompt:     bestMut.system_prompt,
        last_evaluated_at: new Date().toISOString(),
        baseline_score:    bestScore,
      });
    } else {
      expStatus = "shadow";  // improved but auto_apply disabled — log for human review
    }

    // 6. Log experiment
    await sbInsert("agent_experiments", {
      agent_id,
      mutation_description: bestMut?.description ?? "No improvement",
      system_prompt_before: system_prompt,
      system_prompt_after:  bestMut?.system_prompt ?? system_prompt,
      score_before:         metrics.baseline_score,
      score_after:          bestScore,
      status:               expStatus,
      judge_reasoning:      judgment.reasoning,
      metrics_snapshot:     metrics,
      org_id:               orgId,
    });

    // Update last_evaluated_at even on discard
    if (expStatus === "discarded") {
      await sbPatch("agent_definitions", { agent_id: `eq.${agent_id}` }, {
        last_evaluated_at: new Date().toISOString(),
      });
    }

    // 7. Close trace
    const summary = `${agent_id}: ${expStatus} | Δ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}% | ${bestMut?.description ?? "no improvement"}`;
    if (traceId) await sbPatch("reasoning_traces", { id: `eq.${traceId}` }, {
      status:      "completed",
      answer:      summary,
      skills_used: ["prompt_mutation", "eval_run", "experiment_log"],
      duration_ms: Date.now() - t0,
    });

    // 8. Telegram
    const modeTag = autoApply ? "🔁 AUTO-APPLY" : "👁 SHADOW";
    const emoji   = { kept: "✅", discarded: "❌", shadow: "💡" }[expStatus] ?? "❓";
    await telegram(
      `*EVOLVER* ${modeTag}\n\n` +
      `${emoji} *${agent_id.toUpperCase()}* — ${expStatus}\n` +
      `Score: ${(metrics.baseline_score * 100).toFixed(1)}% → ${(bestScore * 100).toFixed(1)}% (Δ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%)\n\n` +
      `📝 ${bestMut?.description ?? "No improvement"}\n` +
      `🧠 _${judgment.reasoning.slice(0, 200)}_\n\n` +
      `⏱ ${Math.round((Date.now() - t0) / 1000)}s`,
    );

    return new Response(
      JSON.stringify({ ok: true, agent_id, status: expStatus, delta, auto_apply: autoApply }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (traceId) await sbPatch("reasoning_traces", { id: `eq.${traceId}` }, {
      status: "failed", answer: `EVOLVER crashed: ${msg}`, duration_ms: Date.now() - t0,
    }).catch(() => {});
    await telegram(`⚠️ *EVOLVER crashed*\n\`${msg}\``);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
