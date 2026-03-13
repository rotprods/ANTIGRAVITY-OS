import type { JsonRecord } from "./control-plane-types.ts";
import { AGENT_REGISTRY } from "./agent-registry.ts";
import { compact } from "./http.ts";
import { admin } from "./supabase.ts";

export interface AgentWorkforceNode {
  agent_id: string;
  agent_name: string;
  agent_category: string;
  agent_role: string;
  agent_capabilities: string[];
  agent_tools: string[];
  agent_permissions: string[];
  agent_cost_profile: string;
  agent_performance_score: number;
  agent_memory_scope: string[];
  agent_supervisor: string | null;
  agent_autonomy_level: string;
  source: "db" | "static_registry";
}

export interface AgentWorkforceSnapshot {
  agents: AgentWorkforceNode[];
  warnings: string[];
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => compact(item)).filter(Boolean);
}

function mapDbAgent(row: Record<string, unknown>): AgentWorkforceNode {
  const metadata = asRecord(row.metadata);
  return {
    agent_id: compact(row.code_name || row.agent_id || row.id),
    agent_name: compact(row.display_name || row.name || row.agent_name || row.code_name),
    agent_category: compact(row.category || metadata.category || "system"),
    agent_role: compact(row.role || metadata.role || "worker"),
    agent_capabilities: asStringArray(metadata.capabilities),
    agent_tools: asStringArray(row.allowed_tools || metadata.allowed_tools),
    agent_permissions: asStringArray(metadata.permissions),
    agent_cost_profile: compact(metadata.cost_profile || "standard"),
    agent_performance_score: Number(row.success_score || metadata.performance_score || 0),
    agent_memory_scope: asStringArray(row.memory_scope || metadata.memory_scope),
    agent_supervisor: compact(row.supervisor || metadata.supervisor) || null,
    agent_autonomy_level: compact(row.autonomy_level || metadata.autonomy_level || "guarded"),
    source: "db",
  };
}

function mapStaticAgent(codeName: string, row: Record<string, unknown>): AgentWorkforceNode {
  const policy = asRecord(row.policy_set);
  const memory = asRecord(row.memory_scope);
  return {
    agent_id: `agent-${codeName}`,
    agent_name: compact(row.display_name || codeName),
    agent_category: compact(row.type || "system"),
    agent_role: compact(row.goal_template || "worker"),
    agent_capabilities: asStringArray(row.allowed_skills),
    agent_tools: [],
    agent_permissions: asStringArray(row.requires_approval_for),
    agent_cost_profile: `usd_${Number(policy.max_spend_per_run_usd || 0).toFixed(2)}`,
    agent_performance_score: 0,
    agent_memory_scope: asStringArray(memory.can_read),
    agent_supervisor: compact(row.escalation_path) || null,
    agent_autonomy_level: policy.safe_mode === true ? "manual_only" : "guarded",
    source: "static_registry",
  };
}

function staticRegistryAgents(): AgentWorkforceNode[] {
  return Object.entries(AGENT_REGISTRY).map(([codeName, row]) => {
    return mapStaticAgent(codeName, row as unknown as Record<string, unknown>);
  });
}

export async function getAgentWorkforceSnapshot(orgId?: string | null): Promise<AgentWorkforceSnapshot> {
  const warnings: string[] = [];
  const normalizedOrgId = compact(orgId) || null;

  try {
    let query = admin
      .from("agent_registry")
      .select("*")
      .order("updated_at", { ascending: false });

    if (normalizedOrgId) {
      query = query.or(`org_id.eq.${normalizedOrgId},org_id.is.null`);
    } else {
      query = query.is("org_id", null);
    }

    const { data, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((row) => mapDbAgent(row as Record<string, unknown>));
    if (mapped.length > 0) {
      return { agents: mapped, warnings };
    }

    warnings.push("agent_registry table returned zero rows; using static registry fallback.");
    return { agents: staticRegistryAgents(), warnings };
  } catch (error) {
    warnings.push(error instanceof Error
      ? `agent_registry query failed; using static fallback (${error.message}).`
      : "agent_registry query failed; using static fallback.");
    return { agents: staticRegistryAgents(), warnings };
  }
}

export async function resolveAgentWorkforceNode(
  agentId: string,
  orgId?: string | null,
): Promise<AgentWorkforceNode | null> {
  const normalized = compact(agentId).replace(/^agent-/, "").toLowerCase();
  if (!normalized) return null;

  const snapshot = await getAgentWorkforceSnapshot(orgId);
  const match = snapshot.agents.find((agent) => {
    const agentKey = compact(agent.agent_id).replace(/^agent-/, "").toLowerCase();
    return agentKey === normalized;
  });

  return match || null;
}
