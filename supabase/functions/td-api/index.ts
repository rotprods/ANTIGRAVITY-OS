import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

/**
 * OCULOPS — TouchDesigner API
 *
 * REST endpoint returning aggregated system state snapshots for TD
 * polling or initial state loading.
 *
 * Auth: X-TD-Service-Key header validated against TD_SERVICE_KEY env var.
 *
 * Usage:
 *   GET ?view=system   → health score, agent stats, signal count, pipeline value
 *   GET ?view=agents   → full agent registry with status, tasks, recent logs
 *   GET ?view=signals  → active signals with categories, impact
 *   GET ?view=pipeline → deals by stage, values, weighted pipeline
 *   GET ?view=events   → recent event log (last 50)
 *   GET ?view=full     → all of the above
 */

const TD_SERVICE_KEY = Deno.env.get("TD_SERVICE_KEY") || "";

function validateServiceKey(req: Request): boolean {
  if (!TD_SERVICE_KEY) return false;
  const key = req.headers.get("x-td-service-key") || req.headers.get("X-TD-Service-Key") || "";
  return key === TD_SERVICE_KEY;
}

// ── View builders ──

async function getSystemView() {
  const [agentsRes, signalsRes, dealsRes] = await Promise.all([
    admin.from("agent_registry").select("id,status,code_name,total_runs,total_tokens"),
    admin.from("signals").select("id,status,impact,category").eq("status", "active"),
    admin.from("deals").select("id,stage,value,probability"),
  ]);

  const agents = agentsRes.data || [];
  const signals = signalsRes.data || [];
  const deals = dealsRes.data || [];

  const totalValue = deals.reduce((s, d: Record<string, unknown>) => s + (Number(d.value) || 0), 0);
  const weightedValue = deals.reduce((s, d: Record<string, unknown>) =>
    s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0);

  const healthScore = (() => {
    const pipelineScore = Math.min(totalValue / 500, 100);
    const agentUptime = agents.length > 0
      ? (agents.filter((a: Record<string, unknown>) => a.status === "online").length / agents.length) * 100
      : 0;
    const signalScore = Math.min(signals.length * 10, 100);
    return Math.round(pipelineScore * 0.5 + agentUptime * 0.3 + signalScore * 0.2);
  })();

  return {
    healthScore,
    agents: {
      total: agents.length,
      online: agents.filter((a: Record<string, unknown>) => a.status === "online").length,
      running: agents.filter((a: Record<string, unknown>) => a.status === "running").length,
      error: agents.filter((a: Record<string, unknown>) => a.status === "error").length,
      totalRuns: agents.reduce((s, a: Record<string, unknown>) => s + (Number(a.total_runs) || 0), 0),
      totalTokens: agents.reduce((s, a: Record<string, unknown>) => s + (Number(a.total_tokens) || 0), 0),
    },
    signals: {
      active: signals.length,
      avgImpact: signals.length > 0
        ? Math.round(signals.reduce((s, sig: Record<string, unknown>) => s + (Number(sig.impact) || 0), 0) / signals.length)
        : 0,
      byCategory: signals.reduce((acc: Record<string, number>, s: Record<string, unknown>) => {
        const cat = String(s.category || "other");
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {}),
    },
    pipeline: {
      totalDeals: deals.length,
      totalValue: Math.round(totalValue),
      weightedValue: Math.round(weightedValue),
      byStage: deals.reduce((acc: Record<string, number>, d: Record<string, unknown>) => {
        const stage = String(d.stage || "unknown");
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {}),
    },
    timestamp: new Date().toISOString(),
  };
}

async function getAgentsView() {
  const [agentsRes, tasksRes, logsRes] = await Promise.all([
    admin.from("agent_registry").select("*").order("created_at", { ascending: false }),
    admin.from("agent_tasks").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("agent_logs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    agents: agentsRes.data || [],
    tasks: {
      queued: (tasksRes.data || []).filter((t: Record<string, unknown>) => t.status === "queued").length,
      running: (tasksRes.data || []).filter((t: Record<string, unknown>) => t.status === "running").length,
      recent: (tasksRes.data || []).slice(0, 20),
    },
    recentLogs: logsRes.data || [],
    timestamp: new Date().toISOString(),
  };
}

async function getSignalsView() {
  const { data } = await admin
    .from("signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const signals = data || [];
  return {
    signals,
    active: signals.filter((s: Record<string, unknown>) => s.status === "active"),
    byCategory: signals.reduce((acc: Record<string, unknown[]>, s: Record<string, unknown>) => {
      const cat = String(s.category || "other");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    }, {}),
    timestamp: new Date().toISOString(),
  };
}

async function getPipelineView() {
  const { data } = await admin
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });

  const deals = data || [];
  const totalValue = deals.reduce((s, d: Record<string, unknown>) => s + (Number(d.value) || 0), 0);
  const weightedValue = deals.reduce((s, d: Record<string, unknown>) =>
    s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0);

  const byStage: Record<string, { count: number; value: number; deals: unknown[] }> = {};
  for (const deal of deals) {
    const stage = String((deal as Record<string, unknown>).stage || "unknown");
    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0, deals: [] };
    byStage[stage].count++;
    byStage[stage].value += Number((deal as Record<string, unknown>).value) || 0;
    byStage[stage].deals.push(deal);
  }

  return {
    totalDeals: deals.length,
    totalValue: Math.round(totalValue),
    weightedValue: Math.round(weightedValue),
    byStage,
    timestamp: new Date().toISOString(),
  };
}

async function getEventsView() {
  const { data } = await admin
    .from("event_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    events: data || [],
    timestamp: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!validateServiceKey(req)) {
    return errorResponse("Invalid or missing TD service key", 401);
  }

  if (req.method !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "system";

  try {
    switch (view) {
      case "system":
        return jsonResponse(await getSystemView());

      case "agents":
        return jsonResponse(await getAgentsView());

      case "signals":
        return jsonResponse(await getSignalsView());

      case "pipeline":
        return jsonResponse(await getPipelineView());

      case "events":
        return jsonResponse(await getEventsView());

      case "full": {
        const [system, agents, signals, pipeline, events] = await Promise.all([
          getSystemView(),
          getAgentsView(),
          getSignalsView(),
          getPipelineView(),
          getEventsView(),
        ]);
        return jsonResponse({ system, agents, signals, pipeline, events });
      }

      default:
        return errorResponse(
          `Unknown view: ${view}. Valid: system, agents, signals, pipeline, events, full`,
          400,
        );
    }
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch data",
      500,
    );
  }
});
