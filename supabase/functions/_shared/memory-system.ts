import type { JsonRecord, MemoryRecord, MemoryScope } from "./control-plane-types.ts";
import { compact, safeNumber } from "./http.ts";
import { admin } from "./supabase.ts";

interface WriteMemoryRecordInput {
  orgId?: string | null;
  userId?: string | null;
  agentCodeName?: string | null;
  scope: MemoryScope;
  namespace: string;
  summary?: string | null;
  content?: JsonRecord;
  entityType?: string | null;
  entityId?: string | null;
  pipelineRunId?: string | null;
  stepRunId?: string | null;
  correlationId?: string | null;
  importance?: number;
  expiresAt?: string | null;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function mapMemoryRow(row: Record<string, unknown>): MemoryRecord {
  return {
    id: compact(row.id),
    scope: compact(row.scope) as MemoryScope,
    namespace: compact(row.namespace),
    summary: compact(row.summary) || null,
    content: asRecord(row.content_json),
    correlation_id: compact(row.correlation_id) || null,
    importance: safeNumber(row.importance, 50),
    created_at: compact(row.created_at),
  };
}

export async function writeMemoryRecord(input: WriteMemoryRecordInput): Promise<MemoryRecord> {
  const { data, error } = await admin
    .from("memory_entries")
    .insert({
      org_id: compact(input.orgId) || null,
      user_id: compact(input.userId) || null,
      agent_code_name: compact(input.agentCodeName) || null,
      scope: input.scope,
      namespace: compact(input.namespace) || "operations",
      summary: compact(input.summary) || null,
      content_json: input.content || {},
      entity_type: compact(input.entityType) || null,
      entity_id: compact(input.entityId) || null,
      pipeline_run_id: compact(input.pipelineRunId) || null,
      step_run_id: compact(input.stepRunId) || null,
      correlation_id: compact(input.correlationId) || null,
      importance: Math.max(0, Math.min(100, Math.round(safeNumber(input.importance, 50)))),
      expires_at: compact(input.expiresAt) || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapMemoryRow(data as Record<string, unknown>);
}

export async function recallMemoryRecords(input?: {
  orgId?: string | null;
  userId?: string | null;
  scope?: MemoryScope | null;
  namespace?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(200, Number(input?.limit || 30)));
  let query = admin
    .from("memory_entries")
    .select("*")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (compact(input?.orgId)) query = query.eq("org_id", compact(input?.orgId));
  if (compact(input?.userId)) query = query.eq("user_id", compact(input?.userId));
  if (compact(input?.scope)) query = query.eq("scope", compact(input?.scope));
  if (compact(input?.namespace)) query = query.eq("namespace", compact(input?.namespace));
  if (compact(input?.entityType)) query = query.eq("entity_type", compact(input?.entityType));
  if (compact(input?.entityId)) query = query.eq("entity_id", compact(input?.entityId));
  if (compact(input?.correlationId)) query = query.eq("correlation_id", compact(input?.correlationId));

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => mapMemoryRow(row as Record<string, unknown>));
}

export async function promoteMemoryRecord(input: {
  memoryId: string;
  targetScope: MemoryScope;
  promotedByAgent?: string | null;
  reason?: string | null;
}) {
  const { data: existing, error: existingError } = await admin
    .from("memory_entries")
    .select("*")
    .eq("id", input.memoryId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error(`Memory record not found: ${input.memoryId}`);

  const currentContent = asRecord(existing.content_json);
  const promotedContent: JsonRecord = {
    ...currentContent,
    promotion: {
      from_memory_id: existing.id,
      from_scope: existing.scope,
      to_scope: input.targetScope,
      reason: compact(input.reason) || "promotion",
      promoted_by: compact(input.promotedByAgent) || null,
      promoted_at: new Date().toISOString(),
    },
  };

  const promoted = await writeMemoryRecord({
    orgId: compact(existing.org_id) || null,
    userId: compact(existing.user_id) || null,
    agentCodeName: compact(input.promotedByAgent) || compact(existing.agent_code_name) || null,
    scope: input.targetScope,
    namespace: compact(existing.namespace) || "operations",
    summary: compact(existing.summary) || null,
    content: promotedContent,
    entityType: compact(existing.entity_type) || null,
    entityId: compact(existing.entity_id) || null,
    pipelineRunId: compact(existing.pipeline_run_id) || null,
    stepRunId: compact(existing.step_run_id) || null,
    correlationId: compact(existing.correlation_id) || null,
    importance: safeNumber(existing.importance, 50),
    expiresAt: compact(existing.expires_at) || null,
  });

  return {
    promoted_record: promoted,
    source_memory_id: existing.id,
  };
}
