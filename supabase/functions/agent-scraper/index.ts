import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMPETITORS = [
  { name: 'ORBIDI', url: 'https://orbidi.com', focus: 'marketing digital IA para pymes' },
  { name: 'Plinng', url: 'https://plinng.com', focus: 'plataforma marketing pymes' },
  { name: 'Witei', url: 'https://witei.com', focus: 'CRM y marketing inmobiliario' },
];

function extractText(html: string): string {
  // Remove scripts, styles, nav, footer
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  
  // Extract title
  const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Extract meta description
  const metaMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const metaDesc = metaMatch ? metaMatch[1].trim() : '';
  
  // Extract headings
  const headings: string[] = [];
  const hMatches = text.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
  for (const m of hMatches) {
    const cleaned = m[1].replace(/\s+/g, ' ').trim();
    if (cleaned.length > 3) headings.push(cleaned);
  }
  
  // Extract paragraphs
  const paragraphs: string[] = [];
  const pMatches = text.matchAll(/<p[^>]*>([^<]+)<\/p>/gi);
  for (const m of pMatches) {
    const cleaned = m[1].replace(/\s+/g, ' ').trim();
    if (cleaned.length > 20) paragraphs.push(cleaned);
  }
  
  // Also try removing all tags for a text-only version
  const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  return `TITLE: ${title}\nMETA: ${metaDesc}\nHEADINGS:\n${headings.slice(0, 15).join('\n')}\nCONTENT:\n${paragraphs.slice(0, 10).join('\n')}\nPLAIN TEXT (first 2000 chars):\n${plainText.substring(0, 2000)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const start = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    // Support single URL from Copilot: { action: "scrape", url: "https://..." }
    const targets = body.url
      ? [{ name: new URL(body.url).hostname, url: body.url, focus: 'competitor analysis' }]
      : body.targets || COMPETITORS;
    
    const results: Record<string, unknown>[] = [];
    
    for (const competitor of targets) {
      try {
        // Fetch the website
        const res = await fetch(competitor.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OCULOPS-Bot/1.0)' },
          signal: AbortSignal.timeout(10000)
        });
        const html = await res.text();
        const extracted = extractText(html);
        
        let analysis = 'No OpenAI key';
        
        if (openaiKey) {
          // GPT analysis of competitor
          const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: `Analiza esta página web del competidor "${competitor.name}" (${competitor.url}) para OCULOPS, una agencia IA boutique en Murcia.\n\nContenido extraído:\n${extracted}\n\nGenera un JSON con:\n{"company": "${competitor.name}", "services": ["lista de servicios que ofrecen"], "pricing_signals": ["cualquier indicación de precios"], "target_audience": "a quién se dirigen", "positioning": "cómo se posicionan", "strengths": ["fortalezas"], "weaknesses": ["debilidades percibidas"], "differentiation_opportunity": "cómo OCULOPS puede diferenciarse de este competidor"}` }],
              temperature: 0.3,
              max_tokens: 800,
              response_format: { type: 'json_object' }
            })
          });
          const aiData = await aiRes.json();
          analysis = aiData.choices?.[0]?.message?.content || 'Analysis failed';
        }
        
        // Save to knowledge_entries
        await supabase.from('knowledge_entries').insert({
          title: `Competitor Intel: ${competitor.name} — ${new Date().toISOString().split('T')[0]}`,
          content: analysis,
          category: 'competitive_intel',
          type: 'competitor_analysis',
          source: 'agent-scraper',
          tags: ['competitor', competitor.name.toLowerCase(), 'auto', 'phase1']
        });
        
        results.push({
          name: competitor.name,
          url: competitor.url,
          scraped: true,
          content_length: extracted.length,
          analysis_saved: true
        });
        
      } catch(e) {
        results.push({
          name: competitor.name,
          url: competitor.url,
          scraped: false,
          error: (e as Error).message
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      agent: 'scraper',
      competitors_analyzed: results.filter(r => r.scraped).length,
      results,
      duration_ms: Date.now() - start
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
