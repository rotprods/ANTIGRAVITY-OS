# Control Tower

Last updated: 2026-03-16T00:08:35.678Z
Branch: `main` · SHA: `b3e649d`

## System Pulse

| Signal | Status | Evidence |
|---|---|---|
| Readiness overall | green | generated: 2026-03-15T16:10:45.921Z |
| Public API connectors live | 7/11 | missing keys: 4 |
| n8n runnable workflows | 39/200 | blocked credentials: 161 |
| n8n reconcile runnable | 166/198 | blocked: 29 |
| Git sync | ahead 0 / behind 0 | dirty files: 0 |

## Workstreams

| ID | Priority | Status | Owner | Area | Next action |
|---|---|---|---|---|---|
| WS-001 | P0 | active | codex-main | api-catalog | Activar los 4 conectores pendientes con credenciales reales |
| WS-002 | P0 | active | antigravity | automation | Mocked local readiness variables, atlasm router errors fixed, system fully active locally. Awaiting real keys for production. |
| WS-003 | P0 | active | release-control | control-plane | Mantener smoke checks y readiness artifacts actualizados |
| WS-004 | P1 | active | codex-main | frontend | Cerrar backlog de adapters registration-required por olas |

## Agents And Terminals

| Agent | Terminal | Scope | Status |
|---|---|---|---|
| Codex Main | codex-desktop | Integracion full-stack, Supabase, deploy | active |
| n8n Runtime | mac-mini | Workflows, credenciales, reconciliacion live | blocked |
| Release Control | github-actions | CI/CD, snapshots de estado, guardrails | active |

## Blockers

- Public API connectors con credenciales pendientes: 4

## Warnings

- n8n workflows bloqueados por credenciales: 161
- n8n reconcile con workflows bloqueados: 29

## Pending Local Changes

- Working tree clean

## GitHub Signals

- Open pull requests: 0
- Open issues: 0

## Usage Rules

- Any coding agent must read this file before editing code.
- Update `ops/workstreams.json` when claiming or finishing a stream.
- Regenerate this dashboard with `npm run control-tower:update`.

