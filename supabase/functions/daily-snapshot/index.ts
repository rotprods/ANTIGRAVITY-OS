// ═══════════════════════════════════════════════════
// Edge Function: Daily Snapshot
// Captures daily metrics for sparkline history
// Schedule: Trigger via pg_cron with CRON_SECRET header
// ═══════════════════════════════════════════════════

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTERNAL_AUTH_HEADER = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`;
const PUBLIC_FUNCTIONS_BASE = `${Deno.env.get("SUPABASE_URL")!}/functions/v1`;

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type ConnectorFeed = {
    id: string;
    name: string;
    endpoint_name: string | null;
    capabilities: string[];
    sample_params: Record<string, unknown>;
};

function pickFeedConnector(connectors: ConnectorFeed[], capabilities: string[]) {
    const normalized = new Set(capabilities.map(item => item.toLowerCase()));
    return connectors.find(connector =>
        (connector.capabilities || []).some(cap => normalized.has(String(cap).toLowerCase()))
    ) || null;
}

function summarizeFeedPayload(payload: any) {
    const normalized = payload?.normalized ?? payload?.raw ?? payload;

    if (normalized == null) return null;
    if (Array.isArray(normalized)) return normalized.slice(0, 5);
    if (typeof normalized !== "object") return normalized;

    const summary: Record<string, unknown> = {};
    const keys = ["total", "routes", "distanceKm", "durationMinutes", "seriesId", "latest", "timezone", "next", "totalProviders"];
    for (const key of keys) {
        if (normalized[key] !== undefined) summary[key] = normalized[key];
    }

    if (Array.isArray(normalized.items)) summary.items = normalized.items.slice(0, 5);
    if (Array.isArray(normalized.jobs)) summary.jobs = normalized.jobs.slice(0, 5);
    if (Array.isArray(normalized.records)) summary.records = normalized.records.slice(0, 5);
    if (Array.isArray(normalized.observations)) summary.observations = normalized.observations.slice(0, 5);
    if (Array.isArray(normalized.providers)) summary.providers = normalized.providers.slice(0, 5);
    if (normalized.current) summary.current = normalized.current;

    return Object.keys(summary).length > 0 ? summary : normalized;
}

async function runConnectorFeed(connector: ConnectorFeed | null) {
    if (!connector) return { ok: false, reason: "connector_unavailable" };

    const response = await fetch(`${PUBLIC_FUNCTIONS_BASE}/api-proxy`, {
        method: "POST",
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Authorization": INTERNAL_AUTH_HEADER,
        },
        body: JSON.stringify({
            connector_id: connector.id,
            endpoint_name: connector.endpoint_name,
            params: connector.sample_params || {},
            healthcheck: false,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    return {
        ok: response.ok && payload?.ok === true,
        status: response.status,
        connector_id: connector.id,
        connector_name: connector.name,
        endpoint_name: connector.endpoint_name,
        summary: summarizeFeedPayload(payload),
        error: payload?.error || null,
        meta: payload?.meta || null,
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    // Only callable by trusted cron scheduler (Bearer CRON_SECRET)
    const authHeader = req.headers.get("Authorization");
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id");

        if (!profiles || profiles.length === 0) {
            return new Response(
                JSON.stringify({ message: "No profiles found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const results = [];

        for (const profile of profiles) {
            const userId = profile.id;

            const { data: deals } = await supabase
                .from("deals")
                .select("monthly_value, stage")
                .eq("user_id", userId)
                .in("stage", ["closed_won", "onboarding"]);

            const mrr = (deals || []).reduce(
                (sum: number, d: any) => sum + (parseFloat(d.monthly_value) || 0),
                0
            );

            const { count: clients } = await supabase
                .from("deals")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .in("stage", ["closed_won", "onboarding"]);

            const { data: pipelineDeals } = await supabase
                .from("deals")
                .select("value")
                .eq("user_id", userId)
                .not("stage", "in", '("closed_won","closed_lost")');

            const pipelineTotal = (pipelineDeals || []).reduce(
                (sum: number, d: any) => sum + (parseFloat(d.value) || 0),
                0
            );

            const { count: activeAlerts } = await supabase
                .from("alerts")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("status", "active");

            const { data: tasks } = await supabase
                .from("tasks")
                .select("status")
                .eq("user_id", userId);

            const totalTasks = (tasks || []).length;
            const doneTasks = (tasks || []).filter((t: any) => t.status === "done").length;
            const taskCompletionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

            const mrrScore = Math.min(mrr / 200, 100);
            const pipelineScore = Math.min(pipelineTotal / 500, 100);
            const executionScore = taskCompletionPct;
            const alertPenalty = Math.max(0, 100 - (activeAlerts || 0) * 10);
            const healthScore = Math.round(
                mrrScore * 0.35 + executionScore * 0.25 + pipelineScore * 0.25 + alertPenalty * 0.15
            );

            const { data: connectors } = await supabase
                .from("api_connectors")
                .select("id, name, catalog_slug, template_key, capabilities, health_status, last_healthcheck_at, endpoints")
                .eq("is_active", true)
                .eq("health_status", "live");

            const connectorFeeds: ConnectorFeed[] = (connectors || []).map((connector: any) => ({
                id: connector.id,
                name: connector.name,
                capabilities: connector.capabilities || [],
                endpoint_name: Array.isArray(connector.endpoints) ? connector.endpoints[0]?.name || null : null,
                sample_params: Array.isArray(connector.endpoints) ? connector.endpoints[0]?.sampleParams || {} : {},
            }));

            const feedConfig = {
                weather: ["weather", "forecast", "spain_weather"],
                macro: ["macro_data"],
                treasury: ["treasury_data"],
                jobs: ["jobs", "hiring_signals"],
                news: ["news"],
            };

            const [weatherFeed, macroFeed, treasuryFeed, jobsFeed, newsFeed] = await Promise.all([
                runConnectorFeed(pickFeedConnector(connectorFeeds, feedConfig.weather)),
                runConnectorFeed(pickFeedConnector(connectorFeeds, feedConfig.macro)),
                runConnectorFeed(pickFeedConnector(connectorFeeds, feedConfig.treasury)),
                runConnectorFeed(pickFeedConnector(connectorFeeds, feedConfig.jobs)),
                runConnectorFeed(pickFeedConnector(connectorFeeds, feedConfig.news)),
            ]);

            const today = new Date().toISOString().split("T")[0];
            const { data: existing } = await supabase
                .from("daily_snapshots")
                .select("id")
                .eq("user_id", userId)
                .eq("snapshot_date", today)
                .maybeSingle();

            const snapshot = {
                user_id: userId,
                snapshot_date: today,
                mrr,
                clients: clients || 0,
                pipeline_total: Math.round(pipelineTotal),
                active_alerts: activeAlerts || 0,
                task_completion_pct: taskCompletionPct,
                health_score: healthScore,
                metadata: {
                    mrr_score: mrrScore,
                    pipeline_score: pipelineScore,
                    execution_score: executionScore,
                    alert_penalty: alertPenalty,
                    connector_feeds: {
                        live_count: connectors?.length || 0,
                        items: (connectors || []).map((connector: any) => ({
                            name: connector.name,
                            catalog_slug: connector.catalog_slug,
                            template_key: connector.template_key,
                            capabilities: connector.capabilities || [],
                            last_healthcheck_at: connector.last_healthcheck_at,
                        })),
                        saved_feeds: {
                            weather: weatherFeed,
                            macro: macroFeed,
                            treasury: treasuryFeed,
                            jobs: jobsFeed,
                            news: newsFeed,
                        },
                    },
                },
            };

            if (existing) {
                await supabase.from("daily_snapshots").update(snapshot).eq("id", existing.id);
            } else {
                await supabase.from("daily_snapshots").insert(snapshot);
            }

            results.push({ userId, healthScore, mrr, clients: clients || 0 });
        }

        return new Response(
            JSON.stringify({ message: `Snapshots created for ${results.length} user(s)`, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("[daily-snapshot] error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
