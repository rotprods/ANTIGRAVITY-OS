# TASK.md — Unified Execution Matrix (Agent 1 + Agent 2)
Author: Roberto + Runtime Team  
Date: 2026-03-13  
Mode: Execution-first, parallel-safe

---

## 0) Objective
Unify:
1. `OCULOPS_AGENTIC_GAP_MAP` (agentic core build)
2. Current closed-loop sprint plan (`docs/implementation-plan.md` + `docs/sprint-01-closed-loop-mvp.md`)

into one execution matrix with strict ownership:
- **Agent 1 = Claude (other terminal)**
- **Agent 2 = Codex (this terminal)**

## 0.1) Runtime Progress Snapshot (Agent 2)
- `AG2-C0` ✅ Completed (registry + contracts scaffolded under `registry/**` and `contracts/**`)
- `AG2-C1` ✅ Completed baseline (goal classification + decomposition + dependency persistence + retry/escalation hooks in orchestration engine)
- `AG2-C4` ✅ Completed baseline (evaluation engine + score history table + orchestration integration)
- `AG2-C5` ✅ Completed + hardening pass (`simulation-engine` + `simulation_runs` + policy-gated pre-execution simulation in goals/pipelines + replay support + medium-risk production false-block fix + step trace continuity fix in pipeline_step_runs)
- `AG2-C6` ✅ Completed baseline (provider status persistence on dispatch failure/success + inbound/status reconciliation to existing conversations + `message_in` trigger preserved post-persistence + run failure/stuck taxonomy API)
- `AG2-C7` ✅ Completed baseline (synthetic smoke harness for orchestration/simulation/evaluation without provider dependencies + aggregated taxonomy listing API)
- New API actions available:
  - `orchestration-engine: plan_goal`
  - `orchestration-engine: execute_goal`
  - `orchestration-engine: plan_and_execute_goal`
  - `orchestration-engine: get_run_taxonomy`
  - `orchestration-engine: list_taxonomy`
  - `evaluation-engine: evaluate`
  - `evaluation-engine: get`
  - `evaluation-engine: list`
  - `simulation-engine: run`
  - `simulation-engine: get`
  - `simulation-engine: list`
  - `simulation-engine: replay`

---

## 1) Variables And Subvariables

### V0 — Strategic Context
- `V0.1` ProductBody = mostly built (360 SaaS operational layer).
- `V0.2` MissingNervousSystem = orchestration, governance, memory, evaluation, simulation, self-improvement.
- `V0.3` NorthStar = Business OS where AI agents can run business workflows end-to-end.

### V1 — Immediate Runtime Goal (Sprint Critical Path)
- `V1.1` ClosedLoop = `Copilot -> pipeline -> approval -> provider send -> inbound/status -> unified trace`.
- `V1.2` NonNegotiables:
  - `V1.2.1` correlation continuity
  - `V1.2.2` approval gate enforcement
  - `V1.2.3` provider-backed delivery evidence
  - `V1.2.4` operator-visible diagnostics

### V2 — Agentic Systems (Gap Map)
- `V2.1` OrchestrationEngine
- `V2.2` ChiefIntelligenceLayer
- `V2.3` FormalAgentRegistry
- `V2.4` ToolBusMCPAccess
- `V2.5` EvaluationLayer
- `V2.6` MemorySimulationSelfImprovement

### V3 — Contracts
- `V3.1` TaskSpecContract
- `V3.2` InputContract
- `V3.3` OutputContract
- `V3.4` EvalContract
- `V3.5` AutonomyPolicyContract

### V4 — Governance Controls
- `V4.1` BudgetGuardrails
- `V4.2` ToolPermissions
- `V4.3` EscalationRules
- `V4.4` EnvironmentGates (shadow/staging/production)

### V5 — Parallel Execution Controls
- `V5.1` FileOwnershipStrict = true
- `V5.2` NoSharedFileEditWithoutLock = true
- `V5.3` IntegrationCadenceMinutes = 60-90
- `V5.4` MergeGate = `eslint + tests + build` required

---

## 2) Ownership Split (Hard Boundary)

### Agent 1 (Claude) — Product Surfaces + Operator UX
- Owns:
  - `src/components/modules/**`
  - `src/components/ui/**`
  - `src/components/Sidebar.jsx`
  - `tests/e2e/**`
  - UX demo docs/checklists under `docs/**` (UI-oriented)
- Must not edit:
  - `supabase/functions/**`
  - `supabase/migrations/**`
  - core contracts/registry artifacts owned by Agent 2

### Agent 2 (Codex) — Agentic Core + Runtime Contracts
- Owns:
  - `supabase/functions/**`
  - `supabase/migrations/**`
  - `supabase/functions/_shared/**`
  - `src/hooks/**` (runtime/data hooks)
  - `contracts/**` (new)
  - `registry/**` (new)
  - `memory/**` (new structure)
  - orchestration/evaluation docs
- Must not edit:
  - Premium UI styling/layout tasks assigned to Agent 1 unless explicitly requested

---

## 3) Unified Task List — Agent 1 (Claude)

## AG1-P0 — UI Continuity + Trace UX (from Sprint S1-07/S1-08/S1-06)
- Variable: `V1.2.4`
- Subvariables:
  - `AG1-P0.1` Messaging status surface (draft/sent/delivered/read/failed with clear badges).
  - `AG1-P0.2` Conversation-level “blocked / pending approval / failed delivery” indicators.
  - `AG1-P0.3` Run-inspection affordances in Agents/Command Center/Control Tower.
  - `AG1-P0.4` One-click operator actions (open approval, open conversation, inspect run).
- Acceptance:
  - Operator can answer “what is blocked and where?” from UI without DB queries.

## AG1-P1 — Premium Operator Layer (without contract drift)
- Variables: `V0.3`, `V1.2`
- Subvariables:
  - `AG1-P1.1` Upgrade Copilot/Agents/Messaging operational UX language.
  - `AG1-P1.2` Keep canonical entity names (no new runtime aliases).
  - `AG1-P1.3` Ensure UI uses existing contracts (no hidden schema assumptions).
- Acceptance:
  - Premium UX exists on top of stable runtime contracts, not replacing them.

## AG1-P2 — E2E Operator Proof
- Variables: `V1.1`, `V5.4`
- Subvariables:
  - `AG1-P2.1` Create/maintain authenticated happy-path E2E spec.
  - `AG1-P2.2` Add manual smoke doc for provider steps not automatable.
- Acceptance:
  - Team can demo the loop on demand end-to-end.

---

## 4) Unified Task List — Agent 2 (Codex)

## AG2-C0 — Registries + Contracts (48h Block 1-2)
- Variables: `V2.3`, `V3.*`
- Deliverables:
  - `registry/agent_registry.json`
  - `registry/tool_registry.json`
  - `registry/workflow_registry.json`
  - `registry/evaluation_policies.json`
  - `registry/autonomy_policies.json`
  - `contracts/TASK_SPEC.md`
  - `contracts/INPUT_CONTRACT.json`
  - `contracts/OUTPUT_CONTRACT.json`
  - `contracts/EVAL_CONTRACT.json`
- Acceptance:
  - No runtime agent/workflow/tool exists outside registries/contracts.

## AG2-C1 — Orchestration Core Hardening (48h Block 3)
- Variables: `V2.1`, `V1.1`
- Subvariables:
  - `AG2-C1.1` Goal classification -> workflow selection contract.
  - `AG2-C1.2` Task graph + dependency state persistence.
  - `AG2-C1.3` Retry/replan/escalate policy hooks.
  - `AG2-C1.4` Correlation continuity across run/step/events/messages/approvals.
- Acceptance:
  - Every goal enters through structured decomposition and tracked execution state.

## AG2-C2 — Tool Bus / MCP Access Layer (48h Block 4)
- Variables: `V2.4`, `V4.2`
- Status: ✅ Completed backend pathing (runtime auth/channel provisioning still pending for full provider E2E)
- Subvariables:
  - `AG2-C2.1` Standardize tool invocation envelope (auth, policy, trace metadata).
  - `AG2-C2.2` Enforce permissioned access per agent role.
  - `AG2-C2.3` Register internal/external capabilities in tool registry.
- Acceptance:
  - No critical execution path bypasses the tool bus.

## AG2-C3 — Chief Brain + Governance Hooks (48h Block 5)
- Variables: `V2.2`, `V4.*`
- Subvariables:
  - `AG2-C3.1` Governor interface for high-impact planning/review decisions.
  - `AG2-C3.2` Escalation API for critical uncertainty/risk thresholds.
  - `AG2-C3.3` Budget + autonomy gate evaluation hooks.
- Acceptance:
  - Strategic vs worker responsibilities are enforced in code paths.

## AG2-C4 — Evaluation Layer (48h Block 6)
- Variables: `V2.5`, `V3.4`
- Subvariables:
  - `AG2-C4.1` Critics: quality, architecture, risk, cost.
  - `AG2-C4.2` Pass/fail + retry recommendation contract.
  - `AG2-C4.3` Store score history for routing feedback loops.
- Acceptance:
  - High-impact outputs require explicit score and disposition.

## AG2-C5 — Memory + Simulation Base (48h Block 7-8)
- Variables: `V2.6`
- Deliverables:
  - `memory/product/`
  - `memory/customers/`
  - `memory/operations/`
  - `memory/improvements/`
- Subvariables:
  - `AG2-C5.1` Replay-ready operational logs
  - `AG2-C5.2` Dry-run/shadow execution mode
  - `AG2-C5.3` Policy-gated self-improvement proposal flow
- Acceptance:
  - Important changes are testable in simulation before real execution.

## AG2-C6 — Closed-Loop Runtime Completion (remaining Sprint backend)
- Variables: `V1.1`, `V1.2`
- Status: ✅ Completed baseline
- Subvariables:
  - `AG2-C6.1` Ensure provider IDs/statuses persist consistently.
  - `AG2-C6.2` Ensure inbound/status updates map to existing conversations.
  - `AG2-C6.3` Ensure `message_in` automation triggers after persistence.
  - `AG2-C6.4` Expose run failure/stuck taxonomy via backend APIs.
- Acceptance:
  - One approved send returns with status/reply into same operational graph.

## AG2-C7 — Provider-Independent Runtime Verification
- Variables: `V1.2.4`, `V5.4`
- Status: ✅ Completed baseline
- Subvariables:
  - `AG2-C7.1` Add aggregated taxonomy endpoint for recent orchestration runs (`list_taxonomy`).
  - `AG2-C7.2` Add synthetic smoke script for orchestration + simulation + evaluation.
  - `AG2-C7.3` Keep provider integrations as final gate, not dev blocker.
- Deliverables:
  - `scripts/smoke-agentic-core.mjs`
  - `npm run smoke:agentic-core`
- Acceptance:
  - Team can validate core agentic control loops on demand without Gmail/WhatsApp credentials.

---

## 5) Shared Integration Tasks (Both Agents, Scheduled Windows Only)

## INT-1 — Contract Freeze Window
- Variables: `V3.*`, `V5.*`
- Action:
  - Agent 2 publishes contract/registry changes.
  - Agent 1 adapts UI to those contracts only after freeze tag.

## INT-2 — Demo Workflow Pack (3 required)
- Variables: `V1.1`, `V2.*`
- Workflows:
  - `INT-2.1` bug -> patch -> test -> review
  - `INT-2.2` feature -> implement -> evaluate
  - `INT-2.3` campaign workflow -> execute -> score -> improve proposal

## INT-3 — Merge Gate
- Variables: `V5.4`
- Required before integration:
  - `eslint` passes
  - targeted tests pass
  - `build` passes

---

## 6) Execution Order (Now)
1. `AG2-C0` registries + contracts
2. `AG2-C1` orchestration hardening
3. `AG2-C4` evaluation baseline
4. `AG2-C5` memory/simulation skeleton
5. `AG1-P0` + `AG1-P2` UI diagnostics + E2E proof
6. `INT-2` run three real workflows and score

---

## 7) Definition Of Done (Unified)
- Closed loop is verifiable from UI and persisted backend state.
- Agent registry + tool registry + workflow registry are canonical.
- All important outputs are scored with pass/fail and retry semantics.
- Simulation exists for high-risk changes before production.
- Agent autonomy is policy-gated (budget/tool/risk/escalation).

---

## 8) Non-Negotiable Rules
1. No new random agents outside registry.
2. No direct tool access bypassing tool bus.
3. No high-impact output without evaluation.
4. No self-improvement directly on production without simulation/policy gate.
5. No cross-agent file overlap without explicit lock.
