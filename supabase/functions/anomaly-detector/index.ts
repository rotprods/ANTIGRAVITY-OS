import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

interface AnomalyAlert {
  title: string;
  description: string;
  severity: number; // 1=info, 2=warning, 3=critical
  category: string;
  source: string;
}

// Rule 1: Deals stale > 7 days without crm_activity
async function checkStaleDeals(): Promise<AnomalyAlert[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const { data: deals } = await admin
    .from("deals")
    .select("id, title, stage, org_id")
    .not("stage", "in", '("closed_won","closed_lost")')
    .lt("updated_at", cutoff.toISOString());

  if (!deals || deals.length === 0) return [];

  // Check if each stale deal has any recent activity
  const alerts: AnomalyAlert[] = [];
  for (const deal of deals.slice(0, 10)) {
    const { count } = await admin
      .from("crm_activities")
      .select("id", { count: "exact", head: true })
      .eq("company_id", deal.company_id)
      .gte("created_at", cutoff.toISOString());

    if ((count || 0) === 0) {
      alerts.push({
        title: `Stale deal: ${deal.title}`,
        description: `No activity in the last 7 days. Stage: ${deal.stage}`,
        severity: 2,
        category: "pipeline",
        source: "anomaly-detector",
      });
    }
  }

  return alerts;
}

// Rule 2: Pipeline value drop vs rolling 7-day average
async function checkPipelineDrop(): Promise<AnomalyAlert[]> {
  const { data: current } = await admin
    .from("deals")
    .select("value")
    .not("stage", "in", '("closed_won","closed_lost")');

  const currentTotal = (current || []).reduce((s, d) => s + (parseFloat(String(d.value)) || 0), 0);

  // Approximate 7-day average from daily_snapshots if available
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: snapshots } = await admin
    .from("daily_snapshots")
    .select("pipeline_value")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(7);

  if (!snapshots || snapshots.length < 3) return []; // Not enough data

  const avgPipeline = snapshots.reduce((s, sn) => s + (parseFloat(String(sn.pipeline_value)) || 0), 0) / snapshots.length;

  if (avgPipeline > 0 && currentTotal < avgPipeline * 0.8) {
    return [{
      title: "Pipeline value dropped",
      description: `Current €${Math.round(currentTotal).toLocaleString()} vs 7d avg €${Math.round(avgPipeline).toLocaleString()} (${Math.round((1 - currentTotal / avgPipeline) * 100)}% drop)`,
      severity: 3,
      category: "pipeline",
      source: "anomaly-detector",
    }];
  }

  return [];
}

// Rule 3: Signal spike — >3 new signals in last 1h
async function checkSignalSpike(): Promise<AnomalyAlert[]> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { count } = await admin
    .from("signals")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneHourAgo.toISOString());

  if ((count || 0) > 3) {
    return [{
      title: `Signal spike detected`,
      description: `${count} new signals in the last hour. Review Intelligence module.`,
      severity: 1,
      category: "intelligence",
      source: "anomaly-detector",
    }];
  }

  return [];
}

// Rule 4: All agents idle > 4h
async function checkAgentIdle(): Promise<AnomalyAlert[]> {
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  const { count } = await admin
    .from("agent_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fourHoursAgo.toISOString());

  if ((count || 0) === 0) {
    return [{
      title: "All agents idle",
      description: "No agent activity in the last 4 hours. Check agent health.",
      severity: 2,
      category: "agents",
      source: "anomaly-detector",
    }];
  }

  return [];
}

// Dedup: don't insert same alert if already active within last 2h
async function isAlertDuplicate(title: string): Promise<boolean> {
  const twoHoursAgo = new Date();
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

  const { count } = await admin
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("title", title)
    .eq("status", "active")
    .gte("created_at", twoHoursAgo.toISOString());

  return (count || 0) > 0;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Run all rules in parallel
    const [stale, drop, spike, idle] = await Promise.all([
      checkStaleDeals(),
      checkPipelineDrop(),
      checkSignalSpike(),
      checkAgentIdle(),
    ]);

    const allAlerts = [...stale, ...drop, ...spike, ...idle];
    const inserted: AnomalyAlert[] = [];

    for (const alert of allAlerts) {
      const isDupe = await isAlertDuplicate(alert.title);
      if (!isDupe) {
        await admin.from("alerts").insert({ ...alert, status: "active" });
        inserted.push(alert);
      }
    }

    return jsonResponse({
      ok: true,
      detected: allAlerts.length,
      inserted: inserted.length,
      alerts: inserted,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Anomaly detection failed", 500);
  }
});
