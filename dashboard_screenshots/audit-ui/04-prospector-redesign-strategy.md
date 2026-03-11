# REDESIGN STRATEGY: OCULOPS SYSTEM

## Strategic Core

**From Dashboard to Intelligence Instrument.**
The redesign will shift the paradigm from "boxes containing data" to "an open airspace where data lives."

## What to Preserve (The Engine)

1. **Information Architecture:** Do not change the 6 tabs (Airspace, Map, Scanner, Leads, Outreach, Network).
2. **Data Structure:** Keep the exact same hooks, state variables, and API responses. The AI logic works perfectly.
3. **Module Routing:** Maintain the `Layout.jsx` sidebar and the global routing structure in `App.jsx`.

## What to Replace (The Shell)

1. **The Color System:** Implement the OCULOPS Yellow scale. Strip out all generic greens/blues/reds. Statuses will be indicated primarily by brightness and opacity in yellow and white.
2. **The Components:**
   - Replace standard inputs with seamless, borderless or glass-backed editorial inputs.
   - Replace standard buttons with highly styled, premium interaction triggers.
   - Replace HTML tables with dynamic data grids that feel like a financial terminal.
3. **The Layout:** Remove hard `.card` borders. Use a unified "Glassmorphism Panel System".
4. **The Nav:** Replace the standard generic Sidebar with a highly minimal, typography-driven navigational spine.

## Agent Visualization (The Soul)

- Inject "Agent Activity Streams" into the Prospector. When scanning, visually show an agent node (e.g., CORTEX) glowing and emitting data.
- The Outreach tab must visually frame HUNTER as an autonomous entity drafting emails in real-time.
