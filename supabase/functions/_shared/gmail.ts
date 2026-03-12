import { admin } from "./supabase.ts";
import { base64UrlDecode, base64UrlEncode, compact } from "./http.ts";
import type { MessagingChannelRow } from "./channels.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
const GMAIL_REDIRECT_URL = Deno.env.get("GMAIL_OAUTH_REDIRECT_URL");
const GMAIL_PUBSUB_TOPIC = Deno.env.get("GMAIL_PUBSUB_TOPIC_NAME");
const GMAIL_MODEL_MAILBOX = "me";
const GOOGLE_SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function getGmailRedirectUrl() {
  if (!GMAIL_REDIRECT_URL) {
    throw new Error("GMAIL_OAUTH_REDIRECT_URL is required");
  }

  return GMAIL_REDIRECT_URL;
}

export function buildGmailOAuthUrl(state: string) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID is required");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", getGmailRedirectUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth client is not configured");
  }

  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: getGmailRedirectUrl(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || "Google token exchange failed");
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth client is not configured");
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || "Google token refresh failed");
  }

  return data as {
    access_token: string;
    expires_in: number;
    token_type?: string;
  };
}

function isTokenExpired(channel: MessagingChannelRow) {
  if (!channel.token_expires_at) return true;
  return new Date(channel.token_expires_at).getTime() - Date.now() < 60_000;
}

export async function ensureGmailAccessToken(channel: MessagingChannelRow) {
  if (channel.access_token && !isTokenExpired(channel)) {
    return channel.access_token;
  }

  if (!channel.refresh_token) {
    throw new Error("Gmail refresh token is missing");
  }

  const refreshed = await refreshAccessToken(channel.refresh_token);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await admin
    .from("messaging_channels")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
      status: "active",
      last_error: null,
    })
    .eq("id", channel.id);

  return refreshed.access_token;
}

export async function gmailRequest(channel: MessagingChannelRow, path: string, init: RequestInit = {}) {
  const accessToken = await ensureGmailAccessToken(channel);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${GMAIL_MODEL_MAILBOX}/${path}`, {
    ...init,
    headers,
  });

  return response;
}

export async function fetchGmailProfileFromAccessToken(accessToken: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${GMAIL_MODEL_MAILBOX}/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to load Gmail profile");
  }

  return data as {
    emailAddress: string;
    messagesTotal?: number;
    threadsTotal?: number;
    historyId?: string;
  };
}

export async function fetchGmailProfile(channel: MessagingChannelRow) {
  const accessToken = await ensureGmailAccessToken(channel);
  return fetchGmailProfileFromAccessToken(accessToken);
}

export async function activateGmailWatch(channel: MessagingChannelRow) {
  if (!GMAIL_PUBSUB_TOPIC) return null;

  const response = await gmailRequest(channel, "watch", {
    method: "POST",
    body: JSON.stringify({
      topicName: GMAIL_PUBSUB_TOPIC,
      labelIds: ["INBOX"],
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to activate Gmail watch");
  }

  return data as {
    historyId?: string;
    expiration?: string;
  };
}

export function buildMimeMessage({
  from,
  to,
  subject,
  body,
  inReplyTo,
  references,
}: {
  from?: string | null;
  to: string;
  subject?: string | null;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const headers = [
    from ? `From: ${from}` : null,
    `To: ${to}`,
    `Subject: ${compact(subject) || "(no subject)"}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "",
    body,
  ].filter(Boolean);

  return base64UrlEncode(headers.join("\r\n"));
}

export async function sendGmailMessage(
  channel: MessagingChannelRow,
  payload: {
    to: string;
    subject?: string | null;
    body: string;
    inReplyTo?: string | null;
    references?: string | null;
    threadId?: string | null;
  },
) {
  const profile = await fetchGmailProfile(channel);
  const raw = buildMimeMessage({
    from: profile.emailAddress,
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    inReplyTo: payload.inReplyTo,
    references: payload.references,
  });

  const response = await gmailRequest(channel, "messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw,
      threadId: payload.threadId || undefined,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gmail send failed");
  }

  return data as {
    id?: string;
    threadId?: string;
    labelIds?: string[];
  };
}

export async function listGmailHistory(channel: MessagingChannelRow, startHistoryId: string | number) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/${GMAIL_MODEL_MAILBOX}/history`);
  url.searchParams.set("startHistoryId", String(startHistoryId));
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("maxResults", "100");

  const accessToken = await ensureGmailAccessToken(channel);
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) return { history: [], historyId: channel.last_history_id || null };
    throw new Error(data?.error?.message || "Gmail history sync failed");
  }

  return data as {
    history?: Array<{ id?: string; messagesAdded?: Array<{ message?: { id?: string } }> }>;
    historyId?: string;
  };
}

export async function fetchGmailMessage(channel: MessagingChannelRow, messageId: string) {
  const response = await gmailRequest(channel, `messages/${messageId}?format=full`, {
    method: "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to fetch Gmail message");
  }

  return data as Record<string, unknown>;
}

export function getHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value || null;
}

function extractBodyFromParts(parts: Array<Record<string, unknown>> | undefined): string | null {
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    const mimeType = compact(part.mimeType);
    const bodyData = compact((part.body as { data?: string } | undefined)?.data);
    if (mimeType === "text/plain" && bodyData) return base64UrlDecode(bodyData);

    const nested = extractBodyFromParts(part.parts as Array<Record<string, unknown>> | undefined);
    if (nested) return nested;
  }

  return null;
}

export function extractMessageText(message: Record<string, unknown>) {
  const payload = message.payload as Record<string, unknown> | undefined;
  const directBody = compact((payload?.body as { data?: string } | undefined)?.data);
  if (directBody) return base64UrlDecode(directBody);

  const fromParts = extractBodyFromParts(payload?.parts as Array<Record<string, unknown>> | undefined);
  return fromParts || compact(message.snippet) || "";
}
