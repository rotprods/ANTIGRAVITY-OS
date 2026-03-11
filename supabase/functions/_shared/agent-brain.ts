/**
 * OCULOPS — Agent Brain
 *
 * Wraps ANY agent with OpenAI function-calling + a full skill set.
 * Agents think → pick skills → act → loop until done.
 *
 * Skills (agent "hands"):
 *   fetch_external_data  → auto-connect to 6,898 catalog APIs
 *   web_search           → DuckDuckGo search
 *   fetch_url            → read any URL
 *   crm_query            → read contacts/deals/tasks/signals
 *   crm_write_contact    → create/update contact
 *   crm_write_deal       → create/update deal
 *   crm_write_task       → create task
 *   create_signal        → add market signal
 *   create_alert         → fire system alert
 *   store_memory         → save to knowledge_entries
 *   recall_memory        → search knowledge_entries
 *   send_notification    → Telegram message
 *   call_agent           → invoke another OCULOPS agent
 *   generate_content     → GPT writes text/email/post
 *   trigger_n8n_workflow → invoke an n8n workflow for complex tasks
 *
 * Usage:
 *   import { runBrain } from "../_shared/agent-brain.ts";
 *   const result = await runBrain({ agent: "sentinel", goal: "Monitor pipeline health and fix anomalies", context: { deals, alerts } });
 */

import { admin } from "./supabase.ts";
import { autoConnectApi } from "./auto-api-connector.ts";
import { billing } from "./billing-engine.ts";

const OPENAI_KEY = () => Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ─── Skill definitions (OpenAI function format) ───────────────────────────────

const SKILLS = [
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
          query: { type: "string", description: "Search query" },
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
        properties: {
          url: { type: "string", description: "URL to fetch" },
        },
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
          filters: { type: "object", description: "Key-value filters, e.g. {status: 'qualified'}" },
          limit: { type: "number", description: "Max rows (default 20)" },
          select: { type: "string", description: "Columns to select (default *)" },
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
          score: { type: "number", description: "Lead score 0-100" },
          notes: { type: "string" },
          id: { type: "string", description: "If provided, updates existing contact" },
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
          value: { type: "number", description: "Deal value in EUR" },
          stage: { type: "string", enum: ["lead", "qualified", "proposal", "negotiation", "won", "lost"] },
          probability: { type: "number", description: "Win probability 0-100" },
          contact_id: { type: "string" },
          notes: { type: "string" },
          id: { type: "string", description: "If provided, updates existing deal" },
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
          due_date: { type: "string", description: "ISO date string" },
          assigned_to: { type: "string", description: "Agent or user name" },
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
          impact: { type: "number", description: "Impact score 1-10" },
          confidence: { type: "number", description: "Confidence 0-100" },
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
      name: "trigger_n8n_workflow",
      description: "Trigger a high-level automation workflow in n8n for registration, lead management, or complex processing. USE THIS for stateful business processes.",
      parameters: {
        type: "object",
        properties: {
          workflow_id: { type: "string", description: "The n8n workflow slug or identifier" },
          payload: { type: "object", description: "The data to send to n8n (leads, contact info, etc.)" },
        },
        required: ["workflow_id", "payload"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "store_memory",
      description: "Save a finding, insight, or piece of information to the knowledge base for future recall.",
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
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results (default 5)" },
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
          message: { type: "string", description: "Message text (max 4000 chars)" },
          urgent: { type: "boolean", description: "If true, marks message as urgent" },
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
            enum: ["atlas", "hunter", "oracle", "forge", "sentinel", "herald", "outreach", "scraper"],
          },
          action: { type: "string", description: "Action for that agent to perform" },
          payload: { type: "object", description: "Additional payload" },
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
          brief: { type: "string", description: "What to write and for whom" },
          tone: { type: "string", enum: ["professional", "friendly", "urgent", "persuasive", "technical"] },
          length: { type: "string", enum: ["short", "medium", "long"] },
        },
        required: ["type", "brief"],
      },
    },
  },
];

// ─── Skill executors ──────────────────────────────────────────────────────────

async function executeSkill(name: string, args: Record<string, unknown>, agentCode: string): Promise<unknown> {
  switch (name) {

    case "fetch_external_data": {
      const result = await autoConnectApi(args.intent as string, { agentName: agentCode });
      return result.ok ? result.data : { error: result.error, api_tried: result.api_used };
    }

    case "web_search": {
      const q = encodeURIComponent(args.query as string);
      const limit = (args.limit as number) || 5;
      // DuckDuckGo instant answer API (no auth)
      const res = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, {
        headers: { "User-Agent": "oculops-agent/1.0" },
      }).catch(() => null);
      if (!res?.ok) {
        // Fallback: return search URL for agent to reason about
        return { query: args.query, note: "Search engine unavailable, reason from your knowledge" };
      }
      const data = await res.json();
      const results = (data.RelatedTopics || []).slice(0, limit).map((t: Record<string, unknown>) => ({
        title: t.Text,
        url: t.FirstURL,
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
      // Strip HTML tags for readability
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
      const lengthMap = { short: 200, medium: 500, long: 1200 };
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

    case "trigger_n8n_workflow": {
      const webhook = Deno.env.get("N8N_WEBHOOK_URL");
      if (!webhook) return { error: "n8n Webhook not configured in environment" };
      const res = await fetch(`${webhook}/oculops-bridge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: agentCode,
          workflow: args.workflow_id,
          data: args.payload,
          org_id: orgId,
          user_id: userId,
        }),
      });
      return res.ok ? { status: "Workflow triggered", workflow: args.workflow_id } : { error: "n8n trigger failed" };
    }

    default:
      return { error: `Unknown skill: ${name}` };
  }
}

// ─── Main: runBrain ───────────────────────────────────────────────────────────

export interface BrainInput {
  agent: string;
  goal: string;
  orgId?: string;
  userId?: string;
  context?: Record<string, unknown>;
  systemPromptExtra?: string;
  maxRounds?: number;
  model?: string;
}

export interface BrainOutput {
  ok: boolean;
  agent: string;
  goal: string;
  answer: string;
  skills_used: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  rounds: number;
  credits_used: number;
}

export async function runBrain(input: BrainInput): Promise<BrainOutput> {
  const { agent, goal, orgId, userId, context = {}, systemPromptExtra = "", maxRounds = 6, model = "gpt-4o" } = input;

  // ─── Credit check ───────────────────────────────────────────────────────
  let usedCustomKey = false;
  let apiKey = OPENAI_KEY();
  let totalCreditsUsed = 0;

  if (orgId) {
    const budget = await billing.checkBudget(orgId, "openai");
    if (!budget.canProceed) {
      return {
        ok: false, agent, goal,
        answer: "⚠️ Sin créditos disponibles. Añade créditos para continuar usando los agentes.",
        skills_used: [], rounds: 0, credits_used: 0,
      };
    }
    // Developer mode: use custom key if available
    if (budget.customKeyAvailable) {
      const customKey = await billing.getCustomKey(orgId, "openai");
      if (customKey) {
        apiKey = customKey;
        usedCustomKey = true;
      }
    }
  }

  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const systemPrompt = `You are ${agent.toUpperCase()}, an autonomous AI agent inside OCULOPS — a Growth Operating System for a Spanish AI agency.

Your current GOAL: ${goal}

You have HANDS — skills you can call to take real actions in the world:
- Read and write CRM data (contacts, deals, tasks, signals, alerts)
- Fetch real-time external data from 6,898+ APIs
- Search the web, fetch URLs
- Store and recall memories (knowledge base)
- Send Telegram notifications to the team
- Call other agents (atlas, hunter, oracle, forge, sentinel, herald, outreach)
- Generate emails, proposals, and content with GPT-4o

Rules:
- Be proactive. Don't just analyze — ACT. If you detect a problem, create an alert. If you find a lead, write it to CRM.
- Chain skills logically. You can call multiple skills in sequence.
- Store important findings in memory for future runs.
- When done, summarize what you did and what changed.
${systemPromptExtra}`;

  const messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Context:\n${JSON.stringify(context, null, 2)}\n\nExecute your goal now.` },
  ];

  const skillsUsed: BrainOutput["skills_used"] = [];
  let rounds = 0;
  let finalAnswer = "";
  const provider = model.startsWith("claude") ? "anthropic" : "openai";

  while (rounds < maxRounds) {
    rounds++;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        tools: SKILLS,
        tool_choice: "auto",
        max_tokens: 2000,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const usage = data.usage || {};

    // ─── Record usage & deduct credits ────────────────────────────────────
    if (orgId && usage.prompt_tokens) {
      const { creditsCharged } = await billing.recordUsage({
        orgId, userId, agentCode: agent,
        provider, model,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        usedCustomKey,
        metadata: { goal, round: rounds },
      });
      totalCreditsUsed += creditsCharged;
    }
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

      const result = await executeSkill(call.function.name, args, agent).catch((e) => ({ error: String(e) }));
      skillsUsed.push({ name: call.function.name, args, result });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return { ok: true, agent, goal, answer: finalAnswer, skills_used: skillsUsed, rounds, credits_used: totalCreditsUsed };
}
