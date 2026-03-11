import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { runAgentTask } from "../_shared/agents.ts";
import { errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function callAgent(endpoint: string, payload: Record<string, unknown>) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase runtime env is not configured");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `${endpoint} failed`);
  }

  return data as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<{
      action?: string;
      query?: string;
      location?: string;
      lat?: number;
      lng?: number;
      radius?: number;
      scan_id?: string;
      user_id?: string;
      maxResults?: number;
    }>(req);

    const action = body.action || "orchestrate";

    const result = await runAgentTask({
      codeName: "cortex",
      action,
      title: `CORTEX ${action}`,
      payload: body as Record<string, unknown>,
      handler: async () => {
        let scanId = body.scan_id || null;
        let atlasResult: Record<string, unknown> | null = null;
        let publicData: Record<string, unknown> | null = null;

        // New Action: Dynamically query any public catalog API based on intent
        if (action === "query_public_data" && body.query) {
          const { executeDynamicPublicApi } = await import("../_shared/public-catalog-router.ts");
          const data = await executeDynamicPublicApi("cortex", body.query);
          publicData = {
            intent: body.query,
            fetched_data: data
          };

          // Format a nice summary to be injected straight into the Telegram message
          const dataPreview = JSON.stringify(data, null, 2).slice(0, 1500);

          // We can stop here for this specific action type, avoiding the whole pipeline
          return {
            summary: `Fetched Public Data\nIntent: ${body.query}\n\nResults Preview:\n${dataPreview}…`,
            action,
            public_data: publicData
          };
        }

        if (!scanId) {
          atlasResult = await callAgent("agent-atlas", {
            action: "cycle",
            query: body.query,
            location: body.location,
            lat: body.lat,
            lng: body.lng,
            radius: body.radius,
            user_id: body.user_id,
            maxResults: body.maxResults,
            skip_telegram: true,
          });
          scanId = String((atlasResult.output as Record<string, unknown> | undefined)?.scan?.id || "");
        }

        // Hunter now includes strategic briefs (merged Strategist)
        const hunterResult = await callAgent("agent-hunter", {
          action: "cycle",
          scan_id: scanId,
          user_id: body.user_id,
          skip_telegram: true,
        });
        const outreachResult = await callAgent("agent-outreach", {
          action: "cycle",
          user_id: body.user_id,
          skip_telegram: true,
        });

        return {
          scan_id: scanId,
          atlas: atlasResult,
          hunter: hunterResult,
          outreach: outreachResult,
        };
      },
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "CORTEX failed", 500);
  }
});
