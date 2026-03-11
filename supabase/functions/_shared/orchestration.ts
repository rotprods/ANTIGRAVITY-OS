import { executeTriggeredWorkflows } from "./automation.ts";
import { compact } from "./http.ts";
import { admin } from "./supabase.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

export interface JsonRecord {
  [key: string]: unknown;
}

interface EventEnvelopeInput {
  eventType: string;
  payload?: JsonRecord;
  userId?: string | null;
  orgId?: string | null;
  sourceAgent?: string | null;
  pipelineRunId?: string | null;
  stepRunId?: string | null;
  correlationId?: string | null;
  status?: "emitted" | "processing" | "delivered" | "failed" | "dead_lettered";
  metadata?: JsonRecord;
}

interface CreatePipelineRunInput {
  templateCodeName: string;
  goal?: string | null;
  context?: JsonRecord;
  initiatedByUserId?: string | null;
  orgId?: string | null;
  source?: string;
  autoExecute?: boolean;
  authHeader?: string | null;
}

interface ExecutePipelineRunInput {
  pipelineRunId: string;
  authHeader?: string | null;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function nowIso() {
  return new Date().toISOString();
}

function pickSummary(payload: JsonRecord) {
  return compact(
    payload.summary ||
    payload.message ||
    payload.description ||
    payload.recommendation ||
    payload.goal ||
    payload.step_key,
  ) || "Pipeline context update";
}

function normalizeContext(context: JsonRecord | undefined, templateContext: unknown) {
  return {
    ...asRecord(templateContext),
    ...asRecord(context),
  };
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

export function eventMatchesPattern(pattern: string, eventType: string) {
  const normalizedPattern = compact(pattern);
  const normalizedType = compact(eventType);
  if (!normalizedPattern || !normalizedType) return false;
  if (normalizedPattern === normalizedType) return true;
  if (normalizedPattern.endsWith("*")) {
    return normalizedType.startsWith(normalizedPattern.slice(0, -1));
  }
  return false;
}

async function callEdgeFunction(
  functionName: string,
  payload: JsonRecord,
  authHeader?: string | null,
) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Supabase runtime env is not configured");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader || `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `${functionName} failed (${response.status})`);
  }

  return asRecord(data);
}

export async function emitSystemEvent(input: EventEnvelopeInput) {
  const resolvedOrgId = await resolveOrgId(input.orgId || null, input.userId || null);
  const insertRow = {
    event_type: input.eventType,
    payload: input.payload || {},
    user_id: input.userId || null,
    org_id: resolvedOrgId,
    source_agent: input.sourceAgent || null,
    pipeline_run_id: input.pipelineRunId || null,
    step_run_id: input.stepRunId || null,
    correlation_id: input.correlationId || null,
    status: input.status || "emitted",
    metadata: input.metadata || {},
  };

  const { data, error } = await admin
    .from("event_log")
    .insert(insertRow)
    .select()
    .single();

  if (error) throw error;
  return data as JsonRecord;
}

export async function recordMemoryEntry(input: {
  orgId?: string | null;
  userId?: string | null;
  agentCodeName?: string | null;
  scope: "task" | "shared_ops" | "long_term";
  namespace: string;
  entityType?: string | null;
  entityId?: string | null;
  pipelineRunId?: string | null;
  stepRunId?: string | null;
  correlationId?: string | null;
  summary?: string | null;
  content?: JsonRecord;
  importance?: number;
  expiresAt?: string | null;
}) {
  const resolvedOrgId = await resolveOrgId(input.orgId || null, input.userId || null);
  const { data, error } = await admin
    .from("memory_entries")
    .insert({
      org_id: resolvedOrgId,
      user_id: input.userId || null,
      agent_code_name: input.agentCodeName || null,
      scope: input.scope,
      namespace: input.namespace,
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
      pipeline_run_id: input.pipelineRunId || null,
      step_run_id: input.stepRunId || null,
      correlation_id: input.correlationId || null,
      summary: compact(input.summary) || null,
      content_json: input.content || {},
      importance: input.importance ?? 50,
      expires_at: input.expiresAt || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as JsonRecord;
}

async function loadPipelineTemplate(templateCodeName: string, orgId?: string | null) {
  if (compact(orgId)) {
    const { data, error } = await admin
      .from("pipeline_templates")
      .select("*")
      .eq("code_name", templateCodeName)
      .eq("org_id", compact(orgId))
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as JsonRecord;
  }

  const { data, error } = await admin
    .from("pipeline_templates")
    .select("*")
    .eq("code_name", templateCodeName)
    .is("org_id", null)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

async function loadPipelineTemplateSteps(templateId: string) {
  const { data, error } = await admin
    .from("pipeline_template_steps")
    .select("*")
    .eq("template_id", templateId)
    .order("step_number", { ascending: true });

  if (error) throw error;
  return (data || []) as JsonRecord[];
}

function unwrapStepOutput(value: unknown) {
  const record = asRecord(value);
  if (record.output && typeof record.output === "object" && record.output !== null) {
    return asRecord(record.output);
  }
  return record;
}

function mergeContextWithOutput(
  currentContext: JsonRecord,
  stepKey: string,
  rawOutput: JsonRecord,
) {
  const output = unwrapStepOutput(rawOutput);
  const stepOutputs = {
    ...asRecord(currentContext.step_outputs),
    [stepKey]: output,
  };

  const nextContext: JsonRecord = {
    ...currentContext,
    step_outputs: stepOutputs,
    last_step_key: stepKey,
    last_summary: pickSummary(output),
  };

  if (output.scan && typeof output.scan === "object") {
    const scan = asRecord(output.scan);
    if (compact(scan.id)) nextContext.scan_id = compact(scan.id);
  }

  if (compact(output.scan_id)) nextContext.scan_id = compact(output.scan_id);
  if (output.leads) nextContext.latest_leads = output.leads;
  if (output.shortlist) nextContext.shortlist = output.shortlist;
  if (output.stats) nextContext.stats = output.stats;
  if (output.emails) nextContext.outreach_emails = output.emails;
  if (compact(output.summary)) nextContext.summary = compact(output.summary);
  if (compact(output.recommendation)) nextContext.recommendation = compact(output.recommendation);

  return nextContext;
}

function buildStepPayload(run: JsonRecord, step: JsonRecord, stepRunId: string) {
  const inputMapping = asRecord(step.input_mapping);
  const context = asRecord(run.context);

  return {
    ...context,
    ...inputMapping,
    action: compact(step.action) || "cycle",
    user_id: compact(run.initiated_by_user_id) || null,
    org_id: compact(run.org_id) || null,
    pipeline_run_id: run.id,
    step_run_id: stepRunId,
    correlation_id: compact(run.correlation_id) || null,
    skip_telegram: true,
  };
}

async function updatePipelineRunState(pipelineRunId: string, patch: JsonRecord) {
  const { error } = await admin
    .from("pipeline_run_state")
    .update({
      ...patch,
      updated_at: nowIso(),
    })
    .eq("pipeline_run_id", pipelineRunId);

  if (error) throw error;
}

async function markDeliveryFailed(deliveryId: string, eventId: string, orgId: string | null, payload: JsonRecord, errorMessage: string) {
  await admin
    .from("event_deliveries")
    .update({
      status: "dead_lettered",
      last_error: errorMessage,
      last_attempt_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", deliveryId);

  await admin
    .from("event_dead_letters")
    .insert({
      delivery_id: deliveryId,
      event_id: eventId,
      org_id: orgId,
      reason: errorMessage,
      payload,
    });
}

export async function createPipelineRun(input: CreatePipelineRunInput) {
  const resolvedOrgId = await resolveOrgId(input.orgId || null, input.initiatedByUserId || null);
  const template = await loadPipelineTemplate(input.templateCodeName, resolvedOrgId);

  if (!template) {
    throw new Error(`Unknown pipeline template: ${input.templateCodeName}`);
  }

  const steps = await loadPipelineTemplateSteps(String(template.id));
  const correlationId = crypto.randomUUID();
  const runContext = normalizeContext(input.context, template.default_context);

  const { data: pipelineRun, error: pipelineRunError } = await admin
    .from("pipeline_runs")
    .insert({
      org_id: resolvedOrgId,
      template_id: template.id,
      initiated_by_user_id: input.initiatedByUserId || null,
      source: compact(input.source) || "copilot",
      goal: compact(input.goal) || compact(template.goal_prompt) || null,
      status: input.autoExecute === false ? "queued" : "running",
      current_step_number: 0,
      correlation_id: correlationId,
      context: runContext,
      result: {},
    })
    .select()
    .single();

  if (pipelineRunError) throw pipelineRunError;

  const { error: stateError } = await admin
    .from("pipeline_run_state")
    .insert({
      pipeline_run_id: pipelineRun.id,
      org_id: resolvedOrgId,
      metrics: {
        total_steps: steps.length,
        completed_steps: 0,
      },
    });

  if (stateError) throw stateError;

  await emitSystemEvent({
    eventType: "pipeline.created",
    payload: {
      template_code_name: input.templateCodeName,
      goal: compact(input.goal) || compact(template.goal_prompt),
      total_steps: steps.length,
    },
    userId: input.initiatedByUserId || null,
    orgId: resolvedOrgId,
    sourceAgent: "copilot",
    pipelineRunId: String(pipelineRun.id),
    correlationId,
  });

  if (input.autoExecute === false) {
    return {
      ok: true,
      pipeline_run: pipelineRun,
      template,
      steps,
      auto_executed: false,
    };
  }

  return executePipelineRun({
    pipelineRunId: String(pipelineRun.id),
    authHeader: input.authHeader,
  });
}

export async function executePipelineRun(input: ExecutePipelineRunInput) {
  const { data: pipelineRun, error: pipelineRunError } = await admin
    .from("pipeline_runs")
    .select("*, pipeline_templates(*)")
    .eq("id", input.pipelineRunId)
    .single();

  if (pipelineRunError) throw pipelineRunError;

  const template = asRecord(pipelineRun.pipeline_templates);
  const steps = await loadPipelineTemplateSteps(String(pipelineRun.template_id));
  const resolvedOrgId = compact(pipelineRun.org_id) || null;
  const userId = compact(pipelineRun.initiated_by_user_id) || null;
  let runContext = asRecord(pipelineRun.context);

  await admin
    .from("pipeline_runs")
    .update({
      status: "running",
      started_at: pipelineRun.started_at || nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", pipelineRun.id);

  await emitSystemEvent({
    eventType: "pipeline.started",
    payload: {
      template_code_name: compact(template.code_name),
      goal: compact(pipelineRun.goal),
    },
    userId,
    orgId: resolvedOrgId,
    sourceAgent: "cortex",
    pipelineRunId: String(pipelineRun.id),
    correlationId: compact(pipelineRun.correlation_id) || null,
  });

  for (const step of steps.filter((candidate) => Number(candidate.step_number) > Number(pipelineRun.current_step_number || 0))) {
    const startedAt = nowIso();
    const currentRun = {
      ...pipelineRun,
      context: runContext,
    };
    const { data: stepRun, error: stepRunError } = await admin
      .from("pipeline_step_runs")
      .insert({
        pipeline_run_id: pipelineRun.id,
        template_step_id: step.id,
        org_id: resolvedOrgId,
        step_number: step.step_number,
        step_key: step.step_key,
        agent_code_name: step.agent_code_name || null,
        action: step.action || null,
        status: "running",
        input: buildStepPayload(currentRun, step, crypto.randomUUID()),
        attempt_count: 1,
        started_at: startedAt,
      })
      .select()
      .single();

    if (stepRunError) throw stepRunError;

    const stepPayload = buildStepPayload(currentRun, step, String(stepRun.id));

    await updatePipelineRunState(String(pipelineRun.id), {
      current_agent: compact(step.agent_code_name) || null,
      waiting_for_event: compact(step.emits_event) || null,
      metrics: {
        total_steps: steps.length,
        running_step: step.step_key,
        completed_steps: Math.max(Number(step.step_number) - 1, 0),
      },
    });

    await emitSystemEvent({
      eventType: "pipeline.step.started",
      payload: {
        step_key: step.step_key,
        step_number: step.step_number,
        agent_code_name: step.agent_code_name || null,
      },
      userId,
      orgId: resolvedOrgId,
      sourceAgent: compact(step.agent_code_name) || "cortex",
      pipelineRunId: String(pipelineRun.id),
      stepRunId: String(stepRun.id),
      correlationId: compact(pipelineRun.correlation_id) || null,
    });

    try {
      let output: JsonRecord = {};

      if (step.step_type === "agent") {
        const functionName = compact(step.agent_code_name)
          ? `agent-${compact(step.agent_code_name)}`
          : "";
        if (!functionName) throw new Error(`Pipeline step ${step.step_key} has no agent_code_name`);
        output = await callEdgeFunction(functionName, stepPayload, input.authHeader);
      } else if (step.step_type === "workflow") {
        output = await callEdgeFunction("automation-runner", {
          action: "trigger",
          trigger_key: compact(step.action) || compact(step.step_key),
          context: stepPayload,
          source: "pipeline_run",
          send_live: false,
        }, input.authHeader);
      } else if (step.step_type === "event") {
        const emitted = await emitSystemEvent({
          eventType: compact(step.emits_event) || compact(step.action) || compact(step.step_key),
          payload: stepPayload,
          userId,
          orgId: resolvedOrgId,
          sourceAgent: "cortex",
          pipelineRunId: String(pipelineRun.id),
          stepRunId: String(stepRun.id),
          correlationId: compact(pipelineRun.correlation_id) || null,
        });
        output = { event: emitted };
      } else {
        output = { ok: true, skipped: true };
      }

      runContext = mergeContextWithOutput(runContext, compact(step.step_key), output);

      // Trim output for DB storage — keep summary, not full lead arrays
      const trimmedOutput = { ...output };
      if (Array.isArray(trimmedOutput.leads) && trimmedOutput.leads.length > 5) {
        trimmedOutput.leads_count = trimmedOutput.leads.length;
        trimmedOutput.leads = trimmedOutput.leads.slice(0, 5);
        trimmedOutput._truncated = true;
      }

      await admin
        .from("pipeline_step_runs")
        .update({
          status: "completed",
          output: trimmedOutput,
          completed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq("id", stepRun.id);

      await admin
        .from("pipeline_runs")
        .update({
          status: "running",
          current_step_number: step.step_number,
          context: runContext,
          updated_at: nowIso(),
        })
        .eq("id", pipelineRun.id);

      await updatePipelineRunState(String(pipelineRun.id), {
        current_agent: compact(step.agent_code_name) || null,
        waiting_for_event: null,
        metrics: {
          total_steps: steps.length,
          completed_steps: step.step_number,
          last_completed_step: step.step_key,
        },
      });

      // Memory + Events — non-critical, don't kill the pipeline on failure
      try {
        await recordMemoryEntry({
          orgId: resolvedOrgId,
          userId,
          agentCodeName: compact(step.agent_code_name) || "cortex",
          scope: "shared_ops",
          namespace: `pipeline:${compact(template.code_name) || "runtime"}`,
          entityType: "pipeline_run",
          entityId: String(pipelineRun.id),
          pipelineRunId: String(pipelineRun.id),
          stepRunId: String(stepRun.id),
          correlationId: compact(pipelineRun.correlation_id) || null,
          summary: pickSummary(unwrapStepOutput(output)),
          content: { summary: pickSummary(unwrapStepOutput(output)) },
          importance: 60,
        });
      } catch (_memErr) { /* non-critical */ }

      try {
        await emitSystemEvent({
          eventType: "pipeline.step.completed",
          payload: {
            step_key: step.step_key,
            step_number: step.step_number,
            agent_code_name: step.agent_code_name || null,
            result_summary: pickSummary(unwrapStepOutput(output)),
          },
          userId,
          orgId: resolvedOrgId,
          sourceAgent: compact(step.agent_code_name) || "cortex",
          pipelineRunId: String(pipelineRun.id),
          stepRunId: String(stepRun.id),
          correlationId: compact(pipelineRun.correlation_id) || null,
        });

        if (compact(step.emits_event)) {
          await emitSystemEvent({
            eventType: compact(step.emits_event),
            payload: {
              step_key: step.step_key,
              summary: pickSummary(unwrapStepOutput(output)),
            },
            userId,
            orgId: resolvedOrgId,
            sourceAgent: compact(step.agent_code_name) || "cortex",
            pipelineRunId: String(pipelineRun.id),
            stepRunId: String(stepRun.id),
            correlationId: compact(pipelineRun.correlation_id) || null,
          });
        }
      } catch (_evtErr) { /* non-critical */ }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error) || "Pipeline step failed";

      await admin
        .from("pipeline_step_runs")
        .update({
          status: "failed",
          error: message,
          completed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq("id", stepRun.id);

      await admin
        .from("pipeline_runs")
        .update({
          status: "failed",
          last_error: message,
          updated_at: nowIso(),
        })
        .eq("id", pipelineRun.id);

      await updatePipelineRunState(String(pipelineRun.id), {
        current_agent: compact(step.agent_code_name) || null,
        waiting_for_event: null,
        metrics: {
          total_steps: steps.length,
          failed_step: step.step_key,
          completed_steps: Math.max(Number(step.step_number) - 1, 0),
        },
      });

      await emitSystemEvent({
        eventType: compact(step.agent_code_name)
          ? "agent.error"
          : "pipeline.failed",
        payload: {
          step_key: step.step_key,
          step_number: step.step_number,
          agent_code_name: step.agent_code_name || null,
          error: message,
        },
        userId,
        orgId: resolvedOrgId,
        sourceAgent: compact(step.agent_code_name) || "cortex",
        pipelineRunId: String(pipelineRun.id),
        stepRunId: String(stepRun.id),
        correlationId: compact(pipelineRun.correlation_id) || null,
        status: "failed",
      });

      await emitSystemEvent({
        eventType: "pipeline.failed",
        payload: {
          step_key: step.step_key,
          error: message,
          template_code_name: compact(template.code_name),
        },
        userId,
        orgId: resolvedOrgId,
        sourceAgent: "cortex",
        pipelineRunId: String(pipelineRun.id),
        stepRunId: String(stepRun.id),
        correlationId: compact(pipelineRun.correlation_id) || null,
        status: "failed",
      });

      return {
        ok: false,
        pipeline_run_id: pipelineRun.id,
        status: "failed",
        error: message,
      };
    }
  }

  await admin
    .from("pipeline_runs")
    .update({
      status: "completed",
      result: {
        step_outputs: asRecord(runContext.step_outputs),
        summary: pickSummary(runContext),
      },
      completed_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", pipelineRun.id);

  await updatePipelineRunState(String(pipelineRun.id), {
    current_agent: null,
    waiting_for_event: null,
    metrics: {
      total_steps: steps.length,
      completed_steps: steps.length,
      status: "completed",
    },
  });

  await emitSystemEvent({
    eventType: "pipeline.completed",
    payload: {
      template_code_name: compact(template.code_name),
      total_steps: steps.length,
      summary: pickSummary(runContext),
    },
    userId,
    orgId: resolvedOrgId,
    sourceAgent: "cortex",
    pipelineRunId: String(pipelineRun.id),
    correlationId: compact(pipelineRun.correlation_id) || null,
    status: "delivered",
  });

  const { data: refreshedRun, error: refreshedRunError } = await admin
    .from("pipeline_runs")
    .select("*")
    .eq("id", pipelineRun.id)
    .single();

  if (refreshedRunError) throw refreshedRunError;

  const { data: stepRuns, error: stepRunsError } = await admin
    .from("pipeline_step_runs")
    .select("*")
    .eq("pipeline_run_id", pipelineRun.id)
    .order("step_number", { ascending: true });

  if (stepRunsError) throw stepRunsError;

  return {
    ok: true,
    status: "completed",
    pipeline_run: refreshedRun,
    steps: stepRuns || [],
  };
}

export async function getPipelineRunDetails(pipelineRunId: string) {
  const { data: pipelineRun, error: pipelineRunError } = await admin
    .from("pipeline_runs")
    .select("*, pipeline_templates(*)")
    .eq("id", pipelineRunId)
    .single();

  if (pipelineRunError) throw pipelineRunError;

  const { data: stepRuns, error: stepRunsError } = await admin
    .from("pipeline_step_runs")
    .select("*")
    .eq("pipeline_run_id", pipelineRunId)
    .order("step_number", { ascending: true });

  if (stepRunsError) throw stepRunsError;

  const { data: state, error: stateError } = await admin
    .from("pipeline_run_state")
    .select("*")
    .eq("pipeline_run_id", pipelineRunId)
    .maybeSingle();

  if (stateError) throw stateError;

  return {
    pipeline_run: pipelineRun,
    step_runs: stepRuns || [],
    state: state || null,
  };
}

export async function listRecentPipelineRuns(limit = 20) {
  const { data, error } = await admin
    .from("pipeline_runs")
    .select("*, pipeline_templates(name, code_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function deliverEventToSubscriptions(event: JsonRecord) {
  const eventType = compact(event.event_type);
  if (!eventType) return [];

  const { data, error } = await admin
    .from("event_subscriptions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const subscriptions = (data || []).filter((subscription) => {
    const sameOrg = !compact(subscription.org_id)
      || compact(subscription.org_id) === compact(event.org_id);
    return sameOrg && eventMatchesPattern(compact(subscription.event_pattern), eventType);
  });

  const results = [];

  for (const subscription of subscriptions) {
    const deliveryPayload = {
      event_type: eventType,
      payload: asRecord(event.payload),
      config: asRecord(subscription.config),
    };

    const { data: delivery, error: deliveryError } = await admin
      .from("event_deliveries")
      .insert({
        subscription_id: subscription.id,
        event_id: event.id,
        org_id: compact(event.org_id) || null,
        target_type: subscription.target_type,
        target_ref: subscription.target_ref,
        payload: deliveryPayload,
      })
      .select()
      .single();

    if (deliveryError) throw deliveryError;

    try {
      const subscriptionConfig = asRecord(subscription.config);
      let result: unknown = null;

      if (subscription.target_type === "agent") {
        const action = compact(subscriptionConfig.action) || "cycle";
        const invokeDirectly = subscription.delivery_mode === "sync" || subscriptionConfig.invoke === true;
        const payload = {
          ...asRecord(event.payload),
          action,
          user_id: compact(event.user_id) || null,
          org_id: compact(event.org_id) || null,
          source_event_id: event.id,
          source_event_type: eventType,
          correlation_id: compact(event.correlation_id) || null,
          skip_telegram: true,
        };

        if (invokeDirectly) {
          result = await callEdgeFunction(`agent-${compact(subscription.target_ref)}`, payload);
        } else {
          const { data: task, error: taskError } = await admin
            .from("agent_tasks")
            .insert({
              agent_code_name: compact(subscription.target_ref),
              type: eventType,
              title: `${eventType} subscription`,
              payload,
              status: "queued",
              created_by: "event_dispatcher",
            })
            .select()
            .single();

          if (taskError) throw taskError;
          result = task;
        }
      } else if (subscription.target_type === "workflow") {
        result = await executeTriggeredWorkflows({
          triggerKey: compact(subscription.target_ref) || eventType,
          userId: compact(event.user_id) || null,
          context: asRecord(event.payload),
          source: "event_subscription",
        });
      } else if (subscription.target_type === "pipeline") {
        result = await createPipelineRun({
          templateCodeName: compact(subscription.target_ref),
          goal: `Event trigger: ${eventType}`,
          context: asRecord(event.payload),
          initiatedByUserId: compact(event.user_id) || null,
          orgId: compact(event.org_id) || null,
          source: "event_subscription",
          autoExecute: subscriptionConfig.auto_execute !== false,
        });
      } else if (subscription.target_type === "webhook") {
        const webhookUrl = compact(subscriptionConfig.webhook_url) || compact(subscription.target_ref);
        if (!webhookUrl) {
          throw new Error(`Missing webhook url for subscription ${subscription.id}`);
        }
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
        result = {
          ok: response.ok,
          status: response.status,
        };
        if (!response.ok) {
          throw new Error(`Webhook failed (${response.status})`);
        }
      }

      const deliveredAt = nowIso();
      await admin
        .from("event_deliveries")
        .update({
          status: "delivered",
          attempt_count: (delivery.attempt_count || 0) + 1,
          last_attempt_at: deliveredAt,
          delivered_at: deliveredAt,
          payload: {
            ...deliveryPayload,
            result,
          },
          updated_at: deliveredAt,
        })
        .eq("id", delivery.id);

      results.push({
        subscription_id: subscription.id,
        event_type: eventType,
        target_type: subscription.target_type,
        target_ref: subscription.target_ref,
        status: "delivered",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Event delivery failed";
      await markDeliveryFailed(
        String(delivery.id),
        String(event.id),
        compact(event.org_id) || null,
        deliveryPayload,
        message,
      );

      results.push({
        subscription_id: subscription.id,
        event_type: eventType,
        target_type: subscription.target_type,
        target_ref: subscription.target_ref,
        status: "dead_lettered",
        error: message,
      });
    }
  }

  return results;
}
