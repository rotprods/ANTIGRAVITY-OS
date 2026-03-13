import { compact, safeNumber } from "./http.ts";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type GoalPriority = "low" | "medium" | "high" | "critical";
export type MemoryScope = "task" | "shared_ops" | "long_term";
export type ReadinessState = "connected" | "simulated" | "degraded" | "offline" | "planned";

export interface JsonRecord {
  [key: string]: unknown;
}

export interface GoalSpec {
  goal_type: string;
  goal_priority: GoalPriority;
  goal_scope: string;
  goal_complexity: number;
  goal_dependencies: string[];
  goal_deadline: string | null;
  goal_risk_level: RiskLevel;
  goal_expected_outcome: string;
  goal_text: string;
}

export interface TaskNode {
  id: string;
  key: string;
  title: string;
  step_type: "agent" | "workflow" | "task" | "event" | "manual";
  depends_on: string[];
  agent_id?: string | null;
  workflow_id?: string | null;
  tool_id?: string | null;
  metadata?: JsonRecord;
}

export interface WorkflowNode {
  workflow_id: string;
  workflow_type: "native_pipeline" | "n8n_template" | "custom";
  workflow_inputs: string[];
  workflow_outputs: string[];
  workflow_tools: string[];
  workflow_agents: string[];
  workflow_dependencies: string[];
  workflow_success_rate: number;
  description?: string;
}

export interface ToolCapability {
  tool_id: string;
  tool_type: string;
  tool_provider: string;
  tool_permissions: string[];
  tool_latency: number;
  tool_cost: number;
  tool_security_level: RiskLevel;
}

export interface EvaluationResult {
  output_score: number;
  execution_time: number;
  cost_estimate: number;
  risk_level: RiskLevel;
  retry_needed: boolean;
  decision: "pass" | "retry" | "reject" | "escalate";
  explanation: string;
}

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  namespace: string;
  summary: string | null;
  content: JsonRecord;
  correlation_id: string | null;
  importance: number;
  created_at: string;
}

export interface GovernanceDecision {
  allowed: boolean;
  decision: "allow" | "soft_block" | "hard_block";
  reason: string;
  requires_approval: boolean;
  applied_policies: string[];
}

export interface SimulationResult {
  simulation_id: string;
  mode: "dry_run" | "shadow" | "replay";
  status: "passed" | "failed";
  score: number;
  recommended_action: string;
  policy_gate_passed: boolean;
}

export interface ImprovementPatch {
  patch_id: string;
  issue_type: string;
  issue_summary: string;
  proposal: string;
  risk_level: RiskLevel;
  status: "proposed" | "simulated" | "approved" | "rejected" | "blocked";
  simulation?: SimulationResult;
  evaluation?: EvaluationResult;
  governance?: GovernanceDecision;
  created_at: string;
}

export interface EcosystemReadinessRecord {
  module_key: string;
  route: string;
  backend_surface: string;
  state: ReadinessState;
  state_reason_code: string;
  state_reason_text: string;
  last_success_at: string | null;
  last_checked_at: string;
  correlation_id: string | null;
  smoke_case_id: string | null;
  remediation_action: string;
}

export interface GovernanceMetricSnapshot {
  org_id: string | null;
  window: string;
  dispatch_total: number;
  blocked_total: number;
  approval_pending_total: number;
  high_risk_routed_total: number;
  tool_bus_trace_coverage: number;
}

export interface RunTraceView {
  correlation_id: string;
  run_id: string | null;
  workflow_id: string | null;
  steps: JsonRecord[];
  governance_decisions: JsonRecord[];
  tool_bus_events: JsonRecord[];
  final_status: string;
}

export interface ReadinessArtifact {
  generated_at: string;
  version: string;
  overall_state: "green" | "yellow" | "red";
  records: EcosystemReadinessRecord[];
  smokes: JsonRecord[];
  failures: JsonRecord[];
  governance_metrics: GovernanceMetricSnapshot;
}

export interface ControlPlaneEventV2 {
  event_type: string;
  agent_id: string | null;
  workflow_id: string | null;
  tool_id: string | null;
  trace_id: string | null;
  correlation_id: string | null;
  timestamp: string;
  latency_ms: number;
  cost_usd: number;
  risk_level: RiskLevel;
  result: string;
  payload: JsonRecord;
  metadata: JsonRecord;
}

export interface ControlPlaneActionRequest {
  action: string;
  org_id?: string | null;
  user_id?: string | null;
  tool_code_name?: string;
  function_name?: string | null;
  payload?: JsonRecord;
  goal_id?: string | null;
  pipeline_run_id?: string | null;
  correlation_id?: string | null;
  trace_id?: string | null;
  goal_spec?: Partial<GoalSpec>;
  task_nodes?: Array<Partial<TaskNode>>;
  workflow_id?: string | null;
  target_type?: "goal" | "pipeline" | "pipeline_step" | "agent_action";
  target_id?: string | null;
  target_ref?: string | null;
  source_agent?: string | null;
  risk_class?: RiskLevel;
  context?: JsonRecord;
  artifact_type?: string;
  artifact_id?: string | null;
  artifact_payload?: JsonRecord;
  mode?: "dry_run" | "shadow" | "replay";
  simulation_id?: string | null;
  issue_type?: string;
  issue_summary?: string;
  proposal?: string;
  workflow_query?: string;
  limit?: number;
  window_hours?: number;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function normalizeRiskLevel(value: unknown): RiskLevel {
  const normalized = compact(value).toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

export function normalizeGoalPriority(value: unknown): GoalPriority {
  const normalized = compact(value).toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

export function parseGoalSpec(input: unknown): GoalSpec {
  const source = asRecord(input);
  const goalText = compact(source.goal_text || source.goal || source.description || source.goal_expected_outcome);
  const expected = compact(source.goal_expected_outcome || source.expected_outcome || goalText);
  const rawDependencies = Array.isArray(source.goal_dependencies)
    ? source.goal_dependencies
    : Array.isArray(source.dependencies)
      ? source.dependencies
      : [];

  return {
    goal_type: compact(source.goal_type || source.type || "general_objective"),
    goal_priority: normalizeGoalPriority(source.goal_priority || source.priority),
    goal_scope: compact(source.goal_scope || source.scope || "cross_system"),
    goal_complexity: Math.max(1, Math.min(10, Math.round(safeNumber(source.goal_complexity || source.complexity, 5)))),
    goal_dependencies: rawDependencies.map((value) => compact(value)).filter(Boolean),
    goal_deadline: compact(source.goal_deadline || source.deadline) || null,
    goal_risk_level: normalizeRiskLevel(source.goal_risk_level || source.risk_level || source.risk_class),
    goal_expected_outcome: expected || "Execute goal successfully with measurable business impact.",
    goal_text: goalText || expected || "Unspecified goal",
  };
}

export function parseTaskNodes(input: unknown): TaskNode[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw, index) => {
    const source = asRecord(raw);
    const rawDeps = Array.isArray(source.depends_on) ? source.depends_on : [];
    const stepTypeRaw = compact(source.step_type || source.type || "task").toLowerCase();
    const stepType: TaskNode["step_type"] = stepTypeRaw === "agent"
      ? "agent"
      : stepTypeRaw === "workflow"
        ? "workflow"
        : stepTypeRaw === "event"
          ? "event"
          : stepTypeRaw === "manual"
            ? "manual"
            : "task";

    return {
      id: compact(source.id) || `task_${index + 1}`,
      key: compact(source.key || source.step_key) || `task_${index + 1}`,
      title: compact(source.title || source.name) || `Task ${index + 1}`,
      step_type: stepType,
      depends_on: rawDeps.map((dep) => compact(dep)).filter(Boolean),
      agent_id: compact(source.agent_id || source.agent_code_name) || null,
      workflow_id: compact(source.workflow_id || source.pipeline_template) || null,
      tool_id: compact(source.tool_id || source.action) || null,
      metadata: asRecord(source.metadata),
    };
  });
}

export function toEventEnvelopeV2(input: Partial<ControlPlaneEventV2>): ControlPlaneEventV2 {
  return {
    event_type: compact(input.event_type || "control_plane.event"),
    agent_id: compact(input.agent_id) || null,
    workflow_id: compact(input.workflow_id) || null,
    tool_id: compact(input.tool_id) || null,
    trace_id: compact(input.trace_id) || null,
    correlation_id: compact(input.correlation_id) || null,
    timestamp: compact(input.timestamp) || new Date().toISOString(),
    latency_ms: Math.max(0, safeNumber(input.latency_ms, 0)),
    cost_usd: Math.max(0, safeNumber(input.cost_usd, 0)),
    risk_level: normalizeRiskLevel(input.risk_level),
    result: compact(input.result || "unknown"),
    payload: asRecord(input.payload),
    metadata: asRecord(input.metadata),
  };
}
