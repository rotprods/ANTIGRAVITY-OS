/**
 * OCULOPS — Auto API Connector
 *
 * Allows any agent to autonomously find and call APIs from the catalog
 * (6,898+ APIs) based on a plain-text intent, with zero hardcoding.
 *
 * Flow:
 *   1. Search `api_catalog` table for matching APIs (prefer auth=none)
 *   2. Use OpenAI to pick the best match + build the endpoint URL
 *   3. Execute the HTTP call directly
 *   4. Return structured result
 *
 * Usage:
 *   import { autoConnectApi } from "../_shared/auto-api-connector.ts";
 *   const result = await autoConnectApi("current weather in Madrid");
 */

import { admin } from "./supabase.ts";

interface ApiCatalogEntry {
  name: string;
  url: string;
  docs: string;
  description: string;
  category: string;
  auth: string;
  source: string;
}

export interface AutoApiResult {
  ok: boolean;
  intent: string;
  api_used: string;
  endpoint_called: string;
  data: unknown;
  error?: string;
  candidates_found: number;
}

// ─── Step 1: Find candidate APIs from catalog ─────────────────────────────────

async function findCandidates(intent: string, preferFree: boolean): Promise<ApiCatalogEntry[]> {
  const keywords = intent
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length > 3)
    .slice(0, 4);

  const orFilter = keywords
    .map((k) => `name.ilike.%${k}%,description.ilike.%${k}%,category.ilike.%${k}%`)
    .join(",");

  let q = admin
    .from("api_catalog")
    .select("name, url, docs, description, category, auth, source")
    .or(orFilter);

  if (preferFree) q = q.eq("auth", "none");

  const { data } = await q.limit(20);

  if (!data?.length) {
    // Fallback: drop auth filter
    const { data: fallback } = await admin
      .from("api_catalog")
      .select("name, url, docs, description, category, auth, source")
      .or(orFilter)
      .limit(20);
    return (fallback as ApiCatalogEntry[]) || [];
  }

  return data as ApiCatalogEntry[];
}

// ─── Step 2: OpenAI picks best API + builds endpoint URL ─────────────────────

async function routeWithAI(
  intent: string,
  candidates: ApiCatalogEntry[],
): Promise<{ api: ApiCatalogEntry; endpoint: string } | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const candidateList = candidates
    .map((c, i) => `${i + 1}. ${c.name} (${c.url}) — ${(c.description || "").slice(0, 100)}`)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an API routing expert. Given a user intent and candidate APIs, pick the BEST match and construct a working GET endpoint URL.
Return JSON: { "index": <1-based int>, "endpoint": "<absolute https:// URL>", "reason": "<brief>" }
Rules: endpoint must start with https://, no auth params, use common REST patterns if guessing.`,
        },
        {
          role: "user",
          content: `Intent: "${intent}"\n\nCandidates:\n${candidateList}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  try {
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");
    const idx = Math.max(0, (parsed.index || 1) - 1);
    const api = candidates[idx] || candidates[0];
    const endpoint = parsed.endpoint || api.url;
    if (!endpoint?.startsWith("http")) return null;
    return { api, endpoint };
  } catch {
    return null;
  }
}

// ─── Step 3: Execute the API call ────────────────────────────────────────────

async function executeCall(endpoint: string): Promise<{ data: unknown; ok: boolean; status: number }> {
  try {
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "oculops-agent/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 1000) }; }
    return { data, ok: res.ok, status: res.status };
  } catch {
    return { data: null, ok: false, status: 0 };
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function autoConnectApi(
  intent: string,
  opts: { preferFree?: boolean; agentName?: string } = {},
): Promise<AutoApiResult> {
  const { preferFree = true, agentName } = opts;

  const candidates = await findCandidates(intent, preferFree);

  if (!candidates.length) {
    return { ok: false, intent, api_used: "none", endpoint_called: "", data: null, error: "No matching APIs in catalog", candidates_found: 0 };
  }

  const route = await routeWithAI(intent, candidates);

  const target = route
    ? { api: route.api, endpoint: route.endpoint }
    : { api: candidates[0], endpoint: candidates[0].url };

  const call = await executeCall(target.endpoint);

  if (agentName) {
    admin.from("agent_logs").insert({
      agent_code_name: agentName,
      action: "auto_api_connect",
      input: { intent, candidates_found: candidates.length },
      output: { api: target.api.name, endpoint: target.endpoint, ok: call.ok },
      status: call.ok ? "success" : "error",
    }).then(() => {}, () => {});
  }

  return {
    ok: call.ok,
    intent,
    api_used: target.api.name,
    endpoint_called: target.endpoint,
    data: call.data,
    error: call.ok ? undefined : `HTTP ${call.status} from ${target.api.name}`,
    candidates_found: candidates.length,
  };
}

/** Resolve multiple intents in parallel */
export async function autoConnectApiBatch(
  intents: string[],
  agentName?: string,
): Promise<AutoApiResult[]> {
  return Promise.all(intents.map((i) => autoConnectApi(i, { agentName })));
}
