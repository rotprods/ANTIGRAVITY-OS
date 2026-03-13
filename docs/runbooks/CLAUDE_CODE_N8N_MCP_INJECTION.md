# Claude Code Runbook — n8n MCP + API Injection for OCULOPS

Updated: 2026-03-13

## Goal

Make n8n templates truly operational inside OCULOPS:

1. read templates from full n8n catalog,
2. inject/install selected templates into the live n8n app,
3. patch credentials and trigger strategy,
4. connect to OCULOPS event + automation processes.

## Current Reality (verified)

- Full catalog synced: **8753** templates.
- Install-ready in catalog: **7643**.
- Priority templates: **3389**.
- Recent import audit: **12** recent workflows audited, **3 runnable now**, **9 blocked by missing credential types**.

Latest full audit (2026-03-13):

- 26 workflows scanned
- 16 runnable now
- 15 activatable now
- 9 blocked by credentials
- 6 blocked by missing community package support

Blocking credential types observed:

- `blotatoApi`
- `googleSheetsOAuth2Api`
- `openAiApi`
- `httpHeaderAuth`
- `googleDriveOAuth2Api`
- `githubApi`
- `openRouterApi`
- `postizApi`
- `httpBearerAuth`
- `perplexityApi`

Community node package blocker observed:

- `@blotato/n8n-nodes-blotato`

## Required Secrets / Env

- `N8N_API_URL` (example: `https://rotprods.app.n8n.cloud/api/v1`)
- `N8N_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_URL` (default receiver for `launch_n8n` automation actions)

## Canonical Commands

```bash
# 1) Sync full n8n template catalog (seed + public shards + Supabase)
npm run sync:n8n-templates

# 2) Audit runnable/blocked workflows in live n8n
npm run audit:n8n-workflows

# 3) Dry-run template injection from install-ready pool
npm run n8n:install-template -- --all-install-ready --top 20

# 4) Real inject (creation in n8n)
npm run n8n:install-template -- --all-install-ready --top 20 --apply
```

## Injection Strategy (what Claude Code should do)

### Phase A — Select viable templates

Select only templates where:

- `is_installable = true`
- `install_tier in ('priority', 'install_ready')`
- required credential types are available or can be mapped to existing credentials.

Reject templates that require unavailable providers unless owner explicitly opts in.

### Phase B — Install + patch

For each selected template:

1. Install template via n8n API.
2. Add tags:
   - `oculops`
   - `module:<target_module>`
   - `agent:<target_agent>`
3. Normalize trigger mode:
   - `webhook` for event-driven pipelines,
   - `schedule` for periodic intelligence/report jobs.
4. Bind credentials by type/name mapping.
5. If install fails (HTTP 400), log and continue; do not abort whole batch.

### Phase B.1 — Community node prerequisites

Before activation, verify required community node packages exist in n8n runtime.
If a package is missing (for example `@blotato/n8n-nodes-blotato`), either:

1. install/enable it in n8n, or
2. skip templates that require it and record them as blocked.

### Phase C — Wire to OCULOPS process bus

Use two wiring modes:

1. **Event bus route** (database/event-driven):
   - OCULOPS emits to `event-dispatcher`.
   - `event-dispatcher` forwards to n8n webhooks.
2. **Automation step route** (workflow-driven):
   - OCULOPS `automation_workflows` with `launch_n8n` and/or `run_connector`.

### Phase D — Validate end-to-end

For each activated flow:

1. Trigger source event or webhook.
2. Confirm n8n execution succeeds.
3. Confirm OCULOPS persistence updates (e.g., `automation_runs`, CRM/events tables).
4. Mark workflow as `active` only after successful test.

## OCULOPS Integration Points

Key files:

- `supabase/functions/event-dispatcher/index.ts`
- `supabase/functions/_shared/automation.ts`
- `src/components/modules/Automation.jsx`
- `src/hooks/useN8nTemplateCatalog.js`
- `src/lib/n8nTemplateCatalog.js`

## Claude Code Prompt (copy/paste)

```text
You are integrating n8n workflows into OCULOPS using MCP + n8n API.

Constraints:
- Do not stop on a single workflow failure.
- Continue batch operations; emit a final success/failed/skipped report.
- Only activate workflows that pass credential and execution checks.
- Wire successful workflows into OCULOPS via event-dispatcher routes or launch_n8n steps.

Tasks:
1) Run sync:n8n-templates and audit:n8n-workflows.
2) Build a candidate set from install_ready/priority templates for modules: prospector, watchtower, finance, automation, knowledge, world_monitor.
3) Install candidates into n8n in batches of 20.
4) Auto-map credentials where type matches existing n8n credentials.
5) Patch trigger modes and webhook paths for OCULOPS event flow.
6) Execute smoke test per workflow and only then activate.
7) Output a JSON report with installed/active/blocked reasons and required credential gaps.
```

## Output Contract (required)

Claude run must output:

- `installed_count`
- `active_count`
- `blocked_count`
- `failed_install_ids`
- `missing_credential_types`
- `new_event_routes`
- `new_automation_workflow_ids`
