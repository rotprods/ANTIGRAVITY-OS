# OCULOPS — Project Brain
> Vision: Autonomous Growth Operating System | AI Agents + Market Intelligence + Pipeline Automation
> Actualizado: 2026-03-10 | Session sync for multi-terminal workflow

---

## Vision y Mision

**OCULOPS** es el Autonomous Growth Operating System mas avanzado del mercado:
- 7 agentes IA autonomos que buscan clientes, llenan el CRM y gestionan campanas
- War room de inteligencia: dashboard en tiempo real con datos LIVE de Supabase
- Filosofia visual: sala de mandos de un general — terminal Bloomberg para marketing

**Operador**: Roberto Ortega (CEO fundador)
**Stack**: React 19 + Vite 7 + Electron 35 + Supabase + Zustand 5 + React Router 7
**Package manager**: npm
**Deploy**: Vercel (LIVE) + Electron (desktop)
**Repo**: github.com/rotprods/ANTIGRAVITY-OS (branch: main) — pending rename to OCULOPS
**Vercel URL**: https://oculops.vercel.app (pending Vercel rebrand)
**Supabase project**: yxzdafptqtcvpsbqkmkm

---

## Estado Actual del Sistema (2026-03-10)

### Lo que esta HECHO y FUNCIONANDO

| Componente | Estado | Detalles |
|------------|--------|----------|
| **Vercel deploy** | LIVE | Build limpio 4.5s, SPA rewrites, cache headers |
| **Supabase DB** | LIVE | 46 tablas, datos reales de agentes |
| **Git** | PUSHED | main @ `90695bd`, todo commiteado |
| **Token rebrand** | DONE | Todos `var(--color-*)` canonicos, 0 tokens legacy |
| **Agent Runtime** | DONE | `_shared/agents.ts` + 7 agent edge functions + Cortex orchestrator |
| **CRM full CRUD** | DONE | Create/edit modals, search bar, clickable rows, toast notifications |
| **ControlTower live** | DONE | 6 KPIs reales (contacts, companies, pipeline, signals, activities, agents) |
| **Pipeline DnD** | DONE | @dnd-kit drag between kanban columns + DealDetailModal |
| **Intelligence edit** | DONE | SignalEditModal con impact/confidence sliders |
| **Event bus** | DONE | `useEventBus` hook + `eventBus.js` + pg_notify migration |
| **7 agent functions** | RESTORED | oracle, sentinel, forge, scribe, scraper, feedback, proposal — source code local synced |
| **n8n integration** | CONNECTED | API key + URL set in Supabase secrets + Vercel env + .env |

### Datos LIVE en produccion

| Tabla | Datos |
|-------|-------|
| `contacts` | Real contacts (El Rincon de Pepe, Cafe de Paris, Clinica Dental...) |
| `deals` | HUNTER leads con valores $2.5k-$5k |
| `companies` | Madrid Lab, Madrid Works, Petimetre... |
| `signals` | Meta API deprecation, TikTok Shop EU, AI cost reduction |
| `crm_activities` | Atlas sync logs |
| `agent_logs` | Cortex orchestration with 7 sub-agents |
| `event_log` | Ready (0 events, populates as agents fire) |

---

## Infraestructura de Deploy

### Vercel
- **URL**: https://oculops.vercel.app (pending Vercel rebrand)
- **Env vars set**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `N8N_API_KEY`, `N8N_API_URL`, `N8N_WEBHOOK_URL`, `SUPABASE_*` (7 vars), `GOOGLE_APP_PASSWORD_N8N`
- **Config**: `vercel.json` con SPA rewrites + asset caching

### Supabase (Remote)
- **Project**: yxzdafptqtcvpsbqkmkm
- **46 tablas** activas en produccion
- **31 edge functions** deployed (all ACTIVE)
- **Migrations**: 27 archivos, todos aplicados, remote up to date
- **Secrets set**: OpenAI, Anthropic, Google Maps, Gmail OAuth, n8n, Alpha Vantage, PostHog, GitHub, Telegram bot, Reddit, Higgsfield, CRON_SECRET

### Secrets PENDIENTES (no bloquean core, bloquean channels)
```
WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_*  → WhatsApp messaging
META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN                → Meta Business Discovery
TIKTOK_API_KEY, TIKTOK_API_SECRET                              → TikTok search
MANYCHAT_API_KEY                                                → ManyChat sync
TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID                           → Telegram delivery
```
> Estos se configuran ULTIMO, antes de activar cada channel

### n8n
- **Instance**: https://rotprods.app.n8n.cloud
- **API**: https://rotprods.app.n8n.cloud/api/v1
- **Webhook**: https://rotprods.app.n8n.cloud/webhook/architect-os-handoff
- **API key expira**: 2026-04-07 (regenerar antes)

---

## Design System — SPEC BLOQUEADA v10.3

> FUENTE DE VERDAD: `src/styles/tokens.css`
> NO usar valores hardcoded — siempre `var(--nombre-token)`

### Tokens de color (nombres CANONICOS — los unicos validos)
```css
--color-primary:    #FFD400   /* Gold */
--color-primary-hover: #FFC400
--color-primary-active: #FFB800
--color-bg:         #000000   /* Negro puro OLED */
--color-bg-2:       #0D0D0D   /* Superficie elevada */
--color-bg-3:       #1A1A1A   /* Cards / panels */
--color-border:     #2A2A2A   /* Bordes 1px */
--color-text:       #FFFFFF   /* Texto principal */
--color-text-2:     #D1D5DB   /* Texto secundario */
--color-text-3:     #9CA3AF   /* Texto terciario */
--color-danger:     #FF3333   /* Errores */
--color-success:    #FFFFFF   /* White for minimal systems */
--color-info:       #66B2FF   /* Informacion */
--color-warning:    #FFD400   /* Same as primary */
```

### Aliases que EXISTEN (en uso, no borrar)
```css
--glass-bg, --glass-blur, --glass-bg-light   /* Glass effects */
--border-subtle: rgba(255,255,255,0.05)      /* 386 refs */
--text-tertiary: var(--color-text-3)          /* 236 refs */
--glass-border, --glass-inner-glow            /* Panel borders */
```

### Tokens ELIMINADOS (ya no existen, no usar)
```
--accent-primary, --bg-primary, --bg-secondary, --bg-card,
--success, --danger, --warning, --info, --border-default,
--text-primary, --text-secondary, --border-active
```

### Tipografia
- `var(--font-sans)` → Inter
- `var(--font-mono)` → JetBrains Mono
- `var(--font-editorial)` → Times New Roman Modern / Canela
- `var(--font-display)` → var(--font-sans)
- NUNCA hardcodear font strings

### Filosofia visual
- Bold, alto contraste, minimal
- NO glassmorphism, NO gradients decorativos, NO purple
- Cards: `box-shadow: 0 0 0 1px var(--color-border)`
- Active states: borde izquierdo `3px solid var(--color-primary)`
- Modales: overlay `rgba(0,0,0,0.85)`, panel `var(--color-bg-2)`, border `var(--color-border)`

---

## Estructura de Archivos

```
src/
├── App.jsx                    # 23+ modulos lazy-loaded + React Router 7
├── styles/
│   ├── tokens.css             # FUENTE DE VERDAD del design system
│   ├── global.css             # .card, .btn, .badge, .stat-card
│   └── animations.css
├── components/
│   ├── layout/Layout.jsx      # Sidebar 220px/60px collapsed
│   └── modules/               # 23+ modulos (ver tabla abajo)
├── hooks/                     # Supabase hooks (ver seccion Hooks)
├── stores/
│   ├── useAppStore.js         # Sidebar, theme, toasts, CEO score
│   ├── usePipelineStore.js    # Pipeline state (selectedDeal, showClosedLost)
│   └── useLeadStore.js        # Lead filters
├── lib/
│   ├── supabase.js            # Cliente + CRUD + Realtime + scopeUserQuery
│   └── eventBus.js            # emitEvent(type, payload) → inserts to event_log
└── data/                      # Static data (studies, agentAutomationPacks)

electron/
├── main.js
└── preload.js

supabase/
├── migrations/                # 27+ migration files (all applied)
│   ├── 001_initial_schema.sql
│   ├── ... (timestamps)
│   └── 20260310120000_event_bus.sql
└── functions/                 # 28 local folders, 31 deployed remotely
    ├── _shared/               # agents.ts, supabase.ts, http.ts, gmail.ts, whatsapp.ts
    ├── agent-atlas/
    ├── agent-cortex/          # Master orchestrator
    ├── agent-hunter/
    ├── agent-oracle/          # Restored from remote
    ├── agent-sentinel/        # Restored from remote
    ├── agent-forge/           # Restored from remote
    ├── agent-scribe/          # Restored from remote
    ├── agent-scraper/         # Restored from remote
    ├── agent-feedback/        # Restored from remote
    ├── agent-proposal/        # Restored from remote
    ├── agent-herald/
    ├── agent-outreach/
    ├── agent-strategist/
    ├── agent-studies/
    ├── ai-advisor/
    ├── ai-qualifier/
    ├── api-gateway/
    ├── automation-runner/
    ├── messaging-dispatch/
    └── ... (28 total)

n8n/                           # 21 workflow JSONs
CONTEXT.md                     # Perfil de agencia (ICP, servicios, precios)
```

---

## Modulos — Estado Actual

| Modulo | Estado | Que tiene |
|--------|--------|-----------|
| **ControlTower.jsx** | DONE | 6 KPIs live, health score real, Agent Health Matrix |
| **CRM.jsx** | DONE | Full CRUD modals (contacts, companies, deals), search bar, clickable rows, toast |
| **Pipeline.jsx** | DONE | Kanban DnD (@dnd-kit), DealDetailModal, funnel chart |
| **Intelligence.jsx** | DONE | SignalEditModal, impact/confidence sliders, clickable rows |
| **Agents.jsx** | DONE | Network/queue/logs/studies/automation tabs, connected to agent_registry + agent_logs |
| **ProspectorHub.jsx** | DONE | Connected to CORTEX API network |
| **HeraldAgent.jsx** | DONE | Daily briefing agent |
| **GTM.jsx** | DONE | Go-to-market dashboard |
| **StudyHub.jsx** | DONE | Research studies (fuera de vision SaaS core) |
| **WorldMonitor.jsx** | DONE | Map view (fuera de vision SaaS core) |
| **Messaging.jsx** | PARCIAL | UI exists, WhatsApp/Gmail channels pending secrets |
| **Automation.jsx** | PARCIAL | UI shell with n8n pack references |
| **Execution.jsx** | PARCIAL | Task execution UI |
| **Experiments.jsx** | SHELL | A/B testing placeholder |
| **Opportunities.jsx** | SHELL | Opportunity tracking placeholder |
| **Knowledge.jsx** | SHELL | Knowledge base (needs pgvector) |
| **Finance.jsx** | SHELL | Financial tracking placeholder |
| **Decisions.jsx** | SHELL | Decision log placeholder |
| **Niches.jsx** | SHELL | Niche analysis placeholder |
| **Portfolio.jsx** | SHELL | Portfolio placeholder |
| **Watchtower.jsx** | SHELL | Agent monitoring placeholder |
| **Simulation.jsx** | SHELL | Simulation placeholder |
| **Settings.jsx** | EXISTS | Basic settings |
| **CreativeStudio.jsx** | EXISTS | Creative tools |
| **Reports.jsx** | EXISTS | Reporting |
| **Billing.jsx** | EXISTS | Billing placeholder |
| **Analytics.jsx** | EXISTS | Analytics placeholder |

---

## Hooks — Supabase Connected (src/hooks/)

| Hook | Table | CRUD | Realtime |
|------|-------|------|----------|
| `useContacts()` | `contacts` | add, update, remove | YES |
| `useCompanies()` | `companies` | add, update, remove | YES |
| `useDeals()` | `deals` | add, update, remove + pipelineView, totalValue, weightedValue | YES |
| `useActivities()` | `crm_activities` | add, update, remove | YES |
| `useLeads()` | `detected_leads` | add, update, remove | YES |
| `useSignals()` | `signals` | add, update, remove | YES |
| `useAgents()` | `agent_registry` + `agent_logs` + `agent_messages` + `agent_studies` + `agent_tasks` | read | YES |
| `useEventBus()` | `event_log` (broadcast) | subscribe, emit | YES (Supabase broadcast) |
| `useAtlasCRM()` | Multiple (bridge) | import leads → contacts/companies/deals | YES |
| `useFinance()` | `finance_entries` | CRUD | YES |
| `useTasks()` | `tasks` | CRUD | YES |
| `useAlerts()` | `alerts` | CRUD | YES |

**IMPORTANTE**: La tabla de activities se llama `crm_activities` (NO `activities`). La tabla de agent runs se llama `agent_logs` (NO `agent_runs`).

---

## Event Bus System (NEW)

```
src/hooks/useEventBus.js  → { lastEvent, subscribe(type, cb), emit(type, payload) }
src/lib/eventBus.js       → emitEvent(type, payload) — inserts to event_log + broadcasts
supabase/migrations/20260310120000_event_bus.sql → event_log table + pg_notify trigger
```

Event types: `agent.started`, `agent.completed`, `agent.error`, `deal.stage_changed`, `lead.captured`, `signal.detected`

Dual delivery: DB insert (persistence) + Supabase broadcast (instant UI).

---

## 7+ Agentes IA del Sistema

| Agente | Edge Function | Status | Funcion |
|--------|--------------|--------|---------|
| **ATLAS** | `agent-atlas` (v18) | ACTIVE | Prospecting automatico |
| **HUNTER** | `agent-hunter` (v17) | ACTIVE | Lead capture |
| **ORACLE** | `agent-oracle` (v? restored) | ACTIVE | Analytics y reportes |
| **FORGE** | `agent-forge` (v? restored) | ACTIVE | Generacion de contenido |
| **SENTINEL** | `agent-sentinel` (v? restored) | ACTIVE | Monitoreo competidores |
| **SCRIBE** | `agent-scribe` (v? restored) | ACTIVE | Reportes semanales |
| **CORTEX** | `agent-cortex` (v19) | ACTIVE | Orquestador maestro |
| **HERALD** | `agent-herald` (v13) | ACTIVE | Daily briefing |
| **STRATEGIST** | `agent-strategist` (v14) | ACTIVE | Strategy agent |
| **OUTREACH** | `agent-outreach` (v12) | ACTIVE | Outreach automation |
| **SCRAPER** | `agent-scraper` (v? restored) | ACTIVE | Web scraping |
| **FEEDBACK** | `agent-feedback` (v? restored) | ACTIVE | Client feedback |
| **PROPOSAL** | `agent-proposal` (v? restored) | ACTIVE | Proposal generation |

Agent runtime: `supabase/functions/_shared/agents.ts` → `runAgentTask()`, `createAgentStudy()`, `deliverAgentStudy()`, `sendAgentMessage()`, `callApi()`

Cortex chain: Atlas → Hunter → Strategist → Outreach (via `agent-cortex/index.ts`)

---

## Agent-OS Infrastructure (external)

- **Agent-Vault**: `~/agent-vault/` — 414 agents across 13 namespaces
- **Agent-OS**: `~/agent-os/` — Router, manifest (v2.0.0), presets, runtime session
- **Bridge to OCULOPS**: Phase 4 (pending)

---

## Reglas de Trabajo

- UI en **espanol**, codigo en **ingles**
- Usar `var(--color-*)` de tokens.css — NUNCA colores hardcoded
- Fuentes: usar `var(--font-mono)` y `var(--font-sans)` — NUNCA strings hardcoded
- Clases de global.css primero, CSS local solo para layout especifico del modulo
- NO glassmorphism — estilo bold/minimal (war room, no startup)
- Hooks en `src/hooks/` — hooks existentes conectados a Supabase, usarlos
- Zustand: selectores narrowos SIEMPRE — `useStore(s => s.field)` no destructuring
- Computaciones derivadas en componentes: envolver en `useMemo`/`useCallback`
- Handlers que pasan a librerias externas (dnd-kit, etc): `useCallback` obligatorio
- `ControlTower.jsx` + `Agents.jsx` + `CRM.jsx` son los modulos de referencia de calidad
- Modal pattern: overlay rgba(0,0,0,0.85), panel bg-2, ESC close, PURGE/ABORT/COMMIT buttons
- Al terminar cada intervencion: actualizar este CLAUDE.md
- Al terminar cada sesion: append a `docs/session-log.md` con fecha, terminal, cambios, archivos, deploy status
- NO hacer commits sin pedir confirmacion
- Security fixes: ULTIMO paso antes de deploy publico

---

## Tooling Guardrails — GitNexus / Context / Google Workspace

- `claude.md` es el archivo central del proyecto. No permitir que herramientas externas lo reemplacen con `CLAUDE.md`.
- GitNexus esta integrado via wrapper local:
  - `scripts/gitnexus.mjs`
  - `.mcp.json`
  - `.gitnexus/`
  - `.claude/skills/gitnexus/`
- El wrapper de GitNexus restaura `claude.md` y limpia `AGENTS.md` / `CLAUDE.md` generados automaticamente para evitar colision en macOS case-insensitive.
- El auditor de contexto oficial del proyecto es:
  - `scripts/context-audit.mjs`
- El wrapper oficial de Google Workspace es:
  - `scripts/gws.mjs`
- Nunca borrar estos artefactos de integracion sin reemplazo equivalente:
  - `.mcp.json`
  - `.gitnexus/`
  - `.claude/skills/gitnexus/`
  - `scripts/gitnexus.mjs`
  - `scripts/context-audit.mjs`
  - `scripts/gws.mjs`

### Deployment Gate — ejecutar en cada deploy o handoff fuerte

```bash
npm run deploy:gate
npm run context:audit
npm run gitnexus:status
npm run build
npm run lint
npm test
git status --short
```

Reglas:
- Si `gitnexus:status` no da `up-to-date`, ejecutar `npm run gitnexus:index` antes de deploy.
- Si se quiere mejor busqueda semantica, ejecutar `npm run gitnexus:index:embeddings`.
- Si `context:audit` sube por encima de 12%, recortar contexto antes de seguir metiendo instrucciones nuevas.
- Si `git status --short` muestra borrados (`D`), detenerse y validar que no se haya eliminado ningun archivo central o artefacto de integracion por error.
- Si el deploy toca Gmail, Drive, Calendar o Docs, verificar credenciales de Google Workspace CLI antes del deploy.

### Google Workspace CLI

- Wrapper local:
  - `npm run gws -- <comando>`
- Helpers:
  - `npm run gws:auth:setup`
  - `npm run gws:auth:login`
  - `npm run gws:drive:recent`
- Auth soportada por env:
  - `GOOGLE_WORKSPACE_CLI_CLIENT_ID`
  - `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET`
  - `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`
  - `GOOGLE_WORKSPACE_CLI_TOKEN`
  - `GOOGLE_WORKSPACE_PROJECT_ID`

---

## Comandos

```bash
npm run dev                                              # Vite dev (puerto 5173)
npm run electron                                         # Electron + Vite
NODE_OPTIONS=--no-experimental-require-module npm run build  # Build produccion (Node v24 fix)
npm run deploy:gate                                      # Gate completo antes de deploy/handoff
npx supabase db push --linked                            # Aplicar migraciones a remote
supabase functions deploy <name>                         # Deploy edge function
vercel --prod                                            # Deploy a Vercel produccion
supabase secrets set KEY=value                           # Set remote secret
vercel env add KEY production                            # Set Vercel env var
npm run context:audit                                    # Auditoria de contexto del proyecto
npm run gitnexus:index                                   # Reindexar knowledge graph local
npm run gitnexus:mcp                                     # Levantar MCP GitNexus
npm run gws -- drive files list --params '{"pageSize": 5}'  # Google Workspace CLI via wrapper
```

---

## Plan de Implementacion — Progreso

### Phase 1: Stabilize & Unblock
- [x] 1.1 Clean working tree (duplicates removed)
- [x] 1.2 Supabase CLI auth — WORKING (logged in, functions list OK)
- [x] 1.3 ALPHA_VANTAGE_KEY + n8n secrets — SET in Supabase + Vercel + .env
- [x] 1.4 Design system token rebrand — ALL canonical, 0 legacy tokens
- [x] 1.5 DEV_MODE killed — real Supabase auth flow enforced, 10 edge functions redeployed, pg_notify channel migrated

### Phase 2: Live Agent Runtime
- [x] 2.1-2.6 — ALREADY BUILT: `_shared/agents.ts`, `agent-cortex`, `useAgents.js`, `Agents.jsx`, realtime subscriptions — 95% complete from prior work

### Phase 3: Event Bus + Intelligence
- [x] 3.1 Event bus — useEventBus + eventBus.js + pg_notify migration
- [ ] 3.2 n8n webhooks as event consumers — PENDING (n8n connected, webhooks to wire)
- [x] 3.3 Intelligence module — SignalEditModal + clickable rows
- [x] 3.4 CRM rewrite — Full CRUD + search + modals
- [x] 3.5 Pipeline DnD — @dnd-kit already implemented
- [x] 3.6 ControlTower war room — Live KPIs from real hooks

### Phase 4: Bridge Agent-OS ↔ OCULOPS
- [ ] 4.1 OCULOPS-specific presets in agent-os
- [ ] 4.2 Map vault agents to business roles
- [ ] 4.3 oculops-bridge.py
- [ ] 4.4 Watchtower as monitoring surface
- [ ] 4.5 Knowledge + pgvector

### Phase 5: SaaS + Production
- [ ] 5.1 Multi-tenancy (org_id, RLS)
- [ ] 5.2 Stripe billing
- [ ] 5.3 Onboarding flow
- [ ] 5.4 Testing (Vitest + Playwright)
- [ ] 5.5 CI/CD (GitHub Actions)
- [ ] 5.6 Sentry error tracking
- [ ] 5.7 Settings module

---

## Contexto de Negocio

- Agencia IA Espana — servicios 1500-5000 EUR/mes
- ICP: PYMEs 10-200 empleados (e-commerce, clinicas, inmobiliarias, SaaS B2B)
- Integraciones: n8n, WhatsApp Cloud API, OpenAI, Anthropic, Meta Ads, Google Maps
- Fase actual: pre-revenue → 0-20k EUR/mes objetivo
- Ver `CONTEXT.md` para perfil completo

---

## Errores y Problemas Conocidos

- **Node.js v24 + rollup 4.44+**: `ERR_INVALID_PACKAGE_CONFIG` — fix: `NODE_OPTIONS=--no-experimental-require-module`
- **Table names**: `crm_activities` (NOT `activities`), `agent_logs` (NOT `agent_runs`)
- **Zustand selectors**: SIEMPRE narrow `useStore(s => s.field)` — NO destructuring
- **`var(--color-X)22` pattern**: valido en CSS moderno (hex con alpha) — no es bug
- **Hardcoded fonts**: NUNCA inline — usar `var(--font-mono)`
- **n8n API key expira**: 2026-04-07 — regenerar antes
- **Stray secret**: `FEPGQ5TC1RSITP` en Supabase — limpiar con `supabase secrets unset`
- **Docker not running**: `supabase start` falla — necesita Docker Desktop activo para dev local
- **.env contiene secrets**: esta en .gitignore, NUNCA commitear

---

## Backlog

- [ ] Wire n8n webhooks as event bus consumers (Phase 3.2)
- [ ] Flesh out shell modules (Automation, Execution, Experiments, Knowledge, Finance, Niches, etc.)
- [ ] Set WhatsApp/Meta/TikTok/ManyChat secrets when ready to activate channels
- [ ] pgvector extension for Knowledge semantic search
- [ ] @tanstack/virtual for list virtualization
- [ ] Stripe integration for billing
- [ ] Clean stray Supabase secret `FEPGQ5TC1RSITP`
- [ ] Security sweep before public launch (DEV_MODE=false, RLS, ProtectedRoute)
