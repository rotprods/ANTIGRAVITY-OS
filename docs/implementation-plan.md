# OCULOPS Definitive Implementation Plan
> Updated: 2026-03-15
> Status: active convergence plan
> Basis: corrected cross-terminal audit pack plus repo-synced staging doc

## Objective

Converge OCULOPS into a governed hybrid operating system where:

- `OCULOPS-OS` is the product and control plane
- `AGENCY_OS` is the canonical runtime code owner
- `CloudBot Governor` is the governor role
- `ClawBot` is the live governor implementation label
- `OpenClaw` is the underlying runtime framework
- `oculops-api-gateway :38793` is the only justified broker
- native `n8n :5680` is the canonical workflow runtime
- the canonical readiness artifact is `/Users/rotech/AGENCY_OS/CONTEXT/ecosystem-readiness.latest.json`
- model policy is `hybrid with local-first preference`
- Agent Zero remains `non-core` until a governed caller path exists

This plan replaces the older pre-audit implementation draft and is now the authoritative build order for convergence work.

## Binding Inputs

### Repo truth

- `/Users/rotech/OCULOPS-OS/CURRENT_TRUTH.md`
- `/Users/rotech/OCULOPS-OS/docs/codex-next-steps.md`
- `/Users/rotech/AGENCY_OS/OCULOPS_MAC_MINI_RUNTIME_MASTER.md`
- `/Users/rotech/AGENCY_OS/CONFIG/CLAWBOT_MASTER_OPERATING_SYSTEM.md`
- `/Users/rotech/AGENCY_OS/CONFIG/FIRST_3_VERTICAL_SLICES.md`

### Corrected audit pack

- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-1/01_control_plane_truth_map.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-1/03_governor_reroute_list.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-2/01_runtime_manifest.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-2/02_permission_model.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-2/03_governance_gap_list.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-3/02_automation_topology_recommendation.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-3/03_exposure_path_recommendation.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-4/01_registry_truth_map.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-4/02_model_routing_truth_map.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-4/03_workforce_status.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/terminal-4/04_governor_identity_recommendation.md`
- `/Users/rotech/OCULOPS_MASTER/05_EXECUTION_OUTPUTS/_shared/HANDOFFS.md`

## Locked Decisions

| Decision | Locked rule for this plan | Why it is locked |
| --- | --- | --- |
| Runtime ownership | `AGENCY_OS` is the canonical runtime code owner. `/Users/rotech/OCULOPS-OS/AIOPS` is a transitional live launch workspace. `/Users/rotech/Downloads/rr` is out-of-tree and non-core until migrated or removed. | The corrected runtime manifest proved this is the real live split. |
| Governor naming | `CloudBot Governor` = role, `ClawBot` = live implementation label, `OpenClaw` = runtime framework. | This is the only naming model that matches live evidence without collapsing unlike things. |
| Automation topology | Native `n8n :5680` is canonical. Docker `n8n :5678` is non-core. `oculops-api-gateway :38793` is the only justified broker. | Terminal 3 closed this with runtime support from Terminal 2. |
| Readiness truth | `/Users/rotech/AGENCY_OS/CONTEXT/ecosystem-readiness.latest.json` is canonical. `http://127.0.0.1:38791/api/readiness` is its API projection. | This is the only machine-readable readiness source backed by the live watcher and dashboard API. |
| Exposure posture | Public exposure is `NO-GO` until gateway auth, named Cloudflare tunnel, owned DNS, and public ingress health checks are all in place. | Current tunnels are unstable and auth is ineffective. |
| Model policy | Current policy label is `hybrid with local-first preference`, not `local-first enforced`. | Live routing still includes Gemini and direct cloud-model paths. |
| Agent Zero | `non-core` until a governed caller path and pinned provider policy are proven. | The runtime is live, but the governed path is still missing. |
| Registry truth | `/Users/rotech/AGENCY_OS/CONFIG/canonical` is the canonical registry pack and is generated from live/runtime-backed sources. Design-only registries under `AGENCY_OS/CONFIG/registries` remain non-operational reference material. | The canonical pack is now the approved runtime truth source for dashboard and MCP registry reads. |
| Product entrypoint rule | Privileged product actions must move to `control-plane` or a governor-owned launcher. | The strongest current drift is caller fragmentation, not missing downstream infrastructure. |

## Out of Core Until Re-Proven

The following surfaces must not be treated as core during implementation:

- Docker `n8n :5678`
- Agent Zero direct ingress on `:50080`
- `integration-hub :38792`
- `OMNICENTER` ports `40000`, `40001`, `40002`
- `n8n-tunnel`, `op-mcp-tunnel`, and `cf-quick-tunnel`
- browser localhost health probes as product truth
- `/Users/rotech/Downloads/rr` runtime code
- synthetic registries under `AGENCY_OS/CONFIG/registries`

## Stop-Ship Issues Before Breadth Work

These are not optional cleanup items. They are the first implementation wave.

1. Gateway auth is ineffective on protected routes.
2. Siri is callable without a second factor.
3. Dashboard API is open and can write memory.
4. Integration Hub exposes mutating external-action routes with no auth.
5. Hardcoded tokens and secrets still exist in runtime code.
6. Voice ingress is duplicated and partly broken.
7. Public tunnels are unstable while readiness still reports false green.

No feature expansion, workflow growth, or public runtime claim should proceed until these are corrected and revalidated.

## Implementation Order

### Phase 0 — Ingress and Governance Hardening

**Goal**
- Turn the live open mesh into a minimally governed runtime boundary.

**Scope**
- Fix gateway auth enforcement in `AGENCY_OS/MCP/oculops-mcp-server/api-gateway.js`
- Add a real second factor or shared secret to `/api/v1/siri`
- Lock down `dashboard_api.py`, `integration_hub.py`, direct chains, direct voice, and host-exposed write surfaces
- Remove hardcoded tokens and secrets from executable runtime code
- Remove duplicate voice handlers and repair the broken voice proxy path
- Freeze public ingress as `NO-GO` until revalidated

**Primary repos and files**
- `/Users/rotech/AGENCY_OS/MCP/oculops-mcp-server/api-gateway.js`
- `/Users/rotech/AGENCY_OS/RUNNERS/dashboard/dashboard_api.py`
- `/Users/rotech/AGENCY_OS/RUNNERS/dashboard/integration_hub.py`
- `/Users/rotech/AGENCY_OS/RUNNERS/dashboard/governance.py`
- `/Users/rotech/AGENCY_OS/AGENTS/voice/voice_server.py`
- `/Users/rotech/AGENCY_OS/SCRIPTS/*.sh`

**Exit gate**
- Protected gateway routes return `401` or `403` when unauthenticated.
- Siri rejects unauthenticated calls.
- Dashboard memory writes are not publicly reachable.
- Integration Hub mutating routes are authenticated or removed from core.
- No secret material remains in tracked executable code.

### Phase 1 — Runtime Topology Convergence

**Goal**
- Reduce the runtime to one declared owner and one declared automation path.

**Scope**
- Migrate or remove out-of-tree runtime executables in `/Users/rotech/Downloads/rr`
- Decide the approved launch root and relaunch PM2-managed scripts from that root
- Keep `AGENCY_OS` as the canonical runtime code owner
- Canonicalize native `n8n :5680` and stop publishing Docker `n8n :5678` as core
- Dedupe `readiness-sync`, tunnel surfaces, and duplicated workforce process names
- Remove public editor assumptions and stale port defaults

**Exit gate**
- No core runtime executable runs from `/Users/rotech/Downloads/rr`.
- The live launch workspace is declared and repeatable.
- Native `n8n :5680` is the only core workflow runtime.
- Docker `n8n :5678` is isolated, stopped, or clearly sandboxed.

### Phase 2 — Control Plane and Governor Convergence

**Goal**
- Make privileged product behavior enter through one governed caller path.

**Scope**
- Adopt `control-plane` as the default entrypoint for privileged product actions
- Reroute the Messaging UI live-send path
- Reroute TouchDesigner command execution
- Reroute GTM and Herald direct agent launches
- Reroute write-capable connector execution
- Replace browser localhost readiness probes with an edge-backed readiness view
- Remove stale `5678` and `5679` assumptions from product surfaces
- Introduce one governor-owned agent launcher for product-triggered agent execution

**Primary repos and files**
- `/Users/rotech/OCULOPS-OS/src/hooks/useConversations.js`
- `/Users/rotech/OCULOPS-OS/src/components/modules/Messaging.jsx`
- `/Users/rotech/OCULOPS-OS/src/hooks/useReadiness.js`
- `/Users/rotech/OCULOPS-OS/src/components/modules/CommandCenter.jsx`
- `/Users/rotech/OCULOPS-OS/src/data/n8nAirdropIntel.js`
- `/Users/rotech/OCULOPS-OS/src/hooks/useConnectorProxy.js`
- `/Users/rotech/OCULOPS-OS/src/components/modules/GTM.jsx`
- `/Users/rotech/OCULOPS-OS/src/components/modules/HeraldAgent.jsx`
- `/Users/rotech/OCULOPS-OS/supabase/functions/td-command/index.ts`
- `/Users/rotech/OCULOPS-OS/supabase/functions/_shared/automation.ts`
- `/Users/rotech/OCULOPS-OS/supabase/functions/control-plane/index.ts`

**Exit gate**
- No privileged UI action sends directly to a provider, write-capable connector, or runtime command surface.
- Product readiness uses the canonical readiness artifact or its API projection.
- The governor entrypoint is explicit and consistent across product modules.

### Phase 3 — Registry, Readiness, and Memory Convergence

**Goal**
- Replace descriptive registry claims with one runtime-backed contract pack.

**Scope**
- Rebuild `agent`, `service`, `workflow`, `tool`, `memory`, and `dashboard_action` registries from live truth
- Mark synthetic registry files as design-only
- Reconcile memory taxonomy from 3 collections to the live 7-collection reality
- Align docs and runtime around the canonical readiness artifact
- Separate operational workflows from imported or community workflows
- Separate governed tools from raw n8n node catalogs

**Primary repos and files**
- `/Users/rotech/AGENCY_OS/CONFIG/*_registry.json`
- `/Users/rotech/AGENCY_OS/CONFIG/registries/*.json`
- `/Users/rotech/AGENCY_OS/CONTEXT/ecosystem-readiness.latest.json`
- `/Users/rotech/OCULOPS-OS/docs/codex-next-steps.md`
- `/Users/rotech/OCULOPS-OS/docs/OPERATIONS_ARCHITECTURE.md`

**Exit gate**
- One canonical registry pack exists and is backed by audited live truth.
- Synthetic registries are clearly non-operational.
- Memory and readiness docs match live runtime behavior.

### Phase 4 — Workforce and Model Policy Convergence

**Goal**
- Align the governor, workforce, and model-routing layers to one explicit operating rule.

**Scope**
- Propagate the governor naming policy across docs, runtime labels, and control-plane language
- Freeze the current model policy label as `hybrid with local-first preference`
- Decide whether the core governor remains Gemini-backed or is migrated to local Ollama for core claims
- Audit and reduce direct cloud-model calls in `OCULOPS-OS` Supabase functions
- Keep Agent Zero non-core until a governed caller path and provider policy are pinned
- Dedupe or retire parallel workforce daemons that create split ownership

**Exit gate**
- One governor naming model is used consistently.
- One model-routing policy label is used consistently.
- Agent Zero is either still non-core with documented reason or promoted only after proof.

### Phase 5 — Vertical Slice 1: HERALD Briefing

**Goal**
- Close the safest end-to-end governed slice first.

**Scope**
- Prove `readiness -> workflow -> model -> Telegram -> memory -> audit` on the corrected runtime boundary
- Use the canonical readiness artifact and native `n8n :5680`
- Route the messaging leg through the approved governed path
- Record audit evidence without relying on validation-only logs

**Reason for first position**
- This slice is already the closest to closure, it is lower risk than content publishing, and it validates the control-plane plus runtime plus memory chain without exposing write-heavy outbound surfaces first.

**Exit gate**
- A scheduled or manual HERALD run completes on the governed path with traceable logs, memory write, and delivery proof.

### Phase 6 — Vertical Slice 2: Lead-to-Notification

**Goal**
- Close the first operational outbound slice after hardening and governor reroutes are in place.

**Scope**
- Prove `governance -> native n8n -> lead scrape -> Supabase store -> memory -> Telegram or governed notification`
- Use retained workflow IDs only
- Make the notification leg use the approved governed path

**Exit gate**
- Lead-to-notification runs without direct unauthenticated runtime calls or out-of-tree workflow ownership.

### Phase 7 — Vertical Slice 3: Content Factory (FORGE)

**Goal**
- Close the content slice only after governance enforcement is proven, not just documented.

**Scope**
- Prove draft generation on the approved model-routing policy
- Revalidate `publish_content` as an actual blocked action until approval
- Route approval and publish through the singular governor path

**Critical note**
- This slice is intentionally last because the current docs claim `publish_content` is gated, while runtime evidence previously contradicted that claim.

**Exit gate**
- `publish_content` returns a real block before approval and only executes after approved release.

## Parallel Execution Groups

Use four execution groups, but keep the phase order above. Parallel work is allowed only inside each phase boundary.

| Group | Scope | Starts in phase | Cannot close until |
| --- | --- | --- | --- |
| Group A | Runtime, ingress, governance, secrets, readiness | Phase 0 | auth and unsafe-surface gates are revalidated live |
| Group B | Product and control-plane reroutes | Phase 2 | privileged UI actions no longer bypass the governor path |
| Group C | Automation, workflow ownership, n8n topology, exposure | Phase 1 | native `n8n` is canonical and public exposure remains `NO-GO` or is reapproved safely |
| Group D | Registries, memory, model policy, workforce, governor naming | Phase 3 | one canonical registry pack and one naming or routing policy are adopted |

## Immediate Next Commit Sequence

1. Harden `api-gateway.js` auth and Siri.
2. Lock down `dashboard_api.py`, `integration_hub.py`, and direct write surfaces.
3. Remove secrets from tracked runtime code and rotate exposed credentials.
4. Disable or demote unstable public tunnels and non-core ingress.
5. Canonicalize native `n8n :5680` and stop publishing Docker `n8n :5678` as core.
6. Replace browser localhost readiness probes in `OCULOPS-OS`.
7. Reroute Messaging UI live send through `control-plane`.
8. Reroute TouchDesigner, GTM, Herald, and write-capable connector paths.
9. Rebuild the registry pack from live truth.
10. Close HERALD as the first governed vertical slice.

## Ready / Not Ready

**Current status**
- Ready for phased implementation
- Not ready for direct execution against the target governed hypermesh blueprint

**Why**
- The runtime is real.
- The control plane is real.
- The corrected audit pack now gives one coherent truth map.
- But the ingress boundary, registry pack, governor singularity, and governed caller paths are still not converged.

## Definition of Done for This Plan

This plan is complete only when all of the following are true:

- protected runtime routes enforce caller identity
- one runtime owner and one automation path are declared and reflected in live process state
- one governor naming model is used consistently
- one canonical registry pack exists and matches runtime truth
- one canonical readiness artifact is used everywhere
- privileged product actions enter through the governor path
- Agent Zero is either still explicitly non-core or promoted with a proven caller path
- HERALD, Lead-to-Notification, and FORGE each run end to end on governed paths with auditable proof
