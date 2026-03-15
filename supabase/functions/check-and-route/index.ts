import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // 3. Get the latest tunnel URL from ecosystem_tunnels table
    const { data: tunnelData, error: tunnelError } = await supabaseClient
      .from('ecosystem_tunnels')
      .select('url')
      .eq('name', 'localtunnel')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (tunnelError || !tunnelData?.url) {
      console.error("Tunnel not found in ecosystem_tunnels:", tunnelError);
      return new Response(
        JSON.stringify({
          error: "mac_mini_offline",
          details: "No active tunnel URL found in database.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503,
        }
      );
    }

    const tunnelUrl = tunnelData.url.replace(/\/$/, ''); // Remove trailing slash

    // 4. Determine destination path (from req URL or defaults to health check)
    const url = new URL(req.url);
    // E.g. /v1/health or /v1/chain/lead
    const targetPath = url.searchParams.get('path') || '/api/v1/health'; 
    const targetUrl = `${tunnelUrl}${targetPath}`;

    // 5. Check if Mac Mini is actually answering (Ping it)
    let isOnline = false;
    try {
      // Small timeout so the frontend doesn't hang forever if the tunnel is dead
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const healthCheck = await fetch(`${tunnelUrl}/api/v1/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (healthCheck.ok) {
        isOnline = true;
      }
    } catch (e) {
      console.warn(`Tunnel ping failed: ${e.message}`);
    }

    if (!isOnline) {
      return new Response(
        JSON.stringify({
          error: "mac_mini_offline",
          details: `Tunnel URL ${tunnelUrl} is unreachable right now.`,
          fallbackRequired: true
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503, // Service Unavailable
        }
      );
    }

    // 6. If it's just a status check request, return online
    if (targetPath === '/api/v1/health' || req.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: "online",
          tunnel: tunnelUrl,
          message: "Mac Mini bridge is ready."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 7. If it's a POST/Proxy request, forward the payload to the tunnel
    const bodyText = await req.text();
    const proxyReqHeaders = new Headers();
    proxyReqHeaders.set('Content-Type', 'application/json');
    // Forward authorization if present
    const authHeader = req.headers.get('Authorization');
    if (authHeader) proxyReqHeaders.set('Authorization', authHeader);

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: proxyReqHeaders,
      body: bodyText ? bodyText : undefined,
    });

    const proxyData = await proxyRes.text();

    return new Response(proxyData, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: proxyRes.status,
    });

  } catch (err) {
    console.error(`Edge function error: ${err.message}`);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        details: err.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
