# OCULOPS — Google APIs Playbook

## Purpose
Provide agents with a one-stop guide to ingest, catalog, and execute against the ~400 Google Cloud & Workspace endpoints enabled in this project. The doc explains how to:

- **Collect the knowledge (Discovery & MCP).**
- **Normalize it into local tools/connectors.**
- **Run live actions safely.**
- **Document expectations for future agents and automations.**

## 1. Collecting the Knowledge

1. **Discovery Service**
   - Hit `https://www.googleapis.com/discovery/v1/apis?fields=items(name,version,title,preferred,description,discoveryLink,documentationLink,rootUrl,servicePath,resources,methods)` once per target API (or build a nightly refresh) and store the JSON in Supabase `api_catalog` or a static cache (see `src/data/publicApiCatalog.seed.json` for structure).
   - Agents can query that local table to answer “what path/method do I call for Cloud Asset?” and glean required OAuth scopes.

2. **Workspace Developer MCP**
   - Leverage `workspace-developer.goog/mcp` (already registered in `.mcp.json`) for human-readable docs/snippets. Any agent can issue MCP questions like “What scopes does Gmail API require?” and expect curated text + examples.
   - Keep `scripts/gitnexus.mjs` and context audits running before publishing so MCP context stays clean.

3. **Gemini + Documentation Sync**
   - Use Gemini tooling (via `.env` `GOOGLE_CLOUD_PROJECT_GEMINI`) to summarise new Google release notes into `docs/CONTINUITY_STATUS_*.md`, then sync into `google-apis.md` via `AGENTS.md` instructions.

## 2. Normalizing Into OCULOPS Tools

1. **API Catalog Entries**
   - For any API you expose, add a catalog row to `docs/MASTER_API_REGISTRY.md` and `src/data/publicApiCatalog.seed.json` with:
     - `name`, `category` (`workspace`, `maps`, `cloud`), `template_key`.
     - `docsUrl` and `catalogSlug` (see `src/lib/publicApiConnectorTemplates.js` for examples).

2. **Connector Template**
   - Extend `src/lib/publicApiConnectorTemplates.js` with a template per surface (Drive, Gmail, Maps, Discovery). Provide `inputSchema`, `capabilities`, `endpointName`, and `normalizerKey`. Example: `disify` template.
   - Map to `supabase/functions/api-proxy/index.ts` normalizers so connectors return structured data.

3. **Edge Functions**
   - Wrap Google APIs inside Supabase Edge Functions (e.g., `google-maps-search`, `agent-atlas`). Each handler must:
     - Validate inputs.
     - Inject `GOOGLE_*` secrets from `.env`.
     - Log requests (for audit) and normalize responses before returning to UI/agents.

4. **Workflows**
   - Build `mcp/<name>` folders (`google-drive`, `google-places`, etc.) with:
     - `manifest.json` (`id`, `actions`, `auth` definitions).
     - `schema.json` for payloads/output shapes.
     - `actions/` placeholder scripts describing the handler signature.
   - These assets give agents a concrete contract for each API.

## 3. Execution Guidance for Agents

1. **Auth & Scopes**
   - `scripts/gws.mjs` wraps `@googleworkspace/cli`. Agents should always run via `npm run gws ...` with scope-specific commands (e.g., `gws -- auth login -s drive.file,gmail.readonly`).
   - Frontend uses `VITE_GOOGLE_MAPS_EMBED_KEY` (documented in `.env.example`) for safe Maps rendering; backend uses `GOOGLE_MAPS_API_KEY`.

2. **Agent Prompt Template**
   - Use the prompt: “Which Google API + method matches the intent? Provide method, path, required scopes, and sample JSON.” Have agents answer referencing the catalog entry or discovery doc before execution.

3. **Action Execution Flow**
   - Step 1: Query local discovery catalog (or `workspace-developer` MCP) for base path/method + scopes.
   - Step 2: Choose connector/template from `publicApiConnectorTemplates`.
   - Step 3: Run through `supabase/functions/api-proxy` to honor auth/headers:
     ```json
     {
       "connector_id": "google-drive",
       "endpoint_name": "create_file",
       "params": { "name": "report.pdf", "parents": ["root"] }
     }
     ```
   - Step 4: Record the `lookup` to RAG (see `docs/RAG_MURCIA_MARKET_INTELLIGENCE.md`) for traceability.

4. **Monitoring & Safety**
   - Use `npm run protected:check`/`deploy:gate` before any release to ensure no stray `CLAUDE.md` or unauthorized MCP modifications.
   - Keep Google API usage within permitted quotas by including rate limiting in Edge Functions (Supabase `limit` or script-level throttles).

## 4. Knowledge Maintenance

1. **Chain of Truth**
   - When new APIs are enabled, add notes to `docs/google-apis.md` and reference them in `docs/HANDOFF.md` under “Google Surfaces”.
   - Use `AGENT_ROLES.md` to assign who refreshes each discovery document weekly.

2. **Agent Training**
   - Build a short `llm-repo-handoff` section summarizing:
     1. Discovery URL.
     2. MCP server name `workspace-developer`.
     3. Key `.env` variables.
     4. Sample connector payloads.

3. **Verification**
   - After implementing a new API, run `npm run context:audit --json` and update `.claude/skills` if needed. Document failures in `docs/error-log.md`.

## 5. Next Actions for Agents

1. Harvest the latest discovery JSON → persist in Supabase table `google_api_discovery`.
2. Build a connector template for `cloudasset` and expose it via UI/mini-app.
3. Script an entry in `docs/MASTER_API_REGISTRY.md` and announce the capability via `docs/session-log.md`.
