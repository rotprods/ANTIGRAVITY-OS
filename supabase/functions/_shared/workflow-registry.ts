import type { WorkflowNode } from "./control-plane-types.ts";
import { compact, safeNumber } from "./http.ts";
import { admin } from "./supabase.ts";

export interface WorkflowRegistrySnapshot {
  native_workflows: WorkflowNode[];
  n8n_workflows: WorkflowNode[];
  warnings: string[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => compact(item)).filter(Boolean);
}

function mapPipelineTemplateRow(row: Record<string, unknown>): WorkflowNode {
  return {
    workflow_id: compact(row.code_name || row.id),
    workflow_type: "native_pipeline",
    workflow_inputs: [],
    workflow_outputs: asStringArray(row.success_criteria),
    workflow_tools: [],
    workflow_agents: [],
    workflow_dependencies: [],
    workflow_success_rate: safeNumber(row.success_rate, 0),
    description: compact(row.description) || "",
  };
}

function mapN8nTemplateRow(row: Record<string, unknown>): WorkflowNode {
  return {
    workflow_id: compact(row.slug || row.template_id || row.id),
    workflow_type: "n8n_template",
    workflow_inputs: asStringArray(row.action_keys),
    workflow_outputs: [],
    workflow_tools: asStringArray(row.node_types),
    workflow_agents: asStringArray(row.agent_targets),
    workflow_dependencies: [],
    workflow_success_rate: 0,
    description: compact(row.description) || "",
  };
}

export async function getWorkflowRegistrySnapshot(input?: {
  orgId?: string | null;
  workflowQuery?: string | null;
  limit?: number;
}): Promise<WorkflowRegistrySnapshot> {
  const warnings: string[] = [];
  const limit = Math.max(1, Math.min(1000, Number(input?.limit || 200)));
  const normalizedOrgId = compact(input?.orgId) || null;
  const normalizedQuery = compact(input?.workflowQuery).toLowerCase();

  let nativeWorkflows: WorkflowNode[] = [];
  let n8nWorkflows: WorkflowNode[] = [];

  try {
    let pipelineQuery = admin
      .from("pipeline_templates")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (normalizedOrgId) {
      pipelineQuery = pipelineQuery.or(`org_id.eq.${normalizedOrgId},org_id.is.null`);
    } else {
      pipelineQuery = pipelineQuery.is("org_id", null);
    }

    const { data, error } = await pipelineQuery;
    if (error) throw error;
    nativeWorkflows = (data || []).map((row) => mapPipelineTemplateRow(row as Record<string, unknown>));
  } catch (error) {
    warnings.push(error instanceof Error
      ? `pipeline_templates read failed: ${error.message}`
      : "pipeline_templates read failed.");
  }

  try {
    let n8nQuery = admin
      .from("n8n_template_entries")
      .select("*")
      .eq("is_listed", true)
      .order("recent_views", { ascending: false })
      .limit(limit);

    if (normalizedQuery) {
      n8nQuery = n8nQuery.or(`name.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%,slug.ilike.%${normalizedQuery}%`);
    }

    const { data, error } = await n8nQuery;
    if (error) throw error;
    n8nWorkflows = (data || []).map((row) => mapN8nTemplateRow(row as Record<string, unknown>));
  } catch (error) {
    warnings.push(error instanceof Error
      ? `n8n_template_entries read failed (migration/sync may be pending): ${error.message}`
      : "n8n_template_entries read failed (migration/sync may be pending).");
  }

  return {
    native_workflows: nativeWorkflows,
    n8n_workflows: n8nWorkflows,
    warnings,
  };
}

export async function resolveWorkflowNodeById(
  workflowId: string,
  input?: { orgId?: string | null; limit?: number },
) {
  const normalizedWorkflowId = compact(workflowId).toLowerCase();
  if (!normalizedWorkflowId) return null;

  const snapshot = await getWorkflowRegistrySnapshot({
    orgId: input?.orgId || null,
    limit: input?.limit || 500,
  });

  const all = [...snapshot.native_workflows, ...snapshot.n8n_workflows];
  const match = all.find((workflow) => compact(workflow.workflow_id).toLowerCase() === normalizedWorkflowId);
  return match || null;
}
