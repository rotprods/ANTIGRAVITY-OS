import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

/**
 * OCULOPS — TouchDesigner Command Receiver
 *
 * Receives validated operator commands from TouchDesigner
 * and executes them against the OCULOPS backend.
 *
 * Auth: X-TD-Service-Key header.
 * Policy: all commands are logged, rate-limited, and validated.
 *
 * Supported commands:
 *   - trigger_agent       → invokes agent-{codeName} Edge Function
 *   - run_cortex_cycle    → triggers full CORTEX orchestration
 *   - update_deal_stage   → moves a deal to a new stage
 *   - dismiss_signal      → marks a signal as dismissed
 *   - create_alert        → creates a new alert in the system
 *   - approve_decision    → approves a pending decision
 */

const TD_SERVICE_KEY = Deno.env.get("TD_SERVICE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Rate limiting: track commands per client
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max commands per minute
const RATE_WINDOW_MS = 60_000;

const ALLOWED_COMMANDS = new Set([
  "trigger_agent",
  "run_cortex_cycle",
  "update_deal_stage",
  "dismiss_signal",
  "create_alert",
  "approve_decision",
]);

function validateServiceKey(req: Request): boolean {
  if (!TD_SERVICE_KEY) return false;
  const key = req.headers.get("x-td-service-key") || req.headers.get("X-TD-Service-Key") || "";
  return key === TD_SERVICE_KEY;
}

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(clientIp);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(clientIp, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function logCommand(
  command: string,
  params: Record<string, unknown>,
  result: Record<string, unknown>,
  operatorId: string | null,
) {
  try {
    await admin.from("event_log").insert({
      event_type: `td.command.${command}`,
      payload: { command, params, result, operator_id: operatorId },
      source: "touchdesigner",
    });
  } catch (err) {
    console.error("[td-command] Failed to log command:", err);
  }
}

// ── Command handlers ──

async function handleTriggerAgent(params: Record<string, unknown>) {
  const codeName = String(params.code_name || params.codeName || "");
  const action = String(params.action || "cycle");

  if (!codeName) return { ok: false, error: "Missing code_name" };

  const url = `${SUPABASE_URL}/functions/v1/agent-${codeName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function handleRunCortexCycle() {
  return handleTriggerAgent({ code_name: "cortex", action: "orchestrate" });
}

async function handleUpdateDealStage(params: Record<string, unknown>) {
  const dealId = String(params.deal_id || "");
  const newStage = String(params.stage || "");

  if (!dealId || !newStage) return { ok: false, error: "Missing deal_id or stage" };

  const { data, error } = await admin
    .from("deals")
    .update({ stage: newStage })
    .eq("id", dealId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, deal: data };
}

async function handleDismissSignal(params: Record<string, unknown>) {
  const signalId = String(params.signal_id || "");
  if (!signalId) return { ok: false, error: "Missing signal_id" };

  const { data, error } = await admin
    .from("signals")
    .update({ status: "dismissed" })
    .eq("id", signalId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, signal: data };
}

async function handleCreateAlert(params: Record<string, unknown>) {
  const { data, error } = await admin
    .from("alerts")
    .insert({
      title: String(params.title || "TD Alert"),
      message: String(params.message || ""),
      severity: String(params.severity || "info"),
      source: "touchdesigner",
      status: "active",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, alert: data };
}

async function handleApproveDecision(params: Record<string, unknown>) {
  const decisionId = String(params.decision_id || "");
  if (!decisionId) return { ok: false, error: "Missing decision_id" };

  const { data, error } = await admin
    .from("decisions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", decisionId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, decision: data };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (!validateServiceKey(req)) {
    return errorResponse("Invalid or missing TD service key", 401);
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  // Rate limit check
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(clientIp)) {
    return errorResponse("Rate limit exceeded. Max 10 commands/minute.", 429);
  }

  try {
    const body = await readJson<{
      command: string;
      params?: Record<string, unknown>;
      operator_id?: string;
      timestamp?: string;
    }>(req);

    const { command, params = {}, operator_id = null } = body;

    if (!command) {
      return errorResponse("Missing 'command' field", 400);
    }

    if (!ALLOWED_COMMANDS.has(command)) {
      return errorResponse(
        `Unknown command: ${command}. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}`,
        400,
      );
    }

    let result: Record<string, unknown>;

    switch (command) {
      case "trigger_agent":
        result = await handleTriggerAgent(params);
        break;
      case "run_cortex_cycle":
        result = await handleRunCortexCycle();
        break;
      case "update_deal_stage":
        result = await handleUpdateDealStage(params);
        break;
      case "dismiss_signal":
        result = await handleDismissSignal(params);
        break;
      case "create_alert":
        result = await handleCreateAlert(params);
        break;
      case "approve_decision":
        result = await handleApproveDecision(params);
        break;
      default:
        result = { ok: false, error: "Unhandled command" };
    }

    // Log every command
    await logCommand(command, params, result, operator_id);

    return jsonResponse({
      ok: true,
      command,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Command execution failed",
      500,
    );
  }
});
