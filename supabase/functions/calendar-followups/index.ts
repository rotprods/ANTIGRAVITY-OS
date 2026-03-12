import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  buildFollowUpEvent,
} from "../_shared/google-calendar.ts";
import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { admin, getAuthUser } from "../_shared/supabase.ts";

async function getGmailChannel(userId: string | null) {
  let query = admin
    .from("messaging_channels")
    .select("*")
    .eq("type", "email")
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .limit(1);

  if (userId) query = query.or(`user_id.eq.${userId},user_id.is.null`);
  else query = query.is("user_id", null);

  const { data, error } = await query;
  if (error || !data?.length) throw new Error("No active Gmail channel. Connect Gmail in Messaging first.");
  return data[0];
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getAuthUser(req);
    const userId = user?.id || null;

    const body = await readJson(req);
    const action = body?.action;
    const channel = await getGmailChannel(userId);

    // list upcoming calendar events
    if (action === "list") {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      // deno-lint-ignore no-explicit-any
      const events = await listCalendarEvents(channel as any, {
        timeMin: body?.timeMin || now.toISOString(),
        timeMax: body?.timeMax || in30.toISOString(),
        maxResults: 50,
      });
      return jsonResponse({ events });
    }

    // POST { action: "create_followup", dealId, daysFromNow?, attendeeEmail? }
    if (action === "create_followup") {
      const dealId = body?.dealId as string;
      if (!dealId) return errorResponse("dealId required", 400);

      const { data: deal, error: dealError } = await admin
        .from("deals")
        .select("*, contacts(name,email), companies(name)")
        .eq("id", dealId)
        .single();

      if (dealError || !deal) return errorResponse("Deal not found", 404);

      const contactEmail = deal.contacts?.email || body?.attendeeEmail;
      const contactName = deal.contacts?.name || "Contact";
      const companyName = deal.companies?.name || deal.company_id || "";

      const event = buildFollowUpEvent({
        title: `Follow-up: ${deal.title}${companyName ? ` — ${companyName}` : ""}`,
        description: [
          `Deal: ${deal.title}`,
          `Value: €${deal.value || 0}`,
          `Stage: ${deal.stage}`,
          `Contact: ${contactName}`,
          `\nCreated by OCULOPS`,
        ].join("\n"),
        daysFromNow: body?.daysFromNow ?? 3,
        durationMinutes: body?.durationMinutes ?? 30,
        attendeeEmail: contactEmail,
        timeZone: body?.timeZone || "Europe/Madrid",
      });

      // deno-lint-ignore no-explicit-any
      const created = await createCalendarEvent(channel as any, event);

      // Store calendar_event_id in deal metadata
      await admin
        .from("deals")
        .update({
          metadata: {
            ...(deal.metadata || {}),
            calendar_event_id: created.id,
            calendar_event_url: created.htmlLink,
          },
        })
        .eq("id", dealId);

      return jsonResponse({
        ok: true,
        event: created,
        deal: { id: deal.id, title: deal.title },
      });
    }

    // POST { action: "create_event", event: CalendarEvent }
    if (action === "create_event") {
      if (!body?.event) return errorResponse("event required", 400);
      // deno-lint-ignore no-explicit-any
      const created = await createCalendarEvent(channel as any, body.event);
      return jsonResponse({ ok: true, event: created });
    }

    // POST { action: "update_event", eventId, patch }
    if (action === "update_event") {
      if (!body?.eventId || !body?.patch) return errorResponse("eventId and patch required", 400);
      // deno-lint-ignore no-explicit-any
      const updated = await updateCalendarEvent(channel as any, body.eventId, body.patch);
      return jsonResponse({ ok: true, event: updated });
    }

    // POST { action: "delete_event", eventId }
    if (action === "delete_event") {
      if (!body?.eventId) return errorResponse("eventId required", 400);
      // deno-lint-ignore no-explicit-any
      await deleteCalendarEvent(channel as any, body.eventId);
      return jsonResponse({ ok: true });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(message, 500);
  }
});
