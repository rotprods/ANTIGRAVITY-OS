import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

/**
 * OCULOPS — TouchDesigner Bridge
 *
 * WebSocket relay that streams realtime system state to connected TD clients.
 * Also supports REST GET for connection status.
 *
 * Auth: X-TD-Service-Key header validated against TD_SERVICE_KEY env var.
 *
 * WebSocket protocol:
 *   Client → Server: { action: "subscribe", channels: ["agents","signals","pipeline","events"] }
 *   Client → Server: { action: "command", command: "...", params: {...} }
 *   Server → Client: TDEvent JSON packets
 */

const TD_SERVICE_KEY = Deno.env.get("TD_SERVICE_KEY") || "";
const HEARTBEAT_MS = 30_000;

// ── Active connections registry ──
interface TDClient {
  id: string;
  socket: WebSocket;
  channels: Set<string>;
  connectedAt: string;
  lastEvent: string;
  ip: string;
}

const clients = new Map<string, TDClient>();

// ── TD Event builder ──
interface TDEvent {
  type: string;
  timestamp: string;
  source: string;
  data: Record<string, unknown>;
}

function buildEvent(type: string, data: Record<string, unknown>): string {
  const event: TDEvent = {
    type,
    timestamp: new Date().toISOString(),
    source: "oculops-bridge",
    data,
  };
  return JSON.stringify(event);
}

// ── Broadcast to subscribed clients ──
function broadcast(channel: string, type: string, data: Record<string, unknown>) {
  const msg = buildEvent(type, data);
  for (const client of clients.values()) {
    if (client.channels.has(channel) || client.channels.has("*")) {
      try {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(msg);
          client.lastEvent = new Date().toISOString();
        }
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  }
}

// ── Auth validation ──
function validateServiceKey(req: Request): boolean {
  if (!TD_SERVICE_KEY) return false;
  const key = req.headers.get("x-td-service-key") || req.headers.get("X-TD-Service-Key") || "";
  return key === TD_SERVICE_KEY;
}

// ── Supabase Realtime subscriptions ──
function setupRealtimeSubscriptions() {
  // Agent registry changes
  admin
    .channel("td-agents")
    .on("postgres_changes", { event: "*", schema: "public", table: "agent_registry" }, (payload) => {
      broadcast("agents", "agent.state", {
        event: payload.eventType,
        agent: payload.new || payload.old,
      });
    })
    .subscribe();

  // Signal changes
  admin
    .channel("td-signals")
    .on("postgres_changes", { event: "*", schema: "public", table: "signals" }, (payload) => {
      const eventType = payload.eventType === "INSERT" ? "signal.new" :
                        payload.eventType === "UPDATE" ? "signal.update" : "signal.removed";
      broadcast("signals", eventType, {
        event: payload.eventType,
        signal: payload.new || payload.old,
      });
    })
    .subscribe();

  // Deal / pipeline changes
  admin
    .channel("td-deals")
    .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, (payload) => {
      broadcast("pipeline", "deal.changed", {
        event: payload.eventType,
        deal: payload.new || payload.old,
      });
    })
    .subscribe();

  // Event log (system events)
  admin
    .channel("td-events")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_log" }, (payload) => {
      broadcast("events", "event.dispatch", {
        event_type: (payload.new as Record<string, unknown>)?.event_type,
        payload: (payload.new as Record<string, unknown>)?.payload,
      });
    })
    .subscribe();

  // Agent tasks
  admin
    .channel("td-tasks")
    .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, (payload) => {
      broadcast("agents", "agent.task", {
        event: payload.eventType,
        task: payload.new || payload.old,
      });
    })
    .subscribe();

  console.log("[td-bridge] Realtime subscriptions active");
}

// ── Build system health snapshot ──
async function getSystemHealth(): Promise<Record<string, unknown>> {
  const [agentsRes, signalsRes, dealsRes] = await Promise.all([
    admin.from("agent_registry").select("id,status,code_name").limit(50),
    admin.from("signals").select("id,status,impact").eq("status", "active").limit(50),
    admin.from("deals").select("id,stage,value,probability").limit(100),
  ]);

  const agents = agentsRes.data || [];
  const signals = signalsRes.data || [];
  const deals = dealsRes.data || [];

  const totalValue = deals.reduce((s, d: Record<string, unknown>) => s + (Number(d.value) || 0), 0);
  const weightedValue = deals.reduce((s, d: Record<string, unknown>) =>
    s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100), 0);

  return {
    agents: {
      total: agents.length,
      online: agents.filter((a: Record<string, unknown>) => a.status === "online").length,
      running: agents.filter((a: Record<string, unknown>) => a.status === "running").length,
      error: agents.filter((a: Record<string, unknown>) => a.status === "error").length,
    },
    signals: {
      active: signals.length,
      avgImpact: signals.length > 0
        ? Math.round(signals.reduce((s, sig: Record<string, unknown>) => s + (Number(sig.impact) || 0), 0) / signals.length)
        : 0,
    },
    pipeline: {
      totalDeals: deals.length,
      totalValue: Math.round(totalValue),
      weightedValue: Math.round(weightedValue),
    },
    connectedClients: clients.size,
    timestamp: new Date().toISOString(),
  };
}

// ── Initialize realtime on first load ──
let realtimeInitialized = false;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // ── Auth check ──
  if (!validateServiceKey(req)) {
    return errorResponse("Invalid or missing TD service key", 401);
  }

  // Initialize realtime subscriptions on first request
  if (!realtimeInitialized) {
    setupRealtimeSubscriptions();
    realtimeInitialized = true;
  }

  // ── WebSocket upgrade ──
  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const clientId = crypto.randomUUID();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    const client: TDClient = {
      id: clientId,
      socket,
      channels: new Set(["agents", "signals", "pipeline", "events"]), // Default: all
      connectedAt: new Date().toISOString(),
      lastEvent: new Date().toISOString(),
      ip,
    };

    socket.onopen = () => {
      clients.set(clientId, client);
      console.log(`[td-bridge] Client connected: ${clientId} (${ip})`);

      // Send welcome + initial state
      socket.send(buildEvent("system.connected", {
        clientId,
        subscribedChannels: [...client.channels],
        message: "OCULOPS Bridge — connection established",
      }));

      // Send initial health snapshot
      getSystemHealth().then((health) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(buildEvent("system.health", health));
        }
      });
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.action === "subscribe" && Array.isArray(msg.channels)) {
          client.channels = new Set(msg.channels);
          socket.send(buildEvent("system.subscribed", { channels: msg.channels }));
        }

        if (msg.action === "health") {
          const health = await getSystemHealth();
          socket.send(buildEvent("system.health", health));
        }

        if (msg.action === "ping") {
          socket.send(buildEvent("heartbeat", { pong: true }));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    socket.onclose = () => {
      clients.delete(clientId);
      console.log(`[td-bridge] Client disconnected: ${clientId}`);
    };

    socket.onerror = (err) => {
      console.error(`[td-bridge] Socket error for ${clientId}:`, err);
      clients.delete(clientId);
    };

    // Heartbeat interval
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(buildEvent("heartbeat", { ts: Date.now() }));
      } else {
        clearInterval(heartbeat);
      }
    }, HEARTBEAT_MS);

    return response;
  }

  // ── REST fallback: GET returns bridge status ──
  if (req.method === "GET") {
    const health = await getSystemHealth();
    return jsonResponse({
      bridge: "oculops-td-bridge",
      version: "1.0.0",
      connectedClients: Array.from(clients.values()).map((c) => ({
        id: c.id,
        connectedAt: c.connectedAt,
        lastEvent: c.lastEvent,
        channels: [...c.channels],
      })),
      systemHealth: health,
    });
  }

  return errorResponse("Use WebSocket upgrade or GET for status", 400);
});
