import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ── Internal agent invoker ──
async function invokeAgent(fnName: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// ── Step 1: Load or create detected_lead ──
async function resolveDetectedLead(input: {
  lead_id?: string;
  company?: string;
  url?: string;
  location?: string;
}): Promise<{ lead: Record<string, unknown>; isNew: boolean }> {
  if (input.lead_id) {
    const { data } = await admin.from("detected_leads").select("*").eq("id", input.lead_id).single();
    if (data) return { lead: data, isNew: false };
  }

  // Create a minimal lead record from input params
  const { data } = await admin
    .from("detected_leads")
    .insert({
      name: input.company || "Unknown",
      website: input.url || null,
      address: input.location || null,
      status: "active",
      source: "enrichment-pipeline",
    })
    .select()
    .single();

  return { lead: data || {}, isNew: true };
}

// ── Step 2+3: Scrape + analyze URL ──
async function scrapeAndAnalyze(lead: Record<string, unknown>): Promise<{
  text: string;
  tech: string[];
  socialSignals: string[];
}> {
  const url = lead.website as string | null;
  if (!url) return { text: "", tech: [], socialSignals: [] };

  const scraped = await invokeAgent("agent-scraper", { url, extract: "text" });
  const analyzed = await invokeAgent("web-analyzer", { url, text: scraped?.content });

  return {
    text: scraped?.content?.slice(0, 2000) || "",
    tech: analyzed?.tech_stack || [],
    socialSignals: analyzed?.social_signals || [],
  };
}

// ── Step 4: AI qualifier ──
async function qualifyLead(
  lead: Record<string, unknown>,
  context: { text: string; tech: string[] }
): Promise<{ intentScore: number; icpFit: number; reasoning: string }> {
  // Heuristic fallback
  let intentScore = 40;
  let icpFit = 40;
  let reasoning = "Heuristic qualification";

  // Boost if website with tech stack
  if (context.tech.length > 0) intentScore += 10;
  if (lead.website) icpFit += 10;
  if (lead.rating) icpFit += 5;

  if (!OPENAI_API_KEY) {
    return { intentScore, icpFit, reasoning };
  }

  const prompt = `Qualify this business lead for a digital agency selling web/AI services (1500-5000 EUR/month).
Company: ${lead.name} | Website: ${lead.website || "none"} | Location: ${lead.address || "unknown"}
Tech detected: ${context.tech.join(", ") || "unknown"} | Text excerpt: ${context.text.slice(0, 500)}
Return JSON only: { "intent_score": 0-100, "icp_fit": 0-100, "reasoning": "one sentence" }`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a lead qualification AI. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
      intentScore = Math.min(100, Math.max(0, parseInt(parsed.intent_score) || intentScore));
      icpFit = Math.min(100, Math.max(0, parseInt(parsed.icp_fit) || icpFit));
      reasoning = parsed.reasoning || reasoning;
    }
  } catch { /* use heuristic values */ }

  return { intentScore, icpFit, reasoning };
}

// ── Step 5: Deal score ──
async function scoreLead(intentScore: number, icpFit: number): Promise<number> {
  return Math.round((intentScore + icpFit) / 2);
}

// ── Step 6: Promote to CRM if score >= 60 ──
async function promoteToCRM(lead: Record<string, unknown>, score: number, reasoning: string, orgId?: string) {
  // Update detected_lead with score
  await admin
    .from("detected_leads")
    .update({ ai_score: score, ai_reasoning: reasoning, status: "qualified" })
    .eq("id", lead.id);

  // Insert company
  const { data: company } = await admin
    .from("companies")
    .insert({ name: lead.name, website: lead.website, address: lead.address, org_id: orgId })
    .select()
    .single();

  // Insert deal
  const { data: deal } = await admin
    .from("deals")
    .insert({
      title: `Lead: ${lead.name}`,
      stage: "lead",
      value: 2000, // default estimate
      company_id: company?.id,
      ai_score: score,
      ai_reasoning: reasoning,
      org_id: orgId,
    })
    .select()
    .single();

  return { company, deal };
}

// ── Event emitter ──
async function emitEvent(eventType: string, payload: Record<string, unknown>, orgId?: string) {
  await admin.from("event_log").insert({ event_type: eventType, payload, source_agent: "lead-enrichment-pipeline", org_id: orgId });
}

// ── Main handler ──
Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await readJson<{
      lead_id?: string;
      company?: string;
      url?: string;
      location?: string;
      org_id?: string;
    }>(req);

    if (!body.lead_id && !body.company && !body.url) {
      return errorResponse("lead_id or (company/url) required");
    }

    const steps: Array<{ step: string; status: "pending" | "ok" | "error"; data?: unknown }> = [
      { step: "resolve_lead", status: "pending" },
      { step: "scrape_analyze", status: "pending" },
      { step: "qualify", status: "pending" },
      { step: "score", status: "pending" },
    ];

    // Step 1
    let lead: Record<string, unknown>;
    try {
      const resolved = await resolveDetectedLead(body);
      lead = resolved.lead;
      steps[0] = { step: "resolve_lead", status: "ok", data: { id: lead.id, isNew: resolved.isNew } };
    } catch (err) {
      steps[0] = { step: "resolve_lead", status: "error", data: { error: String(err) } };
      return jsonResponse({ ok: false, steps, error: "Could not resolve lead" });
    }

    // Step 2
    let scrapeResult = { text: "", tech: [], socialSignals: [] as string[] };
    try {
      scrapeResult = await scrapeAndAnalyze(lead);
      steps[1] = { step: "scrape_analyze", status: "ok", data: { techCount: scrapeResult.tech.length } };
    } catch {
      steps[1] = { step: "scrape_analyze", status: "error" };
      // Continue — non-fatal
    }

    // Step 3
    let qualification = { intentScore: 40, icpFit: 40, reasoning: "Heuristic" };
    try {
      qualification = await qualifyLead(lead, scrapeResult);
      steps[2] = { step: "qualify", status: "ok", data: qualification };
    } catch {
      steps[2] = { step: "qualify", status: "error" };
    }

    // Step 4
    const score = await scoreLead(qualification.intentScore, qualification.icpFit);
    steps[3] = { step: "score", status: "ok", data: { score } };

    // Step 5: Auto-promote if score >= 60
    let crm: { company: unknown; deal: unknown } | null = null;
    let autoPromoted = false;
    if (score >= 60) {
      crm = await promoteToCRM(lead, score, qualification.reasoning, body.org_id);
      autoPromoted = true;
    } else {
      // Still update the score on the lead
      await admin
        .from("detected_leads")
        .update({ ai_score: score, ai_reasoning: qualification.reasoning })
        .eq("id", lead.id);
    }

    // Emit event
    await emitEvent("lead.enriched", {
      lead_id: lead.id,
      score,
      auto_promoted: autoPromoted,
      reasoning: qualification.reasoning,
    }, body.org_id);

    return jsonResponse({
      ok: true,
      lead_id: lead.id,
      score,
      reasoning: qualification.reasoning,
      auto_promoted: autoPromoted,
      crm,
      steps,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Enrichment pipeline failed", 500);
  }
});
