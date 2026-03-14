# OCULOPS Mac Mini Unified Roadmap
Updated: 2026-03-14T13:35 (session 2 — Stitch V2 design integration)  
Scope: Unified recap + implementation roadmap to close the Level-7 convergence gap

## 1) Executive Context
Oculops is already a high-capability SaaS body. The remaining gap is agentic convergence: control-plane governance, deterministic readiness visibility, provider-backed runtime, and production-grade operations.

Mac Mini is treated as the physical AI-Server runtime:
- n8n + AI stack (ComfyUI / Agent Zero / local LLMs via Ollama)
- public ingress via Cloudflare tunnel
- webhook target for Oculops control-plane and automation orchestration

This document consolidates:
- what is already completed in this chat,
- what is pending,
- the exact ordered roadmap (Step 0 to Step 15),
- and a ready-to-run prompt for Mac Mini execution/audit.

## 2) Session Closure Snapshot (Already Completed)

### Session 1 — Control-plane convergence
Production sync evidence:
- Git commit deployed on `main`: `d262462c0b69d3744f9ae784937b89bae2d57bea`
- `HEAD == origin/main` and clean working tree
- Supabase edge deploy completed for `study-publisher`
- Vercel production deploy completed and aliased to `https://oculops.com`
- Domain check passed: `HTTP/2 200`

Quality gates executed:
- `npm run lint` passed (existing warnings in `FlightDeck.jsx`, no new errors)
- `npm test` passed (`177/177`)
- `npm run build` passed

Readiness and governance baseline:
- `npm run readiness:gate` executed
- Synthetic gate is operational (`overall_state` currently yellow)
- `ecosystem-readiness.latest.json` generated and usable as source-of-truth artifact

### Session 2 — Stitch V2 Ivory OS Design Integration (Current)
Full-stack design system overhaul:
- Stitch V2 Ivory OS extracted from `dashboard_screenshots/stitch-final/` (35 folders)
- 14 files changed, 1266 insertions, 632 deletions
- 2 new CSS files created (`Finance.css`, `Execution.css`)
- `npm run build` passed — `✓ built in 3.48s`
- All 6 core modules visually verified against Stitch Final HTML references

Files modified in this session:
```
 M src/components/Sidebar.css                (Stitch V2 sidebar: rounded nav, gold active)
 M src/components/modules/Agents.css         (Stitch V2 agent cards, status pills)
 M src/components/modules/Agents.jsx         (Stitch V2 hero banner, KPI grid)
 M src/components/modules/ControlTower.css   (Stitch V2 hero, 4-col KPIs, tables)
 M src/components/modules/ControlTower.jsx   (Stitch V2 KPI content, hero layout)
 M src/components/modules/Execution.jsx      (Full rewrite: hero + table + status pills)
 M src/components/modules/Finance.jsx        (Full rewrite: hero + KPIs + transactions)
 M src/components/modules/Intelligence.css   (Stitch V2 cards, tables, filters)
 M src/components/modules/Messaging.css      (Stitch V2 bubbles, compose, status)
 M src/components/modules/Pipeline.css       (Stitch V2 Kanban columns, deal cards)
 M src/components/modules/Pipeline.jsx       (Stitch V2 header, action buttons)
 M src/styles/global.css                     (Sticky header, backdrop blur, max-width)
 A src/components/modules/Execution.css      (NEW — task table, progress bars)
 A src/components/modules/Finance.css        (NEW — KPIs, form card, data table)
```

Design tokens applied across all modules:
```
Background:     #FAFAF8 (Ivory base)
Cards:          #FFFFFF with border #E8E8E4 + inset 0 1px 0 rgba(255,255,255,1)
Accent:         #D4A843 (Gold)
Text Primary:   #1A1A1A
Text Secondary: #6B6B6B
Text Tertiary:  #8A8A8E
Border Radius:  12px (cards), 9999px (pills/badges)
Typography:     Inter, 32px bold KPIs, 11px uppercase labels
Shadows:        0 2px 5px -1px rgba(0,0,0,0.05)
Status Colors:  #34C759 (green), #FF3B30 (red), #FF9500 (orange), #007AFF (blue)
```

## 3) What We Already Built in This Program
Control-plane and enforcement:
- Hard-block policy active for legacy high/critical routes without control-plane/tool-bus evidence
- Reroute pattern active for high-risk legacy paths (`compose_message`, `run_connector`, `run_api`) via control-plane/tool-dispatch
- Failure taxonomy and smoke coverage added for critical routing scenarios

Readiness convergence:
- Canonical readiness generation/check scripts integrated in release gate flow
- Frontend baseline wiring to readiness states started in Control Tower and key modules
- Run trace visibility by correlation id introduced for operator diagnostics

Synthetic operations:
- AG2-C6 synthetic harness validated for outbound -> inbound -> replied path
- Operational smoke artifacts available in `docs/runbooks/*.latest.json`

Project APIs -> n8n bridge:
- Build/injection tooling and docs/reporting artifacts added
- Post-deploy persistence verification and live reconciliation remain in next block

### 3.5) Stitch V2 Ivory OS — Full Design System Integration (Session 2)
Completed modules (all with dedicated CSS + JSX updates):

| Module | CSS | JSX | Key Changes |
|--------|-----|-----|-------------|
| **Sidebar** | ✅ Rewritten | — | 32px rounded logo, gold active state, group headers, improved scrollbar |
| **Control Tower** | ✅ Rewritten | ✅ Updated | Hero banner, 4-col KPI grid with progress bars, section cards with inner shadow |
| **Pipeline** | ✅ Rewritten | ✅ Updated | Kanban columns with 3px color bars, white deal cards, pill count badges |
| **Finance** | ✅ New file | ✅ Full rewrite | Hero, 4-col KPIs (revenue/expenses/profit/margin), transactions table, form card |
| **Execution** | ✅ New file | ✅ Full rewrite | Hero, 4-col KPIs, task table with status pills + mini progress bars, gate pills |
| **Intelligence** | ✅ Rewritten | — (474 lines preserved) | Card-based category cells, 32px values, clean data tables, rounded pill filters |
| **Messaging** | ✅ Rewritten | — (414 lines preserved) | Rounded cards, golden outbound bubbles, circular avatars, pill status badges |
| **Agents** | ✅ Rewritten | ✅ Updated | Hero banner, agent cards, pill-shaped status indicators |
| **Global** | ✅ Updated | — | Sticky header with backdrop blur, 1400px max-width |

Design patterns applied consistently:
1. **Hero Banners** — Full-width card with gradient overlay, title/subtitle, status pill (LIVE/Day N)
2. **KPI Grids** — 4-column, each card: label → 32px value → 4px progress bar, gold accent on first
3. **Data Tables** — Uppercase 11px headers, hover rows, pill-shaped type/status badges
4. **Filter Buttons** — Pill-shaped, active = gold filled, inactive = outlined with hover
5. **Status Pills** — Semantic colors with 8% alpha translucent backgrounds
6. **Form Cards** — Sidebar form cards with 11px uppercase labels and focus glow ring

## 4) Remaining Gap to Close Initial Plan
Critical remaining gap:
- Move from synthetic-valid to provider-backed connected in critical modules
- Finish deterministic frontend convergence across all operator surfaces
- Complete production strict gate rollout with connected-required policy
- Close n8n live reconciliation and bridge persistence verification loop
- Finish E2E authenticated operator flows and release hardening

Current known blockers:
- Provider credentials/OAuth activation (intentionally deferred to final stage)
- n8n MCP host/session reload consistency when tunnel changes
- Some UI readiness reason/remediation fields still partial outside Control Tower

## 5) Unified Roadmap (Step 1 to Step 15)

| Step | Name | Owner | ETA | Status | Definition of Done |
|---|---|---|---|---|---|
| 1 | Close current block in Git/Deploy | AG2 | Done | Done | Commit on `main`, Supabase + Vercel deploy, domain 200, clean tree |
| 2 | Stabilize Project APIs -> n8n bridge | AG2 + Mac Mini | 0.5-1 day | In progress | `apiInjection` persisted in workflow config + metadata, live reconciliation report green |
| 3 | Backend -> Frontend readiness convergence | AG2 + AG1 | 1-2 days | Pending | UI states and backend artifact match for all mapped modules |
| 4 | Production cutover (provider-backed) | AG2 + Mac Mini | 1-2 days | Pending | Critical modules `connected`, real provider smoke green, production gate green |
| 5 | Operational hardening | AG2 | 1-2 days | Pending | SLO alerts/runbooks/rollback path validated |
| 6 | Unified observability layer | AG2 + AG1 | 1 day | Pending | Single ops dashboard for traces, governance, readiness, routing |
| 7 | Incident response automation | AG2 | 1 day | Pending | Auto-remediation playbooks for top failure classes |
| 8 | Cost governance enforcement | AG2 | 1 day | Pending | Budget guardrails and hard stops active by org/agent/workflow |
| 9 | Security hardening pass | AG2 | 1-2 days | Pending | Secret rotation policy, permission audit, dependency checks documented |
| 10 | DR/continuity validation | AG2 + Ops | 1 day | Pending | Backup/restore test with measured RTO/RPO |
| 11 | Memory quality lifecycle | AG2 | 1 day | Pending | Memory retention/promotion/dedup rules applied and monitored |
| 12 | Self-improvement safety loop | AG2 | 1-2 days | Pending | Patch proposal -> simulation -> approval gate -> controlled rollout |
| 13 | Adaptive routing optimization | AG2 | 1 day | Pending | Runtime routing by score/latency/cost with telemetry |
| 14 | Multi-tenant reliability pass | AG2 | 1 day | Pending | Strong org isolation and quota/fairness validation |
| 15 | Enterprise release finish | AG1 + AG2 | 1 day | Pending | Authenticated E2E green, operator UX finalized, release checklist signed |

## 6) Immediate Execution Sequence (Next 72h)
Order is strict unless blocked:

1. Step 2 complete:
   - verify persisted `apiInjection` in `automation_workflows.steps[].config`
   - verify `metadata.api_injection`
   - run n8n live reconciliation and store artifact
2. Step 3 complete:
   - finalize frontend mapping for `state_reason_code` + `remediation_action`
   - unify readiness states across Control Tower, Messaging, Automation, Marketplace, API Catalog
3. Step 4 complete:
   - switch to provider-backed checks
   - set production readiness mode
   - run real round-trip smokes and force critical modules to connected
4. Step 5 start:
   - activate runtime alerting and incident/rollback runbooks

## 7) AG2 vs AG1 vs Mac Mini Split
AG2 (Backend / Control Plane):
- control-plane contracts
- tool-bus/governance enforcement
- readiness artifact generation/checks
- smokes/reconciliation scripts
- production gate policy and deploy paths

AG1 (Frontend / Operator UX):
- readiness visualization and consistency
- correlation trace drilldown UX
- remediation links and reason-code clarity
- authenticated E2E coverage

Mac Mini (Physical Runtime / Connectors):
- n8n live runtime and webhook ingress stability
- connector/provider credential onboarding
- provider-backed validation loop
- operational key rotation and host continuity

## 8) Acceptance Gates by Stage
Stage A (Step 2-3):
- `npm run lint` pass
- `npm test` pass
- `npm run build` pass
- readiness artifact generated and consistent with UI

Stage B (Step 4):
- production readiness gate pass
- real provider smokes pass (`outbound -> inbound -> replied`)
- critical modules all in `connected`

Stage C (Step 5+):
- observability + incident + rollback validated
- budget/security/DR gates validated
- release checklist closed

## 9) Risks and Mitigations
Risk: Cloudflare tunnel volatility changes n8n endpoint.  
Mitigation: update MCP/server env and rerun `n8n_health_check` before reconciliation.

Risk: OAuth/provider restrictions block real runtime validation.  
Mitigation: keep synthetic gates for development; perform production cutover only after provider credentials are live.

Risk: UI shows green without backend evidence.  
Mitigation: enforce artifact-driven rendering and CI gate on readiness artifact.

## 10) Prompt Pack for Mac Mini (Audit + Implementation)
Copy/paste this into the Mac Mini execution terminal:

```md
You are executing the OCULOPS convergence closeout.

Current deployed baseline:
- commit: d262462c0b69d3744f9ae784937b89bae2d57bea
- production domain: https://oculops.com (HTTP 200)
- readiness gate operational in synthetic mode

Execute now in order:
1) Validate n8n runtime health and workflow inventory against live tunnel host.
2) Reconcile Project APIs -> n8n bridge and confirm persistence:
   - automation_workflows.steps[].config.apiInjection
   - metadata.api_injection
3) Run critical smoke suite:
   - hard-block denial for legacy high-risk direct paths
   - allowed routing through control-plane/tool-bus
   - synthetic or provider-backed round-trip outbound -> inbound -> replied
4) Regenerate readiness artifact and publish evidence:
   - docs/runbooks/ecosystem-readiness.latest.json
   - docs/runbooks/ecosystem-readiness.md
5) Report any mismatch between backend readiness and frontend states with explicit module keys.
6) If provider credentials are available, switch gate to production and enforce critical modules connected-only.

Output required:
- summary table by module (`state`, `reason_code`, `last_success_at`, `next_action`)
- smoke results with PASS/FAIL and correlation ids
- explicit blockers that require human credential/OAuth action
```

## 11) Source Files for Live Status
- `missings.md`
- `docs/missings.md`
- `docs/runbooks/ecosystem-readiness.latest.json`
- `docs/runbooks/ecosystem-readiness.md`
- `docs/runbooks/readiness-production-cutover.md`
- `docs/runbooks/provider-runtime-smoke.latest.json`
- `docs/runbooks/hard-block-routing-smoke.latest.json`
- `reports/n8n-api-context-injection.json`

