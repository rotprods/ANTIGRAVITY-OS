import type {
  ControlPlaneActionRequest,
  GoalSpec,
  JsonRecord,
  TaskNode,
} from "./control-plane-types.ts";
import { parseGoalSpec, parseTaskNodes, toEventEnvelopeV2 } from "./control-plane-types.ts";
import { emitControlPlaneEventV2 } from "./control-plane-events.ts";
import { evaluateArtifact } from "./evaluation.ts";
import { evaluateGovernanceGate, getGovernanceMetrics } from "./governance.ts";
import { compact, safeNumber } from "./http.ts";
import { runImprovementCycle } from "./improvement-engine.ts";
import { recallMemoryRecords } from "./memory-system.ts";
import {
  executeGoal,
  executePipelineRun,
  getPipelineRunDetails,
  listRecentPipelineRuns,
  planGoal,
} from "./orchestration.ts";
import { replaySimulation, runSimulation } from "./simulation.ts";
import { admin } from "./supabase.ts";
import { getAgentWorkforceSnapshot } from "./agent-workforce.ts";
import { listToolCapabilities } from "./tool-fabric.ts";
import { invokeToolThroughBus } from "./tool-bus.ts";
import { getWorkflowRegistrySnapshot, resolveWorkflowNodeById } from "./workflow-registry.ts";
import {
  buildWorkflowGraph,
  getReadyTaskIds,
  summarizeGraphExecution,
  type TaskStatusIndex,
} from "./workflow-graph-engine.ts";

interface ControlPlaneActionResult {
  ok: boolean;
  action: string;
  trace_id: string;
  correlation_id: string;
  data: JsonRecord;
  warnings?: string[];
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function nowIso() {
  return new Date().toISOString();
}

function goalKeywords(goal: GoalSpec) {
  return `${goal.goal_type} ${goal.goal_text} ${goal.goal_expected_outcome}`.toLowerCase();
}

function routeGoalToWorkflow(goal: GoalSpec, workflows: Array<Record<string, unknown>>) {
  if (workflows.length === 0) return null;
  const keyset = goalKeywords(goal);

  const exact = workflows.find((workflow) => {
    const workflowId = compact(workflow.workflow_id).toLowerCase();
    return workflowId === compact(goal.goal_type).toLowerCase();
  });
  if (exact) return exact;

  const scored = workflows
    .map((workflow) => {
      const workflowId = compact(workflow.workflow_id).toLowerCase();
      const description = compact(workflow.description).toLowerCase();
      const words = `${workflowId} ${description}`.split(/[\s_\-]+/).filter(Boolean);
      let score = 0;
      for (const word of words) {
        if (word.length < 3) continue;
        if (keyset.includes(word)) score += 1;
      }
      return { workflow, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) {
    return scored[0].workflow;
  }

  return workflows[0];
}

async function mapGoalStepsToTaskNodes(goalId: string): Promise<TaskNode[]> {
  const { data, error } = await admin
    .from("goal_steps")
    .select("*")
    .eq("goal_id", goalId)
    .order("step_number", { ascending: true });
  if (error) throw error;

  return (data || []).map((step, index) => {
    const input = asRecord(step.input);
    const dependsOnRaw = Array.isArray(step.depends_on) ? step.depends_on : [];
    return {
      id: compact(step.id) || `goal_step_${index + 1}`,
      key: compact(input.template_step_key || step.action || step.title) || `goal_step_${index + 1}`,
      title: compact(step.title) || `Goal step ${index + 1}`,
      step_type: compact(step.step_type) === "pipeline"
        ? "workflow"
        : compact(step.step_type) === "agent"
          ? "agent"
          : compact(step.step_type) === "decision"
            ? "event"
            : "task",
      depends_on: dependsOnRaw.map((value) => compact(value)).filter(Boolean),
      agent_id: compact(step.agent_code_name) || null,
      workflow_id: compact(step.pipeline_template) || null,
      tool_id: compact(step.action) || null,
      metadata: {
        goal_id: step.goal_id,
        step_number: step.step_number,
      },
    } satisfies TaskNode;
  });
}

async function runStatusFromGoal(goalId: string) {
  const { data: goal, error: goalError } = await admin
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .maybeSingle();
  if (goalError) throw goalError;
  if (!goal) throw new Error(`Goal not found: ${goalId}`);

  const { data: steps, error: stepError } = await admin
    .from("goal_steps")
    .select("*")
    .eq("goal_id", goalId)
    .order("step_number", { ascending: true });
  if (stepError) throw stepError;

  const statusById: TaskStatusIndex = {};
  for (const step of (steps || [])) {
    const rawStatus = compact(step.status).toLowerCase();
    statusById[String(step.id)] = rawStatus === "completed"
      ? "completed"
      : rawStatus === "running"
        ? "running"
        : rawStatus === "failed"
          ? "failed"
          : rawStatus === "waiting_approval"
            ? "blocked"
            : "pending";
  }

  const taskNodes = await mapGoalStepsToTaskNodes(goalId);
  const graph = buildWorkflowGraph(taskNodes);
  const summary = summarizeGraphExecution(graph, statusById);
  const ready = getReadyTaskIds(graph, statusById);

  return {
    goal,
    steps: steps || [],
    graph: {
      has_cycle: graph.has_cycle,
      roots: graph.roots,
      topological_order: graph.topological_order,
      cycle_nodes: graph.cycle_nodes,
      ready,
      summary,
    },
  };
}

async function metricsSnapshot(input: {
  orgId?: string | null;
  userId?: string | null;
  windowHours?: number;
}) {
  const orgId = compact(input.orgId) || null;
  const windowHours = Math.max(1, Math.min(168, Number(input.windowHours || 24)));
  const sinceIso = new Date(Date.now() - (windowHours * 60 * 60 * 1000)).toISOString();

  const governance = await getGovernanceMetrics({
    orgId,
    userId: input.userId || null,
    windowHours,
  });

  let pipelineRunsQuery = admin
    .from("pipeline_runs")
    .select("id,status,started_at,completed_at,updated_at")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (orgId) pipelineRunsQuery = pipelineRunsQuery.eq("org_id", orgId);
  const { data: pipelineRuns, error: pipelineError } = await pipelineRunsQuery;
  if (pipelineError) throw pipelineError;

  let completed = 0;
  let failed = 0;
  let totalLatencyMs = 0;
  let latencySamples = 0;
  for (const row of pipelineRuns || []) {
    const status = compact(row.status).toLowerCase();
    if (status === "completed") completed += 1;
    if (status === "failed") failed += 1;
    if (row.started_at && row.completed_at) {
      const started = new Date(String(row.started_at)).getTime();
      const ended = new Date(String(row.completed_at)).getTime();
      if (Number.isFinite(started) && Number.isFinite(ended) && ended >= started) {
        totalLatencyMs += (ended - started);
        latencySamples += 1;
      }
    }
  }

  const totalRuns = (pipelineRuns || []).length;
  const workflowSuccessRate = totalRuns > 0
    ? Number((completed / totalRuns).toFixed(4))
    : 0;

  let agentCompletedQuery = admin
    .from("event_log")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "agent.completed")
    .gte("created_at", sinceIso);
  if (orgId) agentCompletedQuery = agentCompletedQuery.eq("org_id", orgId);
  const { count: agentCompletedCount } = await agentCompletedQuery;

  let agentErrorQuery = admin
    .from("event_log")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "agent.error")
    .gte("created_at", sinceIso);
  if (orgId) agentErrorQuery = agentErrorQuery.eq("org_id", orgId);
  const { count: agentErrorCount } = await agentErrorQuery;
  const totalAgentEvents = Number(agentCompletedCount || 0) + Number(agentErrorCount || 0);
  const agentSuccessRate = totalAgentEvents > 0
    ? Number((Number(agentCompletedCount || 0) / totalAgentEvents).toFixed(4))
    : 0;

  let toolLatencyQuery = admin
    .from("event_log")
    .select("metadata")
    .eq("event_type", "tool_bus.completed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  if (orgId) toolLatencyQuery = toolLatencyQuery.eq("org_id", orgId);
  const { data: toolLatencyRows } = await toolLatencyQuery;

  let toolLatencyTotal = 0;
  let toolLatencySamples = 0;
  for (const row of toolLatencyRows || []) {
    const metadata = asRecord(row.metadata);
    const latency = safeNumber(metadata.duration_ms || metadata.latency_ms, NaN);
    if (Number.isFinite(latency)) {
      toolLatencyTotal += latency;
      toolLatencySamples += 1;
    }
  }

  return {
    generated_at: nowIso(),
    window_hours: windowHours,
    slo_targets: {
      workflow_success_rate: ">0.95",
      agent_success_rate: ">0.90",
      orchestration_latency_ms: "<200",
      internal_tool_router_latency_ms: "<150",
    },
    measurements: {
      workflow_success_rate: workflowSuccessRate,
      agent_success_rate: agentSuccessRate,
      orchestration_latency_ms_avg: latencySamples > 0 ? Number((totalLatencyMs / latencySamples).toFixed(2)) : 0,
      internal_tool_router_latency_ms_avg: toolLatencySamples > 0
        ? Number((toolLatencyTotal / toolLatencySamples).toFixed(2))
        : 0,
      total_pipeline_runs: totalRuns,
      failed_pipeline_runs: failed,
    },
    governance,
  };
}

export async function handleControlPlaneAction(
  input: ControlPlaneActionRequest,
  authHeader?: string | null,
): Promise<ControlPlaneActionResult> {
  const action = compact(input.action || "metrics").toLowerCase();
  const traceId = compact(input.trace_id) || crypto.randomUUID();
  const correlationId = compact(input.correlation_id) || crypto.randomUUID();
  const startedAt = Date.now();
  const warnings: string[] = [];

  const emit = async (result: string, payload: JsonRecord, riskLevel: "low" | "medium" | "high" | "critical" = "low") => {
    const latency = Date.now() - startedAt;
    const event = toEventEnvelopeV2({
      event_type: `control_plane.${action}`,
      agent_id: compact(input.source_agent) || "control-plane",
      workflow_id: compact(input.workflow_id) || null,
      tool_id: compact(input.artifact_type) || null,
      trace_id: traceId,
      correlation_id: correlationId,
      timestamp: nowIso(),
      latency_ms: latency,
      cost_usd: 0,
      risk_level: riskLevel,
      result,
      payload,
      metadata: {
        action,
        org_id: compact(input.org_id) || null,
        user_id: compact(input.user_id) || null,
      },
    });

    await emitControlPlaneEventV2({
      event,
      status: result === "success" ? "delivered" : "failed",
      userId: input.user_id || null,
      orgId: input.org_id || null,
      pipelineRunId: input.pipeline_run_id || null,
    }).catch(() => undefined);
  };

  try {
    if (action === "goal_parse") {
      const goalSpec = parseGoalSpec(input.goal_spec || input.context || {});
      const data = { goal_spec: goalSpec };
      await emit("success", data, goalSpec.goal_risk_level);
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "goal_route") {
      const goalSpec = parseGoalSpec(input.goal_spec || input.context || {});
      const snapshot = await getWorkflowRegistrySnapshot({
        orgId: input.org_id || null,
        workflowQuery: input.workflow_query || goalSpec.goal_text,
        limit: input.limit || 400,
      });
      warnings.push(...snapshot.warnings);

      const allWorkflows = [...snapshot.native_workflows, ...snapshot.n8n_workflows];
      const routed = routeGoalToWorkflow(goalSpec, allWorkflows as Array<Record<string, unknown>>);
      if (!routed) throw new Error("No workflow route available.");

      const data = {
        goal_spec: goalSpec,
        routed_workflow: routed,
        total_candidates: allWorkflows.length,
      };
      await emit("success", data, goalSpec.goal_risk_level);
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "task_graph_build") {
      const taskNodes = compact(input.goal_id)
        ? await mapGoalStepsToTaskNodes(compact(input.goal_id))
        : parseTaskNodes(input.task_nodes || []);

      if (taskNodes.length === 0) {
        throw new Error("No task nodes available for graph build.");
      }

      const graph = buildWorkflowGraph(taskNodes);
      const statusById: TaskStatusIndex = {};
      const summary = summarizeGraphExecution(graph, statusById);
      const data = {
        task_nodes: taskNodes,
        graph: {
          has_cycle: graph.has_cycle,
          roots: graph.roots,
          topological_order: graph.topological_order,
          cycle_nodes: graph.cycle_nodes,
          summary,
        },
      };
      await emit("success", data, "medium");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "task_graph_execute") {
      if (compact(input.goal_id)) {
        const execution = await executeGoal({
          goalId: compact(input.goal_id),
          authHeader,
          retryLimit: Math.max(0, Math.min(5, Number(input.context?.retry_limit ?? 1))),
          autoReplan: input.context?.auto_replan !== false,
        });

        const data = { execution };
        await emit("success", data, "high");
        return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
      }

      if (compact(input.pipeline_run_id)) {
        const execution = await executePipelineRun({
          pipelineRunId: compact(input.pipeline_run_id),
          authHeader,
        });
        const data = { execution };
        await emit("success", data, "high");
        return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
      }

      throw new Error("goal_id or pipeline_run_id is required for task_graph_execute.");
    }

    if (action === "run_status") {
      if (compact(input.goal_id)) {
        const status = await runStatusFromGoal(compact(input.goal_id));
        const data = { run_status: status };
        await emit("success", data, "low");
        return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
      }

      if (compact(input.pipeline_run_id)) {
        const status = await getPipelineRunDetails(compact(input.pipeline_run_id));
        const data = { run_status: status };
        await emit("success", data, "low");
        return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
      }

      const runs = await listRecentPipelineRuns(Math.max(1, Math.min(50, Number(input.limit || 20))));
      const data = { runs };
      await emit("success", data, "low");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "governance_check") {
      if (!input.target_type) {
        throw new Error("target_type is required for governance_check.");
      }
      const governance = await evaluateGovernanceGate({
        targetType: input.target_type,
        targetId: input.target_id || null,
        targetRef: input.target_ref || null,
        orgId: input.org_id || null,
        userId: input.user_id || null,
        sourceAgent: input.source_agent || null,
        source: "control-plane",
        riskClass: input.risk_class || "medium",
        context: input.context || {},
      });
      const data = { governance };
      await emit("success", data, input.risk_class || "medium");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "tool_dispatch") {
      const toolCodeName = compact(input.tool_code_name);
      if (!toolCodeName) {
        throw new Error("tool_code_name is required for tool_dispatch.");
      }

      const dispatchRisk = input.risk_class || "medium";
      const requestedPayload = asRecord(input.payload);
      const payloadMetadata = asRecord(requestedPayload.metadata);
      const payloadPolicy = asRecord(requestedPayload.policy);
      const sourceAgent = compact(input.source_agent) || compact(payloadMetadata.agent_code_name) || "outreach";

      const governance = await evaluateGovernanceGate({
        targetType: input.target_type || "agent_action",
        targetId: input.target_id || null,
        targetRef: input.target_ref || toolCodeName,
        orgId: input.org_id || null,
        userId: input.user_id || null,
        sourceAgent,
        source: "control-plane",
        riskClass: dispatchRisk,
        context: {
          ...asRecord(input.context),
          action,
          tool_code_name: toolCodeName,
          policy: payloadPolicy,
        },
      });

      if (!governance.allowed) {
        throw new Error(`Governance blocked tool_dispatch for ${toolCodeName}: ${governance.reason}`);
      }

      const routedPayload = {
        ...requestedPayload,
        trace_id: compact(requestedPayload.trace_id) || traceId,
        correlation_id: compact(requestedPayload.correlation_id) || correlationId,
        metadata: {
          ...payloadMetadata,
          control_plane_trace_id: traceId,
          control_plane_correlation_id: correlationId,
          route: {
            ...asRecord(payloadMetadata.route),
            via_control_plane: true,
            via_tool_bus: true,
            control_plane_action: action,
            trace_id: traceId,
            correlation_id: correlationId,
            routed_at: nowIso(),
          },
        },
        policy: {
          ...payloadPolicy,
          via_control_plane: true,
          via_tool_bus: true,
          control_plane_trace_id: traceId,
          control_plane_correlation_id: correlationId,
          approval_required: payloadPolicy.approval_required === true || governance.requiresApproval === true,
        },
      } satisfies JsonRecord;

      const dispatchResult = await invokeToolThroughBus({
        toolCodeName,
        functionName: input.function_name || null,
        payload: routedPayload,
        authHeader,
        invokerAgentCodeName: sourceAgent,
        orgId: input.org_id || null,
        userId: input.user_id || null,
        pipelineRunId: input.pipeline_run_id || null,
        stepRunId: input.target_id || null,
        goalId: input.goal_id || null,
        goalStepId: input.target_ref || null,
        correlationId,
        source: "control-plane",
      });

      const data = {
        governance,
        dispatch_result: dispatchResult,
      };
      await emit("success", data, dispatchRisk);
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "evaluate") {
      if (!compact(input.artifact_type)) {
        throw new Error("artifact_type is required for evaluate.");
      }
      const evaluation = await evaluateArtifact({
        artifactType: compact(input.artifact_type),
        artifactPayload: input.artifact_payload || {},
        impactLevel: input.risk_class || "medium",
        artifactId: input.artifact_id || null,
        correlationId,
        orgId: input.org_id || null,
        userId: input.user_id || null,
        sourceAgent: input.source_agent || "control-plane",
      });
      const data = { evaluation };
      await emit("success", data, input.risk_class || "medium");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "simulate") {
      if (compact(input.simulation_id)) {
        const replay = await replaySimulation(compact(input.simulation_id), input.source_agent || "control-plane");
        const data = { simulation: replay, mode: "replay" };
        await emit("success", data, input.risk_class || "medium");
        return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
      }

      const simulation = await runSimulation({
        mode: input.mode || "shadow",
        targetType: compact(input.target_type) || "pipeline",
        targetId: compact(input.target_id) || null,
        workflowId: compact(input.workflow_id) || null,
        riskClass: input.risk_class || "medium",
        targetEnvironment: compact(input.context?.target_environment) === "production" ? "production" : "staging",
        inputSnapshot: input.context || {},
        correlationId,
        orgId: input.org_id || null,
        userId: input.user_id || null,
        sourceAgent: input.source_agent || "control-plane",
      });
      const data = { simulation };
      await emit("success", data, input.risk_class || "medium");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "improve") {
      const cycle = await runImprovementCycle({
        orgId: input.org_id || null,
        userId: input.user_id || null,
        correlationId,
        issueType: input.issue_type,
        issueSummary: input.issue_summary,
        proposal: input.proposal,
        riskLevel: input.risk_class || "medium",
        context: input.context || {},
      });
      const data = { improvement: cycle };
      await emit("success", data, input.risk_class || "medium");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "metrics") {
      const metrics = await metricsSnapshot({
        orgId: input.org_id || null,
        userId: input.user_id || null,
        windowHours: input.window_hours || safeNumber(input.context?.window_hours, 24),
      });

      const memory = await recallMemoryRecords({
        orgId: input.org_id || null,
        userId: input.user_id || null,
        scope: "long_term",
        namespace: "improvement_patches",
        limit: 5,
      }).catch(() => []);

      const data = {
        metrics,
        recent_improvements: memory,
      };
      await emit("success", data, "low");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "plan_goal") {
      const goalSpec = parseGoalSpec(input.goal_spec || input.context || {});
      const planned = await planGoal({
        goal: goalSpec.goal_text,
        context: {
          ...input.context,
          goal_spec: goalSpec,
          trace: {
            trace_id: traceId,
            correlation_id: correlationId,
            source: "control-plane",
          },
        },
        userId: input.user_id || null,
        orgId: input.org_id || null,
        source: "control-plane",
        priority: goalSpec.goal_priority,
        riskClass: goalSpec.goal_risk_level,
        preferredTemplateCodeName: input.workflow_id || null,
      });
      const data = { plan: planned };
      await emit("success", data, goalSpec.goal_risk_level);
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "workflow_lookup") {
      if (!compact(input.workflow_id)) {
        throw new Error("workflow_id is required for workflow_lookup.");
      }
      const workflow = await resolveWorkflowNodeById(compact(input.workflow_id), {
        orgId: input.org_id || null,
        limit: input.limit || 1000,
      });
      const data = { workflow };
      await emit("success", data, "low");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    if (action === "registry_snapshot") {
      const [workflowSnapshot, agentSnapshot, toolCapabilities] = await Promise.all([
        getWorkflowRegistrySnapshot({
          orgId: input.org_id || null,
          workflowQuery: input.workflow_query || null,
          limit: input.limit || 200,
        }),
        getAgentWorkforceSnapshot(input.org_id || null),
        listToolCapabilities({
          orgId: input.org_id || null,
          limit: input.limit || 200,
        }),
      ]);

      warnings.push(...workflowSnapshot.warnings, ...agentSnapshot.warnings);
      const data = {
        workflows: workflowSnapshot,
        agents: agentSnapshot,
        tools: toolCapabilities,
      };
      await emit("success", data, "low");
      return { ok: true, action, trace_id: traceId, correlation_id: correlationId, data, warnings };
    }

    throw new Error(`Unknown control-plane action: ${action}`);
  } catch (error) {
    const payload = {
      error: error instanceof Error ? error.message : "Unknown control-plane failure",
    };
    await emit("failed", payload, input.risk_class || "medium");
    throw error;
  }
}
