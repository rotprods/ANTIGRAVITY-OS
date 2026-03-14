import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { admin } from "../_shared/supabase.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * memory-refresh Edge Function
 * 
 * Purpose: Cron-triggered function that synthesizes recent agent_studies
 * into core beliefs stored in agent_memory_v2.
 * 
 * Schema: agent_memory_v2 uses: agent, namespace, key, value (jsonb), confidence
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const traceId = crypto.randomUUID();

  try {
    // 1. Fetch published studies from the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentStudies, error: studiesError } = await admin
      .from('agent_studies')
      .select(`
        id, title, summary, agent_code_name, study_type, tags,
        quality_status, created_at,
        study_scores (confidence, novelty, impact, urgency)
      `)
      .eq('quality_status', 'published')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (studiesError) throw studiesError;

    if (!recentStudies || recentStudies.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No recent studies to synthesize',
          studies_processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 2. Group studies by agent_code_name
    const groupedByAgent: Record<string, typeof recentStudies> = {};
    for (const study of recentStudies) {
      const agent = study.agent_code_name || 'UNKNOWN';
      if (!groupedByAgent[agent]) groupedByAgent[agent] = [];
      groupedByAgent[agent].push(study);
    }

    // 3. For each agent group, synthesize a belief and upsert into memory
    const memoriesUpserted: string[] = [];

    for (const [agentName, studies] of Object.entries(groupedByAgent)) {
      const topStudies = studies.slice(0, 10);
      const synthesized = topStudies.map(s => {
        const scores = Array.isArray(s.study_scores) ? s.study_scores[0] : s.study_scores;
        return `- [${s.title}] (conf: ${scores?.confidence ?? '?'}, impact: ${scores?.impact ?? '?'}) — ${s.summary?.slice(0, 120) || 'No summary'}`;
      }).join('\n');

      const avgConfidence = topStudies.reduce((sum, s) => {
        const scores = Array.isArray(s.study_scores) ? s.study_scores[0] : s.study_scores;
        return sum + (scores?.confidence ?? 0);
      }, 0) / topStudies.length;

      const beliefValue = {
        type: 'synthesized_belief',
        source: 'memory-refresh',
        agent: agentName,
        study_count: studies.length,
        period: `${cutoff} → ${new Date().toISOString()}`,
        synthesis: synthesized,
        top_titles: topStudies.map(s => s.title),
        avg_confidence: avgConfidence,
      };

      const memoryKey = `belief_${agentName}_daily_${new Date().toISOString().split('T')[0]}`;

      const { error: memError } = await admin
        .from('agent_memory_v2')
        .upsert({
          agent: agentName,
          namespace: 'beliefs',
          key: memoryKey,
          value: beliefValue,
          confidence: avgConfidence,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (memError) {
        console.error(`Memory upsert error for ${agentName}:`, memError);
      } else {
        memoriesUpserted.push(agentName);
      }
    }

    const durationMs = Date.now() - startTime;

    // 4. Log execution trace
    await admin.from('execution_traces').insert({
      trace_id: traceId,
      agent_code_name: 'SYSTEM',
      step: 'memory_refresh',
      status: 'success',
      input_json: { studies_found: recentStudies.length, cutoff },
      output_json: { memories_upserted: memoriesUpserted, duration_ms: durationMs },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({
        success: true,
        trace_id: traceId,
        studies_processed: recentStudies.length,
        memories_upserted: memoriesUpserted,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error('Memory Refresh Error:', err);

    await admin.from('execution_traces').insert({
      trace_id: traceId,
      agent_code_name: 'SYSTEM',
      step: 'memory_refresh',
      status: 'error',
      error: err.message,
      duration_ms: durationMs,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
