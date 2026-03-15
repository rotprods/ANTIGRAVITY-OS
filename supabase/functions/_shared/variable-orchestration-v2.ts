import type {
  ControlPlaneActionRequest,
  JsonRecord,
  OrchestrationPlanV2,
  VariableBinding,
  VariableConstraint,
  VariableDefinition,
  VariableSnapshot,
  VariableViolation,
} from "./control-plane-types.ts";
import { evaluateArtifact } from "./evaluation.ts";
import { evaluateGovernanceGate } from "./governance.ts";
import { compact, safeNumber } from "./http.ts";
import { recordMemoryEntry } from "./orchestration.ts";
import { runSimulation } from "./simulation.ts";
import { admin } from "./supabase.ts";
import { invokeToolThroughBus } from "./tool-bus.ts";
import { buildWorkflowGraph } from "./workflow-graph-engine.ts";
import {
  buildDeterministicVariableResolution,
  evaluateVariableConstraints,
  resolveSimulationRequirement,
  type RuntimeVariableBinding,
} from "./variable-runtime-v2.ts";

export interface ControlPlaneV2Flags {
  control_plane_v2_enabled: boolean;
  variable_simulation_required_in_prod: boolean;
}

export interface SnapshotBuildResult {
  snapshot: VariableSnapshot;
  values: Record<string, unknown>;
  violations: VariableViolation[];
  violation_count: number;
  blocking_violations: number;
  constraint_status: "passed" | "failed_blocking" | "failed_advisory";
  diagnostics: JsonRecord;
}

interface LoadedPlanRow {
  plan_id: string;
  org_id: string | null;
  workflow_id: string | null;
  agent_id: string | null;
  snapshot_id: string;
  correlation_id: string | null;
  task_graph: JsonRecord;
  governance_decision: JsonRecord;
  simulation_required: boolean;
  simulation_mode: string | null;
  simulation_mandatory: boolean;
  simulation_status: string | null;
  preflight_simulation_id: string | null;
  plan_status: string | null;
  risk_class: string | null;
  target_environment: string | null;
  context: JsonRecord;
  created_at: string;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function readEnvFlag(name: string, fallback: boolean) {
  const raw = compact(Deno.env.get(name));
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

export function getControlPlaneV2Flags(): ControlPlaneV2Flags {
  const simulationRequired = readEnvFlag("VARIABLE_SIMULATION_REQUIRED_IN_PROD", true);
  // Compatibility fallback: in some hosted runtimes, CONTROL_PLANE_V2_ENABLED may be shadowed.
  // CONTROL_PLANE_V2_FORCE_ENABLED allows explicit override without changing action contracts.
  const v2Enabled = readEnvFlag("CONTROL_PLANE_V2_ENABLED", true) ||
    readEnvFlag("CONTROL_PLANE_V2_FORCE_ENABLED", false);
  return {
    control_plane_v2_enabled: v2Enabled,
    variable_simulation_required_in_prod: simulationRequired,
  };
}

function ensureControlPlaneV2Enabled() {
  const flags = getControlPlaneV2Flags();
  if (!flags.control_plane_v2_enabled) {
    throw new Error("Control Plane V2 is disabled. Set CONTROL_PLANE_V2_ENABLED=true to use V2 actions.");
  }
  return flags;
}

async function resolveOrgId(explicitOrgId?: string | null, userId?: string | null) {
  if (compact(explicitOrgId)) return compact(explicitOrgId);
  if (!compact(userId)) return null;

  const { data, error } = await admin
    .from("organization_members")
    .select("org_id")
    .eq("user_id", compact(userId))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return compact(data?.org_id) || null;
}

function withOrgScope<T>(query: T, orgId: string | null): T {
  const candidate = query as unknown as {
    or?: (arg: string) => unknown;
    is?: (column: string, value: unknown) => unknown;
  };
  if (orgId && typeof candidate.or === "function") {
    return candidate.or(`org_id.eq.${orgId},org_id.is.null`) as T;
  }
  if (!orgId && typeof candidate.is === "function") {
    return candidate.is("org_id", null) as T;
  }
  return query;
}

function normalizeDefinition(raw: JsonRecord): Partial<VariableDefinition> & JsonRecord {
  const validationRules = asRecord(raw.validation_rules);
  const scope = compact(raw.scope || "org").toLowerCase();
  const normalizedScope = ["global", "org", "agent", "workflow", "run_override"].includes(scope) ? scope : "org";
  return {
    variable_key: compact(raw.variable_key || raw.key),
    variable_family: compact(raw.variable_family || raw.family || "runtime"),
    value_type: compact(raw.value_type || "json"),
    scope: normalizedScope,
    owner_ref: compact(raw.owner_ref || raw.owner || "control-plane"),
    lifecycle_state: compact(raw.lifecycle_state || "active"),
    default_value: raw.default_value,
    validation_rules: validationRules,
    sensitivity: compact(raw.sensitivity || "internal"),
    updated_at: compact(raw.updated_at) || nowIso(),
    is_required: validationRules.required === true || raw.is_required === true,
  };
}

function normalizeBinding(raw: JsonRecord): RuntimeVariableBinding {
  const precedence = compact(raw.precedence_level || raw.scope || "org").toLowerCase();
  const normalizedPrecedence = ["run_override", "workflow", "agent", "org", "global"].includes(precedence)
    ? precedence
    : "org";
  return {
    variable_key: compact(raw.variable_key || raw.key),
    precedence_level: normalizedPrecedence as RuntimeVariableBinding["precedence_level"],
    source_ref: compact(raw.source_ref || raw.source || ""),
    value: raw.value,
    effective_from: compact(raw.effective_from) || null,
    effective_to: compact(raw.effective_to) || null,
    updated_at: compact(raw.updated_at) || nowIso(),
  };
}

function normalizeConstraint(raw: JsonRecord): Partial<VariableConstraint> & JsonRecord {
  const expression = raw.expression;
  const normalizedExpression = typeof expression === "string" || typeof expression === "number" || typeof expression === "boolean"
    ? expression
    : asRecord(expression);
  return {
    constraint_id: compact(raw.constraint_id || raw.id),
    expression: normalizedExpression,
    severity: compact(raw.severity || "medium"),
    fail_mode: compact(raw.fail_mode || "advisory"),
    is_active: raw.is_active !== false,
    description: compact(raw.description) || null,
  };
}

async function loadVariableDefinitions(input: {
  orgId: string | null;
  includeInactive?: boolean;
  variableKeys?: string[];
}) {
  let query = withOrgScope(
    admin
      .from("control_plane_variables")
      .select("*")
      .order("variable_key", { ascending: true })
      .order("updated_at", { ascending: false }),
    input.orgId,
  );
  if (!input.includeInactive) query = query.eq("lifecycle_state", "active");
  if (input.variableKeys && input.variableKeys.length > 0) query = query.in("variable_key", input.variableKeys);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => normalizeDefinition(asRecord(row)));
}

async function loadVariableBindings(input: {
  orgId: string | null;
  variableKeys: string[];
}) {
  if (input.variableKeys.length === 0) return [] as RuntimeVariableBinding[];

  let query = withOrgScope(
    admin
      .from("control_plane_variable_bindings")
      .select("*")
      .in("variable_key", input.variableKeys)
      .order("updated_at", { ascending: false })
      .limit(5000),
    input.orgId,
  );

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => normalizeBinding(asRecord(row)));
}

async function loadVariableConstraints(input: {
  orgId: string | null;
  includeInactive?: boolean;
  constraintIds?: string[];
}) {
  let query = withOrgScope(
    admin
      .from("control_plane_variable_constraints")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(2000),
    input.orgId,
  );
  if (!input.includeInactive) query = query.eq("is_active", true);
  if (input.constraintIds && input.constraintIds.length > 0) query = query.in("constraint_id", input.constraintIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => normalizeConstraint(asRecord(row)));
}

function extractRunOverride(input: ControlPlaneActionRequest) {
  const fromContext = asRecord(input.context).run_override;
  const fromPayload = asRecord(input.payload).run_override;
  const fromInput = input.run_override;
  return asRecord(fromInput || fromPayload || fromContext);
}

function extractBudgetViolation(input: {
  context: JsonRecord;
  values: Record<string, unknown>;
}): VariableViolation[] {
  const policy = asRecord(input.context.policy);
  const budgetLimit = safeNumber(
    policy.budget_limit ??
      policy.max_budget ??
      policy.max_cost_usd ??
      input.context.budget_limit ??
      input.context.max_budget,
    NaN,
  );
  const estimatedCost = safeNumber(
    input.context.estimated_cost ??
      input.context.estimated_cost_usd ??
      input.values.estimated_cost ??
      input.values.estimated_cost_usd,
    NaN,
  );
  if (!Number.isFinite(budgetLimit) || !Number.isFinite(estimatedCost)) return [];
  if (estimatedCost <= budgetLimit) return [];
  return [{
    constraint_id: "budget_limit_guardrail",
    variable_keys: ["estimated_cost"],
    severity: "critical",
    message: `Estimated cost (${estimatedCost}) exceeds budget limit (${budgetLimit}).`,
    blocking: true,
  }];
}

async function persistViolations(input: {
  orgId: string | null;
  snapshotId: string;
  planId?: string | null;
  violations: VariableViolation[];
}) {
  if (input.violations.length === 0) return;
  const rows = input.violations.map((violation) => ({
    org_id: input.orgId,
    snapshot_id: input.snapshotId,
    plan_id: compact(input.planId) || null,
    constraint_id: violation.constraint_id,
    variable_keys: violation.variable_keys,
    severity: violation.severity,
    message: violation.message,
    blocking: violation.blocking,
    metadata: {},
  }));
  const { error } = await admin
    .from("control_plane_variable_violations")
    .insert(rows);
  if (error) throw error;
}

function composeEventFields(input: {
  snapshotId: string;
  planId?: string | null;
  violationCount: number;
  constraintStatus: string;
  simulationStatus?: string | null;
}) {
  return {
    snapshot_id: input.snapshotId,
    plan_id: compact(input.planId) || null,
    violation_count: input.violationCount,
    constraint_status: input.constraintStatus,
    simulation_status: compact(input.simulationStatus) || "not_run",
  };
}

async function insertSnapshotRow(input: {
  orgId: string | null;
  workflowId?: string | null;
  agentId?: string | null;
  bindings: VariableBinding[];
  checksum: string;
  diagnostics: JsonRecord;
}) {
  const { data, error } = await admin
    .from("control_plane_variable_snapshots")
    .insert({
      org_id: input.orgId,
      workflow_id: compact(input.workflowId) || null,
      agent_id: compact(input.agentId) || null,
      bindings: input.bindings,
      checksum: input.checksum,
      metadata: {
        diagnostics: input.diagnostics,
      },
    })
    .select("snapshot_id, org_id, workflow_id, agent_id, bindings, checksum, created_at")
    .single();
  if (error) throw error;
  return data;
}

async function loadSnapshot(input: {
  snapshotId: string;
  orgId: string | null;
}) {
  let query = admin
    .from("control_plane_variable_snapshots")
    .select("*")
    .eq("snapshot_id", input.snapshotId)
    .limit(1)
    .maybeSingle();
  if (input.orgId) query = query.eq("org_id", input.orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data ? asRecord(data) : null;
}

function bindingsToValueMap(bindings: unknown) {
  const out: Record<string, unknown> = {};
  for (const raw of asArray(bindings)) {
    const binding = asRecord(raw);
    const key = compact(binding.variable_key);
    if (!key) continue;
    out[key] = binding.value;
  }
  return out;
}

function extractTaskGraph(input: ControlPlaneActionRequest) {
  const payload = asRecord(input.payload);
  const context = asRecord(input.context);
  const taskNodesRaw = Array.isArray(input.task_nodes)
    ? input.task_nodes
    : Array.isArray(payload.task_nodes)
      ? payload.task_nodes
      : Array.isArray(context.task_nodes)
        ? context.task_nodes
        : [];

  const taskNodes = taskNodesRaw
    .map((raw, index) => {
      const source = asRecord(raw);
      return {
        id: compact(source.id) || `v2_task_${index + 1}`,
        key: compact(source.key || source.step_key) || `v2_task_${index + 1}`,
        title: compact(source.title || source.name) || `V2 Task ${index + 1}`,
        step_type: compact(source.step_type || source.type || "task"),
        depends_on: (Array.isArray(source.depends_on) ? source.depends_on : []).map((entry) => compact(entry)).filter(Boolean),
        agent_id: compact(source.agent_id || source.agent_code_name) || null,
        workflow_id: compact(source.workflow_id || source.pipeline_template) || null,
        tool_id: compact(source.tool_id || source.action) || null,
        metadata: asRecord(source.metadata),
      };
    });

  if (taskNodes.length === 0 && compact(input.workflow_id)) {
    taskNodes.push({
      id: "workflow_root",
      key: compact(input.workflow_id),
      title: `Workflow ${compact(input.workflow_id)}`,
      step_type: "workflow",
      depends_on: [],
      agent_id: null,
      workflow_id: compact(input.workflow_id),
      tool_id: null,
      metadata: {},
    });
  }

  const graph = buildWorkflowGraph(taskNodes);
  return {
    nodes: taskNodes,
    graph: {
      has_cycle: graph.has_cycle,
      roots: graph.roots,
      topological_order: graph.topological_order,
      cycle_nodes: graph.cycle_nodes,
      dependency_index: Object.fromEntries(
        Object.entries(graph.nodes).map(([nodeId, node]) => [nodeId, node.depends_on]),
      ),
    },
  };
}

async function loadPlanRow(input: {
  planId: string;
  orgId: string | null;
}): Promise<LoadedPlanRow> {
  let query = admin
    .from("control_plane_orchestration_plans_v2")
    .select("*")
    .eq("plan_id", input.planId)
    .limit(1)
    .maybeSingle();
  if (input.orgId) query = query.eq("org_id", input.orgId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error(`Plan not found: ${input.planId}`);
  const source = asRecord(data);
  return {
    plan_id: compact(source.plan_id),
    org_id: compact(source.org_id) || null,
    workflow_id: compact(source.workflow_id) || null,
    agent_id: compact(source.agent_id) || null,
    snapshot_id: compact(source.snapshot_id),
    correlation_id: compact(source.correlation_id) || null,
    task_graph: asRecord(source.task_graph),
    governance_decision: asRecord(source.governance_decision),
    simulation_required: source.simulation_required === true,
    simulation_mode: compact(source.simulation_mode) || null,
    simulation_mandatory: source.simulation_mandatory === true,
    simulation_status: compact(source.simulation_status) || null,
    preflight_simulation_id: compact(source.preflight_simulation_id) || null,
    plan_status: compact(source.plan_status) || null,
    risk_class: compact(source.risk_class) || null,
    target_environment: compact(source.target_environment) || null,
    context: asRecord(source.context),
    created_at: compact(source.created_at),
  };
}

async function updatePlanRow(planId: string, patch: JsonRecord) {
  const { error } = await admin
    .from("control_plane_orchestration_plans_v2")
    .update({
      ...patch,
      updated_at: nowIso(),
    })
    .eq("plan_id", planId);
  if (error) throw error;
}

async function linkSnapshotViolationsToPlan(input: {
  snapshotId: string;
  planId: string;
  orgId: string | null;
}) {
  let query = admin
    .from("control_plane_variable_violations")
    .update({
      plan_id: input.planId,
      updated_at: nowIso(),
    })
    .eq("snapshot_id", input.snapshotId)
    .is("plan_id", null);
  if (input.orgId) query = query.eq("org_id", input.orgId);
  const { error } = await query;
  if (error) throw error;
}

async function loadPlanViolations(input: {
  planId: string;
  snapshotId: string;
  orgId: string | null;
}) {
  let query = admin
    .from("control_plane_variable_violations")
    .select("*")
    .eq("plan_id", input.planId)
    .eq("snapshot_id", input.snapshotId)
    .order("created_at", { ascending: true });
  if (input.orgId) query = query.eq("org_id", input.orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => {
    const source = asRecord(row);
    return {
      constraint_id: compact(source.constraint_id),
      variable_keys: asArray(source.variable_keys).map((entry) => compact(entry)).filter(Boolean),
      severity: compact(source.severity),
      message: compact(source.message),
      blocking: source.blocking === true,
    } as VariableViolation;
  });
}

function resolveToolCodeForNode(node: JsonRecord) {
  const tool = compact(node.tool_id || node.action);
  if (tool) return tool;
  const agent = compact(node.agent_id || node.agent_code_name);
  if (agent) return `agent-${agent}`;
  return "";
}

function parseExecutionContext(input: ControlPlaneActionRequest) {
  const payload = asRecord(input.payload);
  return {
    ...asRecord(input.context),
    ...asRecord(payload.context),
  };
}

export async function variableRegistryUpsert(input: {
  request: ControlPlaneActionRequest;
}) {
  ensureControlPlaneV2Enabled();
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const payload = asRecord(input.request.payload);
  const definitionInput = normalizeDefinition(asRecord(input.request.variable_definition || payload.variable_definition || payload.definition));
  const bindingInput = normalizeBinding(asRecord(input.request.variable_binding || payload.variable_binding || payload.binding));
  const constraintInput = normalizeConstraint(asRecord(
    input.request.variable_constraint || payload.variable_constraint || payload.constraint,
  ));
  const hasDefinition = compact(definitionInput.variable_key).length > 0;
  const hasBinding = compact(bindingInput.variable_key).length > 0;
  const hasConstraint = compact(constraintInput.constraint_id).length > 0;
  if (!hasDefinition && !hasBinding && !hasConstraint) {
    throw new Error(
      "variable_registry_upsert requires variable_definition.variable_key, variable_binding.variable_key, or variable_constraint.constraint_id.",
    );
  }

  const now = nowIso();
  let definitionRow: JsonRecord | null = null;
  if (hasDefinition) {
    const variableKey = compact(definitionInput.variable_key);
    const requestedScope = compact(definitionInput.scope || "").toLowerCase();
    const variableScope = requestedScope
      ? (requestedScope === "org" && !orgId ? "global" : requestedScope)
      : (orgId ? "org" : "global");
    const ownerRef = compact(definitionInput.owner_ref || "control-plane");

    let existingDefinitionQuery = admin
      .from("control_plane_variables")
      .select("*")
      .eq("variable_key", variableKey)
      .eq("scope", variableScope)
      .eq("owner_ref", ownerRef)
      .limit(1)
      .maybeSingle();
    if (orgId) existingDefinitionQuery = existingDefinitionQuery.eq("org_id", orgId);
    else existingDefinitionQuery = existingDefinitionQuery.is("org_id", null);

    const { data: existingDefinition, error: existingDefinitionError } = await existingDefinitionQuery;
    if (existingDefinitionError) throw existingDefinitionError;

    const definitionPatch = {
      variable_family: compact(definitionInput.variable_family || "runtime"),
      value_type: compact(definitionInput.value_type || "json"),
      scope: variableScope,
      owner_ref: ownerRef,
      lifecycle_state: compact(definitionInput.lifecycle_state || "active"),
      default_value: definitionInput.default_value ?? null,
      validation_rules: asRecord(definitionInput.validation_rules),
      sensitivity: compact(definitionInput.sensitivity || "internal"),
      is_required: definitionInput.is_required === true,
      updated_at: now,
    };

    if (existingDefinition) {
      const { data, error } = await admin
        .from("control_plane_variables")
        .update(definitionPatch)
        .eq("id", existingDefinition.id)
        .select("*")
        .single();
      if (error) throw error;
      definitionRow = asRecord(data);
    } else {
      const { data, error } = await admin
        .from("control_plane_variables")
        .insert({
          org_id: orgId,
          variable_key: variableKey,
          ...definitionPatch,
        })
        .select("*")
        .single();
      if (error) throw error;
      definitionRow = asRecord(data);
    }
  }

  let bindingRow: JsonRecord | null = null;
  let constraintRow: JsonRecord | null = null;
  if (hasBinding) {
    const sourceRef = compact(bindingInput.source_ref || "");
    let existingBindingQuery = admin
      .from("control_plane_variable_bindings")
      .select("*")
      .eq("variable_key", compact(bindingInput.variable_key))
      .eq("precedence_level", compact(bindingInput.precedence_level))
      .eq("source_ref", sourceRef)
      .limit(1)
      .maybeSingle();
    if (orgId) existingBindingQuery = existingBindingQuery.eq("org_id", orgId);
    else existingBindingQuery = existingBindingQuery.is("org_id", null);
    const { data: existingBinding, error: existingBindingError } = await existingBindingQuery;
    if (existingBindingError) throw existingBindingError;

    if (existingBinding) {
      const { data, error } = await admin
        .from("control_plane_variable_bindings")
        .update({
          value: bindingInput.value,
          effective_from: bindingInput.effective_from,
          effective_to: bindingInput.effective_to,
          updated_at: now,
        })
        .eq("id", existingBinding.id)
        .select("*")
        .single();
      if (error) throw error;
      bindingRow = asRecord(data);
    } else {
      const { data, error } = await admin
        .from("control_plane_variable_bindings")
        .insert({
          org_id: orgId,
          variable_key: compact(bindingInput.variable_key),
          precedence_level: compact(bindingInput.precedence_level || "org"),
          source_ref: sourceRef,
          value: bindingInput.value,
          effective_from: bindingInput.effective_from,
          effective_to: bindingInput.effective_to,
        })
        .select("*")
        .single();
      if (error) throw error;
      bindingRow = asRecord(data);
    }
  }

  if (hasConstraint) {
    const constraintId = compact(constraintInput.constraint_id);
    const expression = constraintInput.expression ?? {};
    const severity = compact(constraintInput.severity || "medium");
    const failMode = compact(constraintInput.fail_mode || "advisory");
    const isActive = constraintInput.is_active !== false;
    const description = compact(constraintInput.description) || null;

    if (orgId) {
      const { data, error } = await admin
        .from("control_plane_variable_constraints")
        .upsert({
          org_id: orgId,
          constraint_id: constraintId,
          expression,
          severity,
          fail_mode: failMode,
          is_active: isActive,
          description,
          updated_at: now,
        }, { onConflict: "org_id,constraint_id" })
        .select("*")
        .single();
      if (error) throw error;
      constraintRow = asRecord(data);
    } else {
      const { data: existing, error: existingError } = await admin
        .from("control_plane_variable_constraints")
        .select("*")
        .eq("constraint_id", constraintId)
        .is("org_id", null)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const { data, error } = await admin
          .from("control_plane_variable_constraints")
          .update({
            expression,
            severity,
            fail_mode: failMode,
            is_active: isActive,
            description,
            updated_at: now,
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        constraintRow = asRecord(data);
      } else {
        const { data, error } = await admin
          .from("control_plane_variable_constraints")
          .insert({
            org_id: null,
            constraint_id: constraintId,
            expression,
            severity,
            fail_mode: failMode,
            is_active: isActive,
            description,
          })
          .select("*")
          .single();
        if (error) throw error;
        constraintRow = asRecord(data);
      }
    }
  }

  return {
    variable_definition: definitionRow,
    variable_binding: bindingRow,
    variable_constraint: constraintRow,
  };
}

export async function variableRegistryList(input: {
  request: ControlPlaneActionRequest;
}) {
  ensureControlPlaneV2Enabled();
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const payload = asRecord(input.request.payload);
  const includeInactive = payload.include_inactive === true || asRecord(input.request.context).include_inactive === true;
  const variableKeys = asArray(payload.variable_keys).map((entry) => compact(entry)).filter(Boolean);
  const constraintIds = asArray(payload.constraint_ids).map((entry) => compact(entry)).filter(Boolean);
  const definitions = await loadVariableDefinitions({
    orgId,
    includeInactive,
    variableKeys,
  });
  const bindingKeys = variableKeys.length > 0
    ? variableKeys
    : definitions.map((definition) => compact(definition.variable_key)).filter(Boolean);
  const bindings = await loadVariableBindings({
    orgId,
    variableKeys: bindingKeys,
  });
  const constraints = await loadVariableConstraints({
    orgId,
    includeInactive,
    constraintIds,
  });
  return {
    org_id: orgId,
    definitions,
    bindings,
    constraints,
  };
}

export async function variableSnapshotBuild(input: {
  request: ControlPlaneActionRequest;
}): Promise<SnapshotBuildResult> {
  ensureControlPlaneV2Enabled();
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const context = parseExecutionContext(input.request);
  const runOverride = extractRunOverride(input.request);

  const definitions = await loadVariableDefinitions({ orgId, includeInactive: false });
  const variableKeys = definitions.map((definition) => compact(definition.variable_key)).filter(Boolean);
  const bindings = await loadVariableBindings({
    orgId,
    variableKeys,
  });

  const resolution = await buildDeterministicVariableResolution({
    definitions,
    bindings,
    runtimeOverrides: runOverride,
    workflowId: input.request.workflow_id || compact(context.workflow_id) || null,
    agentId: input.request.source_agent || compact(context.agent_id) || null,
  });

  const constraints = await loadVariableConstraints({ orgId });
  const derivedRequiredViolations = resolution.diagnostics.missing_required_keys.map((variableKey) => ({
    constraint_id: "required_variable_missing",
    variable_keys: [variableKey],
    severity: "critical" as const,
    message: `Required variable '${variableKey}' is missing from resolved snapshot.`,
    blocking: true,
  }));
  const derivedConflictViolations = resolution.diagnostics.conflict_keys.map((variableKey) => ({
    constraint_id: "variable_conflict_resolution",
    variable_keys: [variableKey],
    severity: "medium" as const,
    message: `Variable '${variableKey}' had multiple active bindings and required deterministic tie-break.`,
    blocking: false,
  }));

  const evaluated = evaluateVariableConstraints({
    constraints,
    values: resolution.value_map,
    executionContext: context,
  });
  const budgetViolations = extractBudgetViolation({
    context,
    values: resolution.value_map,
  });

  const allViolations = [
    ...derivedRequiredViolations,
    ...derivedConflictViolations,
    ...evaluated.violations,
    ...budgetViolations,
  ];
  const blockingViolations = allViolations.filter((violation) => violation.blocking).length;
  const constraintStatus = blockingViolations > 0
    ? "failed_blocking"
    : allViolations.length > 0
      ? "failed_advisory"
      : "passed";

  const snapshotRow = await insertSnapshotRow({
    orgId,
    workflowId: input.request.workflow_id || compact(context.workflow_id) || null,
    agentId: input.request.source_agent || compact(context.agent_id) || null,
    bindings: resolution.bindings,
    checksum: resolution.checksum,
    diagnostics: resolution.diagnostics,
  });

  const snapshot: VariableSnapshot = {
    snapshot_id: compact(snapshotRow.snapshot_id),
    org_id: compact(snapshotRow.org_id) || null,
    workflow_id: compact(snapshotRow.workflow_id) || null,
    agent_id: compact(snapshotRow.agent_id) || null,
    bindings: asArray(snapshotRow.bindings).map((entry) => normalizeBinding(asRecord(entry))),
    checksum: compact(snapshotRow.checksum),
    created_at: compact(snapshotRow.created_at),
  };

  await persistViolations({
    orgId,
    snapshotId: snapshot.snapshot_id,
    violations: allViolations,
  });

  return {
    snapshot,
    values: resolution.value_map,
    violations: allViolations,
    violation_count: allViolations.length,
    blocking_violations: blockingViolations,
    constraint_status: constraintStatus,
    diagnostics: {
      ...resolution.diagnostics,
      definition_count: definitions.length,
      binding_count: bindings.length,
      checksum: resolution.checksum,
    },
  };
}

export async function variableValidate(input: {
  request: ControlPlaneActionRequest;
}) {
  ensureControlPlaneV2Enabled();
  const payload = asRecord(input.request.payload);
  const snapshotId = compact(input.request.snapshot_id || payload.snapshot_id);
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);

  if (!snapshotId) {
    const built = await variableSnapshotBuild(input);
    return {
      source: "built_snapshot",
      ...built,
    };
  }

  const snapshotRow = await loadSnapshot({ snapshotId, orgId });
  if (!snapshotRow) throw new Error(`Snapshot not found: ${snapshotId}`);

  const constraints = await loadVariableConstraints({ orgId });
  const values = bindingsToValueMap(snapshotRow.bindings);
  const context = parseExecutionContext(input.request);
  const evaluated = evaluateVariableConstraints({
    constraints,
    values,
    executionContext: context,
  });
  const budgetViolations = extractBudgetViolation({ context, values });
  const violations = [...evaluated.violations, ...budgetViolations];
  const blocking = violations.filter((violation) => violation.blocking).length;
  const status = blocking > 0
    ? "failed_blocking"
    : violations.length > 0
      ? "failed_advisory"
      : "passed";

  return {
    source: "existing_snapshot",
    snapshot_id: snapshotId,
    checksum: compact(snapshotRow.checksum),
    violations,
    violation_count: violations.length,
    blocking_violations: blocking,
    constraint_status: status,
    values,
  };
}

export async function orchestrationV2Plan(input: {
  request: ControlPlaneActionRequest;
}) {
  const flags = ensureControlPlaneV2Enabled();
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const snapshotResult = await variableSnapshotBuild(input);
  const taskGraph = extractTaskGraph(input.request);
  const context = parseExecutionContext(input.request);
  const riskClass = compact(input.request.risk_class || context.risk_class || "medium");
  const targetEnvironment = compact(input.request.target_environment || context.target_environment || "staging").toLowerCase();

  const governance = await evaluateGovernanceGate({
    targetType: input.request.target_type || "pipeline",
    targetId: input.request.target_id || null,
    targetRef: input.request.target_ref || input.request.workflow_id || null,
    orgId,
    userId: input.request.user_id || null,
    sourceAgent: input.request.source_agent || null,
    source: "control-plane-v2",
    riskClass: riskClass as "low" | "medium" | "high" | "critical",
    context: {
      ...context,
      variable_snapshot: {
        snapshot_id: snapshotResult.snapshot.snapshot_id,
        checksum: snapshotResult.snapshot.checksum,
      },
      variable_constraint_status: snapshotResult.constraint_status,
      variable_violation_count: snapshotResult.violation_count,
    },
    plannedStepCount: taskGraph.nodes.length,
  });

  const simulationRequirement = resolveSimulationRequirement({
    riskClass,
    targetEnvironment,
    simulationRequiredInProd: flags.variable_simulation_required_in_prod,
  });
  const blockedByConstraints = snapshotResult.blocking_violations > 0;
  const blockedByGovernance = !governance.allowed;
  const planStatus = blockedByConstraints || blockedByGovernance ? "blocked" : "planned";
  const correlationId = compact(input.request.correlation_id) || crypto.randomUUID();

  const { data, error } = await admin
    .from("control_plane_orchestration_plans_v2")
    .insert({
      org_id: orgId,
      workflow_id: compact(input.request.workflow_id) || compact(context.workflow_id) || null,
      agent_id: compact(input.request.source_agent) || compact(context.agent_id) || null,
      snapshot_id: snapshotResult.snapshot.snapshot_id,
      correlation_id: correlationId,
      task_graph: taskGraph,
      governance_decision: governance,
      simulation_required: simulationRequirement.simulation_required,
      simulation_mode: simulationRequirement.mode,
      simulation_mandatory: simulationRequirement.mandatory,
      simulation_status: "pending",
      plan_status: planStatus,
      risk_class: riskClass,
      target_environment: targetEnvironment,
      context: context,
    })
    .select("*")
    .single();
  if (error) throw error;

  const planId = compact(asRecord(data).plan_id);
  await linkSnapshotViolationsToPlan({
    snapshotId: snapshotResult.snapshot.snapshot_id,
    planId,
    orgId,
  });

  const plan: OrchestrationPlanV2 = {
    plan_id: planId,
    task_graph: taskGraph,
    snapshot_id: snapshotResult.snapshot.snapshot_id,
    governance_decision: governance as unknown as JsonRecord,
    simulation_required: simulationRequirement.simulation_required,
  };

  return {
    plan,
    snapshot: snapshotResult.snapshot,
    violation_count: snapshotResult.violation_count,
    constraint_status: snapshotResult.constraint_status,
    simulation_status: simulationRequirement.simulation_required ? "pending" : "not_required",
    blocked: planStatus === "blocked",
    event_fields: composeEventFields({
      snapshotId: snapshotResult.snapshot.snapshot_id,
      planId,
      violationCount: snapshotResult.violation_count,
      constraintStatus: snapshotResult.constraint_status,
      simulationStatus: simulationRequirement.simulation_required ? "pending" : "not_required",
    }),
  };
}

export async function simulationPreflight(input: {
  request: ControlPlaneActionRequest;
}) {
  const flags = ensureControlPlaneV2Enabled();
  const payload = asRecord(input.request.payload);
  const planId = compact(input.request.plan_id || payload.plan_id);
  if (!planId) throw new Error("plan_id is required for simulation_preflight.");
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const plan = await loadPlanRow({ planId, orgId });
  if (!compact(plan.snapshot_id)) throw new Error(`Plan ${planId} is missing snapshot_id.`);
  const planViolations = await loadPlanViolations({
    planId,
    snapshotId: plan.snapshot_id,
    orgId,
  });
  const blockingViolations = planViolations.filter((violation) => violation.blocking).length;
  const constraintStatus = blockingViolations > 0
    ? "failed_blocking"
    : planViolations.length > 0
      ? "failed_advisory"
      : "passed";
  const snapshot = await loadSnapshot({ snapshotId: plan.snapshot_id, orgId });
  if (!snapshot) throw new Error(`Snapshot not found for plan ${planId}: ${plan.snapshot_id}`);

  const riskClass = compact(input.request.risk_class || plan.risk_class || "medium");
  const targetEnvironment = compact(
    input.request.target_environment ||
      plan.target_environment ||
      asRecord(input.request.context).target_environment ||
      "staging",
  );
  const requirement = resolveSimulationRequirement({
    riskClass,
    targetEnvironment,
    simulationRequiredInProd: flags.variable_simulation_required_in_prod,
  });

  if (!requirement.simulation_required) {
    await updatePlanRow(planId, {
      simulation_status: "not_required",
      simulation_required: false,
      simulation_mode: requirement.mode,
      simulation_mandatory: requirement.mandatory,
    });
    return {
      plan_id: planId,
      snapshot_id: plan.snapshot_id,
      simulation_required: false,
      simulation_status: "not_required",
      simulation_result: null,
      event_fields: composeEventFields({
        snapshotId: plan.snapshot_id,
        planId,
        violationCount: planViolations.length,
        constraintStatus,
        simulationStatus: "not_required",
      }),
    };
  }

  const inputSnapshot = {
    ...asRecord(plan.context),
    plan_id: planId,
    snapshot_id: plan.snapshot_id,
    checksum: compact(snapshot.checksum),
    risk_class: riskClass,
    target_environment: targetEnvironment,
  };
  const simulation = await runSimulation({
    mode: requirement.mode,
    targetType: "orchestration_v2_plan",
    targetId: planId,
    workflowId: compact(plan.workflow_id) || null,
    riskClass: riskClass as "low" | "medium" | "high" | "critical",
    targetEnvironment: targetEnvironment === "production" ? "production" : "staging",
    inputSnapshot,
    correlationId: compact(plan.correlation_id) || compact(input.request.correlation_id) || null,
    orgId,
    userId: input.request.user_id || null,
    sourceAgent: compact(input.request.source_agent) || compact(plan.agent_id) || "control-plane",
  });

  const simulationStatus = simulation.status === "passed"
    ? "passed"
    : requirement.mandatory
      ? "failed"
      : "advisory_failed";

  await updatePlanRow(planId, {
    simulation_status: simulationStatus,
    simulation_required: requirement.simulation_required,
    simulation_mode: requirement.mode,
    simulation_mandatory: requirement.mandatory,
    preflight_simulation_id: simulation.simulation_id,
  });

  return {
    plan_id: planId,
    snapshot_id: plan.snapshot_id,
    simulation_required: requirement.simulation_required,
    simulation_mandatory: requirement.mandatory,
    simulation_status: simulationStatus,
    simulation_result: simulation,
    event_fields: composeEventFields({
      snapshotId: plan.snapshot_id,
      planId,
      violationCount: planViolations.length,
      constraintStatus,
      simulationStatus,
    }),
  };
}

export async function orchestrationV2Execute(input: {
  request: ControlPlaneActionRequest;
  authHeader?: string | null;
}) {
  ensureControlPlaneV2Enabled();
  const payload = asRecord(input.request.payload);
  const planId = compact(input.request.plan_id || payload.plan_id);
  const snapshotId = compact(input.request.snapshot_id || payload.snapshot_id);
  if (!planId) throw new Error("plan_id is required for orchestration_v2_execute.");
  if (!snapshotId) throw new Error("snapshot_id is required for orchestration_v2_execute.");

  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const plan = await loadPlanRow({ planId, orgId });
  if (plan.snapshot_id !== snapshotId) {
    throw new Error(`Plan ${planId} is bound to snapshot ${plan.snapshot_id}, received ${snapshotId}.`);
  }

  const violations = await loadPlanViolations({
    planId,
    snapshotId,
    orgId,
  });
  const blockingViolations = violations.filter((violation) => violation.blocking).length;
  const constraintStatus = blockingViolations > 0
    ? "failed_blocking"
    : violations.length > 0
      ? "failed_advisory"
      : "passed";
  if (blockingViolations > 0) {
    await updatePlanRow(planId, {
      plan_status: "blocked",
      execution_summary: {
        reason: "blocking_violations",
        violations,
      },
    });
    return {
      ok: false,
      status: "blocked",
      reason: "blocking_violations",
      plan_id: planId,
      snapshot_id: snapshotId,
      violations,
      variable_metrics: {
        binding_count: 0,
        violation_count: violations.length,
        conflict_count: violations.filter((violation) => violation.constraint_id === "variable_conflict_resolution").length,
      },
      event_fields: composeEventFields({
        snapshotId,
        planId,
        violationCount: violations.length,
        constraintStatus,
        simulationStatus: compact(plan.simulation_status) || "not_run",
      }),
    };
  }

  const governanceDecision = asRecord(plan.governance_decision);
  if (governanceDecision.allowed === false) {
    await updatePlanRow(planId, {
      plan_status: "blocked",
      execution_summary: {
        reason: "governance_blocked",
        governance_decision: governanceDecision,
      },
    });
    return {
      ok: false,
      status: "blocked",
      reason: "governance_blocked",
      governance: governanceDecision,
      plan_id: planId,
      snapshot_id: snapshotId,
      variable_metrics: {
        binding_count: 0,
        violation_count: violations.length,
        conflict_count: violations.filter((violation) => violation.constraint_id === "variable_conflict_resolution").length,
      },
      event_fields: composeEventFields({
        snapshotId,
        planId,
        violationCount: violations.length,
        constraintStatus,
        simulationStatus: compact(plan.simulation_status) || "not_run",
      }),
    };
  }

  let simulationStatus = compact(plan.simulation_status) || "not_run";
  if (plan.simulation_required && (simulationStatus === "pending" || simulationStatus === "not_run" || simulationStatus === "not_required")) {
    const preflight = await simulationPreflight({ request: { ...input.request, plan_id: planId, snapshot_id: snapshotId } });
    simulationStatus = compact(preflight.simulation_status) || simulationStatus;
    if (preflight.simulation_required === true && preflight.simulation_mandatory === true && simulationStatus !== "passed") {
      await updatePlanRow(planId, {
        plan_status: "blocked",
        execution_summary: {
          reason: "simulation_blocked",
          preflight,
        },
      });
      return {
        ok: false,
        status: "blocked",
        reason: "simulation_blocked",
        plan_id: planId,
        snapshot_id: snapshotId,
        simulation: preflight,
        variable_metrics: {
          binding_count: 0,
          violation_count: violations.length,
          conflict_count: violations.filter((violation) => violation.constraint_id === "variable_conflict_resolution").length,
        },
        event_fields: composeEventFields({
          snapshotId,
          planId,
          violationCount: violations.length,
          constraintStatus,
          simulationStatus,
        }),
      };
    }
  }

  if (plan.simulation_required && plan.simulation_mandatory && simulationStatus !== "passed") {
    await updatePlanRow(planId, {
      plan_status: "blocked",
      execution_summary: {
        reason: "simulation_blocked",
        simulation_status: simulationStatus,
      },
    });
    return {
      ok: false,
      status: "blocked",
      reason: "simulation_blocked",
      plan_id: planId,
      snapshot_id: snapshotId,
      simulation: {
        simulation_status: simulationStatus,
        simulation_required: true,
        simulation_mandatory: true,
      },
      variable_metrics: {
        binding_count: 0,
        violation_count: violations.length,
        conflict_count: violations.filter((violation) => violation.constraint_id === "variable_conflict_resolution").length,
      },
      event_fields: composeEventFields({
        snapshotId,
        planId,
        violationCount: violations.length,
        constraintStatus,
        simulationStatus,
      }),
    };
  }

  const snapshot = await loadSnapshot({ snapshotId, orgId });
  if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);
  const variableValues = bindingsToValueMap(snapshot.bindings);
  const taskGraph = asRecord(plan.task_graph);
  const nodes = asArray(taskGraph.nodes).map((node) => asRecord(node));
  const graph = asRecord(taskGraph.graph);
  const topologicalOrder = asArray(graph.topological_order).map((entry) => compact(entry)).filter(Boolean);
  const executionOrder = topologicalOrder.length > 0
    ? topologicalOrder
    : nodes.map((node) => compact(node.id)).filter(Boolean);
  const nodeMap = new Map(nodes.map((node) => [compact(node.id), node]));
  const executionSteps: JsonRecord[] = [];
  const correlationId = compact(input.request.correlation_id || plan.correlation_id) || crypto.randomUUID();
  const context = {
    ...asRecord(plan.context),
    ...asRecord(input.request.context),
    ...asRecord(payload.context),
  };

  await updatePlanRow(planId, {
    plan_status: "running",
    executed_at: nowIso(),
  });

  let failedStep: JsonRecord | null = null;
  for (const nodeId of executionOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    const stepType = compact(node.step_type).toLowerCase();
    if (stepType === "manual") {
      executionSteps.push({
        step_id: nodeId,
        step_key: compact(node.key) || nodeId,
        status: "skipped",
        reason: "manual_step",
      });
      continue;
    }

    const toolCodeName = resolveToolCodeForNode(node);
    if (!toolCodeName) {
      executionSteps.push({
        step_id: nodeId,
        step_key: compact(node.key) || nodeId,
        status: "skipped",
        reason: "missing_tool_code",
      });
      continue;
    }

    const started = Date.now();
    try {
      const dispatchPayload = {
        ...context,
        variable_values: variableValues,
        snapshot_id: snapshotId,
        plan_id: planId,
        step_id: nodeId,
        step_key: compact(node.key) || nodeId,
        metadata: {
          ...(asRecord(context.metadata)),
          route: {
            via_control_plane: true,
            via_tool_bus: true,
            control_plane_action: "orchestration_v2_execute",
          },
        },
      };
      const result = await invokeToolThroughBus({
        toolCodeName,
        functionName: compact(node.workflow_id) || null,
        payload: dispatchPayload,
        authHeader: input.authHeader,
        invokerAgentCodeName: compact(plan.agent_id) || compact(input.request.source_agent) || "nexus",
        orgId,
        userId: input.request.user_id || null,
        pipelineRunId: input.request.pipeline_run_id || null,
        stepRunId: nodeId,
        goalId: input.request.goal_id || null,
        goalStepId: nodeId,
        correlationId,
        source: "control-plane-v2",
      });

      executionSteps.push({
        step_id: nodeId,
        step_key: compact(node.key) || nodeId,
        tool_code_name: toolCodeName,
        status: "completed",
        duration_ms: Date.now() - started,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      failedStep = {
        step_id: nodeId,
        step_key: compact(node.key) || nodeId,
        tool_code_name: toolCodeName,
        status: "failed",
        duration_ms: Date.now() - started,
        error: message,
      };
      executionSteps.push(failedStep);
      break;
    }
  }

  const finalStatus = failedStep ? "failed" : "completed";
  const evaluation = await evaluateArtifact({
    artifactType: "orchestration_v2_execution",
    artifactId: planId,
    artifactPayload: {
      plan_id: planId,
      snapshot_id: snapshotId,
      status: finalStatus,
      execution_steps: executionSteps,
      violations,
      simulation_status: simulationStatus,
    },
    impactLevel: compact(plan.risk_class || input.request.risk_class || "medium") as "low" | "medium" | "high" | "critical",
    correlationId,
    orgId,
    userId: input.request.user_id || null,
    sourceAgent: compact(plan.agent_id) || compact(input.request.source_agent) || "control-plane",
    explanationHint: "Variable-oriented orchestration v2 execution quality.",
  });

  await recordMemoryEntry({
    orgId,
    userId: input.request.user_id || null,
    agentCodeName: compact(plan.agent_id) || compact(input.request.source_agent) || "control-plane",
    scope: "shared_ops",
    namespace: "variable_orchestration_v2",
    correlationId,
    summary: `Plan ${planId} executed with status ${finalStatus}`,
    content: {
      plan_id: planId,
      snapshot_id: snapshotId,
      checksum: compact(snapshot.checksum),
      status: finalStatus,
      violation_count: violations.length,
      simulation_status: simulationStatus,
      evaluation_id: evaluation.evaluation_id,
      execution_steps: executionSteps.map((step) => ({
        step_id: step.step_id,
        status: step.status,
        tool_code_name: step.tool_code_name || null,
      })),
    },
  }).catch(() => undefined);

  await updatePlanRow(planId, {
    plan_status: finalStatus,
    simulation_status: simulationStatus,
    execution_summary: {
      status: finalStatus,
      step_count: executionSteps.length,
      failed_step: failedStep,
      evaluation_id: evaluation.evaluation_id,
      evaluation_score: evaluation.overall_score,
      violation_count: violations.length,
    },
    completed_at: nowIso(),
  });

  return {
    ok: finalStatus === "completed",
    status: finalStatus,
    plan_id: planId,
    snapshot_id: snapshotId,
    execution_steps: executionSteps,
    evaluation,
    violation_count: violations.length,
    constraint_status: constraintStatus,
    simulation_status: simulationStatus,
    variable_metrics: {
      binding_count: Object.keys(variableValues).length,
      violation_count: violations.length,
      conflict_count: violations.filter((violation) => violation.constraint_id === "variable_conflict_resolution").length,
      coverage: Object.keys(variableValues).length > 0
        ? Number((Object.keys(variableValues).length / Math.max(1, Object.keys(variableValues).length + violations.length)).toFixed(4))
        : 0,
    },
    event_fields: composeEventFields({
      snapshotId,
      planId,
      violationCount: violations.length,
      constraintStatus,
      simulationStatus,
    }),
  };
}

export async function variableMetrics(input: {
  request: ControlPlaneActionRequest;
}) {
  ensureControlPlaneV2Enabled();
  const orgId = await resolveOrgId(input.request.org_id || null, input.request.user_id || null);
  const windowHours = Math.max(1, Math.min(168, Number(input.request.window_hours || asRecord(input.request.context).window_hours || 24)));
  const sinceIso = new Date(Date.now() - (windowHours * 60 * 60 * 1000)).toISOString();

  const definitions = await loadVariableDefinitions({ orgId, includeInactive: true });
  const latestSnapshotQuery = withOrgScope(
    admin
      .from("control_plane_variable_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1),
    orgId,
  );
  const { data: latestSnapshotRows, error: latestSnapshotError } = await latestSnapshotQuery;
  if (latestSnapshotError) throw latestSnapshotError;
  const latestSnapshot = asRecord((latestSnapshotRows || [])[0] || {});

  let snapshotsWindowQuery = withOrgScope(
    admin
      .from("control_plane_variable_snapshots")
      .select("snapshot_id, checksum, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(2000),
    orgId,
  );
  const { data: snapshotsWindowRows, error: snapshotsWindowError } = await snapshotsWindowQuery;
  if (snapshotsWindowError) throw snapshotsWindowError;
  const snapshotsWindow = (snapshotsWindowRows || []).map((row) => asRecord(row));
  const checksumSet = new Set(snapshotsWindow.map((row) => compact(row.checksum)).filter(Boolean));

  let violationsQuery = withOrgScope(
    admin
      .from("control_plane_variable_violations")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    orgId,
  );
  const { data: violationRows, error: violationsError } = await violationsQuery;
  if (violationsError) throw violationsError;
  const violations = (violationRows || []).map((row) => asRecord(row));

  let executionEventsQuery = withOrgScope(
    admin
      .from("event_log")
      .select("id, result, event_type, metadata, created_at")
      .eq("event_type", "control_plane.orchestration_v2_execute")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1000),
    orgId,
  );
  const { data: executionRows, error: executionRowsError } = await executionEventsQuery;
  if (executionRowsError) throw executionRowsError;
  const executionEvents = (executionRows || []).map((row) => asRecord(row));

  const definitionCount = definitions.length;
  const latestBindings = asArray(latestSnapshot.bindings);
  const latestDiagnostics = asRecord(asRecord(latestSnapshot.metadata).diagnostics);
  const latestConflictCount = asArray(latestDiagnostics.conflict_keys)
    .map((entry) => compact(entry))
    .filter(Boolean)
    .length;
  const coverage = definitionCount > 0
    ? Number((latestBindings.length / definitionCount).toFixed(4))
    : 1;
  const conflictRows = violations.filter((row) => compact(row.constraint_id) === "variable_conflict_resolution");
  const conflictRate = definitionCount > 0
    ? Number((latestConflictCount / definitionCount).toFixed(4))
    : 0;
  const blockingCount = violations.filter((row) => row.blocking === true).length;
  const succeededEvents = executionEvents.filter((row) => compact(row.result).toLowerCase() === "success").length;
  const totalExecutionEvents = executionEvents.length;

  return {
    org_id: orgId,
    window_hours: windowHours,
    generated_at: nowIso(),
    coverage,
    conflict_rate: conflictRate,
    drift_ratio: snapshotsWindow.length > 0
      ? Number((checksumSet.size / snapshotsWindow.length).toFixed(4))
      : 0,
    execution_impact: {
      total_runs: totalExecutionEvents,
      success_rate: totalExecutionEvents > 0 ? Number((succeededEvents / totalExecutionEvents).toFixed(4)) : 0,
      blocking_violations: blockingCount,
    },
    counts: {
      definitions: definitionCount,
      latest_snapshot_bindings: latestBindings.length,
      snapshots_in_window: snapshotsWindow.length,
      unique_checksums_in_window: checksumSet.size,
      violations_in_window: violations.length,
      conflicts_in_window: conflictRows.length,
      latest_conflicts: latestConflictCount,
    },
    latest_snapshot: {
      snapshot_id: compact(latestSnapshot.snapshot_id) || null,
      checksum: compact(latestSnapshot.checksum) || null,
      created_at: compact(latestSnapshot.created_at) || null,
      conflict_count: latestConflictCount,
    },
  };
}
