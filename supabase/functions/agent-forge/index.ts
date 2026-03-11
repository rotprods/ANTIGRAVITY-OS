import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runBrain } from "../_shared/agent-brain-v2.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const AGENT_CODE = 'forge';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'generate', task_id, content_type = 'social_post', topic, audience = 'pymes_murcia', tone = 'profesional' } = body;
    const { data: agent } = await supabase.from('agent_registry').select('*').eq('code_name', AGENT_CODE).single();
    if (!agent) throw new Error('Agent not found');
    await supabase.from('agent_registry').update({ status: 'running', last_run_at: new Date().toISOString() }).eq('id', agent.id);

    let result: any = {};
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (action === 'generate' && openaiKey) {
      const prompts: Record<string, string> = {
        social_post: `Genera 3 posts para redes sociales (LinkedIn + Instagram) para una agencia de IA/marketing digital en Murcia. Tema: ${topic || 'beneficios de IA para pymes'}. Tono: ${tone}. Audiencia: ${audience}. Formato JSON: [{"platform": "linkedin", "text": "...", "hashtags": [...]}, ...]`,
        email_outreach: `Genera un email de prospección frio para contactar a ${audience}. Asunto + cuerpo. Ofrece servicios de automatización con IA. Tono: ${tone}. JSON: {"subject": "...", "body": "...", "cta": "..."}`,
        landing_copy: `Genera copy para una landing page de servicios de IA para ${audience}. Hero title + subtitle + 3 beneficios + CTA. JSON: {"hero_title": "...", "subtitle": "...", "benefits": [...], "cta": "..."}`,
        proposal: `Genera una propuesta comercial breve para ${audience}. Incluye: problema, solución, beneficios esperados, pricing sugerido. JSON: {"intro": "...", "problem": "...", "solution": "...", "benefits": [...], "pricing": "..."}`,
        ad_copy: `Genera 3 variantes de copy para anuncios (Meta Ads) dirigidos a ${audience}. Cada variante con headline + primary_text + CTA. JSON: [{"headline": "...", "primary_text": "...", "cta": "..."}]`
      };

      const prompt = prompts[content_type] || prompts.social_post;

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: 'Eres FORGE, agente creativo de una agencia de IA prémium. Genera contenido profesional, innovador y creativo. Responde SOLO con JSON válido.' }, { role: 'user', content: prompt }], temperature: 0.8, max_tokens: 1000 })
      });

      if (aiRes.ok) {
        const d = await aiRes.json();
        const c = d.choices?.[0]?.message?.content || '';
        try { result.content = JSON.parse(c.replace(/```json\n?|```/g, '')); } catch { result.content = { raw: c }; }
        result.tokens_used = d.usage?.total_tokens || 0;

        await supabase.from('knowledge_entries').insert({
          title: `FORGE ${content_type} — ${new Date().toISOString().split('T')[0]}`,
          content: JSON.stringify(result.content, null, 2),
          category: 'content', type: 'ai_generated', source: 'FORGE',
          tags: ['content', content_type, 'auto']
        });
      }
    } else if (!openaiKey) {
      result = { error: 'No OpenAI key configured' };
    }

    result.content_type = content_type;
    result.agent = AGENT_CODE;

    // ── Brain: enrich content with external data + store in knowledge base ──
    if (action === 'generate') {
      const brain = await runBrain({
        agent: "forge",
        goal: `You just generated ${content_type} content about "${topic}". Now: 1) Fetch relevant real-time data (trends, stats, news) to validate/enrich the content. 2) Store the generated content in memory for future campaigns. 3) If content quality is high, create a task to schedule it.`,
        context: { generated: result, topic, audience, tone, content_type },
        systemPromptExtra: "You are FORGE: the content engine. Be creative and data-driven.",
        maxRounds: 3,
      }).catch(() => null);
      if (brain) result.brain_enrichment = { skills_used: brain.skills_used?.length, notes: brain.answer?.slice(0, 300) };
    }

    const duration = Date.now() - startTime;
    await supabase.from('agent_registry').update({ status: 'online', total_runs: (agent.total_runs || 0) + 1 }).eq('id', agent.id);
    if (task_id) await supabase.from('agent_tasks').update({ status: 'completed', result, completed_at: new Date().toISOString() }).eq('id', task_id);
    await supabase.from('agent_logs').insert({ agent_id: agent.id, agent_code_name: AGENT_CODE, task_id, action, input: body, output: result, duration_ms: duration });

    return new Response(JSON.stringify({ success: true, agent: AGENT_CODE, result, duration_ms: duration }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    await supabase.from('agent_registry').update({ status: 'error' }).eq('code_name', AGENT_CODE);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
