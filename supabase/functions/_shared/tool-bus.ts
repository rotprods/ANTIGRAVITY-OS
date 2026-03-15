import { AGENT_REGISTRY } from "./agent-registry.ts";
import { compact } from "./http.ts";
import { admin } from "./supabase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

export interface JsonRecord {
  [key: string]: unknown;
}

interface ToolRegistryRow {
  id: string;
  code_name: string;
  endpoint_url: string | null;
  invocation_type: string | null;
  risk_level: number | null;
  requires_approval: boolean | null;
  max_calls_per_hour: number | null;
  is_active: boolean | null;
}

interface AgentToolPermissionRow {
  id: string;
  permission_level: "allow" | "approval" | "deny";
  max_calls_per_run: number | null;
  is_active: boolean | null;
}

interface PolicyResolution {
  tool: ToolRegistryRow | null;
  permission: AgentToolPermissionRow | null;
  requiresApproval: boolean;
  allowed: boolean;
  reason: string;
  maxCallsPerRun: number | null;
  policySource: "db_permission" | "agent_registry" | "none";
}

export interface ToolBusInvokeInput {
  toolCodeName: string;
  functionName?: string | null;
  payload?: JsonRecord;
  authHeader?: string | null;
  invokerAgentCodeName: string;
  orgId?: string | null;
  userId?: string | null;
  pipelineRunId?: string | null;
  stepRunId?: string | null;
  goalId?: string | null;
  goalStepId?: string | null;
  correlationId?: string | null;
  source?: string | null;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeToolCodeName(value: string) {
  return compact(value).toLowerCase();
}

function isAgentRuntimeTool(toolCodeName: string) {
  return normalizeToolCodeName(toolCodeName).startsWith("agent-");
}

function parseAgentFromToolCode(toolCodeName: string) {
  const normalized = normalizeToolCodeName(toolCodeName);
  if (!normalized.startsWith("agent-")) return "";
  return normalized.slice("agent-".length);
}

function deriveFunctionName(input: ToolBusInvokeInput, tool: ToolRegistryRow | null) {
  const explicit = compact(input.functionName);
  if (explicit) return explicit;

  const endpoint = compact(tool?.endpoint_url);
  if (endpoint.startsWith("supabase://functions/")) {
    return endpoint.replace("supabase://functions/", "");
  }

  return normalizeToolCodeName(input.toolCodeName);
}

async function loadToolDefinition(toolCodeName: string, orgId?: string | null) {
  const normalizedTool = normalizeToolCodeName(toolCodeName);
  const normalizedOrg = compact(orgId) || null;

  if (normalizedOrg) {
    const { data, error } = await admin
      .from("tool_registry")
      .select("id, code_name, endpoint_url, invocation_type, risk_level, requires_approval, max_calls_per_hour, is_active")
      .eq("code_name", normalizedTool)
      .eq("org_id", normalizedOrg)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ToolRegistryRow;
  }

  const { data, error } = await admin
    .from("tool_registry")
    .select("id, code_name, endpoint_url, invocation_type, risk_level, requires_approval, max_calls_per_hour, is_active")
    .eq("code_name", normalizedTool)
    .is("org_id", null)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data as ToolRegistryRow | null;
}

async function loadAgentToolPermission(input: {
  orgId?: string | null;
  agentCodeName: string;
  toolCodeName: string;
}) {
  const normalizedOrg = compact(input.orgId) || null;
  const normalizedAgent = normalizeToolCodeName(input.agentCodeName);
  const normalizedTool = normalizeToolCodeName(input.toolCodeName);

  if (normalizedOrg) {
    const { data, error } = await admin
      .from("agent_tool_permissions")
      .select("id, permission_level, max_calls_per_run, is_active")
      .eq("agent_code_name", normalizedAgent)
      .eq("tool_code_name", normalizedTool)
      .eq("org_id", normalizedOrg)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as AgentToolPermissionRow;
  }

  const { data, error } = await admin
    .from("agent_tool_permissions")
    .select("id, permission_level, max_calls_per_run, is_active")
    .eq("agent_code_name", normalizedAgent)
    .eq("tool_code_name", normalizedTool)
    .is("org_id", null)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data as AgentToolPermissionRow | null;
}

async function countToolCallsForCorrelation(input: {
  correlationId?: string | null;
  invokerAgentCodeName: string;
  toolCodeName: string;
}) {
  const correlationId = compact(input.correlationId);
  if (!correlationId) return 0;

  const { count, error } = await admin
    .from("event_log")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "tool_bus.invocation")
    .eq("source_agent", normalizeToolCodeName(input.invokerAgentCodeName))
    .eq("correlation_id", correlationId)
    .contains("metadata", { tool_code_name: normalizeToolCodeName(input.toolCodeName) });

  if (error) throw error;
  return Number(count || 0);
}

async function hasExplicitApproval(payload: JsonRecord) {
  const policy = asRecord(payload.policy);
  const approvalGranted = payload.approval_granted === true || policy.approval_granted === true;
  if (approvalGranted) return true;

  const approvalStatus = compact(payload.approval_status || policy.approval_status).toLowerCase();
  if (approvalStatus === "approved") return true;

  const approvalId = compact(payload.approval_id || policy.approval_id);
  if (!approvalId) return false;

  const { data, error } = await admin
    .from("approval_requests")
    .select("status")
    .eq("id", approvalId)
    .maybeSingle();

  if (error) throw error;
  return compact(data?.status).toLowerCase() === "approved";
}

function evaluateRegistryPermission(invokerAgentCodeName: string, toolCodeName: string) {
  if (!isAgentRuntimeTool(toolCodeName)) return false;

  const invoker = AGENT_REGISTRY[normalizeToolCodeName(invokerAgentCodeName)];
  if (!invoker) return false;

  const targetAgent = parseAgentFromToolCode(toolCodeName);
  if (!targetAgent) return false;
  if (targetAgent === invoker.code_name) return true;
  return invoker.policy_set.can_call_agents.includes(targetAgent);
}

async function resolvePolicy(input: {
  orgId?: string | null;
  invokerAgentCodeName: string;
  toolCodeName: string;
  payload: JsonRecord;
}) {
  const tool = await loadToolDefinition(input.toolCodeName, input.orgId || null);
  const permission = await loadAgentToolPermission({
    orgId: input.orgId || null,
    agentCodeName: input.invokerAgentCodeName,
    toolCodeName: input.toolCodeName,
  });

  if (permission) {
    const denied = permission.permission_level === "deny";
    const requiresApproval = permission.permission_level === "approval" || tool?.requires_approval === true;
    if (denied) {
      return {
        tool,
        permission,
        requiresApproval,
        allowed: false,
        reason: "Permission denied by agent_tool_permissions.",
        maxCallsPerRun: permission.max_calls_per_run,
        policySource: "db_permission",
      } satisfies PolicyResolution;
    }

    if (requiresApproval) {
      const approved = await hasExplicitApproval(input.payload);
      if (!approved) {
        return {
          tool,
          permission,
          requiresApproval: true,
          allowed: true,
          reason: "Approval required before invoking tool.",
          maxCallsPerRun: permission.max_calls_per_run,
          policySource: "db_permission",
        } satisfies PolicyResolution;
      }
    }

    return {
      tool,
      permission,
      requiresApproval,
      allowed: true,
      reason: "Tool invocation allowed by agent_tool_permissions.",
      maxCallsPerRun: permission.max_calls_per_run,
      policySource: "db_permission",
    } satisfies PolicyResolution;
  }

  if (evaluateRegistryPermission(input.invokerAgentCodeName, input.toolCodeName)) {
    return {
      tool,
      permission: null,
      requiresApproval: false,
      allowed: true,
      reason: "Internal agent call allowed by static agent registry.",
      maxCallsPerRun: null,
      policySource: "agent_registry",
    } satisfies PolicyResolution;
  }

  return {
    tool,
    permission: null,
    requiresApproval: tool?.requires_approval === true,
    allowed: false,
    reason: "Missing tool permission for invoker and tool.",
    maxCallsPerRun: null,
    policySource: "none",
  } satisfies PolicyResolution;
}

async function writeToolBusEvent(input: {
  eventType: string;
  status: "emitted" | "delivered" | "failed";
  payload: JsonRecord;
  metadata: JsonRecord;
  invokerAgentCodeName: string;
  orgId?: string | null;
  userId?: string | null;
  pipelineRunId?: string | null;
  stepRunId?: string | null;
  correlationId?: string | null;
}) {
  await admin
    .from("event_log")
    .insert({
      event_type: input.eventType,
      payload: input.payload,
      user_id: compact(input.userId) || null,
      org_id: compact(input.orgId) || null,
      source_agent: normalizeToolCodeName(input.invokerAgentCodeName),
      pipeline_run_id: compact(input.pipelineRunId) || null,
      step_run_id: compact(input.stepRunId) || null,
      correlation_id: compact(input.correlationId) || null,
      status: input.status,
      metadata: {
        ...input.metadata,
        emitted_at: nowIso(),
      },
    });
}

async function invokeEdgeFunction(functionName: string, payload: JsonRecord, authHeader?: string | null) {
  if (!SUPABASE_URL) {
    throw new Error("Supabase runtime env is not configured");
  }

  const explicitAuthHeader = compact(authHeader);
  const bearerToken = explicitAuthHeader.startsWith("Bearer ")
    ? explicitAuthHeader.replace(/^Bearer\s+/i, "")
    : "";
  const useServiceRoleForApiKey = Boolean(SERVICE_KEY) && bearerToken === SERVICE_KEY;

  const authValue = explicitAuthHeader.startsWith("Bearer ")
    ? explicitAuthHeader
    : (ANON_KEY ? `Bearer ${ANON_KEY}` : (SERVICE_KEY ? `Bearer ${SERVICE_KEY}` : ""));
  const apiKey = useServiceRoleForApiKey ? (SERVICE_KEY || "") : (ANON_KEY || SERVICE_KEY || "");
  if (!authValue || !apiKey) {
    throw new Error("Supabase auth keys are not configured for tool bus invocation");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authValue,
      apikey: apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = compact((data as JsonRecord).error) || `${functionName} failed (${response.status})`;
    throw new Error(message);
  }

  return asRecord(data);
}

export async function invokeToolThroughBus(input: ToolBusInvokeInput): Promise<JsonRecord> {
  const toolCodeName = normalizeToolCodeName(input.toolCodeName);
  const invokerAgentCodeName = normalizeToolCodeName(input.invokerAgentCodeName);
  const payload = asRecord(input.payload);

  const policy = await resolvePolicy({
    orgId: input.orgId || null,
    invokerAgentCodeName,
    toolCodeName,
    payload,
  });

  const functionName = deriveFunctionName(input, policy.tool);
  const traceMetadata = {
    tool_code_name: toolCodeName,
    function_name: functionName,
    policy_source: policy.policySource,
    permission_level: policy.permission?.permission_level || null,
    requires_approval: policy.requiresApproval,
    goal_id: compact(input.goalId) || null,
    goal_step_id: compact(input.goalStepId) || null,
    source: compact(input.source) || null,
  };

  await writeToolBusEvent({
    eventType: "tool_bus.invocation",
    status: "emitted",
    payload: {
      ok: true,
      status: "invocation_started",
      summary: `Tool ${toolCodeName} requested by ${invokerAgentCodeName}.`,
    },
    metadata: traceMetadata,
    invokerAgentCodeName,
    orgId: input.orgId || null,
    userId: input.userId || null,
    pipelineRunId: input.pipelineRunId || null,
    stepRunId: input.stepRunId || null,
    correlationId: input.correlationId || null,
  });

  if (!policy.allowed) {
    await writeToolBusEvent({
      eventType: "tool_bus.blocked",
      status: "failed",
      payload: {
        ok: false,
        status: "blocked",
        error: policy.reason,
      },
      metadata: traceMetadata,
      invokerAgentCodeName,
      orgId: input.orgId || null,
      userId: input.userId || null,
      pipelineRunId: input.pipelineRunId || null,
      stepRunId: input.stepRunId || null,
      correlationId: input.correlationId || null,
    });
    throw new Error(`Tool bus blocked ${toolCodeName}: ${policy.reason}`);
  }

  if (policy.requiresApproval && !(await hasExplicitApproval(payload))) {
    await writeToolBusEvent({
      eventType: "tool_bus.awaiting_approval",
      status: "failed",
      payload: {
        ok: false,
        status: "waiting_approval",
        tool_code_name: toolCodeName,
        approval_required: true,
        summary: `Tool ${toolCodeName} requires approval before execution.`,
      },
      metadata: traceMetadata,
      invokerAgentCodeName,
      orgId: input.orgId || null,
      userId: input.userId || null,
      pipelineRunId: input.pipelineRunId || null,
      stepRunId: input.stepRunId || null,
      correlationId: input.correlationId || null,
    });

    return {
      ok: false,
      status: "waiting_approval",
      tool_code_name: toolCodeName,
      approval_required: true,
      summary: `Tool ${toolCodeName} requires approval before execution.`,
      policy: {
        approval_required: true,
        approval_granted: false,
        policy_source: policy.policySource,
      },
    };
  }

  if ((policy.maxCallsPerRun || 0) > 0) {
    const callCount = await countToolCallsForCorrelation({
      correlationId: input.correlationId || null,
      invokerAgentCodeName,
      toolCodeName,
    });
    if (callCount >= Number(policy.maxCallsPerRun)) {
      await writeToolBusEvent({
        eventType: "tool_bus.blocked",
        status: "failed",
        payload: {
          ok: false,
          status: "blocked",
          error: `max_calls_per_run exceeded (${policy.maxCallsPerRun})`,
        },
        metadata: traceMetadata,
        invokerAgentCodeName,
        orgId: input.orgId || null,
        userId: input.userId || null,
        pipelineRunId: input.pipelineRunId || null,
        stepRunId: input.stepRunId || null,
        correlationId: input.correlationId || null,
      });
      throw new Error(`Tool bus blocked ${toolCodeName}: max_calls_per_run exceeded (${policy.maxCallsPerRun})`);
    }
  }

  try {
    const result = await invokeEdgeFunction(functionName, payload, input.authHeader);

    await writeToolBusEvent({
      eventType: "tool_bus.result",
      status: "delivered",
      payload: {
        ok: true,
        status: compact(result.status) || "completed",
        summary: compact(result.summary) || `Tool ${toolCodeName} executed successfully.`,
      },
      metadata: {
        ...traceMetadata,
        result_ok: result.ok !== false,
      },
      invokerAgentCodeName,
      orgId: input.orgId || null,
      userId: input.userId || null,
      pipelineRunId: input.pipelineRunId || null,
      stepRunId: input.stepRunId || null,
      correlationId: input.correlationId || null,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool invocation failed";
    await writeToolBusEvent({
      eventType: "tool_bus.result",
      status: "failed",
      payload: {
        ok: false,
        status: "failed",
        error: message,
        summary: `Tool ${toolCodeName} failed.`,
      },
      metadata: traceMetadata,
      invokerAgentCodeName,
      orgId: input.orgId || null,
      userId: input.userId || null,
      pipelineRunId: input.pipelineRunId || null,
      stepRunId: input.stepRunId || null,
      correlationId: input.correlationId || null,
    });
    throw error;
  }
}
