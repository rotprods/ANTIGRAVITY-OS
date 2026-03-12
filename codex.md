# Codex Operating Guide

Updated: 2026-03-12

## Role

- Codex is the execution and stabilization agent for OCULOPS OS.
- Default assumption: OCULOPS OS is Roberto's internal operating system first.
- Do not expand scope to public multi-tenant SaaS unless Roberto explicitly asks for it.

## Source Priority

Use documents in this order when they conflict:

1. `CURRENT_TRUTH.md`
2. `missing/central-secrets.md`
3. `missing/go-live-checklist.md`
4. `docs/CONTINUITY_STATUS_2026-03-09.md`
5. `docs/OPERATIONS_ARCHITECTURE.md`
6. `docs/OPERATIONS_DEPLOY_CHECKLIST.md`
7. `docs/AGENT_ROLES.md`
8. `docs/MASTER_API_REGISTRY.md`
9. `claude.md`, `HANDOFF.md`, `docs/CLAUDE_EXECUTION_BRIEF.md`, `docs/audit*`
10. `OCULOPS_OS_MASTER_SNAPSHOT*.md` as archive only, never as live operational truth

## Product Boundaries

- One Supabase-backed source of truth for prospecting, CRM, messaging, automation, and agent state.
- Frontend stack: React + Vite + Electron.
- Backend stack: Supabase Auth + Postgres + Realtime + Edge Functions.
- Frontend must not own provider secrets or call Gmail, Meta, or similar providers directly.
- Edge Functions own provider credentials, outbound calls, and inbound webhooks.

## Canonical Agent Model

- Canonical business/control-plane agents:
  - `agent-atlas`
  - `agent-hunter`
  - `agent-strategist`
  - `agent-cortex`
  - `agent-outreach`
- `Vanta`, `Apex`, `Scout`, `Radar`, `Pulse`, `Vault`, and `Forge` are role labels and workflow concepts, not the canonical persisted registry names.

## Working Rules

- Prioritize stabilization before net-new surface area.
- Fix root-cause issues before cosmetic expansion.
- Prefer editing existing modules over creating parallel replacements.
- Reconcile duplicate files before broad feature work.
- Never add secrets to source, docs, or UI.
- Remove hardcoded provider tokens or anon fallback values when touched.
- Preserve route topology and persisted data contracts unless a migration is intentional.
- Preserve hooks/API behavior during visual redesigns.
- Validate changes with:
  - `npm run build`
  - `npm run lint`
  - `npm test`

## Current P0 Focus

- Treat `missing/central-secrets.md` and `missing/go-live-checklist.md` as the source of truth for what is actually still missing.
- Repair live n8n workflows first:
  - remove literal `{{SUPABASE_ANON_KEY}}` placeholders and stale hardcoded Supabase JWTs
  - verify `architect-os-handoff`, Speed-to-Lead, Strategist, and CORTEX live paths
  - persist any live workflow fixes back into local `n8n/*.json`
- Reconcile Supabase migration drift before any repair command:
  - do not reuse stale pre-`20260321000000` repair lists blindly
  - compare local `supabase/migrations` to remote history first
- Keep deploys stable while Docker is unreliable:
  - prefer the existing API-based Supabase deploy path when local Docker is not ready
- Operational missing secrets for this phase are now:
  - `APIFY_TOKEN` for Reddit reliability
  - `TELEGRAM_CHAT_ID` for default Herald/report delivery
- Treat Meta / WhatsApp / TikTok / ManyChat secrets as deferred unless Roberto explicitly reopens those integrations
- Run end-to-end verification after the live repair pass:
  - n8n webhook smoke checks
  - authenticated app smoke
  - build/lint/test baseline

## Visual Rules

- The app should feel like a premium dark business OS, not generic SaaS UI.
- Keep the current token system as the implementation source of truth until a scoped redesign is approved.
- For Prospector and Intelligence redesign work:
  - preserve IA
  - preserve routing
  - preserve hooks and API contracts
  - upgrade panels, controls, and tables into stronger reusable primitives

## Non-Goals For Default Work

- No broad rebrand of the whole app without explicit scope.
- No speculative multi-tenant architecture work.
- No new documentation sprawl unless requested.
- No placeholder modules that duplicate existing modules.
