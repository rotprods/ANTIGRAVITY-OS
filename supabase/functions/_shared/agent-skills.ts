/**
 * OCULOPS — Agent Skills Registry
 * 
 * Extracted from agent-brain-v2.ts for modularity.
 * Contains: skill definitions (OpenAI function format) + skill executors.
 */

import { admin } from "./supabase.ts";
import { autoConnectApi } from "./auto-api-connector.ts";

const OPENAI_KEY = () => Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ─── Skill definitions (OpenAI function format) ───────────────────────────────

export const SKILLS = [
  {
    type: "function",
    function: {
      name: "fetch_external_data",
      description: "Fetch real-time data from 6,898+ external APIs (weather, finance, news, crypto, maps, etc.). Describe what you need in plain English.",
      parameters: {
        type: "object",
        properties: {
          intent: { type: "string", description: "What data you need, e.g. 'current EUR/USD exchange rate'" },
        },
        required: ["intent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for any topic. Returns top results with titles and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number", description: "Number of results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch the content of a URL and return it as text.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_query",
      description: "Query OCULOPS CRM data: contacts, deals, tasks, signals, alerts, knowledge.",
      parameters: {
        type: "object",
        properties: {
          table: {
            type: "string",
            enum: ["contacts", "deals", "tasks", "signals", "alerts", "knowledge_entries", "crm_activities", "agent_logs", "daily_snapshots"],
          },
          filters: { type: "object" },
          limit: { type: "number" },
          select: { type: "string" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_write_contact",
      description: "Create or update a contact in the CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          status: { type: "string", enum: ["raw", "contacted", "qualified", "client", "lost"] },
          score: { type: "number" },
          notes: { type: "string" },
          id: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_write_deal",
      description: "Create or update a deal in the pipeline.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          value: { type: "number" },
          stage: { type: "string", enum: ["lead", "qualified", "proposal", "negotiation", "won", "lost"] },
          probability: { type: "number" },
          contact_id: { type: "string" },
          notes: { type: "string" },
          id: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_write_task",
      description: "Create a task or action item.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          due_date: { type: "string" },
          assigned_to: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_signal",
      description: "Log a market signal or competitive intelligence finding.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: ["market", "competitor", "technology", "regulation", "opportunity", "threat"] },
          impact: { type: "number" },
          confidence: { type: "number" },
          source: { type: "string" },
        },
        required: ["title", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_alert",
      description: "Fire a system alert that will appear in the OCULOPS dashboard.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          category: { type: "string" },
        },
        required: ["title", "severity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "store_memory",
      description: "Save a finding, insight, or information to the knowledge base for future recall.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_memory",
      description: "Search the knowledge base for previously stored information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description: "Send a Telegram notification to the operations team.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
          urgent: { type: "boolean" },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "call_agent",
      description: "Invoke another OCULOPS agent to handle a subtask.",
      parameters: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            enum: ["atlas", "hunter", "oracle", "forge", "sentinel", "herald", "outreach", "cortex", "nexus"],
          },
          action: { type: "string" },
          payload: { type: "object" },
        },
        required: ["agent", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_content",
      description: "Use GPT-4o to generate text: emails, proposals, social posts, analyses, reports.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["email", "proposal", "social_post", "report", "analysis", "script", "ad_copy"] },
          brief: { type: "string" },
          tone: { type: "string", enum: ["professional", "friendly", "urgent", "persuasive", "technical"] },
          length: { type: "string", enum: ["short", "medium", "long"] },
        },
        required: ["type", "brief"],
      },
    },
  },
  // ─── v2 Skills ──────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "metrics_query",
      description: "Query operational metrics: agent runs, success rates, error counts, pipeline stats.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["agent_runs_today", "agent_errors_today", "pipeline_deals_count", "pipeline_value", "open_alerts", "open_incidents", "tasks_pending"],
          },
          agent_filter: { type: "string", description: "Optional: filter by agent code_name" },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "incident_create",
      description: "Create a formal incident when anomalous behavior is detected in the system.",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          description: { type: "string" },
          context: { type: "object" },
        },
        required: ["severity", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approval_request",
      description: "Request human approval before executing a high-risk action. The action will be paused until approved or rejected.",
      parameters: {
        type: "object",
        properties: {
          skill: { type: "string", description: "The skill you want to execute after approval" },
          description: { type: "string", description: "Plain English explanation of what you want to do and why" },
          payload: { type: "object", description: "The arguments you would pass to the skill" },
          urgency: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["skill", "description"],
      },
    },
  },
];

// ─── Risk Levels ──────────────────────────────────────────────────────────────

export function getRiskLevel(skill: string): number {
  const levels: Record<string, number> = {
    crm_write_contact: 2, crm_write_deal: 2, crm_write_task: 1,
    create_alert: 2, create_signal: 1, store_memory: 1,
    send_notification: 3, call_agent: 2, approval_request: 3,
    incident_create: 2, generate_content: 2,
  };
  return levels[skill] ?? 0;
}

// ─── Skill Executor ───────────────────────────────────────────────────────────

export async function executeSkill(
  name: string,
  args: Record<string, unknown>,
  agentCode: string,
  traceId?: string,
  orgId?: string | null,
): Promise<unknown> {
  const startMs = Date.now();

  try {
    const result = await _exec(name, args, agentCode, traceId, orgId);

    const riskLevel = getRiskLevel(name);
    if (riskLevel >= 2) {
      await admin.from("audit_logs").insert({
        agent: agentCode,
        event_type: "skill_executed",
        skill: name,
        payload: { args, duration_ms: Date.now() - startMs },
        risk_level: riskLevel,
        trace_id: traceId || null,
        org_id: orgId || null,
      }).catch(() => {});
    }

    return result;
  } catch (e) {
    return { error: String(e) };
  }
}

async function _exec(
  name: string,
  args: Record<string, unknown>,
  agentCode: string,
  traceId?: string,
  orgId?: string | null,
): Promise<unknown> {
  switch (name) {

    case "fetch_external_data": {
      const result = await autoConnectApi(args.intent as string, { agentName: agentCode });
      return result.ok ? result.data : { error: result.error, api_tried: result.api_used };
    }

    case "web_search": {
      const q = encodeURIComponent(args.query as string);
      const limit = (args.limit as number) || 5;
      const res = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, {
        headers: { "User-Agent": "oculops-agent/1.0" },
      }).catch(() => null);
      if (!res?.ok) return { query: args.query, note: "Search engine unavailable, reason from your knowledge" };
      const data = await res.json();
      const results = (data.RelatedTopics || []).slice(0, limit).map((t: Record<string, unknown>) => ({
        title: t.Text, url: t.FirstURL,
      }));
      return { query: args.query, abstract: data.Abstract, results };
    }

    case "fetch_url": {
      const res = await fetch(args.url as string, {
        headers: { "User-Agent": "oculops-agent/1.0" },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (!res?.ok) return { error: `Could not fetch ${args.url}` };
      const text = await res.text();
      const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000);
      return { url: args.url, content: clean };
    }

    case "crm_query": {
      let q = admin.from(args.table as string).select((args.select as string) || "*");
      if (args.filters && typeof args.filters === "object") {
        for (const [k, v] of Object.entries(args.filters as Record<string, unknown>)) {
          q = q.eq(k, v);
        }
      }
      const { data, error } = await q.limit((args.limit as number) || 20);
      return error ? { error: error.message } : { rows: data, count: data?.length };
    }

    case "crm_write_contact": {
      const { id, ...fields } = args as Record<string, unknown>;
      if (id) {
        const { data, error } = await admin.from("contacts").update(fields).eq("id", id).select().single();
        return error ? { error: error.message } : { updated: data };
      }
      const { data, error } = await admin.from("contacts").insert({ ...fields, source: agentCode }).select().single();
      return error ? { error: error.message } : { created: data };
    }

    case "crm_write_deal": {
      const { id, ...fields } = args as Record<string, unknown>;
      if (id) {
        const { data, error } = await admin.from("deals").update(fields).eq("id", id).select().single();
        return error ? { error: error.message } : { updated: data };
      }
      const { data, error } = await admin.from("deals").insert({ ...fields, source: agentCode }).select().single();
      return error ? { error: error.message } : { created: data };
    }

    case "crm_write_task": {
      const { data, error } = await admin.from("tasks").insert({
        ...args, status: "pending", created_by: agentCode,
      }).select().single();
      return error ? { error: error.message } : { created: data };
    }

    case "create_signal": {
      const { data, error } = await admin.from("signals").insert({
        ...args, status: "active", created_by: agentCode,
      }).select().single();
      return error ? { error: error.message } : { created: data };
    }

    case "create_alert": {
      const { data, error } = await admin.from("alerts").insert({
        ...args, status: "active", source: agentCode,
      }).select().single();
      return error ? { error: error.message } : { created: data };
    }

    case "store_memory": {
      const { data, error } = await admin.from("knowledge_entries").insert({
        title: args.title,
        content: args.content,
        category: args.category || "agent_memory",
        type: "ai_generated",
        source: agentCode,
        tags: args.tags || [agentCode, "auto"],
      }).select().single();
      return error ? { error: error.message } : { stored: data?.id };
    }

    case "recall_memory": {
      const query = (args.query as string).toLowerCase();
      const { data, error } = await admin.from("knowledge_entries")
        .select("title, content, category, tags, created_at")
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit((args.limit as number) || 5);
      return error ? { error: error.message } : { memories: data };
    }

    case "send_notification": {
      const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
      if (!token || !chatId) return { error: "Telegram not configured" };
      const text = args.urgent ? `🚨 URGENT\n${args.message}` : `[${agentCode.toUpperCase()}]\n${args.message}`;
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
      return res.ok ? { sent: true } : { error: "Telegram send failed" };
    }

    case "call_agent": {
      const url = `${SUPABASE_URL()}/functions/v1/agent-${args.agent}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: args.action, ...(args.payload as object || {}) }),
      });
      const data = await res.json().catch(() => ({}));
      return { agent: args.agent, action: args.action, result: data };
    }

    case "generate_content": {
      const key = OPENAI_KEY();
      if (!key) return { error: "OpenAI key not set" };
      const lengthMap: Record<string, number> = { short: 200, medium: 500, long: 1200 };
      const maxTokens = lengthMap[(args.length as string) || "medium"] || 500;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: `You are a ${args.tone || "professional"} copywriter for a Spanish AI agency. Write ${args.type} content.` },
            { role: "user", content: args.brief as string },
          ],
          max_tokens: maxTokens,
        }),
      });
      const d = await res.json();
      return { content: d.choices?.[0]?.message?.content || "", type: args.type };
    }

    case "metrics_query": {
      const metric = args.metric as string;
      const agentFilter = args.agent_filter as string | undefined;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let result: Record<string, unknown> = {};

      if (metric === "agent_runs_today") {
        let q = admin.from("agent_logs").select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString());
        if (agentFilter) q = q.eq("agent_code_name", agentFilter);
        const { count } = await q;
        result = { metric, value: count || 0 };
      } else if (metric === "agent_errors_today") {
        let q = admin.from("agent_logs").select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString()).eq("status", "error");
        if (agentFilter) q = q.eq("agent_code_name", agentFilter);
        const { count } = await q;
        result = { metric, value: count || 0 };
      } else if (metric === "pipeline_deals_count") {
        const { count } = await admin.from("deals").select("id", { count: "exact", head: true })
          .not("stage", "eq", "lost");
        result = { metric, value: count || 0 };
      } else if (metric === "pipeline_value") {
        const { data } = await admin.from("deals").select("value").not("stage", "eq", "lost");
        const total = (data || []).reduce((sum: number, d: Record<string, unknown>) => sum + ((d.value as number) || 0), 0);
        result = { metric, value: total };
      } else if (metric === "open_alerts") {
        const { count } = await admin.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active");
        result = { metric, value: count || 0 };
      } else if (metric === "open_incidents") {
        const { count } = await admin.from("incidents").select("id", { count: "exact", head: true }).eq("status", "open");
        result = { metric, value: count || 0 };
      } else if (metric === "tasks_pending") {
        const { count } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending");
        result = { metric, value: count || 0 };
      }

      return result;
    }

    case "incident_create": {
      const { data, error } = await admin.from("incidents").insert({
        severity: args.severity,
        agent: agentCode,
        description: args.description,
        context: args.context || {},
        trace_id: traceId || null,
        org_id: orgId || null,
      }).select().single();
      return error ? { error: error.message } : { incident_id: data?.id };
    }

    case "approval_request": {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data, error } = await admin.from("approval_requests").insert({
        agent: agentCode,
        skill: args.skill,
        payload: args.payload || {},
        urgency: args.urgency || "medium",
        status: "pending",
        expires_at: expiresAt,
        trace_id: traceId || null,
        org_id: orgId || null,
      }).select().single();

      if (error) return { error: error.message };

      const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
      if (token && chatId) {
        const msg = `⚠️ APROBACIÓN REQUERIDA\n\nAgente: ${agentCode.toUpperCase()}\nAcción: ${args.skill}\nMotivo: ${args.description}\n\nID: ${data?.id}\nExpira en: 30 minutos`;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg }),
        }).catch(() => {});
      }

      return { approval_id: data?.id, status: "pending", expires_at: expiresAt };
    }

    default:
      return { error: `Unknown skill: ${name}` };
  }
}
