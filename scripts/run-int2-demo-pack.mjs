#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function parseEnvContent(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? "";
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function loadEnvFile(relativePath) {
  const filePath = path.resolve(projectRoot, relativePath);
  if (!existsSync(filePath)) return {};
  return parseEnvContent(readFileSync(filePath, "utf8"));
}

function resolveEnv(keys) {
  const fromDotEnv = loadEnvFile(".env");
  const fromDeployEnv = loadEnvFile("supabase/.env.deploy");
  const merged = {
    ...fromDotEnv,
    ...fromDeployEnv,
    ...process.env,
  };
  const out = {};
  for (const key of keys) out[key] = merged[key] || "";
  return out;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function callFunction({ baseUrl, serviceKey, functionName, body }) {
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = { raw };
  }

  return {
    status: response.status,
    ok: response.ok,
    data: json,
  };
}

function compact(value) {
  return value == null ? "" : String(value).trim();
}

function parseArgs(argv) {
  const args = { windowHours: 24 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--window-hours") {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next)) {
        args.windowHours = Math.max(1, Math.min(168, Math.round(next)));
        i += 1;
      }
    }
  }
  return args;
}

function parseIsoMaybe(value) {
  const normalized = compact(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# INT-2 Demo Workflow Pack");
  lines.push("");
  lines.push(`Generated at: ${report.generated_at}`);
  lines.push(`Org: \`${report.org_id}\``);
  lines.push(`Window: ${report.window_hours}h`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Workflows executed: ${report.summary.total_workflows}`);
  lines.push(`- Completed: ${report.summary.completed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push(`- Waiting approval: ${report.summary.waiting_approval}`);
  lines.push(`- Total evaluations (window): ${report.summary.evaluations_window_total}`);
  lines.push(`- Total simulation rows (window): ${report.summary.simulations_window_total}`);
  lines.push("");
  lines.push("## Workflow Results");
  lines.push("");
  lines.push("| Workflow | Template | Run ID | Status | Taxonomy | Evaluations | Escalations | Simulations |");
  lines.push("|---|---|---|---|---|---:|---:|---:|");
  for (const row of report.workflows) {
    lines.push(`| ${row.workflow_id} | \`${row.template_code_name}\` | \`${row.pipeline_run_id}\` | ${row.run_status} | ${row.taxonomy_class || "n/a"} | ${row.evaluation_metrics.totals.evaluations_window} | ${row.evaluation_metrics.escalation.escalations_total} | ${row.simulation_taxonomy.totals.simulations_window} |`);
  }
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  lines.push(`- JSON: \`${report.artifacts.json_path}\``);
  lines.push(`- Markdown: \`${report.artifacts.markdown_path}\``);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This pack is provider-independent by design (no Gmail/WhatsApp credentials required).");
  lines.push("- Workflows run through orchestration-engine and are scored by evaluation-engine.");
  return `${lines.join("\n")}\n`;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = resolveEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const baseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  assertCondition(baseUrl, "Missing SUPABASE_URL (env/.env/supabase/.env.deploy).");
  assertCondition(serviceKey, "Missing SUPABASE_SERVICE_ROLE_KEY (env/.env/supabase/.env.deploy).");

  const orgResponse = await fetch(
    `${baseUrl}/rest/v1/organizations?select=id&order=created_at.asc&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  const orgRows = await orgResponse.json();
  const orgId = Array.isArray(orgRows) ? String(orgRows[0]?.id || "") : "";
  assertCondition(Boolean(orgId), "Could not resolve org_id from organizations table.");

  const workflows = [
    {
      workflow_id: "INT-2.1",
      label: "bug -> patch -> test -> review",
      template_code_name: "self_improvement_patch_cycle",
      goal: "Fix regression in runtime taxonomy classification and validate patch quality.",
    },
    {
      workflow_id: "INT-2.2",
      label: "feature -> implement -> evaluate",
      template_code_name: "feature_delivery_eval_cycle",
      goal: "Ship a scoped feature increment and evaluate implementation quality.",
    },
    {
      workflow_id: "INT-2.3",
      label: "campaign -> execute -> score -> improve",
      template_code_name: "campaign_execution_improvement_cycle",
      goal: "Execute a campaign cycle, score outcomes, and propose improvements.",
    },
  ];

  const results = [];
  for (const workflow of workflows) {
    console.log(`[int2-pack] running ${workflow.workflow_id} (${workflow.template_code_name})`);
    const createRun = await callFunction({
      baseUrl,
      serviceKey,
      functionName: "orchestration-engine",
      body: {
        action: "create_run",
        org_id: orgId,
        template_code_name: workflow.template_code_name,
        goal: workflow.goal,
        source: "int2-demo-pack",
        auto_execute: true,
        context: {
          risk_class: "low",
          target_environment: "staging",
          int2_workflow: workflow.workflow_id,
          demo_pack: true,
          skip_telegram: true,
        },
      },
    });

    assertCondition(createRun.status === 200, `${workflow.workflow_id} create_run failed with status ${createRun.status}`);
    assertCondition(createRun.data?.ok === true, `${workflow.workflow_id} create_run did not return ok=true`);

    const pipelineRun = createRun.data?.pipeline_run || {};
    const pipelineRunId = compact(pipelineRun.id) || compact(createRun.data?.pipeline_run_id);
    const correlationId = compact(pipelineRun.correlation_id);
    assertCondition(Boolean(pipelineRunId), `${workflow.workflow_id} missing pipeline_run_id in orchestration response`);

    const runTaxonomy = await callFunction({
      baseUrl,
      serviceKey,
      functionName: "orchestration-engine",
      body: {
        action: "get_run_taxonomy",
        pipeline_run_id: pipelineRunId,
      },
    });
    assertCondition(runTaxonomy.status === 200, `${workflow.workflow_id} get_run_taxonomy failed`);

    const evaluationMetrics = await callFunction({
      baseUrl,
      serviceKey,
      functionName: "evaluation-engine",
      body: {
        action: "metrics",
        org_id: orgId,
        correlation_id: correlationId || null,
        window_hours: args.windowHours,
      },
    });
    assertCondition(evaluationMetrics.status === 200, `${workflow.workflow_id} evaluation metrics failed`);

    const simulationTaxonomy = await callFunction({
      baseUrl,
      serviceKey,
      functionName: "simulation-engine",
      body: {
        action: "taxonomy",
        org_id: orgId,
        correlation_id: correlationId || null,
        window_hours: args.windowHours,
      },
    });
    assertCondition(simulationTaxonomy.status === 200, `${workflow.workflow_id} simulation taxonomy failed`);

    const latestFailures = await callFunction({
      baseUrl,
      serviceKey,
      functionName: "simulation-engine",
      body: {
        action: "latest_failures",
        org_id: orgId,
        correlation_id: correlationId || null,
        limit: 3,
      },
    });
    assertCondition(latestFailures.status === 200, `${workflow.workflow_id} latest_failures failed`);

    const startedAt = parseIsoMaybe(pipelineRun.started_at);
    const completedAt = parseIsoMaybe(pipelineRun.completed_at);
    const durationMs = startedAt && completedAt ? Math.max(0, completedAt - startedAt) : null;

    results.push({
      workflow_id: workflow.workflow_id,
      label: workflow.label,
      template_code_name: workflow.template_code_name,
      pipeline_run_id: pipelineRunId,
      correlation_id: correlationId || null,
      run_status: compact(pipelineRun.status) || compact(createRun.data?.status) || "unknown",
      taxonomy_class: compact(runTaxonomy.data?.taxonomy?.class) || null,
      taxonomy_reason: compact(runTaxonomy.data?.taxonomy?.reason) || null,
      duration_ms: durationMs,
      evaluation_metrics: evaluationMetrics.data?.metrics || {
        totals: { evaluations_window: 0, decision_distribution: { pass: 0, retry: 0, reject: 0, escalate: 0 } },
        escalation: { escalations_total: 0 },
      },
      simulation_taxonomy: simulationTaxonomy.data?.taxonomy || {
        totals: { simulations_window: 0, status: { passed: 0, failed: 0 }, policy_gate: { passed: 0, blocked: 0 } },
      },
      simulation_latest_failures: latestFailures.data?.failures || [],
    });
  }

  const summary = {
    total_workflows: results.length,
    completed: results.filter((row) => row.run_status === "completed").length,
    failed: results.filter((row) => row.run_status === "failed").length,
    waiting_approval: results.filter((row) => row.run_status === "waiting_approval").length,
    evaluations_window_total: results.reduce(
      (acc, row) => acc + Number(row.evaluation_metrics?.totals?.evaluations_window || 0),
      0,
    ),
    simulations_window_total: results.reduce(
      (acc, row) => acc + Number(row.simulation_taxonomy?.totals?.simulations_window || 0),
      0,
    ),
  };

  const artifactsDir = path.resolve(projectRoot, "docs/runbooks");
  await mkdir(artifactsDir, { recursive: true });
  const jsonPath = path.resolve(artifactsDir, "int2-demo-pack.latest.json");
  const mdPath = path.resolve(artifactsDir, "int2-demo-pack.md");

  const report = {
    generated_at: new Date().toISOString(),
    org_id: orgId,
    window_hours: args.windowHours,
    summary,
    workflows: results,
    artifacts: {
      json_path: path.relative(projectRoot, jsonPath),
      markdown_path: path.relative(projectRoot, mdPath),
    },
  };

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown(report), "utf8");

  console.log("[int2-pack] success");
  console.log(JSON.stringify({
    ok: true,
    summary,
    artifacts: report.artifacts,
  }, null, 2));
}

run().catch((error) => {
  console.error("[int2-pack] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

