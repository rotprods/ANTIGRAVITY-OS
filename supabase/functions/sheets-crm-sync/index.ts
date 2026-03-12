import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createSpreadsheet,
  writeRange,
  listSpreadsheets,
} from "../_shared/google-sheets.ts";
import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";
import { admin, getAuthUser } from "../_shared/supabase.ts";

// ─── helpers ────────────────────────────────────────────────────────────────

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

function fmtDate(v: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

// ─── export actions ─────────────────────────────────────────────────────────

async function exportContacts(spreadsheetId: string, channel: unknown) {
  const { data: contacts } = await admin
    .from("contacts")
    .select("id,name,email,phone,company,status,source,created_at")
    .order("created_at", { ascending: false });

  const rows: (string | number | null)[][] = [
    ["ID", "Name", "Email", "Phone", "Company", "Status", "Source", "Created"],
    ...(contacts || []).map((c) => [
      c.id, c.name, c.email, c.phone, c.company, c.status, c.source, fmtDate(c.created_at),
    ]),
  ];

  // deno-lint-ignore no-explicit-any
  await writeRange(channel as any, spreadsheetId, "Contacts!A1", rows);
  return contacts?.length ?? 0;
}

async function exportDeals(spreadsheetId: string, channel: unknown) {
  const { data: deals } = await admin
    .from("deals")
    .select("id,title,value,stage,probability,company_id,contact_id,close_date,created_at")
    .order("created_at", { ascending: false });

  const rows: (string | number | null)[][] = [
    ["ID", "Title", "Value (€)", "Stage", "Probability", "Company ID", "Contact ID", "Close Date", "Created"],
    ...(deals || []).map((d) => [
      d.id, d.title, d.value, d.stage, d.probability, d.company_id, d.contact_id,
      fmtDate(d.close_date), fmtDate(d.created_at),
    ]),
  ];

  // deno-lint-ignore no-explicit-any
  await writeRange(channel as any, spreadsheetId, "Deals!A1", rows);
  return deals?.length ?? 0;
}

async function exportCompanies(spreadsheetId: string, channel: unknown) {
  const { data: companies } = await admin
    .from("companies")
    .select("id,name,domain,industry,size,city,status,created_at")
    .order("created_at", { ascending: false });

  const rows: (string | number | null)[][] = [
    ["ID", "Name", "Domain", "Industry", "Size", "City", "Status", "Created"],
    ...(companies || []).map((c) => [
      c.id, c.name, c.domain, c.industry, c.size, c.city, c.status, fmtDate(c.created_at),
    ]),
  ];

  // deno-lint-ignore no-explicit-any
  await writeRange(channel as any, spreadsheetId, "Companies!A1", rows);
  return companies?.length ?? 0;
}

// ─── main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getAuthUser(req);
    const userId = user?.id || null;
    const channel = await getGmailChannel(userId);

    // POST body: { action: "export"|"list", spreadsheetId?: string }
    const body = await readJson(req);
    const action = body?.action;

    // list existing spreadsheets
    if (action === "list") {
      // deno-lint-ignore no-explicit-any
      const files = await listSpreadsheets(channel as any);
      return jsonResponse({ files });
    }

    if (action === "export") {
      let spreadsheetId = body?.spreadsheetId as string | undefined;

      // Create new spreadsheet if not provided
      if (!spreadsheetId) {
        const title = `OCULOPS CRM — ${new Date().toISOString().slice(0, 10)}`;
        // deno-lint-ignore no-explicit-any
        const sheet = await createSpreadsheet(channel as any, title, [
          "Contacts",
          "Deals",
          "Companies",
        ]);
        spreadsheetId = sheet.spreadsheetId;
      }

      const [contactCount, dealCount, companyCount] = await Promise.all([
        exportContacts(spreadsheetId, channel),
        exportDeals(spreadsheetId, channel),
        exportCompanies(spreadsheetId, channel),
      ]);

      return jsonResponse({
        ok: true,
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        counts: { contacts: contactCount, deals: dealCount, companies: companyCount },
      });
    }

    return errorResponse("Unknown action", 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(message, 500);
  }
});
