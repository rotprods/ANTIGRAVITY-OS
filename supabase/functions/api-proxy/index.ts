// ═══════════════════════════════════════════════════
// Edge Function: Generic API Proxy
// Executes installed public API connectors with normalization + health checks
// ═══════════════════════════════════════════════════

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type JsonRecord = Record<string, any>;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedValue(source: JsonRecord, path: string | undefined) {
    if (!path) return undefined;
    return path.split(".").reduce((value: any, segment) => {
        if (value == null) return undefined;
        return value[segment];
    }, source);
}

function cloneParams(params: JsonRecord = {}) {
    return JSON.parse(JSON.stringify(params));
}

function interpolatePath(pathTemplate: string, params: JsonRecord = {}) {
    const remaining = cloneParams(params);
    const resolvedPath = pathTemplate.replace(/\{([^}]+)\}/g, (_, key) => {
        const value = remaining[key];
        delete remaining[key];
        return encodeURIComponent(String(value ?? ""));
    });

    return { resolvedPath, remainingParams: remaining };
}

function buildRequestUrl(baseUrl: string, resolvedPath: string) {
    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/g, "");
    const nextPath = resolvedPath.replace(/^\/+/g, "");

    url.pathname = nextPath
        ? `${basePath}/${nextPath}`.replace(/\/{2,}/g, "/")
        : (basePath || "/");

    return url;
}

function appendSearchParams(url: URL, params: JsonRecord = {}, transforms: JsonRecord = {}) {
    Object.entries(params).forEach(([key, value]) => {
        if (value == null || value === "") return;

        const transform = transforms[key];

        if (typeof transform === "string" && transform.startsWith("repeat:")) {
            const queryKey = transform.replace("repeat:", "");
            const values = Array.isArray(value) ? value : [value];
            values.forEach(item => url.searchParams.append(queryKey, String(item)));
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(item => url.searchParams.append(key, String(item)));
            return;
        }

        url.searchParams.append(key, String(value));
    });
}

function validateAuthConfig(authType: string, authConfig: JsonRecord = {}) {
    switch (authType) {
        case "api_key":
            if (!authConfig.api_key) return "Missing api_key";
            return null;
        case "bearer":
            if (!authConfig.token) return "Missing bearer token";
            return null;
        case "basic":
            if (!authConfig.username || !authConfig.password) return "Missing basic auth credentials";
            return null;
        default:
            return null;
    }
}

function applyAuth(url: URL, headers: Record<string, string>, connector: JsonRecord) {
    const authConfig = isRecord(connector.auth_config) ? connector.auth_config : {};

    switch (connector.auth_type) {
        case "api_key":
            if (authConfig.header_name) {
                headers[String(authConfig.header_name)] = String(authConfig.api_key);
            } else {
                url.searchParams.set(String(authConfig.query_name || "api_key"), String(authConfig.api_key));
            }
            break;
        case "bearer":
            headers["Authorization"] = `Bearer ${authConfig.token}`;
            break;
        case "basic":
            headers["Authorization"] = `Basic ${btoa(`${authConfig.username}:${authConfig.password}`)}`;
            break;
    }
}

async function parseExternalResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function maybeFollowUp(raw: unknown, endpoint: JsonRecord, headers: Record<string, string>) {
    if (!endpoint.followUpField || !isRecord(raw)) return { raw, followUpUrl: null };

    const followUpUrl = getNestedValue(raw, String(endpoint.followUpField));
    if (!followUpUrl || typeof followUpUrl !== "string") return { raw, followUpUrl: null };

    const response = await fetch(followUpUrl, { headers });
    const followUpRaw = await parseExternalResponse(response);
    return { raw: followUpRaw, followUpUrl };
}

function normalizeResponse(normalizerKey: string | null, raw: any, meta: JsonRecord) {
    switch (normalizerKey) {
        case "administrative_divisions": {
            const divisions = Array.isArray(raw) ? raw : isRecord(raw) ? Object.values(raw) : [];
            return {
                countryCode: meta.params?.country_code || null,
                divisionCount: divisions.length,
                divisions,
            };
        }
        case "adresse_search": {
            const features = Array.isArray(raw?.features) ? raw.features : [];
            return {
                total: features.length,
                query: raw?.query || meta.params?.q || null,
                suggestions: features.map((feature: any) => ({
                    label: feature?.properties?.label,
                    score: feature?.properties?.score,
                    city: feature?.properties?.city,
                    postcode: feature?.properties?.postcode,
                    latitude: feature?.geometry?.coordinates?.[1] ?? null,
                    longitude: feature?.geometry?.coordinates?.[0] ?? null,
                })),
            };
        }
        case "graphhopper_route": {
            const path = raw?.paths?.[0];
            return {
                routes: raw?.paths?.length || 0,
                distanceKm: path?.distance ? Number(path.distance) / 1000 : null,
                durationMinutes: path?.time ? Number(path.time) / 60000 : null,
                points: path?.points || null,
            };
        }
        case "disify_email":
            return {
                email: meta.params?.email || null,
                format: raw?.format ?? null,
                disposable: raw?.disposable ?? null,
                dns: raw?.dns ?? null,
                free: raw?.free ?? null,
                mx: raw?.mx ?? null,
                raw,
            };
        case "disify_view":
            return {
                id: meta.params?.id || null,
                record: raw ?? null,
                raw,
            };
        case "microlink_preview":
            return raw?.data || raw;
        case "open_meteo_forecast":
            return {
                latitude: raw?.latitude ?? null,
                longitude: raw?.longitude ?? null,
                timezone: raw?.timezone ?? null,
                current: raw?.current ?? null,
                daily: raw?.daily ?? null,
            };
        case "aemet_observations": {
            const observations = Array.isArray(raw) ? raw : [];
            return {
                total: observations.length,
                stations: observations.slice(0, 20).map((item: any) => ({
                    station: item?.ubi || item?.nombre,
                    province: item?.provincia || null,
                    temperature: item?.ta ?? item?.temp ?? null,
                    humidity: item?.hr ?? null,
                    timestamp: item?.fint || item?.timestamp || null,
                })),
            };
        }
        case "guardian_search": {
            const results = Array.isArray(raw?.response?.results) ? raw.response.results : [];
            return {
                total: raw?.response?.total ?? results.length,
                items: results.map((item: any) => ({
                    id: item?.id,
                    webTitle: item?.webTitle,
                    sectionName: item?.sectionName,
                    webPublicationDate: item?.webPublicationDate,
                    webUrl: item?.webUrl,
                })),
            };
        }
        case "fred_series": {
            const observations = Array.isArray(raw?.observations) ? raw.observations : [];
            return {
                seriesId: meta.params?.series_id || null,
                total: observations.length,
                latest: observations[0] || null,
                observations: observations.slice(0, 20),
            };
        }
        case "treasury_rates": {
            const records = Array.isArray(raw?.data) ? raw.data : [];
            return {
                total: records.length,
                records: records.slice(0, 20),
                meta: raw?.meta || null,
            };
        }
        case "arbeitnow_jobs": {
            const jobs = Array.isArray(raw?.data) ? raw.data : [];
            return {
                total: jobs.length,
                jobs: jobs.slice(0, 20).map((job: any) => ({
                    slug: job?.slug,
                    company: job?.company_name,
                    title: job?.title,
                    location: job?.location,
                    remote: job?.remote,
                    url: job?.url,
                })),
                next: raw?.links?.next || null,
            };
        }
        case "apis_guru_list": {
            const providers = isRecord(raw) ? Object.entries(raw) : [];
            return {
                totalProviders: providers.length,
                providers: providers.slice(0, 20).map(([provider, value]) => ({
                    provider,
                    preferred: value?.preferred || null,
                    versions: isRecord(value?.versions) ? Object.keys(value.versions) : [],
                })),
            };
        }
        default:
            return raw;
    }
}

async function updateConnectorStatus(connector: JsonRecord, status: string) {
    const updates: JsonRecord = {
        last_synced_at: new Date().toISOString(),
    };

    if (status) {
        updates.health_status = status;
        updates.last_healthcheck_at = new Date().toISOString();
    }

    await supabase.from("api_connectors").update(updates).eq("id", connector.id);

    if (connector.catalog_slug) {
        await supabase
            .from("api_catalog_entries")
            .update({ activation_tier: status === "live" ? "live" : "adapter_ready" })
            .eq("slug", connector.catalog_slug);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return new Response(
            JSON.stringify({ ok: false, error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const supabaseUser = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
        return new Response(
            JSON.stringify({ ok: false, error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const { connector_id, endpoint_name, params, body: requestBody, healthcheck } = await req.json();
        if (!connector_id) {
            return new Response(
                JSON.stringify({ ok: false, error: "connector_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const connectorQuery = await supabase
            .from("api_connectors")
            .select("*")
            .eq("id", connector_id)
            .single();

        const connector = connectorQuery.data;

        if (connectorQuery.error || !connector) {
            return new Response(
                JSON.stringify({ ok: false, error: "Connector not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!connector.is_active) {
            return new Response(
                JSON.stringify({ ok: false, error: "Connector is disabled" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const authErrorMessage = validateAuthConfig(String(connector.auth_type || ""), connector.auth_config || {});
        if (authErrorMessage) {
            await updateConnectorStatus(connector, "error");
            return new Response(
                JSON.stringify({ ok: false, error: authErrorMessage, connector_id }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const endpoints = Array.isArray(connector.endpoints) ? connector.endpoints : [];
        const endpoint = healthcheck
            ? (connector.healthcheck_endpoint || endpoints[0] || null)
            : endpoints.find((candidate: any) => candidate.name === endpoint_name);

        if (!endpoint) {
            return new Response(
                JSON.stringify({
                    ok: false,
                    error: healthcheck ? "Healthcheck endpoint not configured" : `Endpoint '${endpoint_name}' not found`,
                    available: endpoints.map((candidate: any) => candidate.name),
                }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const inputParams = isRecord(params) ? params : {};
        const { resolvedPath, remainingParams } = interpolatePath(String(endpoint.path), inputParams);
        const url = buildRequestUrl(String(connector.base_url), resolvedPath);
        const headers: Record<string, string> = { "Content-Type": "application/json" };

        appendSearchParams(url, remainingParams, isRecord(endpoint.paramTransforms) ? endpoint.paramTransforms : {});
        applyAuth(url, headers, connector);

        const response = await fetch(url.toString(), {
            method: String(endpoint.method || "GET").toUpperCase(),
            headers,
            body: requestBody && ["POST", "PUT", "PATCH"].includes(String(endpoint.method || "GET").toUpperCase())
                ? JSON.stringify(requestBody)
                : undefined,
        });

        let raw = await parseExternalResponse(response);
        const followUp = await maybeFollowUp(raw, endpoint, headers);
        raw = followUp.raw;

        const normalizerKey = String(endpoint.normalizer_key || connector.normalizer_key || "");
        const normalized = normalizeResponse(normalizerKey || null, raw, {
            connector,
            params: inputParams,
            url: url.toString(),
            followUpUrl: followUp.followUpUrl,
        });

        const ok = response.ok && !(isRecord(raw) && raw.error);
        if (healthcheck) {
            await updateConnectorStatus(connector, ok ? "live" : "error");
        } else if (ok) {
            await supabase
                .from("api_connectors")
                .update({ last_synced_at: new Date().toISOString() })
                .eq("id", connector.id);
        }

        const payload = {
            ok,
            status: response.status,
            connector_id,
            endpoint_name: String(endpoint.name || endpoint_name || "healthcheck"),
            normalized,
            raw,
            data: raw,
            meta: {
                url: url.toString(),
                method: String(endpoint.method || "GET").toUpperCase(),
                normalizer_key: normalizerKey || null,
                healthcheck: Boolean(healthcheck),
                follow_up_url: followUp.followUpUrl,
                timestamp: new Date().toISOString(),
            },
        };

        return new Response(
            JSON.stringify(payload),
            { status: ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("[api-proxy] error:", err);
        return new Response(
            JSON.stringify({ ok: false, error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
