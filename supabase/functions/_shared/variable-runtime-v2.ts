import type {
  ConstraintFailMode,
  ConstraintSeverity,
  JsonRecord,
  VariableBinding,
  VariableConstraint,
  VariableDefinition,
  VariablePrecedenceLevel,
  VariableViolation,
} from "./control-plane-types.ts";

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export interface RuntimeVariableBinding extends VariableBinding {
  updated_at?: string;
}

export interface VariableResolutionDiagnostics {
  total_variables: number;
  resolved_variables: number;
  coverage: number;
  conflict_keys: string[];
  tie_break_count: number;
  missing_required_keys: string[];
}

export interface VariableResolutionResult {
  bindings: VariableBinding[];
  value_map: Record<string, unknown>;
  diagnostics: VariableResolutionDiagnostics;
  checksum: string;
}

export interface ConstraintEvaluationResult {
  violations: VariableViolation[];
  blocking_count: number;
  advisory_count: number;
  constraint_status: "passed" | "failed_blocking" | "failed_advisory";
}

interface NormalizedDefinition extends Partial<VariableDefinition>, JsonRecord {
  variable_key: string;
  scope: VariablePrecedenceLevel;
  owner_ref: string;
  updated_at: string;
}

const PRECEDENCE_RANK: Record<VariablePrecedenceLevel, number> = {
  run_override: 5,
  workflow: 4,
  agent: 3,
  org: 2,
  global: 1,
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function normalizePrecedenceLevel(value: unknown): VariablePrecedenceLevel {
  const normalized = compact(value).toLowerCase();
  if (normalized === "run_override") return "run_override";
  if (normalized === "workflow") return "workflow";
  if (normalized === "agent") return "agent";
  if (normalized === "org") return "org";
  return "global";
}

function normalizeSeverity(value: unknown): ConstraintSeverity {
  const normalized = compact(value).toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function normalizeFailMode(value: unknown): ConstraintFailMode {
  const normalized = compact(value).toLowerCase();
  if (normalized === "hard_block") return "hard_block";
  if (normalized === "soft_block") return "soft_block";
  return "advisory";
}

function asEpoch(value: unknown) {
  const iso = compact(value);
  if (!iso) return -1;
  const epoch = new Date(iso).getTime();
  return Number.isFinite(epoch) ? epoch : -1;
}

function normalizeSourceRef(value: unknown) {
  return compact(value);
}

function normalizeKey(value: unknown) {
  return compact(value);
}

function isBindingEffective(binding: RuntimeVariableBinding, nowEpoch: number) {
  const fromEpoch = asEpoch(binding.effective_from);
  const toEpoch = asEpoch(binding.effective_to);
  if (fromEpoch > 0 && fromEpoch > nowEpoch) return false;
  if (toEpoch > 0 && toEpoch < nowEpoch) return false;
  return true;
}

function appliesToScope(
  binding: RuntimeVariableBinding,
  input: {
    workflowId?: string | null;
    agentId?: string | null;
  },
) {
  const precedence = normalizePrecedenceLevel(binding.precedence_level);
  const sourceRef = normalizeSourceRef(binding.source_ref);
  if (precedence === "workflow") {
    if (!compact(input.workflowId)) return sourceRef.length === 0;
    return sourceRef.length === 0 || sourceRef === compact(input.workflowId);
  }
  if (precedence === "agent") {
    if (!compact(input.agentId)) return sourceRef.length === 0;
    return sourceRef.length === 0 || sourceRef === compact(input.agentId);
  }
  return true;
}

function normalizeBinding(input: RuntimeVariableBinding): RuntimeVariableBinding {
  return {
    variable_key: normalizeKey(input.variable_key),
    precedence_level: normalizePrecedenceLevel(input.precedence_level),
    source_ref: normalizeSourceRef(input.source_ref),
    value: input.value,
    effective_from: compact(input.effective_from) || null,
    effective_to: compact(input.effective_to) || null,
    updated_at: compact(input.updated_at) || undefined,
  };
}

function normalizeDefinition(
  input: Partial<VariableDefinition> & JsonRecord,
): NormalizedDefinition | null {
  const variableKey = normalizeKey(input.variable_key);
  if (!variableKey) return null;
  return {
    ...input,
    variable_key: variableKey,
    scope: normalizePrecedenceLevel(input.scope),
    owner_ref: normalizeSourceRef(input.owner_ref),
    updated_at: compact(input.updated_at),
  };
}

function definitionMatchesContext(
  definition: NormalizedDefinition,
  input: {
    workflowId?: string | null;
    agentId?: string | null;
  },
) {
  if (definition.scope === "workflow") {
    if (!compact(input.workflowId)) return definition.owner_ref.length === 0;
    return definition.owner_ref.length === 0 || definition.owner_ref === compact(input.workflowId);
  }
  if (definition.scope === "agent") {
    if (!compact(input.agentId)) return definition.owner_ref.length === 0;
    return definition.owner_ref.length === 0 || definition.owner_ref === compact(input.agentId);
  }
  return true;
}

function compareDefinitions(a: NormalizedDefinition, b: NormalizedDefinition) {
  const precedenceDiff = PRECEDENCE_RANK[b.scope] - PRECEDENCE_RANK[a.scope];
  if (precedenceDiff !== 0) return precedenceDiff;
  const updatedDiff = asEpoch(b.updated_at) - asEpoch(a.updated_at);
  if (updatedDiff !== 0) return updatedDiff;
  return a.owner_ref.localeCompare(b.owner_ref);
}

function resolveEffectiveDefinitions(
  input: {
    definitions: Array<Partial<VariableDefinition> & JsonRecord>;
    workflowId?: string | null;
    agentId?: string | null;
  },
) {
  const grouped = new Map<string, NormalizedDefinition[]>();
  for (const raw of input.definitions) {
    const normalized = normalizeDefinition(raw);
    if (!normalized) continue;
    if (!definitionMatchesContext(normalized, { workflowId: input.workflowId, agentId: input.agentId })) continue;
    const list = grouped.get(normalized.variable_key) || [];
    list.push(normalized);
    grouped.set(normalized.variable_key, list);
  }

  const resolved: NormalizedDefinition[] = [];
  for (const [key, list] of grouped.entries()) {
    const sorted = [...list].sort(compareDefinitions);
    resolved.push({
      ...sorted[0],
      variable_key: key,
    });
  }

  return resolved.sort((a, b) => a.variable_key.localeCompare(b.variable_key));
}

function isRequiredVariable(definition: Partial<VariableDefinition> & JsonRecord) {
  const validation = asRecord(definition.validation_rules);
  const requiredFlag = validation.required === true || validation.is_required === true || definition.is_required === true;
  return requiredFlag === true;
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function normalizeForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeForStableJson(item));
  if (isRecord(value)) {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = normalizeForStableJson(value[key]);
    }
    return out;
  }
  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForStableJson(value));
}

export async function checksumForValue(value: unknown) {
  const payload = stableStringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface ResolutionCandidate extends RuntimeVariableBinding {
  _updated_epoch: number;
}

function compareCandidates(a: ResolutionCandidate, b: ResolutionCandidate) {
  const precedenceDiff = PRECEDENCE_RANK[b.precedence_level] - PRECEDENCE_RANK[a.precedence_level];
  if (precedenceDiff !== 0) return precedenceDiff;
  const updatedDiff = b._updated_epoch - a._updated_epoch;
  if (updatedDiff !== 0) return updatedDiff;
  const sourceDiff = a.source_ref.localeCompare(b.source_ref);
  if (sourceDiff !== 0) return sourceDiff;
  const valueDiff = stableStringify(a.value).localeCompare(stableStringify(b.value));
  if (valueDiff !== 0) return valueDiff;
  return 0;
}

export async function buildDeterministicVariableResolution(input: {
  definitions: Array<Partial<VariableDefinition> & JsonRecord>;
  bindings: RuntimeVariableBinding[];
  runtimeOverrides?: JsonRecord;
  workflowId?: string | null;
  agentId?: string | null;
  nowIso?: string;
}): Promise<VariableResolutionResult> {
  const definitions = resolveEffectiveDefinitions({
    definitions: input.definitions,
    workflowId: input.workflowId,
    agentId: input.agentId,
  });

  const nowEpoch = asEpoch(input.nowIso) > 0 ? asEpoch(input.nowIso) : Date.now();
  const bindingPool = input.bindings
    .map((binding) => normalizeBinding(binding))
    .filter((binding) => binding.variable_key.length > 0)
    .filter((binding) => isBindingEffective(binding, nowEpoch))
    .filter((binding) => appliesToScope(binding, { workflowId: input.workflowId, agentId: input.agentId }));

  const runtimeOverrides = asRecord(input.runtimeOverrides);
  for (const [key, value] of Object.entries(runtimeOverrides)) {
    bindingPool.push({
      variable_key: normalizeKey(key),
      precedence_level: "run_override",
      source_ref: "run_override",
      value,
      effective_from: null,
      effective_to: null,
      updated_at: input.nowIso || new Date(nowEpoch).toISOString(),
    });
  }

  const resolvedBindings: VariableBinding[] = [];
  const valueMap: Record<string, unknown> = {};
  const conflictKeys: string[] = [];
  const missingRequiredKeys: string[] = [];
  let tieBreakCount = 0;

  for (const definition of definitions) {
    const key = definition.variable_key;
    if (!key) continue;

    const candidates: ResolutionCandidate[] = [];
    const defaultValue = definition.default_value;
    if (defaultValue !== undefined) {
      candidates.push({
        variable_key: key,
        precedence_level: definition.scope,
        source_ref: definition.owner_ref || "default",
        value: defaultValue,
        effective_from: null,
        effective_to: null,
        updated_at: definition.updated_at || undefined,
        _updated_epoch: asEpoch(definition.updated_at),
      });
    }

    for (const binding of bindingPool) {
      if (binding.variable_key !== key) continue;
      candidates.push({
        ...binding,
        _updated_epoch: asEpoch(binding.updated_at),
      });
    }

    if (candidates.length === 0) {
      if (isRequiredVariable(definition)) {
        missingRequiredKeys.push(key);
      }
      continue;
    }

    const sorted = [...candidates].sort(compareCandidates);
    if (sorted.length > 1) {
      const highestPrecedence = PRECEDENCE_RANK[sorted[0].precedence_level];
      const topPrecedenceCandidates = sorted.filter((candidate) =>
        PRECEDENCE_RANK[candidate.precedence_level] === highestPrecedence
      );
      const topPrecedenceNonDefaultCandidates = topPrecedenceCandidates
        .filter((candidate) => candidate.source_ref !== "default");
      // Only mark a conflict when multiple candidates compete at the same top precedence.
      // Lower-precedence fallbacks and default-vs-binding overlap are expected layering.
      if (topPrecedenceNonDefaultCandidates.length > 1) {
        conflictKeys.push(key);
        tieBreakCount += 1;
      }
    }

    const selected = sorted[0];
    resolvedBindings.push({
      variable_key: key,
      precedence_level: selected.precedence_level,
      source_ref: selected.source_ref,
      value: selected.value,
      effective_from: selected.effective_from,
      effective_to: selected.effective_to,
    });
    valueMap[key] = selected.value;
  }

  for (const key of missingRequiredKeys) {
    if (hasValue(valueMap[key])) continue;
    delete valueMap[key];
  }

  resolvedBindings.sort((a, b) => a.variable_key.localeCompare(b.variable_key));
  const checksum = await checksumForValue({
    bindings: resolvedBindings,
    workflow_id: compact(input.workflowId) || null,
    agent_id: compact(input.agentId) || null,
  });

  return {
    bindings: resolvedBindings,
    value_map: valueMap,
    diagnostics: {
      total_variables: definitions.length,
      resolved_variables: resolvedBindings.length,
      coverage: definitions.length > 0 ? Number((resolvedBindings.length / definitions.length).toFixed(4)) : 1,
      conflict_keys: conflictKeys.sort((a, b) => a.localeCompare(b)),
      tie_break_count: tieBreakCount,
      missing_required_keys: missingRequiredKeys.sort((a, b) => a.localeCompare(b)),
    },
    checksum,
  };
}

function shouldBlockViolation(severity: ConstraintSeverity, failMode: ConstraintFailMode) {
  if (failMode === "hard_block") return true;
  if (severity === "high" || severity === "critical") return true;
  return false;
}

function pushViolation(
  violations: VariableViolation[],
  input: {
    constraintId: string;
    variableKeys: string[];
    severity: ConstraintSeverity;
    failMode: ConstraintFailMode;
    message: string;
  },
) {
  violations.push({
    constraint_id: input.constraintId,
    variable_keys: input.variableKeys,
    severity: input.severity,
    message: input.message,
    blocking: shouldBlockViolation(input.severity, input.failMode),
  });
}

function evaluateObjectExpression(input: {
  expression: JsonRecord;
  values: Record<string, unknown>;
  executionContext: JsonRecord;
  severity: ConstraintSeverity;
  failMode: ConstraintFailMode;
  constraintId: string;
  violations: VariableViolation[];
}) {
  const type = compact(input.expression.type || input.expression.kind).toLowerCase();
  const variableKey = normalizeKey(input.expression.variable_key || input.expression.key);
  const value = variableKey ? input.values[variableKey] : undefined;

  if (type === "required") {
    if (!variableKey || !hasValue(value)) {
      pushViolation(input.violations, {
        constraintId: input.constraintId,
        variableKeys: variableKey ? [variableKey] : [],
        severity: input.severity,
        failMode: input.failMode,
        message: variableKey
          ? `Required variable '${variableKey}' is missing.`
          : "Required-variable constraint is missing variable_key.",
      });
    }
    return;
  }

  if (type === "max") {
    const limit = safeNumber(input.expression.limit ?? input.expression.value, NaN);
    const current = safeNumber(value, NaN);
    if (Number.isFinite(limit) && Number.isFinite(current) && current > limit) {
      pushViolation(input.violations, {
        constraintId: input.constraintId,
        variableKeys: variableKey ? [variableKey] : [],
        severity: input.severity,
        failMode: input.failMode,
        message: `Variable '${variableKey}' (${current}) exceeds max (${limit}).`,
      });
    }
    return;
  }

  if (type === "min") {
    const limit = safeNumber(input.expression.limit ?? input.expression.value, NaN);
    const current = safeNumber(value, NaN);
    if (Number.isFinite(limit) && Number.isFinite(current) && current < limit) {
      pushViolation(input.violations, {
        constraintId: input.constraintId,
        variableKeys: variableKey ? [variableKey] : [],
        severity: input.severity,
        failMode: input.failMode,
        message: `Variable '${variableKey}' (${current}) is below min (${limit}).`,
      });
    }
    return;
  }

  if (type === "allowed_values") {
    const allowed = Array.isArray(input.expression.values) ? input.expression.values : [];
    if (variableKey && hasValue(value) && !allowed.some((entry) => stableStringify(entry) === stableStringify(value))) {
      pushViolation(input.violations, {
        constraintId: input.constraintId,
        variableKeys: [variableKey],
        severity: input.severity,
        failMode: input.failMode,
        message: `Variable '${variableKey}' has disallowed value.`,
      });
    }
    return;
  }

  if (type === "budget_max") {
    const estimated = safeNumber(
      input.executionContext.estimated_cost ??
        input.executionContext.estimated_cost_usd ??
        input.values.estimated_cost,
      NaN,
    );
    const limit = safeNumber(input.expression.limit ?? input.expression.value, NaN);
    if (Number.isFinite(estimated) && Number.isFinite(limit) && estimated > limit) {
      pushViolation(input.violations, {
        constraintId: input.constraintId,
        variableKeys: ["estimated_cost"],
        severity: input.severity,
        failMode: input.failMode,
        message: `Estimated cost (${estimated}) exceeds budget limit (${limit}).`,
      });
    }
  }
}

function evaluateStringExpression(input: {
  expression: string;
  values: Record<string, unknown>;
  executionContext: JsonRecord;
  severity: ConstraintSeverity;
  failMode: ConstraintFailMode;
  constraintId: string;
  violations: VariableViolation[];
}) {
  const expression = compact(input.expression).toLowerCase();
  if (!expression) return;

  const budgetMatch = expression.match(/estimated_cost\s*<=\s*([0-9]+(?:\.[0-9]+)?)/);
  if (budgetMatch) {
    const limit = safeNumber(budgetMatch[1], NaN);
    const estimated = safeNumber(
      input.executionContext.estimated_cost ??
        input.executionContext.estimated_cost_usd ??
        input.values.estimated_cost,
      NaN,
    );
    if (Number.isFinite(limit) && Number.isFinite(estimated) && estimated > limit) {
      pushViolation(input.violations, {
        constraintId: input.constraintId,
        variableKeys: ["estimated_cost"],
        severity: input.severity,
        failMode: input.failMode,
        message: `Estimated cost (${estimated}) exceeds budget limit (${limit}).`,
      });
    }
  }
}

export function evaluateVariableConstraints(input: {
  constraints: Array<Partial<VariableConstraint> & JsonRecord>;
  values: Record<string, unknown>;
  executionContext?: JsonRecord;
}): ConstraintEvaluationResult {
  const executionContext = asRecord(input.executionContext);
  const violations: VariableViolation[] = [];

  for (const rawConstraint of input.constraints) {
    const constraintId = normalizeKey(rawConstraint.constraint_id || rawConstraint.id || "constraint");
    const severity = normalizeSeverity(rawConstraint.severity);
    const failMode = normalizeFailMode(rawConstraint.fail_mode);
    const expression = rawConstraint.expression;

    if (typeof expression === "string") {
      evaluateStringExpression({
        expression,
        values: input.values,
        executionContext,
        severity,
        failMode,
        constraintId,
        violations,
      });
      continue;
    }

    if (isRecord(expression)) {
      evaluateObjectExpression({
        expression,
        values: input.values,
        executionContext,
        severity,
        failMode,
        constraintId,
        violations,
      });
    }
  }

  const blockingCount = violations.filter((violation) => violation.blocking).length;
  return {
    violations,
    blocking_count: blockingCount,
    advisory_count: violations.length - blockingCount,
    constraint_status: blockingCount > 0
      ? "failed_blocking"
      : violations.length > 0
        ? "failed_advisory"
        : "passed",
  };
}

export function resolveSimulationRequirement(input: {
  riskClass?: string | null;
  targetEnvironment?: string | null;
  simulationRequiredInProd: boolean;
}) {
  const risk = compact(input.riskClass).toLowerCase();
  const environment = compact(input.targetEnvironment).toLowerCase();
  const highRisk = risk === "high" || risk === "critical";
  const isProduction = environment === "production";
  if (isProduction && highRisk && input.simulationRequiredInProd) {
    return {
      simulation_required: true,
      mode: "dry_run" as const,
      mandatory: true,
    };
  }
  if (highRisk) {
    return {
      simulation_required: true,
      mode: "shadow" as const,
      mandatory: false,
    };
  }
  return {
    simulation_required: false,
    mode: "shadow" as const,
    mandatory: false,
  };
}
