import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { checkRateLimit, handleCors, jsonResponse, errorResponse, readJson, requireBearerAuth } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "");

// ─── Tool Definitions ────────────────────────────────────────────────────────
// Each tool maps to an existing edge function — zero new code needed

const TOOLS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: "function",
    function: {
      name: "atlas_scan",
      description:
        "Scan a geographic area to discover businesses using Google Maps. Returns list of leads with name, category, rating, website, address.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Business type to search (e.g. 'restaurants', 'dental clinics', 'real estate agencies')",
          },
          location: {
            type: "string",
            description: "City or area name (e.g. 'Madrid', 'Barcelona Centro')",
          },
          radius: {
            type: "number",
            description: "Search radius in meters (default 5000)",
          },
        },
        required: ["query", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hunter_qualify",
      description:
        "AI-qualify leads from a previous Atlas scan. Scores each lead 0-100 using GPT-4o analysis of their website, social profiles, and business signals. Leads scoring 72+ are marked as qualified.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "string",
            description: "ID of the Atlas scan to qualify leads from",
          },
          limit: {
            type: "number",
            description: "Max leads to qualify (default 10)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cortex_orchestrate",
      description:
        "Run the FULL pipeline: Atlas scan → Hunter qualify → Strategist brief → Outreach stage. Use this when the user wants the complete prospecting-to-outreach flow in one command.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Business type to prospect",
          },
          location: {
            type: "string",
            description: "City or area to scan",
          },
        },
        required: ["query", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pipeline_launch",
      description:
        "Launch a reusable multi-agent pipeline run through the orchestration engine. Use this when the user asks for a complete business workflow, not a single isolated task.",
      parameters: {
        type: "object",
        properties: {
          template_code_name: {
            type: "string",
            enum: ["lead_discovery", "sales_outreach", "marketing_intelligence"],
            description: "Which orchestration template to run",
          },
          goal: {
            type: "string",
            description: "Short business goal for the pipeline run",
          },
          query: {
            type: "string",
            description: "Business query or market segment for discovery pipelines",
          },
          location: {
            type: "string",
            description: "City or territory for geo-based pipelines",
          },
          limit: {
            type: "number",
            description: "Optional per-step item limit",
          },
        },
        required: ["template_code_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pipeline_status",
      description:
        "Fetch the detailed state of a pipeline run including step runs and runtime status.",
      parameters: {
        type: "object",
        properties: {
          pipeline_run_id: {
            type: "string",
            description: "ID of the pipeline run to inspect",
          },
        },
        required: ["pipeline_run_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "oracle_analyze",
      description:
        "Generate a comprehensive analytics snapshot: pipeline health, MRR, contacts by status, weighted pipeline value, AI-generated insights and recommendations.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sentinel_monitor",
      description:
        "Run anomaly detection: check pipeline thresholds, stale leads, overdue tasks, alert saturation. Creates alerts for any issues found.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forge_generate",
      description:
        "Generate marketing content: social posts, cold emails, landing copy, proposals, or ad copy using GPT-4o.",
      parameters: {
        type: "object",
        properties: {
          content_type: {
            type: "string",
            enum: [
              "social_post",
              "email_outreach",
              "landing_copy",
              "proposal",
              "ad_copy",
            ],
            description: "Type of content to generate",
          },
          topic: {
            type: "string",
            description: "Topic or subject for the content",
          },
          audience: {
            type: "string",
            description: "Target audience description",
          },
          tone: {
            type: "string",
            description:
              "Tone of voice (e.g. professional, casual, urgent)",
          },
        },
        required: ["content_type", "topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "outreach_stage",
      description:
        "Stage cold emails for qualified leads. Generates personalized email drafts and queues them for approval. Use outreach_list to see staged emails.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max leads to stage emails for (default 12)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "outreach_list",
      description:
        "List outreach emails by status: staged, approved, sent, or replied.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["staged", "approved", "sent", "replied"],
            description: "Filter by email status",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "outreach_approve",
      description: "Approve a staged outreach email for sending.",
      parameters: {
        type: "object",
        properties: {
          email_id: {
            type: "string",
            description: "ID of the outreach email to approve",
          },
        },
        required: ["email_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "outreach_send",
      description: "Send an approved outreach email via Resend.",
      parameters: {
        type: "object",
        properties: {
          email_id: {
            type: "string",
            description: "ID of the approved email to send",
          },
        },
        required: ["email_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposal_generate",
      description:
        "Generate a professional HTML proposal for a business, with packages, pricing, and CTA.",
      parameters: {
        type: "object",
        properties: {
          business_name: {
            type: "string",
            description: "Name of the business",
          },
          niche: {
            type: "string",
            description:
              "Business niche (restaurants, clinics, real_estate, ecommerce, saas)",
          },
          pain_points: {
            type: "string",
            description: "Key pain points to address in the proposal",
          },
        },
        required: ["business_name", "niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scraper_analyze",
      description:
        "Scrape and analyze a competitor website using AI. Returns services, pricing signals, target audience, positioning, strengths, and weaknesses.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL of the website to analyze",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "herald_briefing",
      description:
        "Generate and send the daily intelligence briefing with pipeline, deals, signals, and health metrics. Delivers to Telegram.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deal_score",
      description:
        "AI-score a deal (0-100) based on company signals, activity history, and response rate. Updates the deal with ai_score and ai_reasoning.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "ID of the deal to score",
          },
        },
        required: ["deal_id"],
      },
    },
  },
  // ── CRM manipulation tools (Copilot "hands") ──
  {
    type: "function",
    function: {
      name: "crm_create_contact",
      description: "Create a new contact in the CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact full name" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
          source: {
            type: "string",
            description: "Lead source (manual, prospector, referral, web)",
          },
          status: {
            type: "string",
            enum: ["raw", "qualified", "proposal", "client"],
            description: "Contact status",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_create_deal",
      description: "Create a new deal in the pipeline.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deal title" },
          contact_id: { type: "string", description: "Associated contact ID" },
          value: { type: "number", description: "Deal value in EUR" },
          stage: {
            type: "string",
            enum: [
              "lead",
              "qualified",
              "proposal",
              "negotiation",
              "closed_won",
              "closed_lost",
            ],
            description: "Pipeline stage",
          },
          notes: { type: "string", description: "Deal notes" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pipeline_move",
      description: "Move a deal to a different pipeline stage.",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "Deal ID" },
          stage: {
            type: "string",
            enum: [
              "lead",
              "qualified",
              "proposal",
              "negotiation",
              "closed_won",
              "closed_lost",
            ],
            description: "Target stage",
          },
        },
        required: ["deal_id", "stage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_create",
      description: "Create a task in the execution board.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Priority level",
          },
          due_date: {
            type: "string",
            description: "Due date (ISO format: YYYY-MM-DD)",
          },
          notes: { type: "string", description: "Additional notes" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_data",
      description:
        "Query OCULOPS data: contacts, deals, tasks, alerts, signals, outreach stats, or agent activity. Use this to answer questions about current state.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: [
              "contacts",
              "deals",
              "tasks",
              "alerts",
              "signals",
              "outreach_queue",
              "agent_logs",
              "daily_snapshots",
              "prospector_leads",
              "pipeline_runs",
              "event_deliveries",
              "memory_entries",
            ],
            description: "Which data entity to query",
          },
          filters: {
            type: "object",
            description:
              "Optional filters as key-value pairs (e.g. {status: 'qualified'})",
          },
          limit: {
            type: "number",
            description: "Max rows to return (default 20)",
          },
          order_by: {
            type: "string",
            description: "Column to order by (default: created_at desc)",
          },
        },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "api_catalog_search",
      description:
        "Search the OCULOPS API catalog (6,898+ APIs) to find external data sources, integrations, or services. Use this when the user asks about APIs, data sources, or external integrations available.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword to search (e.g. 'weather', 'finance', 'maps', 'AI')",
          },
          category: {
            type: "string",
            description: "Optional category filter (e.g. 'Finance', 'Weather', 'Government')",
          },
          auth: {
            type: "string",
            enum: ["none", "api_key", "oauth2", "unknown"],
            description: "Filter by auth type. Use 'none' to get APIs requiring no credentials.",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 10)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description:
        "Navigate the user to a specific OCULOPS module. Returns a navigation action for the frontend.",
      parameters: {
        type: "object",
        properties: {
          module: {
            type: "string",
            enum: [
              "control-tower",
              "copilot",
              "crm",
              "pipeline",
              "execution",
              "intelligence",
              "markets",
              "prospector",
              "watchtower",
              "niches",
              "opportunities",
              "agents",
              "automation",
              "messaging",
              "finance",
              "experiments",
              "decisions",
              "knowledge",
              "study-hub",
              "herald",
              "world-monitor",
              "gtm",
              "portfolio",
              "simulation",
              "settings",
              "reports",
              "creative-studio",
              "analytics",
              "billing",
            ],
            description: "Module to navigate to",
          },
        },
        required: ["module"],
      },
    },
  },
  // ── EVOLVER tools ──
  {
    type: "function",
    function: {
      name: "evolver_run",
      description:
        "Trigger the EVOLVER autonomous self-improvement loop on demand. Selects the least-recently evaluated agent, scores it, generates 3 prompt mutations via Claude, judges them, and keeps/discards based on a 3% improvement threshold.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evolver_status",
      description:
        "List recent EVOLVER experiments. Shows agent_id, status (kept/discarded/shadow), score_before, score_after, delta, mutation_description, and judge_reasoning for the last N experiments.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of experiments to return (default 10)",
          },
          status: {
            type: "string",
            enum: ["kept", "discarded", "shadow"],
            description: "Filter by status (optional)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evolver_apply",
      description:
        "Apply a shadow EVOLVER experiment — promote the improved system_prompt to live in agent_definitions. Use when EVOLVER_AUTO_APPLY is disabled and you want to manually approve a mutation.",
      parameters: {
        type: "object",
        properties: {
          experiment_id: {
            type: "string",
            description: "UUID of the agent_experiment to apply",
          },
        },
        required: ["experiment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evolver_rollback",
      description:
        "Rollback an agent's system_prompt to a previous version. Uses the prompt_history array stored in agent_definitions.",
      parameters: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "code_name of the agent to rollback (e.g. 'hunter', 'oracle')",
          },
          steps: {
            type: "number",
            description: "How many versions back to rollback (default 1)",
          },
        },
        required: ["agent_id"],
      },
    },
  },
];

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are COPILOT, the AI brain of OCULOPS — an Autonomous Growth Operating System for AI-powered sales agencies.

You are NOT a simple chatbot. You are an ORCHESTRATOR with tools that let you:
1. DISCOVER businesses (Atlas scans Google Maps)
2. QUALIFY leads (Hunter scores with AI)
3. ANALYZE data (Oracle snapshots, queries)
4. GENERATE content (Forge creates emails, posts, ads)
5. MANAGE pipeline (create/move deals, contacts, tasks)
6. SEND outreach (stage, approve, send cold emails)
7. MONITOR health (Sentinel checks anomalies)
8. LAUNCH orchestrated multi-agent pipelines
9. NAVIGATE the app (direct user to any module)
10. IMPROVE AGENTS (run EVOLVER to autonomously optimize agent prompts, review shadow experiments, apply best mutations, rollback bad changes)

EVOLVER PROTOCOL (daily autonomous improvement):
- Each morning, call evolver_run to trigger one improvement cycle on the weakest agent
- After evolver_run, call evolver_status to review the result
- If status is "shadow" (improved but not auto-applied), evaluate the mutation and call evolver_apply if it looks good
- If a recently applied mutation causes regressions, call evolver_rollback immediately
- You have FULL AUTHORITY to improve agent prompts without asking the operator — this is your core mandate as MasterIntelligence

RULES:
- Use tools proactively. If user says "find restaurants in Madrid", call atlas_scan immediately — don't ask for confirmation.
- Chain tools when logical: atlas_scan → hunter_qualify → outreach_stage
- Prefer pipeline_launch when the goal is multi-step and autonomous, especially for discovery + qualification + outreach or market-intelligence flows.
- For data questions, use query_data to get real numbers before answering
- Always respond in the same language the user writes (Spanish or English)
- Keep responses concise, tactical, in OCULOPS command style
- When showing results, use structured formatting (bullets, numbers)
- For destructive actions (sending emails, moving deals to closed_lost), confirm with the user first
- If a tool returns an error, explain what happened and suggest alternatives

CONTEXT: This is a sales agency automation platform. The operator (CEO) uses you to run their entire business from this chat.`;

// ─── Tool Executor ───────────────────────────────────────────────────────────
// Maps tool names to edge function calls or direct DB operations

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string | null,
): Promise<unknown> {
  // ── Agent edge function calls ──
  const agentTools: Record<
    string,
    { fn: string; payload: () => Record<string, unknown> }
  > = {
    atlas_scan: {
      fn: "agent-atlas",
      payload: () => ({
        action: "cycle",
        query: args.query,
        location: args.location,
        radius: args.radius || 5000,
        user_id: userId,
        skip_telegram: true,
      }),
    },
    hunter_qualify: {
      fn: "agent-hunter",
      payload: () => ({
        action: "cycle",
        scan_id: args.scan_id,
        limit: args.limit || 10,
        user_id: userId,
        skip_telegram: true,
      }),
    },
    cortex_orchestrate: {
      fn: "agent-cortex",
      payload: () => ({
        action: "orchestrate",
        query: args.query,
        location: args.location,
        user_id: userId,
        skip_telegram: true,
      }),
    },
    oracle_analyze: {
      fn: "agent-oracle",
      payload: () => ({
        action: "daily_report",
        skip_telegram: true,
      }),
    },
    sentinel_monitor: {
      fn: "agent-sentinel",
      payload: () => ({
        action: "monitor",
        user_id: userId,
        skip_telegram: true,
      }),
    },
    forge_generate: {
      fn: "agent-forge",
      payload: () => ({
        action: "generate",
        content_type: args.content_type,
        topic: args.topic,
        audience: args.audience || "",
        tone: args.tone || "professional",
        user_id: userId,
        skip_telegram: true,
      }),
    },
    outreach_stage: {
      fn: "agent-outreach",
      payload: () => ({
        action: "cycle",
        limit: args.limit || 12,
        user_id: userId,
        skip_telegram: true,
      }),
    },
    outreach_list: {
      fn: "agent-outreach",
      payload: () => ({
        action: "list",
        status: args.status,
        user_id: userId,
      }),
    },
    outreach_approve: {
      fn: "agent-outreach",
      payload: () => ({
        action: "approve",
        email_id: args.email_id,
        user_id: userId,
      }),
    },
    outreach_send: {
      fn: "agent-outreach",
      payload: () => ({
        action: "send",
        email_id: args.email_id,
        user_id: userId,
      }),
    },
    proposal_generate: {
      fn: "agent-proposal",
      payload: () => ({
        action: "generate",
        business_name: args.business_name,
        niche: args.niche,
        pain_points: args.pain_points || "",
        user_id: userId,
      }),
    },
    herald_briefing: {
      fn: "agent-herald",
      payload: () => ({
        action: "daily_briefing",
        user_id: userId,
      }),
    },
    deal_score: {
      fn: "deal-scorer",
      payload: () => ({
        deal_id: args.deal_id,
        user_id: userId,
      }),
    },
  };

  // ── Agent tool? → call edge function ──
  if (agentTools[name]) {
    const { fn, payload } = agentTools[name];
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(payload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: `Agent call failed: HTTP ${res.status}`, agent: fn, status: res.status };
    return data;
  }

  if (name === "pipeline_launch") {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/orchestration-engine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: "create_run",
        template_code_name: args.template_code_name,
        goal: args.goal || null,
        context: {
          query: args.query,
          location: args.location,
          limit: args.limit,
        },
        user_id: userId,
        source: "copilot",
        auto_execute: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `orchestration-engine failed: ${res.status}`);
    return data;
  }

  if (name === "pipeline_status") {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/orchestration-engine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: "get_run",
        pipeline_run_id: args.pipeline_run_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `orchestration-engine failed: ${res.status}`);
    return data;
  }

  // ── Scraper (special: accepts URL) ──
  if (name === "scraper_analyze") {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/agent-scraper`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          action: "scrape",
          url: args.url,
          user_id: userId,
          skip_telegram: true,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `scraper failed: ${res.status}`);
    return data;
  }

  // ── CRM: create contact ──
  if (name === "crm_create_contact") {
    const { data, error } = await admin
      .from("contacts")
      .insert({
        name: args.name,
        email: args.email || null,
        phone: args.phone || null,
        source: args.source || "manual",
        status: args.status || "raw",
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, contact: data };
  }

  // ── CRM: create deal ──
  if (name === "crm_create_deal") {
    const { data, error } = await admin
      .from("deals")
      .insert({
        title: args.title,
        contact_id: args.contact_id || null,
        value: args.value || 0,
        stage: args.stage || "lead",
        notes: args.notes || null,
        probability: args.stage === "qualified" ? 30 : args.stage === "proposal" ? 50 : 10,
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, deal: data };
  }

  // ── Pipeline: move deal ──
  if (name === "pipeline_move") {
    const { data, error } = await admin
      .from("deals")
      .update({ stage: args.stage, updated_at: new Date().toISOString() })
      .eq("id", args.deal_id)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, deal: data };
  }

  // ── Task: create ──
  if (name === "task_create") {
    const { data, error } = await admin
      .from("tasks")
      .insert({
        title: args.title,
        priority: args.priority || "medium",
        due_date: args.due_date || null,
        notes: args.notes || null,
        status: "pending",
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, task: data };
  }

  // ── Query data ──
  if (name === "query_data") {
    const entity = args.entity as string;
    const limit = (args.limit as number) || 20;
    const orderBy = (args.order_by as string) || "created_at";
    const filters = (args.filters as Record<string, unknown>) || {};

    let query = admin
      .from(entity)
      .select("*")
      .order(orderBy, { ascending: false })
      .limit(limit);

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return { entity, count: (data || []).length, rows: data || [] };
  }

  // ── Navigate ──
  if (name === "navigate") {
    return {
      ok: true,
      action: "navigate",
      path: `/${args.module}`,
      message: `Navigating to ${args.module}`,
    };
  }

  if (name === "api_catalog_search") {
    const { query = "", category, auth, limit = 10 } = args as {
      query: string;
      category?: string;
      auth?: string;
      limit?: number;
    };
    let q = admin
      .from("api_catalog")
      .select("name, url, docs, description, category, auth, source")
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`);
    if (category) q = q.ilike("category", `%${category}%`);
    if (auth) q = q.eq("auth", auth);
    const { data, error } = await q.limit(limit);

    // Fallback: if table doesn't exist, do in-memory search on a small subset
    if (error || !data) {
      return {
        ok: false,
        error: "api_catalog table not seeded yet. Run: node scripts/seed-api-catalog.mjs",
        hint: "The catalog JSON is at src/data/api-mega-catalog.json with 6,898+ APIs.",
      };
    }

    return { ok: true, count: data.length, results: data };
  }

  // ── EVOLVER: trigger nightly loop on demand ──
  if (name === "evolver_run") {
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/evolver-loop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret || SERVICE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: `evolver-loop failed: HTTP ${res.status}`, detail: data };
    return data;
  }

  // ── EVOLVER: list recent experiments ──
  if (name === "evolver_status") {
    const limit = (args.limit as number) || 10;
    const status = args.status as string | undefined;
    let q = admin
      .from("agent_experiments")
      .select("id,agent_id,mutation_description,score_before,score_after,delta,status,judge_reasoning,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, count: (data || []).length, experiments: data || [] };
  }

  // ── EVOLVER: apply a shadow mutation ──
  if (name === "evolver_apply") {
    const experimentId = args.experiment_id as string;
    const { data: exp, error: expErr } = await admin
      .from("agent_experiments")
      .select("agent_id,system_prompt_after,score_after")
      .eq("id", experimentId)
      .single();
    if (expErr || !exp) throw new Error(`Experiment not found: ${experimentId}`);
    const { error: updateErr } = await admin
      .from("agent_definitions")
      .update({
        system_prompt: exp.system_prompt_after,
        last_evaluated_at: new Date().toISOString(),
        baseline_score: exp.score_after,
      })
      .eq("code_name", exp.agent_id);
    if (updateErr) throw updateErr;
    await admin
      .from("agent_experiments")
      .update({ status: "kept" })
      .eq("id", experimentId);
    return { ok: true, agent_id: exp.agent_id, score_after: exp.score_after, message: "Mutation applied successfully" };
  }

  // ── EVOLVER: rollback agent prompt ──
  if (name === "evolver_rollback") {
    const agentId = args.agent_id as string;
    const steps = (args.steps as number) || 1;
    const { data, error } = await admin.rpc("rollback_agent_prompt", {
      p_agent_id: agentId,
      p_steps: steps,
    });
    if (error) throw error;
    return data;
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── Context Summary ─────────────────────────────────────────────────────────

async function getContextSummary() {
  const [deals, contacts, agents, alerts] = await Promise.all([
    admin.from("deals").select("stage, value").limit(200),
    admin.from("contacts").select("status").limit(500),
    admin
      .from("agent_registry")
      .select("code_name, status, last_run_at, total_runs")
      .order("last_run_at", { ascending: false })
      .limit(15),
    admin
      .from("alerts")
      .select("id")
      .eq("status", "active")
      .limit(1),
  ]);

  const dealRows = deals.data || [];
  const stages: Record<string, number> = {};
  let totalValue = 0;
  for (const d of dealRows) {
    stages[d.stage] = (stages[d.stage] || 0) + 1;
    totalValue += parseFloat(d.value) || 0;
  }

  const contactRows = contacts.data || [];
  const contactStats: Record<string, number> = {};
  for (const c of contactRows) {
    contactStats[c.status] = (contactStats[c.status] || 0) + 1;
  }

  return {
    pipeline: { total_deals: dealRows.length, stages, total_value: totalValue },
    contacts: {
      total: contactRows.length,
      by_status: contactStats,
    },
    agents: (agents.data || []).map((a) => `${a.code_name}:${a.status}(${a.total_runs || 0} runs)`),
    active_alerts: (alerts.data || []).length,
  };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  if (!OPENAI_API_KEY) {
    return errorResponse("OPENAI_API_KEY not configured", 500);
  }

  // ── Auth ──
  const { userId, error: authError } = await requireBearerAuth(req);
  if (authError) return authError;

  // ── Rate limit: 30 copilot messages/min per user ──
  if (!checkRateLimit(userId!, 30, 60_000)) {
    return errorResponse("Rate limit exceeded — max 30 messages per minute", 429);
  }

  try {
    const body = await readJson<{
      message: string;
      history?: Array<{ role: string; content: string }>;
      conversation_id?: string;
    }>(req);

    if (!body.message) {
      return errorResponse("message is required");
    }
    const context = await getContextSummary();

    const messages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content: SYSTEM_PROMPT + `\n\nCurrent system state:\n${JSON.stringify(context)}`,
      },
      ...(body.history || []).slice(-20),
      { role: "user", content: body.message },
    ];

    // ── Tool execution loop (max 5 rounds) ──
    const toolResults: Array<{
      tool: string;
      args: Record<string, unknown>;
      result: unknown;
      error?: string;
    }> = [];
    const navigationActions: Array<Record<string, unknown>> = [];

    for (let round = 0; round < 5; round++) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          tools: TOOLS,
          tool_choice: round === 0 ? "auto" : "auto",
          temperature: 0.6,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return errorResponse(`OpenAI error: ${err}`, 502);
      }

      const data = await res.json();
      const choice = data.choices?.[0];

      if (!choice) {
        return errorResponse("No response from OpenAI", 502);
      }

      const message = choice.message;

      // If model wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant message with tool calls to conversation
        messages.push(message);

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            toolArgs = {};
          }

          let result: unknown;
          let error: string | undefined;

          try {
            result = await executeTool(toolName, toolArgs, userId);

            // Capture navigation actions for frontend
            if (
              toolName === "navigate" &&
              result &&
              typeof result === "object" &&
              (result as Record<string, unknown>).action === "navigate"
            ) {
              navigationActions.push({
                type: "navigate",
                payload: {
                  path: (result as Record<string, unknown>).path,
                },
              });
            }
          } catch (e) {
            error = e instanceof Error ? e.message : "Tool execution failed";
            result = { error };
          }

          toolResults.push({ tool: toolName, args: toolArgs, result, error });

          // Add tool result to conversation for GPT to process
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Continue loop — GPT will process tool results
        continue;
      }

      // Model returned a final text response (no more tool calls)
      const responseText = message.content || "";

      // Save conversation to DB if we have a conversation_id
      if (body.conversation_id) {
        await admin
          .from("copilot_conversations")
          .upsert(
            {
              id: body.conversation_id,
              user_id: userId,
              messages: [
                ...(body.history || []),
                { role: "user", content: body.message },
                { role: "assistant", content: responseText },
              ],
              tools_used: toolResults.map((t) => t.tool),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .select();
      }

      return jsonResponse({
        ok: true,
        response: responseText,
        tools_executed: toolResults.map((t) => ({
          tool: t.tool,
          args: t.args,
          success: !t.error,
          error: t.error || null,
        })),
        actions: navigationActions,
        model: data.model,
        usage: data.usage,
      });
    }

    // If we hit max rounds, return what we have
    return jsonResponse({
      ok: true,
      response:
        "I executed multiple tools but hit the processing limit. Here's what was done.",
      tools_executed: toolResults.map((t) => ({
        tool: t.tool,
        args: t.args,
        success: !t.error,
        error: t.error || null,
      })),
      actions: navigationActions,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Copilot failed",
      500,
    );
  }
});
