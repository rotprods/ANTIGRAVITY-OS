import { resolveMessagingChannel } from "./channels.ts";
import { compact } from "./http.ts";
import { admin } from "./supabase.ts";
import { normalizePhone } from "./whatsapp.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray<T = JsonRecord>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function encodeQuery(value: string | null | undefined) {
  return encodeURIComponent(compact(value));
}

function mergeRecords(...records: Array<unknown>) {
  return records.reduce<JsonRecord>((acc, record) => ({ ...acc, ...asRecord(record) }), {});
}

function getFirstCompact(...values: Array<unknown>) {
  for (const value of values) {
    const normalized = compact(value);
    if (normalized) return normalized;
  }

  return "";
}

function normalizeRiskClass(value: unknown): "low" | "medium" | "high" | "critical" {
  const normalized = compact(value).toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function isHighRisk(riskClass: "low" | "medium" | "high" | "critical") {
  return riskClass === "high" || riskClass === "critical";
}

function extractControlPlaneDispatchResult(controlPlaneDispatch: JsonRecord, fallbackCorrelationId: string | null) {
  const controlPlaneData = asRecord(controlPlaneDispatch.data);
  const dispatchResult = asRecord(controlPlaneData.dispatch_result);
  if (Object.keys(dispatchResult).length === 0) {
    return controlPlaneDispatch;
  }

  return {
    ...dispatchResult,
    control_plane: {
      action: compact(controlPlaneDispatch.action) || "tool_dispatch",
      trace_id: compact(controlPlaneDispatch.trace_id) || null,
      correlation_id: compact(controlPlaneDispatch.correlation_id) || fallbackCorrelationId,
    },
  };
}

function inferWorkflowSteps(workflow: JsonRecord) {
  const steps = asArray<JsonRecord>(workflow.steps);
  if (steps.length > 0) return steps;

  return asArray<JsonRecord>(workflow.actions).map((action, index) => ({
    id: compact(action.id) || `legacy-${index + 1}`,
    type: compact(action.type) || compact(action),
    config: asRecord(action.config),
  }));
}

async function callEdgeFunction(
  endpoint: string,
  payload: JsonRecord,
  authHeader?: string | null,
) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase runtime env is not configured");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader || `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `${endpoint} failed (${response.status})`);
  }

  return data as JsonRecord;
}

async function loadScopedWorkflow(workflowId: string, userId?: string | null) {
  if (userId) {
    const { data, error } = await admin
      .from("automation_workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as JsonRecord;
  }

  const { data, error } = await admin
    .from("automation_workflows")
    .select("*")
    .eq("id", workflowId)
    .is("user_id", null)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

async function listTriggeredWorkflows(triggerKey: string, userId?: string | null) {
  const fetchScoped = async (scopeUserId: string | null) => {
    let query = admin
      .from("automation_workflows")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    query = scopeUserId ? query.eq("user_id", scopeUserId) : query.is("user_id", null);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as JsonRecord[];
  };

  const scoped = userId ? await fetchScoped(userId) : [];
  const global = await fetchScoped(null);

  return [...scoped, ...global.filter(candidate => !scoped.some(row => row.id === candidate.id))]
    .filter(workflow => compact(asRecord(workflow.trigger_config).key || workflow.trigger_type) === triggerKey);
}

async function loadContact(contactId?: string | null) {
  if (!contactId) return null;
  const { data, error } = await admin
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

async function loadCompany(companyId?: string | null) {
  if (!companyId) return null;
  const { data, error } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

async function loadAgentRegistryRow(codeName?: string | null) {
  const normalizedCodeName = compact(codeName);
  if (!normalizedCodeName) return null;

  const { data, error } = await admin
    .from("agent_registry")
    .select("code_name, config")
    .eq("code_name", normalizedCodeName)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

async function loadConversation(conversationId?: string | null) {
  if (!conversationId) return null;
  const { data, error } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

async function loadMessage(messageId?: string | null) {
  if (!messageId) return null;
  const { data, error } = await admin
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  if (error) throw error;
  return data as JsonRecord | null;
}

function resolveWorkflowAgentCodeName(step: JsonRecord, workflow: JsonRecord, context: JsonRecord) {
  const stepConfig = asRecord(step.config);
  const workflowMetadata = asRecord(workflow.metadata);
  const workflowTriggerConfig = asRecord(workflow.trigger_config);
  const workflowSteps = inferWorkflowSteps(workflow);
  const agentStep = workflowSteps.find(candidate => compact(candidate.type) === "run_agent");
  const agentStepConfig = asRecord(agentStep?.config);

  return getFirstCompact(
    stepConfig.agentCodeName,
    stepConfig.agent_code_name,
    workflowMetadata.agentCodeName,
    workflowMetadata.agent_code_name,
    workflowTriggerConfig.agentCodeName,
    workflowTriggerConfig.agent_code_name,
    agentStepConfig.agentCodeName,
    agentStepConfig.agent_code_name,
    context.agentCodeName,
    context.agent_code_name,
    context.agent,
  ) || null;
}

async function resolveN8nWebhook(step: JsonRecord, workflow: JsonRecord, context: JsonRecord) {
  const stepConfig = asRecord(step.config);
  const workflowMetadata = asRecord(workflow.metadata);
  const workflowTriggerConfig = asRecord(workflow.trigger_config);
  const agentCodeName = resolveWorkflowAgentCodeName(step, workflow, context);

  const explicitWebhookUrl = getFirstCompact(
    stepConfig.n8nWebhookUrl,
    stepConfig.n8n_webhook_url,
    stepConfig.webhookUrl,
    stepConfig.webhook_url,
    workflowMetadata.n8nWebhookUrl,
    workflowMetadata.n8n_webhook_url,
    workflowMetadata.webhookUrl,
    workflowMetadata.webhook_url,
    workflowTriggerConfig.n8nWebhookUrl,
    workflowTriggerConfig.n8n_webhook_url,
    workflowTriggerConfig.webhookUrl,
    workflowTriggerConfig.webhook_url,
    context.n8nWebhookUrl,
    context.n8n_webhook_url,
    context.webhookUrl,
    context.webhook_url,
  );

  if (explicitWebhookUrl) {
    return {
      url: explicitWebhookUrl,
      source: "workflow",
      agentCodeName,
    };
  }

  if (agentCodeName) {
    const envWebhookUrl = getFirstCompact(
      Deno.env.get(`N8N_${agentCodeName.toUpperCase()}_WEBHOOK_URL`),
      Deno.env.get(`N8N_WEBHOOK_URL_${agentCodeName.toUpperCase()}`),
    );

    if (envWebhookUrl) {
      return {
        url: envWebhookUrl,
        source: "agent_env",
        agentCodeName,
      };
    }

    const agentRow = await loadAgentRegistryRow(agentCodeName);
    const agentConfig = asRecord(agentRow?.config);
    const agentWebhookUrl = getFirstCompact(
      agentConfig.n8nWebhookUrl,
      agentConfig.n8n_webhook_url,
      agentConfig.webhookUrl,
      agentConfig.webhook_url,
    );

    if (agentWebhookUrl) {
      return {
        url: agentWebhookUrl,
        source: "agent_registry",
        agentCodeName,
      };
    }
  }

  if (n8nWebhookUrl) {
    return {
      url: n8nWebhookUrl,
      source: "env_default",
      agentCodeName,
    };
  }

  return {
    url: "",
    source: "missing",
    agentCodeName,
  };
}

async function ensureConversation({
  userId,
  conversationId,
  contact,
  company,
  channel,
  channelId,
}: {
  userId: string | null;
  conversationId?: string | null;
  contact: JsonRecord | null;
  company: JsonRecord | null;
  channel: string;
  channelId?: string | null;
}) {
  if (conversationId) {
    const existing = await loadConversation(conversationId);
    if (existing) return existing;
  }

  if (!contact?.id) {
    throw new Error("compose_message requires a contact or conversation");
  }

  let query = admin
    .from("conversations")
    .select("*")
    .eq("contact_id", contact.id)
    .eq("channel", channel)
    .limit(1);

  query = userId ? query.eq("user_id", userId) : query.is("user_id", null);

  const { data, error } = await query;
  if (error) throw error;
  if (data?.[0]) return data[0] as JsonRecord;

  const { data: created, error: insertError } = await admin
    .from("conversations")
    .insert({
      user_id: userId,
      contact_id: contact.id,
      company_id: company?.id || contact.company_id || null,
      channel,
      channel_id: channelId || null,
      external_id: `${channel}:${contact.id}`,
      status: "pending",
      assigned_to: "Automation",
      last_message_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created as JsonRecord;
}

function buildLaunchUrl(channel: string, {
  contact,
  company,
  subject,
  body,
}: {
  contact: JsonRecord | null;
  company: JsonRecord | null;
  subject?: string | null;
  body: string;
}) {
  if (channel === "email" && compact(contact?.email)) {
    return `mailto:${encodeQuery(contact.email as string)}?subject=${encodeQuery(subject)}&body=${encodeQuery(body)}`;
  }

  if (channel === "whatsapp" && compact(contact?.phone)) {
    return `https://wa.me/${normalizePhone(contact.phone as string)}?text=${encodeQuery(body)}`;
  }

  if (channel === "linkedin") {
    const searchTarget = compact(company?.name) || compact(contact?.name);
    return compact(contact?.linkedin_url) || `https://www.linkedin.com/search/results/all/?keywords=${encodeQuery(searchTarget)}`;
  }

  if (channel === "instagram") {
    const socialProfiles = mergeRecords(contact?.social_profiles, company?.social_profiles);
    return compact(socialProfiles.instagram) || "https://www.instagram.com/direct/inbox/";
  }

  return null;
}

async function insertActivity({
  userId,
  contact,
  company,
  conversation,
  type,
  subject,
  description,
  metadata,
}: {
  userId: string | null;
  contact: JsonRecord | null;
  company: JsonRecord | null;
  conversation: JsonRecord | null;
  type: string;
  subject: string;
  description?: string | null;
  metadata?: JsonRecord;
}) {
  const { data, error } = await admin
    .from("crm_activities")
    .insert({
      user_id: userId,
      contact_id: contact?.id || null,
      company_id: company?.id || contact?.company_id || null,
      conversation_id: conversation?.id || null,
      type,
      subject,
      description: description || null,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as JsonRecord;
}

async function executeComposeStep({
  step,
  workflow,
  context,
  authHeader,
  sendLive,
}: {
  step: JsonRecord;
  workflow: JsonRecord;
  context: JsonRecord;
  authHeader?: string | null;
  sendLive: boolean;
}) {
  const config = asRecord(step.config);
  const userId = compact(workflow.user_id) || compact(context.user_id) || null;
  const channel = compact(config.channel) || compact(context.channel) || "email";
  const contactId = compact(config.contact_id) || compact(context.contact_id) || compact(asRecord(context.contact).id) || null;
  const companyId = compact(config.company_id) || compact(context.company_id) || compact(asRecord(context.company).id) || null;
  const conversationId = compact(config.conversation_id) || compact(context.conversation_id) || null;
  const messageId = compact(config.message_id) || compact(context.message_id) || null;
  const existingMessage = await loadMessage(messageId);
  const existingMetadata = asRecord(existingMessage?.metadata);
  const contact = await loadContact(contactId || compact(existingMetadata.contact_id) || null);
  const company = await loadCompany(companyId || compact(contact?.company_id) || null);
  const activeChannel = ["email", "whatsapp"].includes(channel)
    ? await resolveMessagingChannel(channel, userId, compact(config.channel_id) || compact(context.channel_id) || null, ["active", "connecting"])
    : null;
  const conversation = await ensureConversation({
    userId,
    conversationId: conversationId || compact(existingMessage?.conversation_id) || null,
    contact,
    company,
    channel,
    channelId: activeChannel?.id || compact(config.channel_id) || null,
  });

  const body = compact(config.body) || compact(context.body) || compact(existingMessage?.content);
  const subject = compact(config.subject) || compact(context.subject) || compact(existingMessage?.subject) || null;
  if (!body) {
    throw new Error("compose_message requires a body");
  }

  const launchUrl = compact(config.launch_url) || buildLaunchUrl(channel, {
    contact,
    company,
    subject,
    body,
  });

  const payload = {
    user_id: userId,
    conversation_id: conversation.id,
    channel_id: activeChannel?.id || conversation.channel_id || null,
    direction: "outbound",
    content: body,
    subject,
    content_type: "text",
    status: "draft",
    metadata: {
      ...existingMetadata,
      channel,
      launch_url: launchUrl || null,
      contact_id: contact?.id || null,
      company_id: company?.id || null,
      company_name: compact(company?.name) || null,
      email: compact(contact?.email) || null,
      phone: compact(contact?.phone) || null,
    },
  };

  const message = existingMessage
    ? await admin
      .from("messages")
      .update(payload)
      .eq("id", existingMessage.id)
      .select()
      .single()
      .then(result => {
        if (result.error) throw result.error;
        return result.data as JsonRecord;
      })
    : await admin
      .from("messages")
      .insert(payload)
      .select()
      .single()
      .then(result => {
        if (result.error) throw result.error;
        return result.data as JsonRecord;
      });

  await admin
    .from("conversations")
    .update({
      user_id: userId,
      channel,
      channel_id: activeChannel?.id || conversation.channel_id || null,
      status: sendLive && ["email", "whatsapp"].includes(channel) ? "sent" : "pending",
      last_message_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  let dispatch = null;
  if (sendLive && ["email", "whatsapp"].includes(channel)) {
    const correlationId = getFirstCompact(
      asRecord(context.trace).correlation_id,
      context.correlation_id,
      asRecord(context.metadata).correlation_id,
    ) || null;
    const orgId = getFirstCompact(
      workflow.org_id,
      context.org_id,
      asRecord(context.trace).org_id,
    ) || null;
    const workflowAgentCodeName = resolveWorkflowAgentCodeName(step, workflow, context) || "outreach";

    const controlPlaneDispatch = await callEdgeFunction("control-plane", {
      action: "tool_dispatch",
      org_id: orgId,
      user_id: userId,
      source_agent: workflowAgentCodeName,
      source: "automation_workflow",
      target_type: "agent_action",
      target_ref: "messaging-dispatch",
      risk_class: "high",
      correlation_id: correlationId,
      context: {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        workflow_step_id: compact(step.id) || null,
        channel,
        send_live: true,
      },
      tool_code_name: "messaging-dispatch",
      payload: {
        message_id: message.id,
        conversation_id: conversation.id,
        channel,
        subject,
        body,
        metadata: {
          launch_url: launchUrl || null,
          source: "automation_workflow",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          workflow_step_id: compact(step.id) || null,
          risk_class: "high",
        },
      },
    }, authHeader || null);

    dispatch = extractControlPlaneDispatchResult(controlPlaneDispatch, correlationId);
  }

  const dispatchStatus = compact(asRecord(dispatch).status).toLowerCase();
  const workflowStatus = dispatchStatus === "waiting_approval"
    ? "awaiting_approval"
    : dispatch
      ? "sent"
      : "drafted";

  return {
    status: workflowStatus,
    channel,
    conversation_id: conversation.id,
    message_id: message.id,
    launch_url: launchUrl || null,
    dispatch,
  };
}

async function executeActivityStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord) {
  const config = asRecord(step.config);
  const contact = await loadContact(compact(config.contact_id) || compact(context.contact_id) || null);
  const company = await loadCompany(compact(config.company_id) || compact(context.company_id) || compact(contact?.company_id) || null);
  const conversation = await loadConversation(compact(config.conversation_id) || compact(context.conversation_id) || null);

  const activity = await insertActivity({
    userId: compact(workflow.user_id) || compact(context.user_id) || null,
    contact,
    company,
    conversation,
    type: compact(config.type) || "note",
    subject: compact(config.subject) || compact(workflow.name) || "Automation activity",
    description: compact(config.description) || compact(context.description) || null,
    metadata: mergeRecords(config.metadata, {
      workflow_id: workflow.id,
      step_id: compact(step.id) || null,
    }),
  });

  return {
    status: "logged",
    activity_id: activity.id,
  };
}

async function executeCreateDealStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord) {
  const config = asRecord(step.config);
  const contact = await loadContact(compact(config.contact_id) || compact(context.contact_id) || null);
  const company = await loadCompany(compact(config.company_id) || compact(context.company_id) || compact(contact?.company_id) || null);

  const { data, error } = await admin
    .from("deals")
    .insert({
      user_id: compact(workflow.user_id) || compact(context.user_id) || null,
      company_id: company?.id || null,
      contact_id: contact?.id || null,
      title: compact(config.title) || `Opportunity · ${compact(company?.name) || compact(contact?.name) || "Lead"}`,
      company: compact(company?.name) || null,
      value: Number(config.value || context.estimated_deal_value || 0) || 0,
      stage: compact(config.stage) || "lead",
      probability: Number(config.probability || 20) || 20,
      notes: compact(config.notes) || compact(context.notes) || null,
      owner: compact(config.owner) || "Automation",
    })
    .select()
    .single();

  if (error) throw error;

  return {
    status: "created",
    deal_id: data.id,
  };
}

async function executeUpdateContactStep(step: JsonRecord, context: JsonRecord) {
  const config = asRecord(step.config);
  const updates = mergeRecords(config.updates, asRecord(context.contact_updates));
  const contactId = compact(config.contact_id) || compact(context.contact_id) || null;

  if (!contactId) {
    throw new Error("update_contact requires contact_id");
  }

  const { data, error } = await admin
    .from("contacts")
    .update({
      ...updates,
      status: compact(updates.status) || "contacted",
    })
    .eq("id", contactId)
    .select()
    .single();

  if (error) throw error;

  return {
    status: "updated",
    contact_id: data.id,
  };
}

async function executeConnectorStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord, authHeader?: string | null) {
  const config = asRecord(step.config);
  if (!authHeader) {
    throw new Error("run_connector requires an authenticated session");
  }

  const connectorId = compact(config.connectorId) || compact(config.connector_id);
  if (!connectorId) {
    throw new Error("run_connector requires connectorId");
  }

  const healthcheck = Boolean(config.healthcheck);
  const { data: connector, error: connectorError } = await admin
    .from("api_connectors")
    .select("id,health_status,is_active")
    .eq("id", connectorId)
    .maybeSingle();

  if (connectorError) throw connectorError;
  if (!connector) {
    throw new Error("run_connector target connector was not found");
  }
  if (!connector.is_active) {
    throw new Error("run_connector target connector is disabled");
  }
  if (!healthcheck && compact(connector.health_status) !== "live") {
    throw new Error("run_connector target connector is not live");
  }

  const riskClass = normalizeRiskClass(
    config.risk_class
      || config.risk_level
      || context.risk_class
      || context.risk_level
      || "medium",
  );
  const correlationId = getFirstCompact(
    asRecord(context.trace).correlation_id,
    context.correlation_id,
    asRecord(context.metadata).correlation_id,
  ) || null;
  const orgId = getFirstCompact(
    workflow.org_id,
    context.org_id,
    asRecord(context.trace).org_id,
  ) || null;
  const workflowAgentCodeName = resolveWorkflowAgentCodeName(step, workflow, context) || "outreach";
  const dispatchPayload = {
    connector_id: connectorId,
    endpoint_name: compact(config.endpointName) || compact(config.endpoint_name) || null,
    params: mergeRecords(config.params, asRecord(context.params)),
    body: mergeRecords(config.body, asRecord(context.body_payload)),
    healthcheck,
    risk_class: riskClass,
    metadata: {
      source: "automation_workflow",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      workflow_step_id: compact(step.id) || null,
      connector_id: connectorId,
      endpoint_name: compact(config.endpointName) || compact(config.endpoint_name) || null,
      risk_class: riskClass,
    },
  };

  if (!isHighRisk(riskClass)) {
    return await callEdgeFunction("api-proxy", dispatchPayload, authHeader);
  }

  const controlPlaneDispatch = await callEdgeFunction("control-plane", {
    action: "tool_dispatch",
    org_id: orgId,
    user_id: compact(workflow.user_id) || compact(context.user_id) || null,
    source_agent: workflowAgentCodeName,
    source: "automation_workflow",
    target_type: "agent_action",
    target_ref: "api-proxy",
    risk_class: riskClass,
    correlation_id: correlationId,
    context: {
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      workflow_step_id: compact(step.id) || null,
      connector_id: connectorId,
      endpoint_name: compact(config.endpointName) || compact(config.endpoint_name) || null,
      high_risk_legacy_reroute: true,
    },
    tool_code_name: "api-proxy",
    function_name: "api-proxy",
    payload: dispatchPayload,
  }, authHeader || null);

  return extractControlPlaneDispatchResult(controlPlaneDispatch, correlationId);
}

async function executeApiStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord, authHeader?: string | null) {
  const config = asRecord(step.config);
  const endpoint = compact(config.endpoint);
  if (!endpoint) {
    throw new Error("run_api requires endpoint");
  }

  const riskClass = normalizeRiskClass(
    config.risk_class
      || config.risk_level
      || context.risk_class
      || context.risk_level
      || "medium",
  );
  const correlationId = getFirstCompact(
    asRecord(context.trace).correlation_id,
    context.correlation_id,
    asRecord(context.metadata).correlation_id,
  ) || null;
  const orgId = getFirstCompact(
    workflow.org_id,
    context.org_id,
    asRecord(context.trace).org_id,
  ) || null;
  const workflowAgentCodeName = resolveWorkflowAgentCodeName(step, workflow, context) || "outreach";
  const dispatchPayload = mergeRecords(config.payload, context, {
    user_id: compact(workflow.user_id) || compact(context.user_id) || null,
    risk_class: riskClass,
    metadata: {
      source: "automation_workflow",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      workflow_step_id: compact(step.id) || null,
      endpoint,
      risk_class: riskClass,
    },
  });

  if (!isHighRisk(riskClass)) {
    return await callEdgeFunction(endpoint, dispatchPayload, authHeader || null);
  }

  const controlPlaneDispatch = await callEdgeFunction("control-plane", {
    action: "tool_dispatch",
    org_id: orgId,
    user_id: compact(workflow.user_id) || compact(context.user_id) || null,
    source_agent: workflowAgentCodeName,
    source: "automation_workflow",
    target_type: "agent_action",
    target_ref: endpoint,
    risk_class: riskClass,
    correlation_id: correlationId,
    context: {
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      workflow_step_id: compact(step.id) || null,
      endpoint,
      high_risk_legacy_reroute: true,
    },
    tool_code_name: endpoint,
    function_name: endpoint,
    payload: dispatchPayload,
  }, authHeader || null);

  return extractControlPlaneDispatchResult(controlPlaneDispatch, correlationId);
}

async function executeAgentStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord, authHeader?: string | null) {
  const config = asRecord(step.config);
  const agentCodeName = compact(config.agentCodeName);
  if (!agentCodeName) {
    throw new Error("run_agent requires agentCodeName");
  }

  return await callEdgeFunction(`agent-${agentCodeName}`, mergeRecords({
    action: compact(config.action) || "cycle",
  }, config.payload, context, {
    user_id: compact(workflow.user_id) || compact(context.user_id) || null,
  }), authHeader || null);
}

async function executeNotifyStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord) {
  const config = asRecord(step.config);
  const activity = await insertActivity({
    userId: compact(workflow.user_id) || compact(context.user_id) || null,
    contact: await loadContact(compact(context.contact_id) || null),
    company: await loadCompany(compact(context.company_id) || null),
    conversation: await loadConversation(compact(context.conversation_id) || null),
    type: "note",
    subject: compact(config.subject) || `Automation notification · ${compact(workflow.name)}`,
    description: compact(config.message) || compact(context.message) || "Automation notification emitted.",
    metadata: mergeRecords(config.metadata, {
      workflow_id: workflow.id,
      step_id: compact(step.id) || null,
    }),
  });

  return {
    status: "logged",
    activity_id: activity.id,
  };
}

async function executeN8nStep(step: JsonRecord, workflow: JsonRecord, context: JsonRecord) {
  const config = asRecord(step.config);
  const template = {
    id: compact(config.workflowTemplate) || null,
    label: compact(config.workflowTemplateLabel) || compact(config.workflowTemplate) || null,
    page_url: compact(config.workflowTemplateUrl) || null,
    download_url: compact(config.workflowTemplateDownloadUrl) || null,
    source: compact(config.workflowTemplateSource) || null,
  };
  const webhookTarget = await resolveN8nWebhook(step, workflow, context);

  if (!webhookTarget.url) {
    return {
      status: "skipped",
      reason: "No n8n webhook is configured for this workflow",
      template,
      agent_code_name: webhookTarget.agentCodeName,
      webhook_source: webhookTarget.source,
    };
  }

  const response = await fetch(webhookTarget.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      workflow_trigger: getFirstCompact(asRecord(workflow.trigger_config).key, workflow.trigger_type) || null,
      workflow_metadata: asRecord(workflow.metadata),
      step_id: compact(step.id) || null,
      step_type: compact(step.type) || "launch_n8n",
      step_config: config,
      agent_code_name: webhookTarget.agentCodeName,
      template,
      context,
    }),
  });

  if (!response.ok) {
    throw new Error(`n8n webhook failed (${response.status})`);
  }

  const data = await response.json().catch(() => ({}));
  return {
    status: "sent",
    template,
    agent_code_name: webhookTarget.agentCodeName,
    webhook_source: webhookTarget.source,
    webhook: data,
  };
}

async function executeStep({
  step,
  workflow,
  context,
  authHeader,
  sendLive,
}: {
  step: JsonRecord;
  workflow: JsonRecord;
  context: JsonRecord;
  authHeader?: string | null;
  sendLive: boolean;
}) {
  const type = compact(step.type);

  switch (type) {
    case "compose_message":
      return await executeComposeStep({ step, workflow, context, authHeader, sendLive });
    case "crm_activity":
      return await executeActivityStep(step, workflow, context);
    case "create_deal":
      return await executeCreateDealStep(step, workflow, context);
    case "update_contact":
      return await executeUpdateContactStep(step, context);
    case "run_connector":
      return await executeConnectorStep(step, workflow, context, authHeader);
    case "run_api":
      return await executeApiStep(step, workflow, context, authHeader);
    case "run_agent":
      return await executeAgentStep(step, workflow, context, authHeader);
    case "notify":
      return await executeNotifyStep(step, workflow, context);
    case "launch_n8n":
      return await executeN8nStep(step, workflow, context);
    default:
      return {
        status: "skipped",
        reason: `Unsupported step type: ${type || "unknown"}`,
      };
  }
}

async function updateRun(runId: string, updates: JsonRecord) {
  const { data, error } = await admin
    .from("automation_runs")
    .update(updates)
    .eq("id", runId)
    .select()
    .single();

  if (error) throw error;
  return data as JsonRecord;
}

async function finalizeWorkflowRun(workflow: JsonRecord, status: string) {
  await admin
    .from("automation_workflows")
    .update({
      run_count: Number(workflow.run_count || 0) + 1,
      last_run_at: new Date().toISOString(),
      metadata: {
        ...(asRecord(workflow.metadata)),
        last_run_status: status,
      },
    })
    .eq("id", workflow.id);
}

export async function executeWorkflow({
  workflow,
  context = {},
  authHeader = null,
  sendLive = false,
  source = "manual",
}: {
  workflow: JsonRecord;
  context?: JsonRecord;
  authHeader?: string | null;
  sendLive?: boolean;
  source?: string;
}) {
  const steps = inferWorkflowSteps(workflow);
  const initialResult = {
    source,
    trigger: compact(asRecord(workflow.trigger_config).key || workflow.trigger_type) || "manual",
    send_live: sendLive,
    steps: [],
    context,
  };

  const { data: run, error: runError } = await admin
    .from("automation_runs")
    .insert({
      workflow_id: workflow.id,
      status: "running",
      result: initialResult,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError) throw runError;

  const stepResults: JsonRecord[] = [];

  try {
    for (const step of steps) {
      const output = await executeStep({
        step,
        workflow,
        context,
        authHeader,
        sendLive,
      });

      stepResults.push({
        id: compact(step.id) || crypto.randomUUID(),
        type: compact(step.type),
        status: compact(asRecord(output).status) || "completed",
        output,
      });

      await updateRun(String(run.id), {
        result: {
          ...initialResult,
          steps: stepResults,
        },
      });
    }

    const completed = await updateRun(String(run.id), {
      status: "completed",
      completed_at: new Date().toISOString(),
      result: {
        ...initialResult,
        steps: stepResults,
      },
      error: null,
    });

    await finalizeWorkflowRun(workflow, "completed");

    return {
      workflow_id: workflow.id,
      run: completed,
      steps: stepResults,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow execution failed";
    stepResults.push({
      id: crypto.randomUUID(),
      status: "failed",
      error: message,
    });

    const failed = await updateRun(String(run.id), {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: message,
      result: {
        ...initialResult,
        steps: stepResults,
      },
    });

    await finalizeWorkflowRun(workflow, "failed");
    return {
      workflow_id: workflow.id,
      run: failed,
      steps: stepResults,
      error: message,
    };
  }
}

export async function executeTriggeredWorkflows({
  triggerKey,
  workflowId,
  userId = null,
  context = {},
  authHeader = null,
  sendLive = false,
  source = "trigger",
}: {
  triggerKey?: string | null;
  workflowId?: string | null;
  userId?: string | null;
  context?: JsonRecord;
  authHeader?: string | null;
  sendLive?: boolean;
  source?: string;
}) {
  const workflows = workflowId
    ? [await loadScopedWorkflow(workflowId, userId)].filter(Boolean) as JsonRecord[]
    : await listTriggeredWorkflows(compact(triggerKey), userId);

  const results = [];

  for (const workflow of workflows) {
    const execution = await executeWorkflow({
      workflow,
      context,
      authHeader,
      sendLive,
      source,
    });
    results.push(execution);
  }

  return {
    workflows: workflows.length,
    runs: results,
  };
}
