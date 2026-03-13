/**
 * OCULOPS — Live Connector Router
 *
 * Routes plain-text intents to installed LIVE connectors only.
 * Enforces connector health and executes through api-proxy.
 */

import { admin } from "./supabase.ts";

interface CatalogEntry {
  slug: string;
  auth_type: string;
  category: string;
  docs_url: string;
}

interface ConnectorEndpoint {
  name?: string;
  sampleParams?: Record<string, unknown>;
}

interface LiveConnector {
  id: string;
  name: string;
  catalog_slug: string | null;
  capabilities: string[];
  endpoints: ConnectorEndpoint[];
  catalog?: CatalogEntry | null;
}

export interface AutoApiResult {
  ok: boolean;
  intent: string;
  api_used: string;
  endpoint_called: string;
  endpoint_name?: string | null;
  connector_id?: string | null;
  capability?: string | null;
  data: unknown;
  meta?: Record<string, unknown> | null;
  error?: string;
  candidates_found: number;
}

const INTENT_HINTS: Array<{ match: RegExp; capabilities: string[] }> = [
  { match: /\b(weather|forecast|temperature|rain|wind|storm)\b/i, capabilities: ["weather", "forecast", "spain_weather"] },
  { match: /\b(news|headline|article|guardian|breaking)\b/i, capabilities: ["news"] },
  { match: /\b(macro|gdp|inflation|unemployment|economic|fed funds)\b/i, capabilities: ["macro_data"] },
  { match: /\b(treasury|yield|bond|rate[s]?)\b/i, capabilities: ["treasury_data"] },
  { match: /\b(job|jobs|hiring|remote|vacancy)\b/i, capabilities: ["jobs", "hiring_signals"] },
  { match: /\b(geocode|address|postcode|postal|city)\b/i, capabilities: ["address_lookup", "geocoding", "territory_lookup"] },
  { match: /\b(route|travel|distance|eta|drive|car)\b/i, capabilities: ["routing", "travel_time"] },
  { match: /\b(email|disposable|verify mail|mail validity)\b/i, capabilities: ["email_validation"] },
  { match: /\b(website|preview|metadata|og:image|link card)\b/i, capabilities: ["website_preview"] },
  { match: /\b(openapi|swagger|spec)\b/i, capabilities: ["openapi_discovery"] },
];

function unique(values: string[] = []) {
  return [...new Set(values.filter(Boolean))];
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function extractUrl(text: string) {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0] || null;
}

function extractCoordinates(text: string): [string, string] | null {
  const matches = [...text.matchAll(/-?\d{1,3}\.\d+/g)].map(match => match[0]);
  if (matches.length >= 2) {
    return [matches[0], matches[1]];
  }
  return null;
}

function inferCapabilities(intent: string) {
  const hits = INTENT_HINTS.flatMap(hint => (hint.match.test(intent) ? hint.capabilities : []));
  return unique(hits);
}

function scoreConnector(connector: LiveConnector, intent: string, capabilities: string[], preferFree: boolean) {
  const haystack = `${connector.name} ${(connector.catalog?.category || "")} ${(connector.capabilities || []).join(" ")}`.toLowerCase();
  let score = 0;

  for (const capability of capabilities) {
    if ((connector.capabilities || []).map(cap => cap.toLowerCase()).includes(capability.toLowerCase())) {
      score += 25;
    }
  }

  if (capabilities.length === 0) {
    score += 5;
  }

  if (haystack.includes("weather") && /weather|forecast/i.test(intent)) score += 8;
  if (haystack.includes("news") && /news|headline|article/i.test(intent)) score += 8;
  if (haystack.includes("macro") && /macro|gdp|inflation|economic/i.test(intent)) score += 8;
  if (haystack.includes("treasury") && /treasury|yield|rate/i.test(intent)) score += 8;
  if (haystack.includes("jobs") && /jobs|hiring|remote/i.test(intent)) score += 8;

  if (preferFree && connector.catalog?.auth_type === "none") score += 6;
  return score;
}

async function loadLiveConnectors(preferFree: boolean): Promise<LiveConnector[]> {
  const { data: connectors, error: connectorsError } = await admin
    .from("api_connectors")
    .select("id,name,catalog_slug,capabilities,endpoints")
    .eq("is_active", true)
    .eq("health_status", "live");

  if (connectorsError) throw connectorsError;

  const rows = (connectors || []) as LiveConnector[];
  const slugs = rows.map(row => row.catalog_slug).filter(Boolean) as string[];
  const catalogBySlug = new Map<string, CatalogEntry>();

  if (slugs.length > 0) {
    const { data: catalogRows } = await admin
      .from("api_catalog_entries")
      .select("slug,auth_type,category,docs_url")
      .in("slug", slugs);

    for (const row of (catalogRows || []) as CatalogEntry[]) {
      catalogBySlug.set(row.slug, row);
    }
  }

  const merged = rows.map(connector => ({
    ...connector,
    capabilities: Array.isArray(connector.capabilities) ? connector.capabilities : [],
    endpoints: Array.isArray(connector.endpoints) ? connector.endpoints : [],
    catalog: connector.catalog_slug ? catalogBySlug.get(connector.catalog_slug) || null : null,
  }));

  if (!preferFree) return merged;
  return merged.sort((a, b) => {
    const aFree = a.catalog?.auth_type === "none" ? 1 : 0;
    const bFree = b.catalog?.auth_type === "none" ? 1 : 0;
    return bFree - aFree;
  });
}

function buildParams(intent: string, connector: LiveConnector, endpoint: ConnectorEndpoint | null, inferredCapabilities: string[]) {
  const params: Record<string, unknown> = { ...(endpoint?.sampleParams || {}) };
  const email = extractEmail(intent);
  const url = extractUrl(intent);
  const coordinates = extractCoordinates(intent);
  const lower = intent.toLowerCase();

  if (inferredCapabilities.includes("email_validation") && email) {
    params.email = email;
  }

  if (inferredCapabilities.includes("website_preview") && url) {
    params.url = url;
  }

  if ((inferredCapabilities.includes("address_lookup") || inferredCapabilities.includes("geocoding"))) {
    const query = intent.replace(/\b(geocode|address|lookup|find|search)\b/gi, "").trim();
    params.q = query || params.q || "Madrid, Spain";
    params.limit = params.limit || "5";
  }

  if (inferredCapabilities.includes("routing")) {
    if (coordinates) {
      params.points = [coordinates.join(","), "40.4168,-3.7038"];
    } else if (!params.points) {
      params.points = ["40.4168,-3.7038", "41.3874,2.1686"];
    }
    params.profile = params.profile || "car";
    params.instructions = params.instructions || "false";
  }

  if (inferredCapabilities.includes("news")) {
    if (!params.q) {
      params.q = lower.includes("technology") ? "technology" : "business";
    }
    params["page-size"] = params["page-size"] || "5";
  }

  if (inferredCapabilities.includes("macro_data")) {
    params.series_id = params.series_id || "FEDFUNDS";
    params.file_type = params.file_type || "json";
    params.limit = params.limit || "10";
    params.sort_order = params.sort_order || "desc";
  }

  if (inferredCapabilities.includes("weather")) {
    params.latitude = params.latitude || coordinates?.[0] || "40.4168";
    params.longitude = params.longitude || coordinates?.[1] || "-3.7038";
  }

  if (inferredCapabilities.includes("jobs")) {
    params.page = params.page || "1";
  }

  return params;
}

async function executeViaProxy(connector: LiveConnector, endpointName: string, params: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/api-proxy`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connector_id: connector.id,
      endpoint_name: endpointName,
      params,
      body: {},
      healthcheck: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function getMatchedCapability(connector: LiveConnector, inferredCapabilities: string[]) {
  for (const capability of inferredCapabilities) {
    if ((connector.capabilities || []).map(cap => cap.toLowerCase()).includes(capability.toLowerCase())) {
      return capability;
    }
  }
  return connector.capabilities?.[0] || null;
}

export async function autoConnectApi(
  intent: string,
  opts: { preferFree?: boolean; agentName?: string } = {},
): Promise<AutoApiResult> {
  const { preferFree = true, agentName } = opts;
  const connectors = await loadLiveConnectors(preferFree);

  if (connectors.length === 0) {
    return {
      ok: false,
      intent,
      api_used: "none",
      endpoint_called: "",
      endpoint_name: null,
      connector_id: null,
      capability: null,
      data: null,
      error: "No live connectors are available",
      candidates_found: 0,
      meta: null,
    };
  }

  const inferredCapabilities = inferCapabilities(intent);
  const ranked = connectors
    .map(connector => ({
      connector,
      score: scoreConnector(connector, intent, inferredCapabilities, preferFree),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked[0]?.connector || connectors[0];
  const endpoint = selected.endpoints?.[0] || null;
  const endpointName = endpoint?.name || null;

  if (!endpointName) {
    return {
      ok: false,
      intent,
      api_used: selected.name,
      endpoint_called: "",
      endpoint_name: null,
      connector_id: selected.id,
      capability: getMatchedCapability(selected, inferredCapabilities),
      data: null,
      error: "Selected connector has no endpoint configuration",
      candidates_found: connectors.length,
      meta: null,
    };
  }

  const params = buildParams(intent, selected, endpoint, inferredCapabilities);
  const { response, payload } = await executeViaProxy(selected, endpointName, params);
  const ok = response.ok && payload?.ok === true;

  if (agentName) {
    admin.from("agent_logs").insert({
      agent_code_name: agentName,
      action: "auto_api_connect",
      input: { intent, candidates_found: connectors.length, connector_id: selected.id },
      output: { ok, endpoint_name: endpointName, status: response.status },
      status: ok ? "success" : "error",
    }).then(() => {}, () => {});
  }

  return {
    ok,
    intent,
    api_used: selected.name,
    endpoint_called: endpointName,
    endpoint_name: endpointName,
    connector_id: selected.id,
    capability: getMatchedCapability(selected, inferredCapabilities),
    data: payload?.normalized ?? payload?.raw ?? payload ?? null,
    error: ok ? undefined : (payload?.error || `HTTP ${response.status}`),
    candidates_found: connectors.length,
    meta: payload?.meta || null,
  };
}

export async function autoConnectApiBatch(
  intents: string[],
  agentName?: string,
): Promise<AutoApiResult[]> {
  return Promise.all(intents.map(intent => autoConnectApi(intent, { agentName })));
}
