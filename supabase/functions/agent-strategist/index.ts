import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGIST — DEPRECATED: Redirects to HUNTER (merged)
// Hunter now runs buildStrategicBrief on qualified leads automatically
// Kept as thin proxy for backwards compatibility
// ═══════════════════════════════════════════════════════════════════════════════

import { handleCors, errorResponse, jsonResponse } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-hunter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return jsonResponse(data, res.status);
});
