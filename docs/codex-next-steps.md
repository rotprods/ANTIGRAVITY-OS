# OCULOPS Codex Next Steps

## Purpose

This document is the canonical repo-synced execution staging doc for OCULOPS.

It is not a raw blueprint mirror. It is the working convergence document that:

- anchors execution to the source-of-truth architecture docs
- records current repo and runtime truth
- isolates contradictions instead of hiding them
- organizes the next execution cycle into four terminal-ready lanes
- serves as the intake document for the definitive implementation plan

## Promotion Status

- On 2026-03-15, the corrected cross-terminal audit pack was promoted into `/Users/rotech/OCULOPS-OS/docs/implementation-plan.md`.
- `codex-next-steps.md` remains the staging and evidence document.
- `implementation-plan.md` is now the authoritative execution order for convergence work.

## Canonical Sources

### Primary Architecture Inputs

- `/Users/rotech/Downloads/OCULOPS_V4_EXECUTION_PACK_MASTER_BLUEPRINT.md`
- `/Users/rotech/Downloads/OCULOPS_4_PROMPT_EXECUTION_SEQUENCE.md`
- `/Users/rotech/Downloads/X.pdf.pdf`
- `/Users/rotech/Downloads/H.pdf.pdf`

### Current Repo and Runtime Truth Inputs

- `/Users/rotech/OCULOPS-OS/CURRENT_TRUTH.md`
- `/Users/rotech/AGENCY_OS/OCULOPS_MAC_MINI_RUNTIME_MASTER.md`
- `/Users/rotech/AGENCY_OS/CONFIG/CLAWBOT_MASTER_OPERATING_SYSTEM.md`
- `/Users/rotech/AGENCY_OS/CONFIG/CONVERGENCE_MATRIX.md`
- `/Users/rotech/AGENCY_OS/CONFIG/FIRST_3_VERTICAL_SLICES.md`
- `/Users/rotech/AGENCY_OS/CONFIG/VALIDATION_MATRIX.md`
- `/Users/rotech/AGENCY_OS/CONFIG/V4_FINAL_GAP_CLOSURE_PLAN.md`
- `/Users/rotech/AGENCY_OS/CONFIG/OCULOPS_TOOL_TAXONOMY.md`

### Operational Truth Inputs

- `/Users/rotech/OCULOPS-OS/supabase/functions/_shared/orchestrator-core.ts`
- `/Users/rotech/OCULOPS-OS/supabase/functions/_shared/tool-bus.ts`
- `/Users/rotech/OCULOPS-OS/supabase/functions/_shared/ecosystem-readiness.ts`
- `/Users/rotech/OCULOPS-OS/supabase/functions/check-and-route/index.ts`
- `/Users/rotech/AGENCY_OS/ecosystem.config.js`
- `/Users/rotech/AGENCY_OS/MCP/oculops-mcp-server/api-gateway.js`
- `/Users/rotech/AGENCY_OS/RUNNERS/dashboard/dashboard_api.py`
- `/Users/rotech/AGENCY_OS/RUNNERS/dashboard/governance.py`
- `/Users/rotech/AGENCY_OS/RUNNERS/dashboard/memory_service.py`
- `/Users/rotech/AGENCY_OS/SCRIPTS/readiness_watcher.py`

## Sync Rules

### Rule Set

- Blueprint documents are authoritative for target architecture.
- `CURRENT_TRUTH.md` is authoritative for current `OCULOPS-OS` operating posture.
- Repo and runtime audit evidence are authoritative for current state.
- If a source doc conflicts with live code or live runtime evidence, log the conflict explicitly.
- Do not silently upgrade a partial component into a core claim.
- Do not treat decorative, duplicated, or synthetic artifacts as operating truth.
- This document may summarize source docs, but it must not overwrite their meaning.
- Supporting PDFs are secondary evidence unless they conflict with the blueprint or audited repo/runtime truth.

### Update Discipline

- Update this file first when a convergence decision changes execution order.
- Add new contradictions to the decision log before changing implementation language elsewhere.
- Keep this file documentation-only until the definitive implementation plan is approved.
- When a lane finishes, convert its open items into validated evidence or explicit carry-forward gaps.

## System Naming and Alias Map

| Role | Canonical Name in This Doc | Current Aliases in Repo/Runtime | Status |
| --- | --- | --- | --- |
| Product and control plane | OCULOPS Control Plane | `OCULOPS-OS`, Antigravity OS surfaces | Real |
| Local runtime stack | OCULOPS Runtime | `AGENCY_OS`, Mac Mini runtime | Real |
| Intended governor | CloudBot Governor | `ClawBot`, `OpenClaw`, `CEO Chatbot v2`, Telegram director flows | Partial |
| Workforce runtime | Agent Zero Workforce | `Agent Zero`, local browser agent container | Partial |
| Local inference layer | Ollama Runtime | Ollama, mixed Gemini/OpenAI/Ollama routing | Partial |
| Automation engine | n8n Runtime | native `n8n`, Docker `n8n` | Real but duplicated |

## Current Truth Snapshot

### What Is Real Now

**FACT**
- OCULOPS exists today as two working codebases: `/Users/rotech/OCULOPS-OS` for the product and control plane, and `/Users/rotech/AGENCY_OS` for the local runtime.
- The local runtime is live: PM2 processes, Docker services, Ollama, Qdrant, gateway services, dashboard API, voice server, chains gateway, and at least one Agent Zero container are present.
- `OCULOPS-OS` contains the real control surface and Supabase orchestration core.
- `AGENCY_OS` contains the real local runtime services, governance scripts, readiness watchers, and service wiring.
- Ollama has installed models and Qdrant has populated collections.

**INFERENCE**
- The system is no longer a concept or stub set. It is an active hybrid control plane plus sovereign runtime.

**RISK**
- Because the runtime is live, ungoverned behavior and false-green readiness are materially dangerous.

**REQUIRED ACTION**
- Treat the system as a hybrid operating environment until governance, registries, and governor identity are singular.

### What Is Partial

**FACT**
- CloudBot is not singular. Current implementations are split across OpenClaw, ClawBot docs, Telegram bot flows, gateway routes, and workflow definitions.
- Model routing is mixed. Local runtime routes some tasks through Ollama, while control-plane agent logic still uses cloud-first paths in places.
- Agent Zero is running, but there is not yet a clean governed caller path that proves it is part of the core execution chain.
- Governance exists, but at least one gated action claim is contradicted by live validation behavior.
- Readiness exists, but readiness artifacts are duplicated and not fully authoritative.

**INFERENCE**
- Partial components are operational enough to be confusing, but not converged enough to be trusted as core.

**RISK**
- Partial systems create false confidence because they look integrated while still bypassing governance or using duplicate truth sources.

**REQUIRED ACTION**
- Reclassify each partial component into one of three states: core, experimental, or not in core claims.

### What Collides

**FACT**
- Runtime identity is split across `OCULOPS`, `CloudBot`, `ClawBot`, `OpenClaw`, `Agency OS`, and legacy naming.
- `n8n` topology is duplicated between native and Docker runtimes.
- Registry truth is duplicated between generated `CONFIG/*.json` files and synthetic `CONFIG/registries/*.json` files.
- Readiness truth is duplicated across separate generated artifacts.
- Some live services are not running from the canonical repo path.
- Tunnel and exposure paths are duplicated and unstable.

**INFERENCE**
- The main architecture problem is not missing software. It is split truth and split authority.

**RISK**
- Duplicate truth sources will keep producing incompatible implementation choices and misleading readiness claims.

**REQUIRED ACTION**
- Collapse to one truth source for naming, registries, readiness, automation topology, and exposure topology.

### What Must Not Be Claimed Yet

**FACT**
- The system does not yet have one canonical governor identity.
- The system now has one canonical registry pack at `/Users/rotech/AGENCY_OS/CONFIG/canonical`; remaining work is to keep downstream docs and product surfaces aligned to it.
- The system does not yet have one canonical automation topology.
- The system does not yet have a proven governed path into Agent Zero.
- The system does not yet have uniform local-first model policy enforcement.

**INFERENCE**
- OCULOPS is ready for phased convergence, not direct full-architecture execution.

**RISK**
- Claiming direct execution readiness now would hide governance and topology debt.

**REQUIRED ACTION**
- Keep all public and internal architecture language aligned to phased convergence until the missing core claims are machine-proven.

## Execution Contracts

Each lane below is an execution contract, not just a topic list. Work inside a lane is only complete when its outputs and validation criteria are satisfied.

### Group 1: Control Plane and Product Surface

**Owner**
- Terminal 1 operator

**Objective**
- Converge the product shell and Supabase control plane into one explicit control-plane truth that routes privileged behavior toward the intended governor model.

**Owned Subsystems**
- `OCULOPS-OS` UI and module shell
- Supabase orchestration
- tool bus
- action routing
- dashboard surfaces
- readiness hooks inside the product

**Inputs**
- `CURRENT_TRUTH.md`
- control-plane shared functions
- dashboard modules
- action registry references

**Outputs**
- current control-plane truth map
- inventory of direct runtime calls from the UI
- inventory of direct provider calls that bypass the intended governor path
- required governor-routing changes list

**Dependencies**
- naming map from this document
- runtime lane confirmation of canonical gateway and readiness endpoints

**Validation Criteria**
- every privileged or runtime-bound action is classified as direct, routed, or missing
- every direct runtime call is explicitly marked for retention, reroute, or removal
- no dashboard action is treated as core without a named caller, callee, permission path, and return path

### Group 2: Runtime, Governance, and Readiness

**Owner**
- Terminal 2 operator

**Objective**
- Produce one authoritative runtime manifest and governance truth model for the local operating environment.

**Owned Subsystems**
- API gateway
- dashboard API
- governance engine
- PM2 estate
- Docker runtime
- readiness watchers
- service health and port topology

**Inputs**
- `ecosystem.config.js`
- dashboard runtime scripts
- readiness artifacts
- live process and service evidence

**Outputs**
- canonical runtime manifest
- permission model for runtime entry points
- false-green readiness findings
- governance enforcement gap list
- canonical readiness artifact recommendation

**Dependencies**
- source naming alignment from this document
- workflow lane confirmation of exposed ports and tunnel ownership

**Validation Criteria**
- every major runtime service has owner, entry point, health path, port, and supervision status
- every runtime entry point states permission model and return path
- all duplicated readiness artifacts are classified as canonical, derived, or deprecated
- governance claims are checked against real validation behavior, not only documentation

### Group 3: Workflows, n8n, Tunnels, and External Exposure

**Owner**
- Terminal 3 operator

**Objective**
- Collapse automation and exposure topology into one canonical operational path.

**Owned Subsystems**
- native `n8n`
- Docker `n8n`
- webhook bridge mappings
- workflow ownership
- localtunnel and Cloudflare exposure paths
- external endpoint publication

**Inputs**
- workflow exports
- bridge maps
- tunnel scripts
- runtime exposure config
- live health evidence

**Outputs**
- single canonical automation topology recommendation
- single canonical exposure path recommendation
- workflow ownership map
- tunnel and external-surface risk list
- deprecation list for duplicate or unstable exposure paths

**Dependencies**
- runtime lane confirmation of gateway ownership
- control-plane lane inventory of workflow callers

**Validation Criteria**
- each core workflow has one authoritative runtime path
- `n8n` duplication is resolved into primary and deprecated states or justified roles
- every public exposure path is named, owned, and either retained or deprecated
- no dead or unstable tunnel remains in core claims

### Group 4: Memory, Inference, Workforce, and Convergence Docs

**Owner**
- Terminal 4 operator

**Objective**
- Align memory, inference, workforce, and convergence documentation with one real operating model.

**Owned Subsystems**
- Qdrant memory
- Ollama
- model routing
- Agent Zero
- OpenClaw and CloudBot reality
- registry pack
- convergence docs

**Inputs**
- runtime memory and inference services
- registry files
- convergence docs
- local model inventory
- workforce runtime references

**Outputs**
- registry truth map
- model-routing truth map
- workforce path status
- governor identity convergence recommendation
- definitive-plan prerequisites list

**Dependencies**
- runtime lane confirmation of actual running services
- control-plane lane inventory of agent and tool callers

**Validation Criteria**
- every registry file is classified as canonical, generated, synthetic, or deprecated
- every agent and model path is classified as local-first, hybrid, cloud-routed, or missing
- Agent Zero is either brought under a governed caller path or explicitly marked non-core
- all convergence docs reflect the same current-state posture

## Terminal Execution Checklists

Run these in parallel, but do not close a lane until its exit criteria and handoff items are complete.

### Parallel Start Order

- Terminal 2 starts first and publishes the initial runtime manifest and permission model.
- Terminal 1 can start immediately, but it must reconcile any runtime endpoint assumptions against Terminal 2 outputs before closing.
- Terminal 3 can start immediately on workflow and tunnel inventory, but it must wait for Terminal 2 before declaring a canonical exposure path.
- Terminal 4 can start immediately on registries, memory, and model routing, but it must consume Terminal 2 runtime truth before making core or non-core claims.

### Terminal 1 Checklist: Control Plane and Product Surface

- [ ] Read `CURRENT_TRUTH.md` and the control-plane shared functions before classifying any surface.
- [ ] Inventory every UI path that calls Edge Functions, local runtime endpoints, or third-party providers.
- [ ] For every major action, capture caller, callee, permission path, and return path.
- [ ] Mark each action as `core`, `partial`, `experimental`, `orphaned`, or `missing`.
- [ ] Identify any dashboard or module surface that still calls providers or runtime services directly.
- [ ] Separate retained direct calls from calls that must be rerouted through the governor path.
- [ ] Produce the control-plane truth map.
- [ ] Produce the direct-call inventory and governor-reroute list.

**Handoff to Other Terminals**
- Share runtime endpoint assumptions with Terminal 2.
- Share workflow callers with Terminal 3.
- Share agent and tool caller inventory with Terminal 4.

**Exit Criteria**
- Every privileged product action is classified.
- Every direct runtime or provider call is marked retain, reroute, or remove.
- The control-plane truth map is consistent with Terminal 2 runtime ownership.

### Terminal 2 Checklist: Runtime, Governance, and Readiness

- [ ] Inventory PM2 processes, Docker containers, listening ports, and health endpoints.
- [ ] Compare live runtime services against `ecosystem.config.js` and other declared registries.
- [ ] Document every runtime entry point with owner, script path, health path, permission model, and return path.
- [ ] Confirm which services are running from outside the canonical repo tree.
- [ ] Audit governance validation behavior for documented gated actions.
- [ ] Audit readiness artifacts and classify each as canonical, derived, synthetic, or stale.
- [ ] Produce the canonical runtime manifest.
- [ ] Produce the governance gap list and canonical readiness recommendation.

**Handoff to Other Terminals**
- Publish the runtime manifest to Terminals 1, 3, and 4.
- Publish the approved gateway, health, and readiness endpoints.
- Publish the list of undeclared or unsafe runtime entry points.

**Exit Criteria**
- Every major runtime node has a named owner and supervision model.
- Every runtime entry path has a permission model and return path.
- Governance mismatches between docs and live behavior are explicitly logged.
- One readiness artifact is recommended as canonical.

### Terminal 3 Checklist: Workflows, n8n, Tunnels, and External Exposure

- [ ] Inventory native `n8n`, Docker `n8n`, workflow exports, bridge maps, and trigger paths.
- [ ] Identify which callers route into workflows from the control plane, gateways, or public endpoints.
- [ ] Map webhook ownership, ingress ports, and return paths for the main workflow families.
- [ ] Inventory all active tunnels and exposure paths.
- [ ] Classify each workflow and exposure path as canonical, duplicate, experimental, blocked, or deprecated.
- [ ] Decide whether native `n8n` or Docker `n8n` is the core automation runtime recommendation.
- [ ] Produce the canonical automation topology recommendation.
- [ ] Produce the canonical exposure path recommendation and deprecation list.

**Handoff to Other Terminals**
- Share workflow caller inventory with Terminal 1.
- Share canonical exposure recommendation with Terminal 2.
- Share workflow ownership and automation dependencies with Terminal 4.

**Exit Criteria**
- Each core workflow family has one authoritative runtime path.
- Each public exposure path has a named owner and status.
- Duplicate or unstable tunnel paths are explicitly marked for removal or downgrade.
- `n8n` topology is resolved into primary and non-core roles.

### Terminal 4 Checklist: Memory, Inference, Workforce, and Convergence Docs

- [ ] Inventory Qdrant collections, memory services, Ollama models, model routers, Agent Zero references, and governor-related docs.
- [ ] Classify every registry file as canonical, generated, synthetic, deprecated, or conflicting.
- [ ] Map current agent and model paths as local-first, hybrid, cloud-routed, or missing.
- [ ] Determine whether Agent Zero has a governed caller path or remains non-core.
- [ ] Determine whether CloudBot, ClawBot, and OpenClaw can be converged into one governor identity or must remain explicitly split.
- [ ] Reconcile convergence docs against audited repo and runtime truth.
- [ ] Produce the registry truth map.
- [ ] Produce the model-routing truth map, workforce status, and definitive-plan prerequisites list.

**Handoff to Other Terminals**
- Share governor naming and identity recommendation with all terminals.
- Share registry truth classification with Terminals 1 and 3.
- Share workforce and model-routing status with Terminal 2 for runtime manifest alignment.

**Exit Criteria**
- Every registry has a truth classification.
- Every major model and agent path has a routing classification.
- Agent Zero is explicitly classified as core, partial, experimental, or non-core.
- Convergence docs no longer contradict the audited current-state posture.

## Decision Log

### Open Contradictions

**FACT**
- The blueprint describes a governed hypermesh OS centered on a sovereign Mac Mini runtime, while current repo reality still spans a hybrid control plane and local runtime split.
- `CloudBot`, `ClawBot`, and `OpenClaw` are being used as if they describe one governor, but current implementation evidence suggests multiple partial versions.
- Native `n8n` and Docker `n8n` are both live.
- Registry truth exists in both generated `CONFIG/*.json` files and synthetic `CONFIG/registries/*.json` files.
- Readiness truth exists in multiple artifacts rather than one canonical readiness source.
- `publish_content` is documented as gated in vertical-slice docs, but live governance validation evidence has contradicted that claim.
- A live `integration-hub` process has been observed running from outside the canonical repo tree.

**INFERENCE**
- The system can act, but it cannot yet claim one singular operating center.

**RISK**
- If these contradictions stay unresolved, the final implementation plan will optimize around fiction instead of proof.

**REQUIRED ACTION**
- Keep each contradiction open until a single owner, single path, and single truth source are assigned.

### Required Approvals

**FACT**
- The following decisions change architecture, not just implementation detail:
  - canonical governor name and owner
  - canonical `n8n` runtime
  - canonical tunnel and exposure path
  - canonical registry pack
  - canonical readiness artifact
  - canonical model-routing policy

**INFERENCE**
- These decisions should be made once and then propagated everywhere.

**RISK**
- If they are resolved ad hoc by lane, split-brain architecture will continue.

**REQUIRED ACTION**
- Promote these decisions into the first convergence review before drafting the definitive implementation plan.

## Final-Plan Intake Checklist

The definitive implementation plan should not be drafted until the following evidence exists or is explicitly waived.

### Required Evidence

- one approved naming map for the system and governor
- one approved runtime manifest
- one approved registry truth source map
- one approved readiness truth source
- one approved automation topology
- one approved exposure topology
- one approved model-routing policy
- one governed classification for Agent Zero
- one documented list of deprecated surfaces and duplicate artifacts

### Required Lane Deliverables

- Group 1 control-plane truth map and direct-call inventory
- Group 2 runtime manifest and governance gap list
- Group 3 automation and exposure topology recommendation
- Group 4 registry and model-routing truth map

### Required Gate Before Definitive Plan

- all known contradictions are either resolved or accepted as scoped exceptions
- all core claims are backed by repo or runtime evidence
- all remaining unknowns are listed as explicit dependencies, not hidden assumptions

## Working Posture

**FACT**
- This phase is documentation-only.
- No runtime, API, schema, or service implementation changes are part of this document.

**INFERENCE**
- The fastest way to converge is to clarify truth and execution order before modifying the operating system again.

**RISK**
- If implementation starts before these contracts are stabilized, the repo will gain more activity but less coherence.

**REQUIRED ACTION**
- Use this document as the working handoff artifact for the next convergence cycle, then turn its validated outputs into the definitive implementation plan.
