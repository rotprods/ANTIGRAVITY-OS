import type {
  EvaluationResult,
  ImprovementPatch,
  JsonRecord,
  RiskLevel,
  SimulationResult,
} from "./control-plane-types.ts";
import { normalizeRiskLevel } from "./control-plane-types.ts";
import { evaluateArtifact } from "./evaluation.ts";
import { evaluateGovernanceGate } from "./governance.ts";
import { compact, safeNumber } from "./http.ts";
import { writeMemoryRecord } from "./memory-system.ts";
import { runSimulation } from "./simulation.ts";
import { admin } from "./supabase.ts";

interface ImprovementIssue {
  issue_type: string;
  issue_summary: string;
  risk_level: RiskLevel;
  evidence: JsonRecord;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function toSimulationResult(row: Awaited<ReturnType<typeof runSimulation>>): SimulationResult {
  return {
    simulation_id: compact(row.simulation_id),
    mode: row.mode,
    status: row.status,
    score: safeNumber(row.score, 0),
    recommended_action: compact(row.recommended_action) || "review",
    policy_gate_passed: row.policy_gate_passed === true,
  };
}

function toEvaluationResult(row: Awaited<ReturnType<typeof evaluateArtifact>>): EvaluationResult {
  return {
    output_score: safeNumber(row.overall_score, 0),
    execution_time: safeNumber(asRecord(row.metadata).execution_time_ms, 0),
    cost_estimate: safeNumber(asRecord(row.metadata).cost_estimate_usd, 0),
    risk_level: normalizeRiskLevel(row.impact_level),
    retry_needed: row.retry_recommended === true,
    decision: row.decision,
    explanation: compact(row.explanation) || "No explanation provided.",
  };
}

export async function detectImprovementIssues(input?: {
  orgId?: string | null;
  userId?: string | null;
  windowHours?: number;
}): Promise<ImprovementIssue[]> {
  const orgId = compact(input?.orgId) || null;
  const windowHours = Math.max(1, Math.min(168, Number(input?.windowHours || 24)));
  const sinceIso = new Date(Date.now() - (windowHours * 60 * 60 * 1000)).toISOString();

  const issues: ImprovementIssue[] = [];

  let failedPipelinesQuery = admin
    .from("pipeline_runs")
    .select("id,status,error_message,updated_at")
    .eq("status", "failed")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (orgId) failedPipelinesQuery = failedPipelinesQuery.eq("org_id", orgId);
  const { data: failedPipelines, error: pipelineError } = await failedPipelinesQuery;
  if (!pipelineError && (failedPipelines || []).length > 0) {
    issues.push({
      issue_type: "pipeline_failure_rate",
      issue_summary: `${(failedPipelines || []).length} failed pipeline runs detected in last ${windowHours}h.`,
      risk_level: "high",
      evidence: { failed_pipeline_runs: failedPipelines },
    });
  }

  let lowEvaluationsQuery = admin
    .from("evaluation_runs")
    .select("id,overall_score,decision,created_at")
    .lt("overall_score", 75)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);
  if (orgId) lowEvaluationsQuery = lowEvaluationsQuery.eq("org_id", orgId);
  const { data: lowEvaluations, error: evaluationError } = await lowEvaluationsQuery;
  if (!evaluationError && (lowEvaluations || []).length > 0) {
    issues.push({
      issue_type: "evaluation_quality_drop",
      issue_summary: `${(lowEvaluations || []).length} low-score evaluation runs detected in last ${windowHours}h.`,
      risk_level: "medium",
      evidence: { low_evaluation_runs: lowEvaluations },
    });
  }

  let failedSimulationsQuery = admin
    .from("simulation_runs")
    .select("id,status,recommended_action,created_at")
    .eq("status", "failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);
  if (orgId) failedSimulationsQuery = failedSimulationsQuery.eq("org_id", orgId);
  const { data: failedSimulations, error: simulationError } = await failedSimulationsQuery;
  if (!simulationError && (failedSimulations || []).length > 0) {
    issues.push({
      issue_type: "simulation_regressions",
      issue_summary: `${(failedSimulations || []).length} failed simulation runs detected in last ${windowHours}h.`,
      risk_level: "high",
      evidence: { failed_simulation_runs: failedSimulations },
    });
  }

  if ((pipelineError || evaluationError || simulationError) && issues.length === 0) {
    issues.push({
      issue_type: "telemetry_gap",
      issue_summary: "Improvement detector could not read one or more telemetry tables.",
      risk_level: "low",
      evidence: {
        pipeline_error: compact(pipelineError?.message),
        evaluation_error: compact(evaluationError?.message),
        simulation_error: compact(simulationError?.message),
      },
    });
  }

  if (issues.length === 0) {
    issues.push({
      issue_type: "no_regressions_detected",
      issue_summary: `No major regressions found in the last ${windowHours}h.`,
      risk_level: "low",
      evidence: { window_hours: windowHours },
    });
  }

  return issues;
}

export async function runImprovementCycle(input: {
  orgId?: string | null;
  userId?: string | null;
  correlationId?: string | null;
  issueType?: string;
  issueSummary?: string;
  proposal?: string;
  riskLevel?: RiskLevel;
  context?: JsonRecord;
}) {
  const issueType = compact(input.issueType);
  const issueSummary = compact(input.issueSummary);
  const riskLevel = normalizeRiskLevel(input.riskLevel || "medium");
  const context = asRecord(input.context);

  const detectedIssues = (!issueType || !issueSummary)
    ? await detectImprovementIssues({
      orgId: input.orgId || null,
      userId: input.userId || null,
      windowHours: safeNumber(context.window_hours, 24),
    })
    : [];

  const selectedIssue = issueType && issueSummary
    ? {
      issue_type: issueType,
      issue_summary: issueSummary,
      risk_level: riskLevel,
      evidence: context,
    }
    : detectedIssues[0];

  const patch: ImprovementPatch = {
    patch_id: crypto.randomUUID(),
    issue_type: selectedIssue.issue_type,
    issue_summary: selectedIssue.issue_summary,
    proposal: compact(input.proposal) || `Stabilize ${selectedIssue.issue_type} via policy/routing hardening and targeted retries.`,
    risk_level: selectedIssue.risk_level,
    status: "proposed",
    created_at: new Date().toISOString(),
  };

  const governance = await evaluateGovernanceGate({
    targetType: "goal",
    targetId: patch.patch_id,
    targetRef: "improvement_engine",
    orgId: input.orgId || null,
    userId: input.userId || null,
    sourceAgent: "improvement-engine",
    source: "control-plane",
    riskClass: patch.risk_level,
    context: {
      issue_type: patch.issue_type,
      issue_summary: patch.issue_summary,
      proposal: patch.proposal,
      policy: {
        approval_required: patch.risk_level === "high" || patch.risk_level === "critical",
      },
    },
    plannedStepCount: 1,
  });

  patch.governance = {
    allowed: governance.allowed,
    decision: governance.decision,
    reason: governance.reason,
    requires_approval: governance.requiresApproval,
    applied_policies: governance.applied_policies,
  };

  if (!governance.allowed) {
    patch.status = "blocked";
    await writeMemoryRecord({
      orgId: input.orgId || null,
      userId: input.userId || null,
      agentCodeName: "improvement-engine",
      scope: "long_term",
      namespace: "improvement_patches",
      summary: `Blocked patch ${patch.patch_id}: ${patch.issue_summary}`,
      content: { patch, detected_issues: detectedIssues },
      correlationId: input.correlationId || null,
      importance: 85,
    }).catch(() => undefined);

    return {
      patch,
      detected_issues: detectedIssues,
      status: "blocked_by_governance",
    };
  }

  const simulation = await runSimulation({
    mode: "shadow",
    targetType: "improvement_patch",
    targetId: patch.patch_id,
    workflowId: "self_improvement_patch_cycle",
    riskClass: patch.risk_level,
    targetEnvironment: "staging",
    inputSnapshot: {
      issue_type: patch.issue_type,
      issue_summary: patch.issue_summary,
      proposal: patch.proposal,
      evidence: selectedIssue.evidence,
    },
    correlationId: input.correlationId || null,
    orgId: input.orgId || null,
    userId: input.userId || null,
    sourceAgent: "improvement-engine",
  });

  patch.simulation = toSimulationResult(simulation);
  patch.status = "simulated";

  const evaluation = await evaluateArtifact({
    artifactType: "improvement_patch",
    artifactPayload: {
      patch_id: patch.patch_id,
      issue_type: patch.issue_type,
      issue_summary: patch.issue_summary,
      proposal: patch.proposal,
      simulation,
      context,
    },
    impactLevel: patch.risk_level,
    artifactId: patch.patch_id,
    correlationId: input.correlationId || null,
    orgId: input.orgId || null,
    userId: input.userId || null,
    sourceAgent: "improvement-engine",
    explanationHint: "Evaluate whether this patch proposal is safe, coherent, and cost-efficient.",
  });

  patch.evaluation = toEvaluationResult(evaluation);

  if (patch.evaluation.decision === "pass" && patch.simulation.policy_gate_passed) {
    patch.status = patch.risk_level === "high" || patch.risk_level === "critical"
      ? "approved"
      : "approved";
  } else if (patch.evaluation.decision === "reject") {
    patch.status = "rejected";
  }

  await writeMemoryRecord({
    orgId: input.orgId || null,
    userId: input.userId || null,
    agentCodeName: "improvement-engine",
    scope: "long_term",
    namespace: "improvement_patches",
    summary: `Patch ${patch.patch_id} status: ${patch.status}`,
    content: {
      patch,
      detected_issues: detectedIssues,
      governance,
      simulation,
      evaluation,
    },
    correlationId: input.correlationId || null,
    importance: patch.status === "rejected" ? 75 : 90,
  }).catch(() => undefined);

  return {
    patch,
    detected_issues: detectedIssues,
    status: patch.status,
  };
}
