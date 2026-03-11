# OCULOPS OS — Session Log
> Cada terminal registra aqui lo que hizo. Append-only. No borrar entradas anteriores.

---

## 2026-03-10 | Terminal: Claude Opus (main session)

### Phase 1: Token Rebrand
- Removed 12 dead alias tokens from `src/styles/tokens.css`
- Bulk sed across all `src/` files (24+ files): replaced legacy token names with canonical `var(--color-*)`
- Fixed hardcoded hex colors in JS contexts: FlightDeck.jsx, WorldMonitor.jsx, MiniAppRegistry.js, MiniApp.jsx
- `#FFD60A` → `#FFD700`, `#FF453A` → `#FF3B30`

### Phase 3: Module Upgrades
- **CRM.jsx** — Full rewrite (329→500+ lines): create/edit modals for contacts, companies, deals + search bar + clickable rows + HoverRow component + toast notifications
- **Pipeline.jsx** — DealDetailModal added (editable fields, stage dropdown, loss reason, PURGE/ABORT/COMMIT). DnD with @dnd-kit was already implemented, adjusted activation distance 8→5
- **Intelligence.jsx** — SignalEditModal added with impact/confidence range sliders, category dropdown, color-coded values, clickable rows

### Phase 3: ControlTower Live Data (via sub-agent)
- Removed 4 phantom imports (useAlerts, useTasks, useSnapshots, useAIAdvisor)
- Added useContacts, useCompanies, useActivities hooks
- 6 KPI cards now show real data: contacts count, companies count, pipeline value, weighted pipeline, 7-day activities, signal intercepts
- Health score = real composite (50% pipeline + 30% agent uptime + 20% signal coverage)
- Bottom panel replaced with Agent Health Matrix from useAgents

### Phase 3: Event Bus (via sub-agent)
- Created `src/hooks/useEventBus.js` — subscribe(type, cb), emit(type, payload), lastEvent
- Created `src/lib/eventBus.js` — emitEvent(type, payload) helper
- Created `supabase/migrations/20260310120000_event_bus.sql` — event_log table + pg_notify trigger + RLS

### Infrastructure
- Restored 7 remote agent functions locally: agent-oracle, agent-sentinel, agent-forge, agent-scribe, agent-scraper, agent-feedback, agent-proposal, agent-herald
- Set n8n secrets: `N8N_API_KEY` + `N8N_API_URL` on Supabase + Vercel + .env
- n8n instance: https://rotprods.app.n8n.cloud (API key expires 2026-04-07)
- Pushed all Supabase migrations (remote up to date)
- Verified live data: contacts, deals, companies, signals, crm_activities, agent_logs all returning real data

### Deploy
- Vercel production deploy: https://oculops-os-theta.vercel.app
- Build clean: 4.5s, 0 errors
- Git: 2 commits pushed to main (`90695bd`, `ffafc69`)

### Files Changed (37 files, +3507 lines)
```
MODIFIED:
  src/components/modules/CRM.jsx
  src/components/modules/ControlTower.jsx
  src/components/modules/Intelligence.jsx
  src/components/modules/Pipeline.jsx
  src/components/modules/Execution.jsx
  src/components/modules/Finance.jsx
  src/components/modules/GTM.jsx
  src/components/modules/ProspectorHub.jsx
  src/hooks/useActivities.js
  src/hooks/useCompanies.js
  src/hooks/useConnectionStatus.js
  src/hooks/useContacts.js
  src/hooks/useDeals.js
  src/hooks/useGeoSearch.js
  src/hooks/useLeads.js
  src/lib/supabase.js
  supabase/functions/api-gateway/index.ts
  supabase/functions/banana-generate/index.ts
  supabase/functions/social-signals/index.ts
  supabase/functions/veo-generate/index.ts
  package.json + package-lock.json
  claude.md

CREATED:
  src/hooks/useEventBus.js
  src/lib/eventBus.js
  supabase/functions/agent-feedback/index.ts
  supabase/functions/agent-forge/index.ts
  supabase/functions/agent-herald/index.ts
  supabase/functions/agent-oracle/index.ts
  supabase/functions/agent-proposal/index.ts
  supabase/functions/agent-scraper/index.ts
  supabase/functions/agent-scribe/index.ts
  supabase/functions/agent-sentinel/index.ts
  supabase/migrations/20260310110000_restore_runtime_schema.sql
  supabase/migrations/20260310111000_sync_agents_and_briefing.sql
  supabase/migrations/20260310112000_remove_broken_cron_jobs.sql
  supabase/migrations/20260310120000_event_bus.sql
  supabase/migrations/20260310123000_schedule_market_and_social_jobs.sql
```

### Pending After This Session
- [ ] 3.2 Wire n8n webhooks as event bus consumers
- [ ] Phase 4: Bridge Agent-OS ↔ OCULOPS-OS
- [ ] Phase 5: SaaS + Production (multi-tenancy, Stripe, testing, CI/CD)
- [ ] Security sweep (DEV_MODE=false, RLS, ProtectedRoute) — LAST before public
- [ ] Set WhatsApp/Meta/TikTok/ManyChat secrets when activating channels

---

<!-- NEXT SESSION: append below this line -->

## 2026-03-10 | Terminal: Opus Preview (this session)

### Summary
- Added the public API catalog “By Access / By Theme / Open Only” toggles, refreshed `MiniAppLauncher` + `publicApiCatalog` logic, and verified `npm run lint` + `npm run build` still pass.  
- Ran `npm run preview` + Playwright to inspect the API Network while toggling each catalog view and capturing screenshots (`api-network-catalog-access.png`, `api-network-catalog-open-only.png`).  
- Attempted a Vercel deploy (`npx vercel --prod --yes`) but it failed twice because `api.vercel.com` could not be resolved; deployment is still pending.

### Errors
- `npx vercel --prod --yes` → `getaddrinfo ENOTFOUND api.vercel.com` (project/teams fetch).  
- Preview console shows Supabase fetch failures for `ai-advisor`, `market-data`, `social-signals`, `messaging-dispatch`, `meta-business-discovery`, `tiktok-business-search`, `manychat-sync`, `banana-generate`, `websocket` connection errors (remote functions not reachable without secrets).

### Pending
- [ ] Redeploy the cleaned build to Vercel once `api.vercel.com` is accessible (or from another network).  
- [ ] Supply `APIFY_TOKEN`/valid Reddit credentials so `social-signals` can stop falling back to blocked endpoints.  
- [ ] Set `TELEGRAM_CHAT_ID` (and optionally thread) so Herald/Scribe reports have a default destination.  
- [ ] Capture the new API catalog info into n8n or agents (scripts/workflows need to learn the new access-theme grouping).

---

## 2026-03-11 | Terminal: Claude Opus 4.6 (schema evolution + onboarding)

### DB Schema Evolution — v2 HARDCORE (10 phases, 57 new tables)
Evolved OCULOPS from ~62 to ~119 tables based on 20-section enterprise spec.

| Phase | File | Tables | Domain |
|-------|------|--------|--------|
| 1 | `20260315100000_phase1_foundation.sql` | 8 | workspaces, teams, permissions, tools, integrations, connectors, sync_logs |
| 2 | `20260315120000_phase2_process_pipeline.sql` | 8 | pipeline_definitions, stages, transitions, processes, SOPs, playbooks, checklists, templates |
| 3 | `20260315140000_phase3_intelligence.sql` | 4 | insights, hypotheses, recommendations, actions_log |
| 4 | `20260315160000_phase4_marketplace.sql` | 6 | seller/buyer profiles, listings, orders, reviews, disputes |
| 5 | `20260315180000_phase5_financial.sql` | 5 | invoices, payments, subscription_plans, revenue_shares, pricing_rules |
| 6 | `20260315200000_phase6_governance.sql` | 8 | policies, risk_cases, guardrails, kill_switches, escalation, consent, retention, compliance |
| 7 | `20260315220000_phase7_observability.sql` | 4 | metric_definitions, metric_values, alert_rules, dashboards_config |
| 8 | `20260316100500_phase8_knowledge.sql` | 3 | knowledge_categories, learning_records, playbook_entries |
| 9 | `20260316120000_phase9_blockchain_additions.sql` | 4 | token_emissions, staking_positions, governance_votes, reward_epochs |
| 10 | `20260316140000_phase10_gtm_meta.sql` | 7 | icp_definitions, channel_configs, partner_programs, user_preferences, saved_views, command_history, maturity_assessments |

All 10 phases deployed to Supabase remote. ~15 ALTER operations across 8 existing tables (deals, contacts, signals, experiments, alerts).

### Migration Fixes
- Phase 2: added missing `org_id` column to `pipeline_transitions`
- Phase 8: renamed from `20260316100000` to `20260316100500` (timestamp collision with `fix_rls_and_leads`)
- `fix_rls_and_leads.sql`: marked as applied via `migration repair` (policies already existed on remote)
- 7 remote-only ghost migrations repaired as `reverted`

### Onboarding & Account Management
- **OnboardingSetup.jsx** rewritten: 3-step flow (Perfil → Organización → Launch)
  - Step 1: full_name, phone, company, role_title → saves to profiles table
  - Step 2: create org via `create_new_organization` RPC
  - Step 3: confirmation + auto-redirect
  - Marks `onboarding_completed = true` via `complete_onboarding()` RPC
- **Settings.jsx**: added "00. ACCOUNT" tab with profile edit + password change
- **DB trigger**: `trigger_welcome_email` fires `welcome-email` edge function on `auth.users` INSERT
- Removed Tailwind/cyan/purple from OnboardingSetup → inline OCULOPS tokens

### UI Fixes
- OrgSelector.jsx: replaced Tailwind + `@heroicons/react` with inline OCULOPS tokens
- UserMenu.jsx: removed blue/cyan avatar, gold circle with `--color-primary`
- ParticleField.jsx: `zIndex: 1` → `0` (behind content)
- Sidebar.jsx: `zIndex: 30` → `10` (above particles, below modals)
- App.jsx: removed duplicate ParticleField, lazy-loaded, AmbientBackground for auth

### Design System Refresh (linter-driven)
- Token rename across ~90 files
- Consistent `--accent-primary`, `--surface-*`, `--text-*`, `--border-*`
- tokens.css, global.css, ControlTower.css refreshed
- New UI primitives: Icon.jsx, ModulePage.jsx

### Infra
- New edge function: `health/index.ts`
- New shared module: `agent-skills.ts`
- `agent-brain-v2.ts` streamlined
- Migration: `20260316200000_phase4_security_hardening.sql`

### Deploy
- Vercel production: 2 deploys, build clean (5-6s)
- GitHub: 4 commits pushed to main
- Commits: `59aeaf2`, `536d086`, `41ad2b8`, `7243fbf`

### Files Changed
- 102 files changed, +4757 / -3546 lines
- 10 new migration files
- 6 new source files (Icon.jsx, ModulePage.jsx, CSS extractions, agent-skills.ts, health endpoint)

### Pending
- [ ] `RESEND_API_KEY` — set in Supabase secrets for welcome email (logged in `docs/missings.md`)
- [ ] Wire n8n webhooks as event bus consumers (Phase 3.2)
- [ ] Phase 4: Bridge Agent-OS ↔ OCULOPS
- [ ] Phase 5: SaaS + Production (Stripe, testing, CI/CD)
- [ ] Set WhatsApp/Meta/TikTok/ManyChat secrets when activating channels

---

## 2026-03-11 — Session: audit/2026-02-23 (RLS + Full Deploy)

**Terminal**: Claude Code (branch: audit/2026-02-23 → main)

### Trabajo realizado

#### 1. Multi-tenancy RLS — Cierre de gaps
- Inventario real de tablas: 150+ tablas (no 47 como indicaba la memoria)
- Identificados 12 tablas sin cobertura RLS completa de org_id
- Escrita y aplicada `supabase/migrations/20260322000000_rls_gap_closure.sql` (706 líneas)
  - Group A (4 tablas): ADD COLUMN org_id NOT NULL, backfill, 4-policy pattern + service_role
  - Group B (3 tablas): mismo patrón, nuevas policies antes de eliminar las antiguas
  - Group C (5 tablas): nullable org_id, SELECT-only authenticated, ALL service_role
  - Hardening: user_org_ids() search_path, set_default_org_id() rechaza multi-org ambiguity
  - Eliminados: anon USING(true), OR org_id IS NULL, WITH CHECK faltantes

#### 2. org_id threading en agent brain
- `_shared/agent-brain-v2.ts`: BrainInput.org_id + resolución temprana + threading a reasoning_traces, incidents, audit_logs, executeSkill()
- `_shared/agent-skills.ts`: executeSkill() + _exec() reciben orgId → audit_logs, incidents, approval_requests
- `supabase/functions/agent-runner/index.ts`: extrae org_id del body, pasa a runBrain() y agent_logs INSERT

#### 3. Deploy completo de todas las edge functions
- 54 funciones ACTIVE en Supabase remote (todas redeployadas con _shared/ actualizados)

#### 4. Git sync
- 11 commits locales pusheados a GitHub (no se habían pusheado en sesiones anteriores)
- Committeada la migración RLS: `f7ab8c9`
- Estado final: local = remote = Supabase DB = edge functions

### Archivos modificados
- `supabase/migrations/20260322000000_rls_gap_closure.sql` (NUEVO)
- `supabase/functions/_shared/agent-brain-v2.ts`
- `supabase/functions/_shared/agent-skills.ts`
- `supabase/functions/agent-runner/index.ts`

### Deploy status
- Git: ✅ pushed (main @ f7ab8c9)
- Supabase DB: ✅ migrations aplicadas (última: 20260322100000)
- Supabase Functions: ✅ 54/54 ACTIVE
- Vercel: ✅ sin cambios frontend (no rebuild necesario)
