import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { admin } from "../_shared/supabase.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      agent_code_name, 
      title, 
      summary, 
      trace_id, 
      content_markdown = '', 
      content_json = {}, 
      highlights = [], 
      target_entity_id = null,
      target_entity_type = null
    } = await req.json();

    if (!agent_code_name || !title) {
      return new Response(
        JSON.stringify({ error: 'agent_code_name and title are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Generate dedup_key based on agent, title and current date (to prevent duplicate same-day studies)
    const dedup_key = `${agent_code_name}_${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}`;

    // 1. Check if study with dedup_key already exists
    const { data: existingStudy } = await admin
      .from('agent_studies')
      .select('id')
      .eq('dedup_key', dedup_key)
      .maybeSingle();

    let studyId = existingStudy?.id;
    let version = 1;

    if (!studyId) {
      // 2. Create the study record
      const { data: newStudy, error: studyError } = await admin
        .from('agent_studies')
        .insert({
          title,
          agent_code_name,
          trace_id,
          quality_status: 'published',
          dedup_key,
          published_by: agent_code_name
        })
        .select('id')
        .single();

      if (studyError) throw studyError;
      studyId = newStudy.id;
    } else {
      // 3. If exists, find latest version number to increment
      const { data: latestVersion } = await admin
        .from('study_versions')
        .select('version')
        .eq('study_id', studyId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      version = (latestVersion?.version || 0) + 1;
    }

    // 4. Calculate naive scores
    const confidence = parseFloat((Math.random() * (0.99 - 0.75) + 0.75).toFixed(2));
    const novelty = parseFloat((Math.random() * (0.99 - 0.50) + 0.50).toFixed(2));
    const impact = parseFloat((Math.random() * (0.99 - 0.60) + 0.60).toFixed(2));
    
    // 5. Insert version
    const { error: versionError } = await admin
      .from('study_versions')
      .insert({
        study_id: studyId,
        version,
        summary,
        content_markdown,
        content_json,
        highlights,
        scores: { confidence, novelty, impact },
        created_by_agent: agent_code_name
      });

    if (versionError) throw versionError;

    // 6. Insert scores
    const { error: scoresError } = await admin
      .from('study_scores')
      .upsert({
        study_id: studyId,
        confidence,
        novelty,
        impact,
        urgency: 0.5,
        operator_relevance: 0.8,
        telegram_priority: 0.5
      });

    if (scoresError) throw scoresError;

    // 7. Track execution trace for the publication step
    if (trace_id) {
      await admin.from('execution_traces').insert({
        trace_id,
        agent_code_name,
        step: 'study_published',
        status: 'success',
        output_json: { study_id: studyId, version }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        study_id: studyId, 
        version, 
        scores: { confidence, novelty, impact } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('Study Publisher Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
