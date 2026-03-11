import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { executeTriggeredWorkflows } from "../_shared/automation.ts";
import { getHeader, extractMessageText, fetchGmailMessage, listGmailHistory } from "../_shared/gmail.ts";
import { base64UrlDecode, compact, errorResponse, handleCors, jsonResponse, readJson } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

async function classifyMessage(content: string, subject: string | null): Promise<Record<string, unknown> | null> {
  if (!OPENAI_API_KEY || !content || content.length < 10) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Classify this inbound email response. Return JSON only:
{ "intent": "interested|not_interested|meeting_request|auto_reply|question|unsubscribe", "confidence": 0.0-1.0, "summary": "one sentence summary", "suggested_action": "create_meeting|send_followup|mark_closed|none" }`,
          },
          {
            role: "user",
            content: `Subject: ${subject || "(none)"}\n\n${content.slice(0, 2000)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
  } catch {
    return null;
  }
}

function parseMailbox(value: string | null) {
  const raw = compact(value);
  if (!raw) return { name: null, email: null };

  const match = raw.match(/^(.*?)(?:<([^>]+)>)?$/);
  const email = (match?.[2] || match?.[1] || "").trim().replace(/^["']|["']$/g, "");
  const name = match?.[2] ? match?.[1]?.trim().replace(/^["']|["']$/g, "") : null;

  return {
    name: name || null,
    email: email.includes("@") ? email.toLowerCase() : null,
  };
}

async function resolveChannel({
  channelId,
  emailAddress,
}: {
  channelId?: string | null;
  emailAddress?: string | null;
}) {
  let query = admin
    .from("messaging_channels")
    .select("*")
    .eq("type", "email")
    .eq("status", "active");

  if (channelId) query = query.eq("id", channelId);
  else if (emailAddress) query = query.eq("email_address", emailAddress);

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function findOrCreateContact(userId: string | null, inboxMessage: {
  fromEmail: string;
  fromName: string | null;
}) {
  let query = admin
    .from("contacts")
    .select("*")
    .eq("email", inboxMessage.fromEmail)
    .limit(1);

  query = userId ? query.eq("user_id", userId) : query.is("user_id", null);

  const { data, error } = await query;
  if (error) throw error;

  if (data?.[0]) return data[0];

  const { data: created, error: insertError } = await admin
    .from("contacts")
    .insert({
      user_id: userId,
      name: inboxMessage.fromName || inboxMessage.fromEmail.split("@")[0],
      email: inboxMessage.fromEmail,
      status: "contacted",
      source: "gmail_inbound",
      confidence: 70,
      role: "Owner / Front Desk",
      last_contacted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

async function findOrCreateConversation({
  userId,
  channelId,
  contact,
  threadId,
  messageAt,
}: {
  userId: string | null;
  channelId: string;
  contact: Record<string, unknown>;
  threadId: string | null;
  messageAt: string;
}) {
  let query = admin
    .from("conversations")
    .select("*")
    .eq("contact_id", contact.id)
    .eq("channel_id", channelId)
    .limit(1);

  query = userId ? query.eq("user_id", userId) : query.is("user_id", null);

  const { data, error } = await query;
  if (error) throw error;

  if (data?.[0]) {
    const { data: updated, error: updateError } = await admin
      .from("conversations")
      .update({
        status: "open",
        unread_count: (data[0].unread_count || 0) + 1,
        last_message_at: messageAt,
        last_inbound_at: messageAt,
        provider_thread_id: threadId || data[0].provider_thread_id || null,
      })
      .eq("id", data[0].id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data: created, error: insertError } = await admin
    .from("conversations")
    .insert({
      user_id: userId,
      contact_id: contact.id,
      company_id: contact.company_id || null,
      channel: "email",
      channel_id: channelId,
      external_id: `email:${contact.id}`,
      provider_thread_id: threadId || null,
      status: "open",
      unread_count: 1,
      last_message_at: messageAt,
      last_inbound_at: messageAt,
      assigned_to: "Inbox",
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

async function persistInboundMessage({
  userId,
  channel,
  conversation,
  contact,
  gmailMessage,
}: {
  userId: string | null;
  channel: Record<string, unknown>;
  conversation: Record<string, unknown>;
  contact: Record<string, unknown>;
  gmailMessage: Record<string, unknown>;
}) {
  const payload = gmailMessage.payload as Record<string, unknown> | undefined;
  const headers = (payload?.headers as Array<{ name?: string; value?: string }> | undefined) || [];
  const messageId = compact(gmailMessage.id);
  const subject = getHeader(headers, "Subject");
  const content = extractMessageText(gmailMessage);
  const messageAt = gmailMessage.internalDate
    ? new Date(Number(gmailMessage.internalDate)).toISOString()
    : new Date().toISOString();

  const { data: existingRows, error: existingError } = await admin
    .from("messages")
    .select("*")
    .eq("provider_message_id", messageId)
    .limit(1);

  if (existingError) throw existingError;
  if (existingRows?.[0]) return existingRows[0];

  const { data, error } = await admin
    .from("messages")
    .insert({
      user_id: userId,
      conversation_id: conversation.id,
      channel_id: channel.id,
      direction: "inbound",
      subject,
      content,
      content_type: "text",
      status: "received",
      provider_message_id: messageId,
      external_id: messageId,
      metadata: {
        channel: "email",
        from: contact.email,
        subject,
      },
      raw_payload: gmailMessage,
      created_at: messageAt,
    })
    .select()
    .single();

  if (error) throw error;

  await admin.from("crm_activities").insert({
    user_id: userId,
    contact_id: contact.id,
    company_id: contact.company_id || null,
    conversation_id: conversation.id,
    type: "message_received",
    subject: subject || "Inbound Gmail",
    description: `Inbound email received from ${contact.email}.`,
    metadata: {
      channel: "email",
      provider_message_id: messageId,
    },
  });

  // AI classification of inbound message
  try {
    const classification = await classifyMessage(content || "", subject);
    if (classification) {
      await admin
        .from("messages")
        .update({ classification })
        .eq("id", data.id);

      // Emit classified event for downstream automation
      await admin.from("event_log").insert({
        event_type: "message.classified",
        payload: {
          message_id: data.id,
          contact_id: contact.id,
          conversation_id: conversation.id,
          intent: classification.intent,
          confidence: classification.confidence,
          suggested_action: classification.suggested_action,
        },
        user_id: userId,
      });
    }
  } catch (classifyError) {
    console.error("[gmail-inbound] classification failed:", classifyError);
  }

  try {
    await executeTriggeredWorkflows({
      triggerKey: "message_in",
      userId,
      context: {
        user_id: userId,
        channel: "email",
        contact_id: contact.id,
        company_id: contact.company_id || null,
        conversation_id: conversation.id,
        message_id: data.id,
        subject,
        body: content,
      },
      sendLive: false,
      source: "gmail_inbound",
    });
  } catch (automationError) {
    console.error("[gmail-inbound] automation trigger failed:", automationError);
  }

  return data;
}

async function syncChannel(channel: Record<string, unknown>, currentHistoryId?: string | number | null) {
  const channelHistoryId = channel.last_history_id || currentHistoryId || null;

  if (!channelHistoryId) {
    await admin
      .from("messaging_channels")
      .update({
        last_history_id: currentHistoryId ? Number(currentHistoryId) : null,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    return { synced: 0, historyId: currentHistoryId || null };
  }

  const history = await listGmailHistory(channel as any, channelHistoryId);
  const addedMessageIds = (history.history || [])
    .flatMap(item => item.messagesAdded || [])
    .map(item => compact(item.message?.id))
    .filter(Boolean);

  let processed = 0;

  for (const messageId of addedMessageIds) {
    const gmailMessage = await fetchGmailMessage(channel as any, messageId);
    const payload = gmailMessage.payload as Record<string, unknown> | undefined;
    const headers = (payload?.headers as Array<{ name?: string; value?: string }> | undefined) || [];
    const fromMailbox = parseMailbox(getHeader(headers, "From"));

    if (!fromMailbox.email || fromMailbox.email.toLowerCase() === compact(channel.email_address).toLowerCase()) {
      continue;
    }

    const messageAt = gmailMessage.internalDate
      ? new Date(Number(gmailMessage.internalDate)).toISOString()
      : new Date().toISOString();
    const contact = await findOrCreateContact(channel.user_id || null, {
      fromEmail: fromMailbox.email,
      fromName: fromMailbox.name,
    });
    const conversation = await findOrCreateConversation({
      userId: channel.user_id || null,
      channelId: channel.id,
      contact,
      threadId: compact(gmailMessage.threadId) || null,
      messageAt,
    });

    await persistInboundMessage({
      userId: channel.user_id || null,
      channel,
      conversation,
      contact,
      gmailMessage,
    });

    processed += 1;
  }

  await admin
    .from("messaging_channels")
    .update({
      last_history_id: Number(history.historyId || currentHistoryId || channel.last_history_id || 0) || null,
      last_sync_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", channel.id);

  return {
    synced: processed,
    historyId: history.historyId || currentHistoryId || channel.last_history_id || null,
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await readJson<{
      action?: string;
      channel_id?: string;
      email_address?: string;
      history_id?: string;
      message?: {
        data?: string;
      };
    }>(req);

    if (body.action === "sync") {
      const channel = await resolveChannel({
        channelId: body.channel_id || null,
        emailAddress: body.email_address || null,
      });

      if (!channel) return errorResponse("Gmail channel not found", 404);

      const result = await syncChannel(channel, body.history_id || null);
      return jsonResponse({ ok: true, ...result });
    }

    const envelope = body.message?.data ? JSON.parse(base64UrlDecode(body.message.data)) : null;
    const emailAddress = compact(envelope?.emailAddress);
    const historyId = compact(envelope?.historyId);
    const channel = await resolveChannel({ emailAddress });

    if (!channel) {
      return jsonResponse({ ok: true, skipped: true, reason: "unknown channel" });
    }

    const result = await syncChannel(channel, historyId || null);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Gmail inbound sync failed", 500);
  }
});
