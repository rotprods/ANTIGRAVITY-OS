import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { runAgentTask } from "../_shared/agents.ts";
import { autoConnectApiBatch } from "../_shared/auto-api-connector.ts";
import { compact, errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";
import { resolveFallbackTelegramTarget, sendTelegramMessage } from "../_shared/telegram.ts";

type BriefingData = {
  pipeline_total?: number;
  pipeline_change_pct?: number;
  deal_count?: number;
  signal_count?: number;
  critical_signals?: number;
  health_score?: number;
  agents_online?: number;
  agents_total?: number;
  signals?: Array<{ title?: string; impact?: number }>;
  top_tasks?: Array<{ title?: string; priority?: string; status?: string }>;
};

function formatBriefingMessage(briefing: BriefingData = {}) {
  const signals = Array.isArray(briefing.signals) ? briefing.signals.slice(0, 3) : [];
  const tasks = Array.isArray(briefing.top_tasks) ? briefing.top_tasks.slice(0, 3) : [];

  return [
    "HERALD // DAILY BRIEFING",
    "",
    `[PIPELINE] $${Math.round(Number(briefing.pipeline_total) || 0).toLocaleString()} (${Number(briefing.pipeline_change_pct) || 0}% vs D-1)`,
    `[DEALS] ${briefing.deal_count || 0} active`,
    `[SIGNALS] ${briefing.signal_count || 0} total / ${briefing.critical_signals || 0} critical`,
    `[HEALTH] ${briefing.health_score || 0}/100`,
    `[AGENTS] ${briefing.agents_online || 0}/${briefing.agents_total || 0} online`,
    "",
    "TOP SIGNALS",
    ...(signals.length > 0
      ? signals.map(signal => `- L${signal.impact || 0} ${compact(signal.title) || "Untitled signal"}`)
      : ["- No critical signals logged"]),
    "",
    "TOP TASKS",
    ...(tasks.length > 0
      ? tasks.map(task => `- [${compact(task.status).toUpperCase() || "OPEN"}] ${compact(task.title) || "Untitled task"}`)
      : ["- No open priority tasks"]),
  ].join("\n").slice(0, 3900);
}

async function loadTelegramTarget() {
  const { data, error } = await admin
    .from("agent_delivery_targets")
    .select("*")
    .eq("type", "telegram")
    .eq("is_active", true)
    .or("agent_code_name.eq.herald,agent_code_name.is.null")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || resolveFallbackTelegramTarget();
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
      dryRun?: boolean;
      user_id?: string;
    }>(req);

    const action = body.action || "daily_briefing";

    const task = await runAgentTask({
      codeName: "herald",
      action,
      title: `HERALD ${action}`,
      payload: { ...body, skip_telegram: true },
      handler: async () => {
        const [{ data: briefingData, error }, externalResults] = await Promise.all([
          admin.rpc("get_daily_briefing_data"),
          autoConnectApiBatch([
            "latest news headlines today",
            "bitcoin ethereum crypto prices",
            "euro dollar pound currency exchange rate",
          ], "herald").catch(() => []),
        ]);
        if (error) throw error;

        const externalLines = externalResults
          .filter((r) => r.ok)
          .map((r) => `[EXT] ${r.api_used.toUpperCase()}: data connected`)
          .join("\n");

        const message = formatBriefingMessage((briefingData || {}) as BriefingData)
          + (externalLines ? `\n\nEXTERNAL FEEDS\n${externalLines}` : "");
        let telegramSent = false;
        let warning: string | null = null;
        let telegramResponse = null;

        if (!body.dryRun) {
          const target = await loadTelegramTarget();
          if (target) {
            telegramResponse = await sendTelegramMessage(target, message);
            telegramSent = true;
          } else {
            warning = "No Telegram target configured";
          }
        }

        return {
          briefing_data: briefingData,
          telegram_sent: telegramSent,
          warning,
          message,
          telegram: telegramResponse,
        };
      },
    });

    return jsonResponse({
      success: true,
      task_id: task.task_id,
      agent_id: task.agent_id,
      ...(task.output as Record<string, unknown>),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "HERALD failed", 500);
  }
});
