import { ensureGmailAccessToken } from "./gmail.ts";
import type { MessagingChannelRow } from "./channels.ts";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

async function calRequest(
  channel: MessagingChannelRow,
  path: string,
  init: RequestInit = {},
) {
  const token = await ensureGmailAccessToken(channel);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${CAL_BASE}${path}`, { ...init, headers });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Calendar API error ${res.status}`);
  }
  return data;
}

export type CalendarEvent = {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method: "email" | "popup"; minutes: number }>;
  };
  colorId?: string; // "1"–"11"
  conferenceData?: unknown;
};

/** Create an event in primary calendar. Returns created event with id. */
export async function createCalendarEvent(
  channel: MessagingChannelRow,
  event: CalendarEvent,
  calendarId = "primary",
) {
  const data = await calRequest(
    channel,
    `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    { method: "POST", body: JSON.stringify(event) },
  );
  return data as CalendarEvent & { id: string; htmlLink: string };
}

/** Update an existing event */
export async function updateCalendarEvent(
  channel: MessagingChannelRow,
  eventId: string,
  patch: Partial<CalendarEvent>,
  calendarId = "primary",
) {
  const data = await calRequest(
    channel,
    `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=none`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data as CalendarEvent & { id: string; htmlLink: string };
}

/** Delete an event */
export async function deleteCalendarEvent(
  channel: MessagingChannelRow,
  eventId: string,
  calendarId = "primary",
) {
  return calRequest(
    channel,
    `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "DELETE" },
  );
}

/** List upcoming events in a time window */
export async function listCalendarEvents(
  channel: MessagingChannelRow,
  opts: {
    timeMin?: string; // ISO
    timeMax?: string;
    q?: string;
    maxResults?: number;
    calendarId?: string;
  } = {},
) {
  const { calendarId = "primary", maxResults = 50, ...params } = opts;
  const url = new URL(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  if (params.timeMin) url.searchParams.set("timeMin", params.timeMin);
  if (params.timeMax) url.searchParams.set("timeMax", params.timeMax);
  if (params.q) url.searchParams.set("q", params.q);

  const token = await ensureGmailAccessToken(channel);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Calendar list failed");
  return (data.items || []) as Array<CalendarEvent & { id: string; htmlLink: string }>;
}

/** Helper: create a follow-up event N days from now */
export function buildFollowUpEvent(opts: {
  title: string;
  description?: string;
  daysFromNow?: number;
  durationMinutes?: number;
  attendeeEmail?: string;
  timeZone?: string;
}): CalendarEvent {
  const tz = opts.timeZone || "Europe/Madrid";
  const days = opts.daysFromNow ?? 3;
  const dur = opts.durationMinutes ?? 30;

  const start = new Date();
  start.setDate(start.getDate() + days);
  start.setHours(10, 0, 0, 0);

  const end = new Date(start.getTime() + dur * 60_000);

  const event: CalendarEvent = {
    summary: opts.title,
    description: opts.description,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 60 },
      ],
    },
    colorId: "5", // banana yellow — close to OCULOPS gold
  };

  if (opts.attendeeEmail) {
    event.attendees = [{ email: opts.attendeeEmail }];
  }

  return event;
}
