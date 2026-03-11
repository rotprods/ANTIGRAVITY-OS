# OCULOPS — Antigravity + Google Stitch MCP Prompt
## Generate Section Images for All Dashboard Screens
Version: 1.0

## Purpose
Use Antigravity with Google Stitch via MCP to generate **high-fidelity section images** for every major OculOps dashboard screen before full UI reconstruction.

The goal is **not** to redesign product logic.

The goal is to:
1. preserve the existing information architecture,
2. preserve the existing screen purposes and module hierarchy,
3. lock a premium visual system,
4. generate each dashboard as a set of reusable section images,
5. use those section images later as implementation references for the functional rebuild.

---

## Primary Source References

### Functional reference pack
Use the existing structural screen references as the source of truth for product logic and module layout:

- `UI_001_control_tower_dashboard`
- `UI_002_execution_os`
- `UI_003_market_intelligence`
- `UI_004_control_tower_ai_advisor`
- `UI_005_prospector_hub`
- `UI_006_ai_agents_control_center`

If available, load the screen reference index:
- `oculops_ui_reference_index.md`

These references define:
- screen names
- module order
- current functionality
- route identity
- component relationships

### Master visual style references
Use the latest approved white/yellow/black premium UI references as the visual DNA baseline.

Primary style references:
- `83002997-1AEE-4149-850A-89C65B8D5F36.webp`
- `6373E2AE-7857-46EA-9B60-336D01CAB516.webp`
- `57E2FA2B-80DF-4634-89A3-58635B6E0020.webp`
- `D248D39F-E5CC-4B37-859F-4C9182D726B5.webp`
- `E631514C-D43F-4F8D-8096-54785D02276F.webp`

Use them to extract:
- color behavior
- surface treatment
- panel depth
- spacing rhythm
- typography feel
- sidebar language
- dashboard hierarchy
- KPI card styling
- live/interactivity cues

---

## Core Instruction

You are a premium product design system generator working inside Antigravity with Google Stitch via MCP.

Your mission is to generate **section-based UI images** for the OculOps app.

Do **not** generate whole product screens first.

Generate the app **section by section**, so the design system can later be assembled into full dashboard screens.

The final style must feel like:

- Apple-grade minimalism
- white-dominant interface
- yellow intelligence signal
- black structure and typography
- premium boutique SaaS
- subtle 3D depth
- soft glassmorphism
- live interactive feeling
- TouchDesigner-inspired reactive logic
- implementation-ready product UI

This is **not**:
- a dark generic SaaS dashboard
- cyberpunk neon
- gaming HUD
- concept art
- dribbble fantasy UI

This is a real premium AI operating system dashboard.

---

## Global Style Lock

### Palette
- White / warm white surfaces dominate
- Yellow is the active intelligence signal
- Black is structural, typographic, and framing
- Use green only for live / online states
- Allow very subtle blue or red only when they are true operational secondary signals

### Material system
- soft matte white surfaces
- refined dark surfaces only when hierarchy requires it
- subtle glassmorphism
- thin 1px borders
- inner glow
- premium soft shadows
- slight 3D dimensionality
- tactile UI objects

### Motion-implied system
Even though static images are being generated, every section should **feel alive**.

Use implied motion cues:
- subtle pulse states
- live status shimmer
- soft edge glow
- active query emphasis
- orchestration bars
- reactive borders
- hover-ready card depth

### Typography
- Sans-serif for all operational UI
- Clean product-grade hierarchy
- Premium editorial serif only where needed for hero emphasis
- No noisy typography

---

## Non-Negotiable Rules

1. Preserve current screen purpose.
2. Preserve current module order.
3. Preserve route identity.
4. Do not invent new product logic.
5. Do not remove required sections.
6. Improve only the visual system and section hierarchy.
7. Every section image must be reusable.
8. Every section must feel like the same design family.
9. Output images must be clean enough for UI rebuild reference.
10. Prioritize product realism over visual spectacle.

---

## Output Directory Structure

Create and save section images using this folder structure:

```text
/exports/oculops-sections/
  UI_001_control_tower/
  UI_002_execution_os/
  UI_003_market_intelligence/
  UI_004_ai_advisor/
  UI_005_prospector_hub/
  UI_006_ai_agents/
```

File naming convention:

```text
UI_001_A_sidebar.png
UI_001_B_top_header.png
UI_001_C_hero_banner.png
UI_001_D_kpi_cards.png
...
```

If variants are created:

```text
UI_001_A_sidebar_v2.png
UI_006_C_main_orchestrator_card_v3.png
```

---

## Export Requirements

For each generated image:
- high fidelity
- desktop UI framing
- no device mockup
- no real-world desk/laptop scene
- straight-on product composition
- readable enough for implementation reference
- same style family as the master references

Also create one markdown manifest:

`/exports/oculops-sections/sections_manifest.md`

This file must include:
- section file name
- screen ID
- section purpose
- notes
- reference source
- whether approved / pending

---

# SECTION GENERATION PLAN

---

## UI_001 — Control Tower Dashboard

### Required sections
1. `UI_001_A_sidebar`
   - left navigation rail
   - account footer
   - grouped nav sections

2. `UI_001_B_top_header`
   - search
   - live state
   - top utility controls

3. `UI_001_C_hero_banner`
   - OculOps system activity summary
   - live intelligence banner
   - premium hero panel

4. `UI_001_D_primary_kpi_cards`
   - Health Score
   - MRR
   - Pipelines

5. `UI_001_E_secondary_metrics_grid`
   - clients
   - alerts
   - completion
   - signals
   - related intelligence cards

6. `UI_001_F_health_score_widget`
   - circular health visualization

7. `UI_001_G_quick_actions_row`
   - premium action buttons / capsules

8. `UI_001_H_main_body_composition`
   - assembled body without sidebar

---

## UI_002 — Execution OS

### Required sections
1. `UI_002_A_sidebar`
2. `UI_002_B_top_header`
3. `UI_002_C_summary_cards`
   - current day
   - completion
   - in progress

4. `UI_002_D_task_filters`
   - all
   - pending
   - in progress
   - completed

5. `UI_002_E_task_list_module`
   - execution plan list
   - rows
   - status markers

6. `UI_002_F_progress_bar_area`
7. `UI_002_G_main_body_composition`

---

## UI_003 — Market Intelligence

### Required sections
1. `UI_003_A_sidebar`
2. `UI_003_B_top_header`
3. `UI_003_C_page_title_block`
   - Market Intelligence
   - subtitle
   - mode buttons

4. `UI_003_D_signal_metric_cards`
   - macro
   - market
   - competition
   - technology

5. `UI_003_E_social_signal_radar_summary`
   - captured posts
   - hot opportunities
   - avg opportunity
   - avg sentiment

6. `UI_003_F_captured_post_card`
   - tags
   - title
   - excerpt
   - engagement
   - promote action

7. `UI_003_G_radar_summary_panel`
   - platform mix
   - total engagement
   - top topics

8. `UI_003_H_main_body_composition`

---

## UI_004 — AI Strategy Advisor / Control Tower Variant

### Required sections
1. `UI_004_A_quick_action_toolbar`
   - add lead
   - new signal
   - create task
   - new experiment
   - search leads

2. `UI_004_B_ai_strategy_advisor_header`
   - section heading
   - update control
   - source badge

3. `UI_004_C_signal_advisory_cards`
   - opportunity
   - risk
   - confidence
   - strategic summary cards

4. `UI_004_D_lower_dashboard_preview`
   - partial lower region styling if needed

---

## UI_005 — Prospector Hub

### Required sections
1. `UI_005_A_sidebar`
2. `UI_005_B_top_header`
3. `UI_005_C_title_and_kpi_strip`
   - Prospector Hub
   - leads
   - qualified
   - avg score

4. `UI_005_D_tab_system`
   - Airspace
   - Map
   - Scanner
   - Leads
   - Outreach
   - API Network

5. `UI_005_E_map_canvas`
   - large premium geospatial scanning view

6. `UI_005_F_flight_command_panel`
   - location chips
   - search
   - target query
   - radius
   - vertical controls
   - scan controls
   - sync controls
   - autopilot

7. `UI_005_G_airspace_intel_cards`
   - opportunity
   - target count
   - lower intel modules

8. `UI_005_H_main_body_composition`

---

## UI_006 — AI Agents Control Center

### Required sections
1. `UI_006_A_sidebar`
2. `UI_006_B_top_header`
3. `UI_006_C_main_orchestrator_card`
   - CORTEX
   - live status
   - runs
   - avg time
   - last run
   - orchestration controls

4. `UI_006_D_action_toolbar`
   - add lead
   - new signal
   - create task
   - new experiment
   - search leads
   - view messages

5. `UI_006_E_secondary_agent_cards_row_1`
   - ATLAS
   - ORACLE
   - FORGE

6. `UI_006_F_secondary_agent_cards_row_2`
   - HUNTER
   - HERALD
   - SCRIBE

7. `UI_006_G_lower_summary_panels`
   - top niches
   - active bets / system summaries

8. `UI_006_H_main_body_composition`

---

# Generation Method

For each section:

1. Use the functional reference screen as structure source.
2. Use the master visual style references as style source.
3. Generate a high-fidelity UI section image.
4. Save it with the correct file name.
5. Add it to `sections_manifest.md`.

After all sections for one screen are complete:
- generate one assembled **main body composition** image for that screen,
- but still keep the section images as the primary source of truth.

---

# Validation Rules

Before marking any section as approved, verify:

- it matches the correct screen purpose,
- it fits the OculOps style system,
- it preserves the module logic,
- it does not invent new functionality,
- it is implementation-friendly,
- it is consistent with the other generated sections.

If a section drifts stylistically, regenerate it before continuing.

---

# Final Result

The final output of this task is:

1. all section images for every major dashboard screen,
2. one main body composition image per screen,
3. one global `sections_manifest.md`,
4. a clean visual reference library ready for Antigravity implementation.

---

# Final Execution Instruction

Execute this task section by section, not screen-by-screen in one giant uncontrolled pass.

Prioritize this order:

1. UI_001 Control Tower
2. UI_006 AI Agents
3. UI_005 Prospector Hub
4. UI_003 Market Intelligence
5. UI_002 Execution OS
6. UI_004 AI Strategy Advisor

Do not skip the manifest.
Do not skip per-section saving.
Do not change the product logic.
Do not use generic UI generation.
