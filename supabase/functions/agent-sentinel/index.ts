import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runBrain } from "../_shared/agent-brain-v2.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const AGENT_CODE = 'sentinel';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'monitor', task_id } = body;
    const { data: agent } = await supabase.from('agent_registry').select('*').eq('code_name', AGENT_CODE).single();
    if (!agent) throw new Error('Agent not found');
    await supabase.from('agent_registry').update({ status: 'running', last_run_at: new Date().toISOString() }).eq('id', agent.id);

    let result: any = {};

    if (action === 'monitor' || action === 'cycle') {
      const thresholds = agent.config?.kpi_thresholds || { mrr_drop_pct: 10, churn_spike: 5, pipeline_low: 10000 };
      const anomalies: any[] = [];

      // Check pipeline health
      const { data: deals } = await supabase.from('deals').select('value, stage').not('stage', 'eq', 'lost');
      const pipelineTotal = (deals || []).reduce((s, d) => s + (d.value || 0), 0);
      if (pipelineTotal < thresholds.pipeline_low) {
        anomalies.push({ type: 'pipeline_low', severity: 'warning', message: `Pipeline total (€${pipelineTotal}) below threshold (€${thresholds.pipeline_low})` });
      }

      // Check stale leads (contacts raw for >7 days)
      const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const { data: staleLeads } = await supabase.from('contacts').select('id').eq('status', 'raw').lt('created_at', weekAgo);
      if ((staleLeads || []).length > 10) {
        anomalies.push({ type: 'stale_leads', severity: 'info', message: `${(staleLeads || []).length} leads sin procesar desde hace >7 días` });
      }

      // Check overdue tasks
      const today = new Date().toISOString().split('T')[0];
      const { data: overdue } = await supabase.from('tasks').select('id').eq('status', 'pending').lt('due_date', today);
      if ((overdue || []).length > 0) {
        anomalies.push({ type: 'overdue_tasks', severity: 'warning', message: `${(overdue || []).length} tareas vencidas sin completar` });
      }

      // Check active alerts count
      const { data: activeAlerts } = await supabase.from('alerts').select('id').eq('status', 'active');
      if ((activeAlerts || []).length > thresholds.churn_spike) {
        anomalies.push({ type: 'too_many_alerts', severity: 'critical', message: `${(activeAlerts || []).length} alertas activas, posible problema sistémico` });
      }

      // Create alerts for anomalies
      for (const anomaly of anomalies) {
        await supabase.from('alerts').insert({
          title: `SENTINEL: ${anomaly.type}`,
          description: anomaly.message,
          severity: anomaly.severity,
          category: 'system',
          status: 'active',
          source: 'SENTINEL'
        });
      }

      const baseResult = { anomalies_detected: anomalies.length, anomalies, pipeline_total: pipelineTotal, overdue_tasks: (overdue || []).length, active_alerts: (activeAlerts || []).length };

      // ── Brain: autonomous reasoning + action on top of raw data ──
      const brain = await runBrain({
        agent: "sentinel",
        goal: "Review system health anomalies and take corrective actions: update tasks, escalate critical alerts, search external market signals if needed, and send a notification if anything is critical.",
        context: baseResult,
        systemPromptExtra: "You are SENTINEL: the watchdog. Be decisive. If pipeline is low, create a task for ATLAS to scan. If alerts are critical, notify the team immediately.",
        maxRounds: 5,
      }).catch((e) => ({ ok: false, answer: `Brain error: ${e.message}`, skills_used: [], rounds: 0 }));

      result = { ...baseResult, brain_analysis: brain.answer, skills_executed: brain.skills_used?.length, rounds: brain.rounds };
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
