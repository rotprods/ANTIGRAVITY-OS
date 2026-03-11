# CURRENT UI INVENTORY - PROSPECTOR HUB

## 1. Page Structure & Layout

- **Root Layout:** `src/components/layout/Layout.jsx` creates a global sidebar, a main content area with a top header.
- **Header:** Contains the current module icon, title ("Prospector Hub"), a Command Palette trigger (⌘K), and a "LIVE" connection status indicator.
- **Module Header:** Contains the module title, subtitle, and KPI summary bar (Live Targets, Qualified, Avg Score cards).
- **Tabs Navigation:** 6 main tabs (`Airspace`, `Mapa`, `Scanner`, `Leads`, `Outreach`, `API Network`).

## 2. Key Components Found

- **Metric Cards (`.kpi-card`):** Used in the header, displaying value and label.
- **Top Navigation / Tabs (`.prospector-tabs`):** Pill-based or button layout for switching sub-views.
- **Data Panels / Cards (`.card`):** Standard container with `.card-header` and `.card-title`.
- **Search Inputs (`.input`, `.input-group`):** Basic text and select inputs.
- **Buttons (`.btn`, `.btn-primary`, `.btn-sm`, `.btn-danger`):** Standard actionable elements.
- **Map Embed (`<MapEmbed>`):** Custom coordinate grid rendering leads as dots with pulsing rings.
- **Score Rings (`<ScoreRing>`):** SVG circular progress bars for AI fit scores.
- **Badges (`.badge`, `.badge-success`, `.badge-info`):** Small standard indicators.
- **Tables (`.table-container`):** Standard HTML data tables for the leads array.
- **Agent Panels:** Outreach stats showing integration for "HUNTER" agent, though visually it just looks like standard tabs and stat widgets.
- **Drawers / Modals (`Lead detail panel`):** Inline slide-down/expand panel showing detailed lead data + tech stack + social profiles.

## 3. Visual Diagnosis

- **What exists:** A highly functional, densely packed set of tools (maps, scanning, CRM sync, email outreach).
- **What is missing:** A unified premium aesthetic. There are too many standard border boxes (`border-subtle`).
- **What is visually weak:** The layout feels generic SaaS. The CSS classes (`.card`, `.btn`) look utility-driven rather than editorial.
- **What breaks premium brand:** Standard HTML tables, basic `<select>` inputs, standard system fonts in inputs, generic emojis used as icons instead of a custom SVG icon set.
- **What to preserve:** The sheer density of intelligence (Scans -> Qualify -> Map -> Outreach -> CRM). The data structure is excellent.
- **What must be redesigned:** All container borders, typography hierarchy, tab switches, and specifically the agent interventions (outreach should feel like a live agent working, not just a stats board).
