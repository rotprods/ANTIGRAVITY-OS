import type { JsonRecord, ToolCapability } from "./control-plane-types.ts";
import { normalizeRiskLevel } from "./control-plane-types.ts";
import { compact, safeNumber } from "./http.ts";
import { admin } from "./supabase.ts";

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => compact(item)).filter(Boolean);
}

function mapToolRow(row: Record<string, unknown>): ToolCapability {
  const metadata = asRecord(row.metadata);
  return {
    tool_id: compact(row.code_name || row.tool_id || row.id),
    tool_type: compact(row.invocation_type || metadata.tool_type || "api"),
    tool_provider: compact(row.provider || metadata.provider || "unknown"),
    tool_permissions: asStringArray(metadata.permissions),
    tool_latency: Math.max(0, safeNumber(metadata.latency_ms || row.avg_latency_ms, 0)),
    tool_cost: Math.max(0, safeNumber(metadata.cost_usd || row.avg_cost_usd, 0)),
    tool_security_level: normalizeRiskLevel(row.risk_level || metadata.risk_level),
  };
}

export async function listToolCapabilities(input?: {
  orgId?: string | null;
  limit?: number;
}) {
  const normalizedOrgId = compact(input?.orgId) || null;
  const limit = Math.max(1, Math.min(1000, Number(input?.limit || 200)));

  let query = admin
    .from("tool_registry")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (normalizedOrgId) {
    query = query.or(`org_id.eq.${normalizedOrgId},org_id.is.null`);
  } else {
    query = query.is("org_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => mapToolRow(row as Record<string, unknown>));
}

export async function resolveToolCapabilityById(toolId: string, orgId?: string | null) {
  const normalizedToolId = compact(toolId).toLowerCase();
  if (!normalizedToolId) return null;

  const capabilities = await listToolCapabilities({ orgId: orgId || null, limit: 1000 });
  const match = capabilities.find((tool) => compact(tool.tool_id).toLowerCase() === normalizedToolId);
  return match || null;
}

export async function getAgentToolPermissions(input: {
  agentId: string;
  orgId?: string | null;
}) {
  const normalizedAgent = compact(input.agentId).replace(/^agent-/, "").toLowerCase();
  if (!normalizedAgent) return [];

  let query = admin
    .from("agent_tool_permissions")
    .select("*")
    .eq("agent_code_name", normalizedAgent)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (compact(input.orgId)) {
    query = query.or(`org_id.eq.${compact(input.orgId)},org_id.is.null`);
  } else {
    query = query.is("org_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => {
    return {
      agent_id: `agent-${normalizedAgent}`,
      tool_id: compact(row.tool_code_name),
      permission_level: compact(row.permission_level || "allow"),
      max_calls_per_run: safeNumber(row.max_calls_per_run, 0),
      metadata: asRecord(row.metadata),
    };
  });
}
