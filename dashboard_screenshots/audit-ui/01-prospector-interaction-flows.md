# PROSPECTOR INTERACTION FLOWS

## 1. Market Scanning Flow (The "Scanner" Tab)

- **Action:** User enters query (e.g., "restaurantes"), location, and radius. Clicks "Lanzar Scan".
- **Feedback:** "⏳ Escaneando APIs...", UI locks the button.
- **Result:** KPIs update automatically (`liveResultsCount`). The map populates. New leads are added to `byStatus.detected`.

## 2. Map Intelligence Flow (The "Mapa" Tab)

- **Action:** User views the grid map. Dots pulse based on selection.
- **Interaction:** Clicking a dot highlights it, brings up a tooltip with name, rating, address, and AI score.
- **Friction Point:** The sidebar list updates, but the connection between map nodes and agent action isn't clear. It feels like a standard map, rather than an agent's "hunting ground".

## 3. Lead Qualification Flow (The "Leads" Tab)

- **Path:** Detected → AI Qualify → Qualified → Pursuing → Promoted (CRM).
- **Actions:**
  1. Click lead to expand detail inline.
  2. Click "🧠 AI Qualify" (triggers Gemini via GeoSearch hook).
  3. Click "✓ Cualificar".
  4. Click "→ CRM".
- **Friction Point:** Too many manual clicks required. The agent (CORTEX/HUNTER) should visualize its autonomous action, rather than waiting for the user to click buttons for every state change.

## 4. Outreach Flow (The "Outreach" Tab)

- **Path:** Leads staged by HUNTER → User Approves / Skips → Mails Sent.
- **Interaction:** User clicks "✅ Aprobar Todos" or clicks individual emails to preview the generated copy and approve.
- **Missed Opportunity:** This is where the Agent (HUNTER) should be personified. Currently, it's just a list of texts. It needs a "terminal" or "feed" feeling to show the AI actually drafting and firing these.
