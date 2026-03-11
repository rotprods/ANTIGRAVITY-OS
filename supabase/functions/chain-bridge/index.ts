import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'status') {
    return new Response(JSON.stringify({ 
      status: 'active', 
      network: 'XRPL EVM Testnet', 
      height: 1234567,
      bridge_active: true 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ status: 'offline' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
