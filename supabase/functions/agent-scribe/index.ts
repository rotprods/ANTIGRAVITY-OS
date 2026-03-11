import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIBE — DEPRECATED: Redirects all calls to ORACLE (merged)
// Kept as thin proxy for backwards compatibility with n8n workflows and crons
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const incomingAuth = req.headers.get("Authorization") || "";

  const body = await req.json().catch(() => ({}));
  body.action = body.action || "daily_report";

  const res = await fetch(`${supabaseUrl}/functions/v1/agent-oracle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: incomingAuth || `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
