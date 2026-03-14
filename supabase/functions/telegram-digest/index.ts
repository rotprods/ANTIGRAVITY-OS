import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Telegram config — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Supabase secrets
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '';

interface StudyDigest {
  id: string;
  title: string;
  summary: string;
  agent_code_name: string;
  quality_status: string;
  created_at: string;
  study_scores: { confidence: number; novelty: number; impact: number; urgency: number; telegram_priority: number } | null;
}

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets.');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Telegram API error:', res.status, body);
    return false;
  }
  return true;
}

function formatDigest(studies: StudyDigest[]): string {
  const now = new Date().toISOString().split('T')[0];
  let msg = `🧠 *OCULOPS Intelligence Digest*\n📅 ${now} · ${studies.length} study/ies\n\n`;

  for (const study of studies) {
    const scores = study.study_scores;
    const conf = scores?.confidence ? (scores.confidence * 100).toFixed(0) : '?';
    const impact = scores?.impact ? (scores.impact * 100).toFixed(0) : '?';
    const urgency = scores?.urgency ? (scores.urgency * 100).toFixed(0) : '?';

    msg += `📌 *${study.title}*\n`;
    msg += `   Agent: \`${study.agent_code_name}\` | Conf: ${conf}% | Impact: ${impact}% | Urgency: ${urgency}%\n`;
    if (study.summary) {
      msg += `   ${study.summary.slice(0, 200)}\n`;
    }
    msg += `\n`;
  }

  msg += `_Powered by ANTIGRAVITY OS_`;
  return msg;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const traceId = crypto.randomUUID();

  try {
    // Parse optional body for custom filters
    let minPriority = 0.5;
    let hoursBack = 24;
    let maxStudies = 10;
    let dryRun = false;

    try {
      const body = await req.json();
      if (body.min_priority !== undefined) minPriority = body.min_priority;
      if (body.hours_back !== undefined) hoursBack = body.hours_back;
      if (body.max_studies !== undefined) maxStudies = body.max_studies;
      if (body.dry_run !== undefined) dryRun = body.dry_run;
    } catch {
      // No body or invalid JSON — use defaults
    }

    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // 1. Fetch high-priority published studies
    const { data: studies, error: studiesError } = await admin
      .from('agent_studies')
      .select(`
        id, title, summary, agent_code_name, quality_status, created_at,
        study_scores (confidence, novelty, impact, urgency, telegram_priority)
      `)
      .eq('quality_status', 'published')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(50);

    if (studiesError) throw new Error(JSON.stringify(studiesError));

    // 2. Filter by telegram_priority threshold
    const eligible = (studies || []).filter((s: any) => {
      const scores = Array.isArray(s.study_scores) ? s.study_scores[0] : s.study_scores;
      const priority = scores?.telegram_priority ?? 0;
      return priority >= minPriority;
    }).slice(0, maxStudies);

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No studies above priority threshold', studies_found: 0, sent: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Format the digest
    const digestText = formatDigest(eligible.map((s: any) => ({
      ...s,
      study_scores: Array.isArray(s.study_scores) ? s.study_scores[0] : s.study_scores,
    })));

    // 4. Send (or dry run)
    let sent = false;
    if (!dryRun) {
      sent = await sendTelegramMessage(digestText);
    }

    const durationMs = Date.now() - startTime;

    // 5. Log execution trace
    await admin.from('execution_traces').insert({
      trace_id: traceId,
      agent_code_name: 'SYSTEM',
      step: 'telegram_digest',
      status: 'success',
      input_json: { min_priority: minPriority, hours_back: hoursBack, dry_run: dryRun },
      output_json: { studies_eligible: eligible.length, sent, duration_ms: durationMs },
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({
        success: true,
        trace_id: traceId,
        studies_eligible: eligible.length,
        sent,
        dry_run: dryRun,
        digest_preview: dryRun ? digestText : undefined,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Telegram Digest Error:', errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
