import type { ControlPlaneEventV2, JsonRecord } from "./control-plane-types.ts";
import { compact } from "./http.ts";
import { admin } from "./supabase.ts";

let eventEnvelopeColumnsCache: boolean | null = null;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

async function hasEventEnvelopeV2Columns() {
  if (eventEnvelopeColumnsCache !== null) return eventEnvelopeColumnsCache;
  try {
    const { data, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "event_log")
      .in("column_name", ["tool_id", "trace_id", "latency_ms", "cost_usd", "risk_level", "result"]);

    if (error) throw error;
    const found = new Set((data || []).map((row) => compact((row as Record<string, unknown>).column_name)));
    eventEnvelopeColumnsCache = ["tool_id", "trace_id", "latency_ms", "cost_usd", "risk_level", "result"]
      .every((column) => found.has(column));
    return eventEnvelopeColumnsCache;
  } catch {
    eventEnvelopeColumnsCache = false;
    return false;
  }
}

function baseRowFromEvent(event: ControlPlaneEventV2, status: "emitted" | "processing" | "delivered" | "failed") {
  return {
    event_type: event.event_type,
    payload: event.payload,
    source_agent: compact(event.agent_id) || null,
    correlation_id: compact(event.correlation_id) || null,
    status,
    metadata: {
      ...asRecord(event.metadata),
      envelope_v2: {
        event_type: event.event_type,
        agent_id: event.agent_id,
        workflow_id: event.workflow_id,
        tool_id: event.tool_id,
        trace_id: event.trace_id,
        timestamp: event.timestamp,
        latency_ms: event.latency_ms,
        cost_usd: event.cost_usd,
        risk_level: event.risk_level,
        result: event.result,
      },
    },
  };
}

export async function emitControlPlaneEventV2(input: {
  event: ControlPlaneEventV2;
  status?: "emitted" | "processing" | "delivered" | "failed";
  userId?: string | null;
  orgId?: string | null;
  pipelineRunId?: string | null;
  stepRunId?: string | null;
}) {
  const status = input.status || "emitted";
  const baseRow = baseRowFromEvent(input.event, status);

  const fullRow = {
    ...baseRow,
    user_id: compact(input.userId) || null,
    org_id: compact(input.orgId) || null,
    pipeline_run_id: compact(input.pipelineRunId) || null,
    step_run_id: compact(input.stepRunId) || null,
    tool_id: compact(input.event.tool_id) || null,
    trace_id: compact(input.event.trace_id) || null,
    latency_ms: input.event.latency_ms,
    cost_usd: input.event.cost_usd,
    risk_level: input.event.risk_level,
    result: compact(input.event.result) || null,
  };

  const canUseFullEnvelope = await hasEventEnvelopeV2Columns();
  if (canUseFullEnvelope) {
    const { data, error } = await admin
      .from("event_log")
      .insert(fullRow)
      .select("*")
      .single();

    if (!error) return data;

    if (!compact(error.message).toLowerCase().includes("column")) {
      throw error;
    }
    eventEnvelopeColumnsCache = false;
  }

  const { data, error } = await admin
    .from("event_log")
    .insert({
      ...baseRow,
      user_id: compact(input.userId) || null,
      org_id: compact(input.orgId) || null,
      pipeline_run_id: compact(input.pipelineRunId) || null,
      step_run_id: compact(input.stepRunId) || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
