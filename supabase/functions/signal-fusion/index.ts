import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

/**
 * signal-fusion Edge Function
 * 
 * Intercepts external signals (news, tweets, scraping payloads via n8n webhooks)
 * and routes them to appropriate tables with alerting.
 * 
 * Accepted platforms: reddit, hackernews, twitter, x, linkedin, youtube, instagram,
 *   telegram, discord, news, rss, custom, demo
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const traceId = crypto.randomUUID();

  try {
    const payload = await req.json();

    if (!payload.signal_type || !payload.content) {
      return new Response(
        JSON.stringify({ error: 'signal_type and content are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const agentCode = payload.agent_code_name || 'SIGNAL_FUSION';
    let insertedId: string | null = null;
    let alertTriggered = false;

    if (payload.signal_type === 'social') {
      const sentimentInt = payload.sentiment ? Math.round(payload.sentiment * 100) : 0;
      const { data, error } = await admin
        .from('social_signals')
        .insert({
          platform: payload.platform || payload.source,
          external_id: crypto.randomUUID(),
          topic: payload.topic || 'general',
          title: payload.title || payload.content.slice(0, 100),
          body_excerpt: payload.content.slice(0, 500),
          author: payload.author || agentCode,
          permalink: payload.url || null,
          published_at: new Date().toISOString(),
          engagement: payload.engagement || 0,
          sentiment_score: sentimentInt,
          velocity_score: 0,
          opportunity_score: Math.round((payload.urgency ?? 0.5) * 100),
          metadata: { source_agent: agentCode, tags: payload.tags },
        })
        .select('id')
        .single();
      if (error) throw new Error(JSON.stringify(error));
      insertedId = data.id;
    } else if (payload.signal_type === 'market' || payload.signal_type === 'competitor') {
      const { data, error } = await admin
        .from('market_snapshots')
        .insert({
          symbol: payload.symbol || payload.source.toUpperCase(),
          display_name: payload.title || payload.source,
          asset_type: payload.signal_type === 'competitor' ? 'competitor' : 'market',
          source: payload.source,
          price: payload.price ?? 0,
          change_24h: payload.change_24h ?? 0,
          metadata: { content: payload.content, url: payload.url, sentiment: payload.sentiment, source_agent: agentCode },
          snapshot_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw new Error(JSON.stringify(error));
      insertedId = data.id;
    } else {
      // news, lead → event_log
      const { data, error } = await admin
        .from('event_log')
        .insert({
          event_type: payload.signal_type === 'lead' ? 'signal.lead_detected' : 'signal.news_alert',
          source_agent: agentCode,
          payload: { title: payload.title, content: payload.content, url: payload.url, original_source: payload.source },
          status: 'emitted',
        })
        .select('id')
        .single();
      if (error) throw new Error(JSON.stringify(error));
      insertedId = data.id;
    }

    // Check urgency/sentiment threshold
    const urgency = payload.urgency ?? 0;
    const sentiment = payload.sentiment ?? 0;
    if (urgency > 0.8 || sentiment < -0.7) {
      alertTriggered = true;
      await admin.from('event_log').insert({
        event_type: 'signal.critical_alert',
        source_agent: 'SIGNAL_FUSION',
        payload: { signal_type: payload.signal_type, urgency, sentiment, signal_id: insertedId },
        status: 'emitted',
      });
    }

    const durationMs = Date.now() - startTime;
    await admin.from('execution_traces').insert({
      trace_id: traceId,
      agent_code_name: agentCode,
      step: 'signal_fusion',
      status: 'success',
      input_json: { signal_type: payload.signal_type, source: payload.source },
      output_json: { inserted_id: insertedId, alert_triggered: alertTriggered },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({ success: true, trace_id: traceId, signal_id: insertedId, signal_type: payload.signal_type, alert_triggered: alertTriggered, duration_ms: durationMs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Signal Fusion Error:', errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
