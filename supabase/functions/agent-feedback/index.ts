import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK — DEPRECATED: No prediction generation engine exists
// This was a validation-only stub. Prediction tracking is now handled by
// Oracle's AI insights + deal-scorer. Kept to avoid 404 on existing calls.
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      success: false,
      deprecated: true,
      message: "FEEDBACK agent deprecated. Prediction tracking handled by Oracle + deal-scorer.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
