import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface DealContext {
  deal: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  activities: Array<Record<string, unknown>>;
  outreach: Array<Record<string, unknown>>;
}

async function loadDealContext(dealId: string): Promise<DealContext> {
  const { data: deal, error } = await admin
    .from("deals")
    .select("*, contact:contacts(*), company:companies(*)")
    .eq("id", dealId)
    .single();

  if (error || !deal) throw new Error("Deal not found");

  const [activities, outreach] = await Promise.all([
    admin
      .from("crm_activities")
      .select("type, subject, created_at")
      .eq("contact_id", deal.contact_id)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("outreach_queue")
      .select("status, template_type, sent_at, created_at")
      .eq("lead_id", deal.contact_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    deal,
    contact: deal.contact || null,
    company: deal.company || null,
    activities: activities.data || [],
    outreach: outreach.data || [],
  };
}

function computeHeuristicScore(ctx: DealContext): number {
  let score = 40; // base

  // Value signal: higher value = higher score
  const value = parseFloat(String(ctx.deal.value)) || 0;
  if (value >= 3000) score += 15;
  else if (value >= 1500) score += 10;
  else if (value >= 500) score += 5;

  // Activity signal: more activities = more engaged
  const activityCount = ctx.activities.length;
  if (activityCount >= 5) score += 15;
  else if (activityCount >= 2) score += 10;
  else if (activityCount >= 1) score += 5;

  // Outreach signal: replies = high intent
  const replied = ctx.outreach.filter(o => o.status === "replied").length;
  if (replied > 0) score += 15;

  // Contact completeness
  if (ctx.contact?.email) score += 5;
  if (ctx.contact?.phone) score += 3;
  if (ctx.company?.website) score += 5;

  // Stage signal
  const stage = String(ctx.deal.stage);
  if (stage === "proposal") score += 10;
  else if (stage === "meeting") score += 7;
  else if (stage === "contacted") score += 3;

  return Math.min(100, Math.max(0, score));
}

async function refineWithAI(ctx: DealContext, heuristicScore: number): Promise<{ score: number; reasoning: string }> {
  if (!OPENAI_API_KEY) {
    return { score: heuristicScore, reasoning: "Heuristic score (no AI key configured)" };
  }

  const prompt = `Score this deal from 0-100 based on likelihood to close. Return JSON only: { "score": number, "reasoning": "one sentence" }

Deal: ${ctx.deal.title} | Stage: ${ctx.deal.stage} | Value: EUR ${ctx.deal.value}
Company: ${ctx.company?.name || "Unknown"} | Website: ${ctx.company?.website || "None"}
Contact: ${ctx.contact?.name || "Unknown"} | Email: ${ctx.contact?.email || "None"}
Activities: ${ctx.activities.length} logged | Outreach replies: ${ctx.outreach.filter(o => o.status === "replied").length}
Heuristic base: ${heuristicScore}/100`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a deal scoring AI. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      return { score: heuristicScore, reasoning: "Heuristic score (AI refinement failed)" };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());

    return {
      score: Math.min(100, Math.max(0, parseInt(parsed.score) || heuristicScore)),
      reasoning: parsed.reasoning || "AI-refined score",
    };
  } catch {
    return { score: heuristicScore, reasoning: "Heuristic score (AI parse error)" };
  }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<{
      deal_id: string;
      deal_ids?: string[];
    }>(req);

    const dealIds = body.deal_ids || (body.deal_id ? [body.deal_id] : []);
    if (dealIds.length === 0) {
      return errorResponse("deal_id or deal_ids required");
    }

    const results = [];

    for (const dealId of dealIds.slice(0, 20)) {
      try {
        const ctx = await loadDealContext(dealId);
        const heuristic = computeHeuristicScore(ctx);
        const { score, reasoning } = await refineWithAI(ctx, heuristic);

        await admin
          .from("deals")
          .update({
            ai_score: score,
            ai_reasoning: reasoning,
            scored_at: new Date().toISOString(),
          })
          .eq("id", dealId);

        results.push({ deal_id: dealId, score, reasoning, ok: true });
      } catch (err) {
        results.push({
          deal_id: dealId,
          ok: false,
          error: err instanceof Error ? err.message : "Scoring failed",
        });
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Deal scoring failed",
      500,
    );
  }
});
