import { ensureGmailAccessToken } from "./gmail.ts";
import type { MessagingChannelRow } from "./channels.ts";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

async function sheetsRequest(
  channel: MessagingChannelRow,
  url: string,
  init: RequestInit = {},
) {
  const token = await ensureGmailAccessToken(channel);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Sheets API error ${res.status}`);
  }
  return data;
}

/** Create a new Google Sheet and return its spreadsheetId */
export async function createSpreadsheet(
  channel: MessagingChannelRow,
  title: string,
  sheets: string[] = ["Sheet1"],
) {
  const body = {
    properties: { title },
    sheets: sheets.map((s) => ({ properties: { title: s } })),
  };
  const data = await sheetsRequest(channel, SHEETS_BASE, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data as { spreadsheetId: string; spreadsheetUrl: string };
}

/** Get spreadsheet metadata (sheet names, IDs) */
export async function getSpreadsheet(
  channel: MessagingChannelRow,
  spreadsheetId: string,
) {
  return sheetsRequest(channel, `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties`);
}

/** Read values from a range (e.g. "CRM!A1:Z1000") */
export async function readRange(
  channel: MessagingChannelRow,
  spreadsheetId: string,
  range: string,
) {
  const data = await sheetsRequest(
    channel,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
  );
  return (data.values || []) as string[][];
}

/** Write rows to a range (clears first, then writes) */
export async function writeRange(
  channel: MessagingChannelRow,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][],
) {
  return sheetsRequest(
    channel,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
}

/** Append rows to a sheet */
export async function appendRows(
  channel: MessagingChannelRow,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][],
) {
  return sheetsRequest(
    channel,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
}

/** Clear a range */
export async function clearRange(
  channel: MessagingChannelRow,
  spreadsheetId: string,
  range: string,
) {
  return sheetsRequest(
    channel,
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: "POST" },
  );
}

/** List spreadsheets in Drive (returns up to 20 most recent) */
export async function listSpreadsheets(channel: MessagingChannelRow) {
  const token = await ensureGmailAccessToken(channel);
  const url = new URL(`${DRIVE_BASE}/files`);
  url.searchParams.set("q", "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  url.searchParams.set("fields", "files(id,name,modifiedTime,webViewLink)");
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "20");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Drive list failed");
  return (data.files || []) as Array<{
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
  }>;
}
