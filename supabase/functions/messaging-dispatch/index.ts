import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { resolveMessagingChannel } from "../_shared/channels.ts";
import { sendGmailMessage } from "../_shared/gmail.ts";
import { compact, errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { collectMessagingRuntimeStatus } from "../_shared/provider-runtime.ts";
import { admin, getAuthUser } from "../_shared/supabase.ts";
import { normalizePhone, sendWhatsAppText } from "../_shared/whatsapp.ts";

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const LEGACY_HIGH_RISK_SOURCES = new Set([
  "automation",
  "automation_ui",
  "automation_trigger",
  "automation_workflow",
  "event_dispatcher",
  "manual",
]);

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

function resolveDispatchRiskClass(body: Record<string, unknown>, existingMetadata: Record<string, unknown>) {
  const policy = asRecord(body.policy);
  const metadata = asRecord(body.metadata);
  const route = asRecord(metadata.route);

  return normalizeRiskClass(
    body.risk_class
      || body.risk_level
      || policy.risk_class
      || policy.risk_level
      || metadata.risk_class
      || metadata.risk_level
      || route.risk_class
      || existingMetadata.risk_class
      || existingMetadata.risk_level
      || "high",
  );
}

function resolveDispatchSource(body: Record<string, unknown>, existingMetadata: Record<string, unknown>) {
  const metadata = asRecord(body.metadata);
  const route = asRecord(metadata.route);
  return compact(
    metadata.source
      || route.source
      || body.source
      || existingMetadata.source
      || "manual",
  ).toLowerCase();
}

async function hasToolBusInvocationEvidence(correlationId: string) {
  const normalizedCorrelationId = compact(correlationId);
  if (!normalizedCorrelationId) return false;

  const { count, error } = await admin
    .from("event_log")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "tool_bus.invocation")
    .eq("correlation_id", normalizedCorrelationId)
    .contains("metadata", { tool_code_name: "messaging-dispatch" });

  if (error) {
    console.error("[messaging-dispatch] unable to verify tool-bus evidence", error);
    return false;
  }

  return Number(count || 0) > 0;
}

function inferChannelType({
  explicit,
  message,
  conversation,
  channel,
}: {
  explicit?: string | null;
  message?: Record<string, unknown> | null;
  conversation?: Record<string, unknown> | null;
  channel?: Record<string, unknown> | null;
}) {
  return compact(explicit)
    || compact(channel?.type)
    || compact(message?.metadata?.channel)
    || compact(conversation?.channel)
    || (compact(conversation?.external_id).includes(":") ? compact(conversation?.external_id).split(":")[0] : "")
    || "email";
}

async function loadMessage(messageId: string) {
  const { data, error } = await admin
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

async function loadConversation(conversationId: string) {
  const { data, error } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

async function loadContact(contactId: string | null | undefined) {
  if (!contactId) return null;
  const { data, error } = await admin
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

async function upsertOutboundMessage({
  messageId,
  conversationId,
  userId,
  channelId,
  content,
  subject,
  metadata,
  providerMessageId,
  externalId,
  status,
  rawPayload,
  errorMessage,
}: {
  messageId?: string | null;
  conversationId: string;
  userId: string | null;
  channelId?: string | null;
  content: string;
  subject?: string | null;
  metadata: Record<string, unknown>;
  providerMessageId?: string | null;
  externalId?: string | null;
  status: string;
  rawPayload?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const payload = {
    user_id: userId,
    conversation_id: conversationId,
    channel_id: channelId || null,
    direction: "outbound",
    content,
    subject: subject || null,
    content_type: "text",
    status,
    metadata,
    provider_message_id: providerMessageId || null,
    external_id: externalId || null,
    raw_payload: rawPayload || {},
    error_message: errorMessage || null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  };

  if (messageId) {
    const { data, error } = await admin
      .from("messages")
      .update(payload)
      .eq("id", messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("messages")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function syncOutreachQueueDispatch(input: {
  queueId: string;
  conversationId: string;
  messageId: string | null;
  providerMessageId: string | null;
  providerStatus: string;
  providerError?: string | null;
  queueStatus?: string | null;
  channelType: string;
  recipient: string;
}) {
  const { data: queueRow, error: queueError } = await admin
    .from("outreach_queue")
    .select("id, metadata")
    .eq("id", input.queueId)
    .maybeSingle();
  if (queueError || !queueRow) return;

  const patch: Record<string, unknown> = {
    conversation_id: input.conversationId,
    message_id: input.messageId,
    provider_message_id: input.providerMessageId,
    provider_status: input.providerStatus,
    provider_error: compact(input.providerError) || null,
    metadata: {
      ...asRecord(queueRow.metadata),
      last_dispatch: {
        at: new Date().toISOString(),
        channel: input.channelType,
        recipient: input.recipient,
        provider_status: input.providerStatus,
        provider_message_id: input.providerMessageId,
      },
    },
    updated_at: new Date().toISOString(),
  };

  if (compact(input.queueStatus)) {
    patch.status = compact(input.queueStatus);
  }
  if (input.providerStatus === "sent") {
    patch.sent_at = new Date().toISOString();
  }

  await admin
    .from("outreach_queue")
    .update(patch)
    .eq("id", input.queueId);
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const user = await getAuthUser(req);
    const userId = user?.id || null;
    const body = await readJson<{
      message_id?: string;
      conversation_id?: string;
      channel_id?: string;
      channel?: string;
      to?: string;
      subject?: string;
      body?: string;
      content?: string;
      source?: string;
      correlation_id?: string;
      risk_class?: string;
      risk_level?: string;
      policy?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }>(req);

    const existingMessage: any = body.message_id ? await loadMessage(body.message_id) : null;
    const conversationId = body.conversation_id || compact(existingMessage?.conversation_id);
    if (!conversationId) {
      return errorResponse("conversation_id or message_id is required");
    }

    const conversation: any = await loadConversation(conversationId);
    if (!conversation) {
      return errorResponse("Conversation not found", 404);
    }

    const contact: any = await loadContact(compact(conversation.contact_id) || compact(body.metadata?.contact_id) || null);
    const channelType = inferChannelType({
      explicit: body.channel || null,
      message: existingMessage,
      conversation,
    });
    const runtime = collectMessagingRuntimeStatus();

    if (!["email", "whatsapp"].includes(channelType)) {
      return errorResponse(`${channelType} is not provider-backed yet. Use Gmail or WhatsApp.`, 400);
    }

    if (channelType === "email" && !runtime.providers.gmail.capabilities.outbound_dispatch) {
      return errorResponse("Gmail runtime is not configured for outbound dispatch", 400, {
        code: "gmail_runtime_not_ready",
        runtime: runtime.providers.gmail,
      });
    }
    if (channelType === "whatsapp" && !runtime.providers.whatsapp.capabilities.outbound_dispatch) {
      return errorResponse("WhatsApp runtime is not configured for outbound dispatch", 400, {
        code: "whatsapp_runtime_not_ready",
        runtime: runtime.providers.whatsapp,
      });
    }

    const channel = await resolveMessagingChannel(channelType, userId || compact(conversation.user_id) || null, body.channel_id || compact(conversation.channel_id) || null, ["active"]);
    if (!channel) {
      return errorResponse(`No active ${channelType} channel is connected`, 400, {
        code: "channel_not_connected",
        runtime: channelType === "email" ? runtime.providers.gmail : runtime.providers.whatsapp,
      });
    }

    const existingMetadata = (existingMessage?.metadata as Record<string, unknown>) || {};
    const subject = compact(body.subject) || compact(existingMessage?.subject) || compact(existingMetadata.subject) || null;
    const content = compact(body.body) || compact(body.content) || compact(existingMessage?.content);
    const queueId = compact(body.metadata?.outreach_queue_id) || compact(existingMetadata.outreach_queue_id) || null;

    if (!content) {
      return errorResponse("Message content is required");
    }

    let recipient = compact(body.to);
    if (!recipient && channelType === "email") {
      recipient = compact(contact?.email) || compact(existingMetadata.email);
    }
    if (!recipient && channelType === "whatsapp") {
      recipient = normalizePhone(compact(contact?.phone) || compact(existingMetadata.phone));
    }

    if (!recipient) {
      return errorResponse(`No ${channelType === "email" ? "email" : "phone"} recipient found`);
    }

    const requestMetadata = asRecord(body.metadata);
    const requestPolicy = asRecord(body.policy);
    const requestRoute = asRecord(requestMetadata.route);
    const dispatchRiskClass = resolveDispatchRiskClass(body as Record<string, unknown>, existingMetadata);
    const dispatchSource = resolveDispatchSource(body as Record<string, unknown>, existingMetadata);
    const viaControlPlane = requestRoute.via_control_plane === true
      || requestPolicy.via_control_plane === true
      || Boolean(compact(requestMetadata.control_plane_trace_id));
    const viaToolBus = requestRoute.via_tool_bus === true
      || requestPolicy.via_tool_bus === true;
    const routeCorrelationId = compact(
      requestRoute.correlation_id
        || requestMetadata.control_plane_correlation_id
        || body.correlation_id,
    ) || null;

    if (isHighRisk(dispatchRiskClass) && LEGACY_HIGH_RISK_SOURCES.has(dispatchSource)) {
      if (!(viaControlPlane && viaToolBus)) {
        return errorResponse(
          "High-risk legacy dispatch is blocked. Route through control-plane tool_dispatch (control-plane + tool-bus).",
          409,
          {
            code: "legacy_high_risk_route_required",
            source: dispatchSource,
            risk_class: dispatchRiskClass,
            routing: {
              via_control_plane: viaControlPlane,
              via_tool_bus: viaToolBus,
              correlation_id: routeCorrelationId,
            },
          },
        );
      }

      const hasEvidence = routeCorrelationId
        ? await hasToolBusInvocationEvidence(routeCorrelationId)
        : false;
      if (!hasEvidence) {
        return errorResponse(
          "High-risk dispatch requires verifiable tool-bus invocation trace.",
          409,
          {
            code: "legacy_high_risk_missing_tool_bus_trace",
            source: dispatchSource,
            risk_class: dispatchRiskClass,
            correlation_id: routeCorrelationId,
          },
        );
      }
    }

    let sendResult: Record<string, unknown>;
    try {
      sendResult = channelType === "email"
        ? await sendGmailMessage(channel, {
          to: recipient,
          subject,
          body: content,
          threadId: compact(conversation.provider_thread_id) || null,
        }) as Record<string, unknown>
        : await sendWhatsAppText(channel, recipient, content) as Record<string, unknown>;
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : "Provider send failed";
      const metadata = {
        ...(existingMetadata || {}),
        ...(body.metadata || {}),
        channel: channelType,
        subject,
        recipient,
        channel_id: channel.id,
      };

      const failedMessage = await upsertOutboundMessage({
        messageId: body.message_id || null,
        conversationId,
        userId: userId || compact(conversation.user_id) || null,
        channelId: channel.id,
        content,
        subject,
        metadata,
        providerMessageId: null,
        externalId: null,
        status: "failed",
        rawPayload: { error: errorMessage },
        errorMessage,
      });

      await admin
        .from("conversations")
        .update({
          channel_id: channel.id,
          channel: channelType,
          status: "failed",
          last_message_at: new Date().toISOString(),
          last_outbound_at: new Date().toISOString(),
          metadata: {
            ...(conversation.metadata as Record<string, unknown> || {}),
            last_channel_type: channelType,
            last_dispatch_error: errorMessage,
          },
        })
        .eq("id", conversationId);

      if (queueId) {
        await syncOutreachQueueDispatch({
          queueId,
          conversationId,
          messageId: compact(failedMessage?.id) || null,
          providerMessageId: null,
          providerStatus: "failed",
          providerError: errorMessage,
          queueStatus: "approved",
          channelType,
          recipient,
        }).catch(() => {});
      }

      return errorResponse(errorMessage, 500);
    }

    const providerMessageId = channelType === "email"
      ? compact((sendResult as { id?: string }).id)
      : compact((sendResult as { messages?: Array<{ id?: string }> }).messages?.[0]?.id);
    const providerThreadId = channelType === "email"
      ? compact((sendResult as { threadId?: string }).threadId)
      : compact(conversation.provider_thread_id);

    const metadata = {
      ...(existingMetadata || {}),
      ...(body.metadata || {}),
      channel: channelType,
      subject,
      recipient,
      channel_id: channel.id,
    };

    const persistedMessage = await upsertOutboundMessage({
      messageId: body.message_id || null,
      conversationId,
      userId: userId || compact(conversation.user_id) || null,
      channelId: channel.id,
      content,
      subject,
      metadata,
      providerMessageId: providerMessageId || null,
      externalId: providerMessageId || null,
      status: "sent",
      rawPayload: sendResult as Record<string, unknown>,
    });

    if (queueId) {
      await syncOutreachQueueDispatch({
        queueId,
        conversationId,
        messageId: compact(persistedMessage?.id) || null,
        providerMessageId: providerMessageId || null,
        providerStatus: "sent",
        queueStatus: "sent",
        channelType,
        recipient,
      }).catch(() => {});
    }

    await admin
      .from("conversations")
      .update({
        user_id: userId || conversation.user_id || null,
        company_id: conversation.company_id || contact?.company_id || null,
        channel_id: channel.id,
        channel: channelType,
        provider_thread_id: providerThreadId || null,
        status: "sent",
        last_message_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        metadata: {
          ...(conversation.metadata as Record<string, unknown> || {}),
          last_channel_type: channelType,
        },
      })
      .eq("id", conversationId);

    if (contact?.id) {
      await admin.from("crm_activities").insert({
        user_id: userId || conversation.user_id || null,
        contact_id: contact.id,
        company_id: contact.company_id || conversation.company_id || null,
        conversation_id: conversationId,
        type: "message_sent",
        subject: subject || `Outbound ${channelType}`,
        description: `Outbound ${channelType} sent to ${recipient}.`,
        metadata: {
          channel: channelType,
          message_id: persistedMessage.id,
          provider_message_id: providerMessageId || null,
        },
      });
    }

    return jsonResponse({
      ok: true,
      channel: channelType,
      message: persistedMessage,
      provider_response: sendResult,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Dispatch failed", 500);
  }
});
