import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { executeTriggeredWorkflows } from "../_shared/automation.ts";

/**
 * OCULOPS Event Dispatcher
 *
 * Routes event_log events to:
 *   1. n8n webhooks (via EVENT_ROUTES map)
 *   2. automation_workflows (via trigger_key matching event_type)
 *
 * Called from:
 *   - DB trigger on event_log (via pg_net, fire-and-forget)
 *   - Direct POST from frontend/agents
 */

const N8N_BASE = Deno.env.get("N8N_WEBHOOK_URL")?.replace(/\/[^/]*$/, "") ||
  Deno.env.get("N8N_API_URL")?.replace("/api/v1", "/webhook") ||
  "";

// ── Event → n8n webhook route map ──
// Keys: event_type patterns (exact match or prefix with *)
// Values: n8n webhook path suffix (appended to N8N_BASE)
const EVENT_ROUTES: Record<string, string> = {
  // Agent lifecycle
  "agent.completed":     "/agent-completed",
  "agent.error":         "/agent-error",

  // Lead/CRM events
  "lead.captured":       "/speed-to-lead",
  "lead.qualified":      "/chatbot-lead-qualifier",

  // Pipeline events
  "deal.stage_changed":  "/deal-stage-changed",
  "deal.closed_won":     "/deal-closed-won",

  // Content events
  "content.requested":   "/forge-content-webhook",

  // Strategy events
  "strategy.requested":  "/strategist-webhook",

  // Signal events
  "signal.detected":     "/signal-detected",

  // Message events (Phase 2)
  "message.classified":  "/message-classified",

  // Pipeline events (Phase 3)
  "deal.closed_lost":    "/deal-closed-lost",

  // Drip sequence events
  "outreach.step_due":   "/drip-outreach-step",

  // TouchDesigner bridge
  "td.state_request":    "/td-state-sync",
  "td.command_executed": "/td-command-log",
};

// ── Wildcard routes (prefix matching) ──
const WILDCARD_ROUTES: Array<[string, string]> = [
  ["agent.", "/agent-event"],     // Catch-all for any agent.* event
];

function resolveWebhookUrl(eventType: string): string | null {
  // Exact match first
  if (EVENT_ROUTES[eventType]) {
    return `${N8N_BASE}${EVENT_ROUTES[eventType]}`;
  }

  // Wildcard prefix match
  for (const [prefix, path] of WILDCARD_ROUTES) {
    if (eventType.startsWith(prefix)) {
      return `${N8N_BASE}${path}`;
    }
  }

  return null;
}

async function dispatchToN8N(webhookUrl: string, event: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error(`Failed to dispatch to ${webhookUrl}:`, err);
    return { ok: false, status: 0 };
  }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<{
      event_type: string;
      payload?: Record<string, unknown>;
      id?: string;
      created_at?: string;
      user_id?: string;
      // Support batch dispatch
      events?: Array<{
        event_type: string;
        payload?: Record<string, unknown>;
        id?: string;
      }>;
    }>(req);

    // Support single event or batch
    const events = body.events || [{
      event_type: body.event_type,
      payload: body.payload || {},
      id: body.id,
      created_at: body.created_at,
      user_id: body.user_id,
    }];

    const results: Array<{
      event_type: string;
      webhook: string | null;
      dispatched: boolean;
      status: number;
    }> = [];

    for (const event of events) {
      const webhookUrl = resolveWebhookUrl(event.event_type);

      if (!webhookUrl || !N8N_BASE) {
        results.push({
          event_type: event.event_type,
          webhook: null,
          dispatched: false,
          status: 0,
        });
        continue;
      }

      const result = await dispatchToN8N(webhookUrl, event);

      results.push({
        event_type: event.event_type,
        webhook: webhookUrl,
        dispatched: result.ok,
        status: result.status,
      });
    }

    // Also trigger automation_workflows that match event_type as trigger_key
    let automationResult = null;
    for (const event of events) {
      try {
        automationResult = await executeTriggeredWorkflows({
          triggerKey: event.event_type,
          userId: event.user_id || null,
          context: event.payload as Record<string, unknown> || {},
          source: "event_dispatcher",
        });
      } catch (err) {
        console.error(`Automation trigger failed for ${event.event_type}:`, err);
      }
    }

    const dispatched = results.filter((r) => r.dispatched).length;
    const skipped = results.filter((r) => !r.webhook).length;
    const failed = results.filter((r) => r.webhook && !r.dispatched).length;

    return jsonResponse({
      ok: failed === 0,
      total: results.length,
      dispatched,
      skipped,
      failed,
      results,
      automations: automationResult || null,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Event dispatch failed",
      500,
    );
  }
});
