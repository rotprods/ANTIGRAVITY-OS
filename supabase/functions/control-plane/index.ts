import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { handleControlPlaneAction } from "../_shared/orchestrator-core.ts";

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<Record<string, unknown>>(req);
    const result = await handleControlPlaneAction(
      body as Parameters<typeof handleControlPlaneAction>[0],
      req.headers.get("Authorization"),
    );
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Control-plane execution failed",
      500,
    );
  }
});
