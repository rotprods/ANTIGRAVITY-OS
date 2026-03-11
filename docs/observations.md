# OCULOPS — Observaciones, Bugs, Mejoras & Vision
> Detectados durante sesiones 2026-03-10 / 2026-03-11
> Organizados por prioridad de impacto

---

## BUGS & ERRORES DETECTADOS

### B1. console.log en produccion
- `App.jsx:17` — `console.log('🚀 [OCULOPS] Booting OS...')` se ejecuta en prod
- `App.jsx:159` — `console.log('🛡️ [Auth] State update:')` tambien
- **Fix**: Envolver en `if (import.meta.env.DEV)` o eliminar antes de deploy publico
- **Severidad**: Media (leak de info en consola del usuario)

### B2. Linter revert problem
- El linter/hooks del proyecto revirtio archivos completos (Knowledge.jsx, Billing.jsx, useKnowledge.js) durante la sesion anterior
- Los cambios sobrevivieron esta sesion, pero el patron es fragil
- **Fix**: Investigar que hook esta causando los reverts (probablemente un pre-commit o save hook) y configurarlo para no revertir archivos completos
- **Severidad**: Alta (puede perder horas de trabajo)

### B3. Onboarding `needsOnboarding` logica fragil
- `App.jsx:162` — `!profile?.full_name && !onboarded` — si el user tiene full_name pero no ha completado onboarding real (org setup), se salta el onboarding
- **Fix**: Usar un campo dedicado `profile.onboarding_completed` en vez de inferir de `full_name`
- **Severidad**: Baja (solo afecta first-login UX)

### B4. `toUpperCase()` en datos que pueden ser null
- Multiples modulos llaman `.toUpperCase()` en campos que pueden ser undefined/null (ej: `exp.metric.toUpperCase()` en Experiments.jsx:86-88, `exp.target_value.toUpperCase()`, `exp.baseline.toUpperCase()`)
- **Fix**: Usar optional chaining `(exp.metric || '').toUpperCase()` o `exp.metric?.toUpperCase() || 'N/A'`
- **Severidad**: Media (crash silencioso si los campos estan vacios)

### B5. `opp.id.slice(0, 6)` asume UUID
- Opportunities.jsx:98 — `opp.id.slice(0, 6).toUpperCase()` — si el ID no es string (ej: numerico), crashea
- **Fix**: `String(opp.id).slice(0, 6).toUpperCase()`
- **Severidad**: Baja

### B6. Billing plan hardcodeado como 'free'
- Billing.jsx:136 — `const isCurrent = plan.id === 'free'` — TODO comment dice "read from org.plan" pero nunca se implemento
- **Fix**: Leer de `profile.default_org_id` → `organizations.plan` despues de multi-tenancy migration
- **Severidad**: Media (UX incorrecta si el user ya tiene un plan)

---

## AREAS DE MEJORA (CODE QUALITY)

### M1. Inline styles excesivos
- TODOS los modulos usan inline `style={{}}` masivamente (200+ lines de JSX con objetos style)
- Esto es anti-pattern: no cacheable, no reutilizable, dificil de mantener
- **Mejora**: Extraer estilos repetidos a clases CSS en `global.css` o crear modulos CSS
- Candidatos: `.kpi-strip`, `.vault-agent-row`, `.section-header`, `.data-table`, `.form-input-oculops`
- **Impacto**: Reduccion de ~30% del tamano de los componentes, build mas rapido

### M2. Patron vault agents duplicado en 10 modulos
- El bloque "VAULT AGENTS" es copy-paste identico en Experiments, Opportunities, Decisions, Niches, Portfolio, Simulation, Execution, Watchtower
- Solo cambia: titulo, namespaces filtrados, colores de namespace dot
- **Mejora**: Crear `<VaultAgentPanel title="..." namespaces={['data','research']} colorMap={{...}} />` como componente reutilizable
- **Impacto**: Reduccion de ~200 lineas de codigo duplicado

### M3. Knowledge search dual-path es confuso
- Knowledge.jsx tiene dos modos de busqueda (texto local vs semantico AI) con logica entrelazada
- El state management mezcla `search` (del store), `semanticQuery` (local), `searchResults` (del hook), `semanticMode` (local)
- **Mejora**: Unificar en un solo search bar con toggle, o separar en dos componentes `<TextSearch>` y `<SemanticSearch>`

### M4. No hay loading skeletons
- Todos los modulos muestran un texto plano ("ACCESSING LABORATORY DATA...", "INTERCEPTING OPPORTUNITY SIGNALS...") durante la carga
- **Mejora**: Crear un `<ModuleSkeleton rows={5} />` que renderice placeholders animados tipo war-room
- **Impacto**: UX percibida mucho mejor (Palantir no muestra textos de carga)

### M5. Agent-OS manifest se carga en CADA modulo
- `useAgentVault()` se llama en 10+ modulos independientemente, cada uno carga el manifest de 414 agents
- **Mejora**: Mover a un context provider o al store global para que se cargue UNA vez
- **Impacto**: Performance (evitar 10 lecturas del manifest)

### M6. Tests solo cubren stores, no hooks ni integracion
- 20 tests pero todos son unitarios de stores puros
- Los hooks de Supabase (useContacts, useDeals, etc.) no tienen tests
- **Mejora**: Crear mock de supabase (`__mocks__/supabase.js`) y testear al menos los 5 hooks criticos
- Tests E2E con Playwright para flujos: login → crear contacto → crear deal → mover pipeline

---

## IDEAS DE IMPLEMENTACION

### I1. Command Palette (Cmd+K)
- Como Palantir/Linear: un command palette global que permita navegar entre modulos, buscar contactos, ejecutar agentes, crear entries
- Stack: `cmdk` library (ya probada en ecosistema React)
- Prioridad: Alta (power-user UX, diferenciador real)

### I2. Real-time collaborative cursors
- Si multi-tenancy ya esta: mostrar que usuario esta en que modulo
- Implementar con Supabase Presence (ya disponible en el SDK)
- Visual: puntos de color en el sidebar con nombre del user

### I3. Agent execution desde la UI
- Actualmente los vault agents se MUESTRAN pero no se EJECUTAN desde la UI
- **Idea**: Boton "DEPLOY" en cada agent card que invoque la edge function correspondiente
- Conectar con `oculops-bridge.py activate <role>` o directamente con `supabase.functions.invoke()`
- Mostrar resultado en real-time via event bus

### I4. Dashboard personalizable (drag & drop widgets)
- Control Tower es estatico — los KPIs son fijos
- **Idea**: Permitir al user arrastrar/reorganizar widgets, elegir que KPIs ver
- Stack: `@dnd-kit` (ya instalado para Pipeline)
- Guardar layout en `profiles.dashboard_config` (JSONB)

### I5. Webhook builder visual
- Automation.jsx tiene workflows pero la creacion es formulario plano
- **Idea**: Editor visual tipo n8n-lite: nodos conectados con lineas, drag & drop triggers/actions
- Esto es un proyecto grande pero es EL diferenciador del producto

### I6. Mobile-responsive / PWA
- Actualmente 0% mobile responsive — el sidebar y las tablas no se adaptan
- **Idea**: PWA con manifest + responsive breakpoints
- Minimo: sidebar como drawer en mobile, tablas scroll horizontal, KPIs en 2 columnas
- Critico si el target son PYMEs (el CEO mira el dashboard desde el movil)

### I7. Notificaciones push
- Event bus ya existe pero solo actualiza la UI cuando esta abierta
- **Idea**: Web Push API + service worker para notificar cuando un agente completa, un deal cambia de stage, un lead responde
- Supabase tiene webhooks que pueden triggear push notifications

### I8. AI Chat integrado (Cortex conversacional)
- Hay 13 agentes pero la interaccion es indirecta (click botones, ver logs)
- **Idea**: Chat panel lateral donde escribes "find me 10 leads in Madrid" y Cortex orquesta los agentes
- Usar Anthropic API con tool_use para que el chat pueda invocar funciones internas
- Esto convertiria OCULOPS de "dashboard con agentes" a "copilot de negocio"

### I9. Data export & reporting
- Reports.jsx existe pero no genera PDFs ni exports
- **Idea**: Generar reportes semanales automaticos (PDF/email) con KPIs, pipeline status, agent activity
- Conectar con SCRIBE agent que ya existe
- Templates: weekly CEO brief, client report, investor update

### I10. Marketplace de agentes
- Con 414 agents en el vault, podria haber un "marketplace" donde otros usuarios instalan agentes
- Cada agente tiene: nombre, descripcion, capabilities, install button
- Post-SaaS: los users pagan por agentes premium

---

## VISION & ESTRATEGIA

### V1. El producto NO es un dashboard — es un copilot
- El mayor riesgo es que OCULOPS se quede como "otro dashboard bonito"
- El diferenciador real: los agentes que ACTUAN autonomamente
- **Prioridad #1**: Hacer que al menos 3 agentes funcionen end-to-end sin intervencion humana:
  1. ATLAS → detecta lead → HUNTER → cualifica → CRM
  2. SENTINEL → detecta competidor → alerta → FORGE → genera respuesta
  3. ORACLE → analiza pipeline → SCRIBE → genera reporte semanal

### V2. Onboarding es el momento critico
- Un SaaS con 23+ modulos es OVERWHELMING
- **Idea**: Onboarding guiado que desbloquea modulos progresivamente
  - Semana 1: Solo ControlTower + CRM + Pipeline
  - Semana 2: Desbloquea Intelligence + Agents
  - Semana 3: Desbloquea Automation + Knowledge
- Gamification: "Level 1 Operator" → "Level 5 Commander"

### V3. Pricing basado en agentes, no en seats
- El modelo actual (free/starter/pro/enterprise por precio fijo) es generico
- **Idea**: Pricing por "agent hours" o "agent credits"
  - Free: 100 agent runs/mes
  - Pro: 5,000 agent runs/mes
  - Enterprise: unlimited
- Esto alinea el pricing con el VALOR (mas agentes = mas revenue para el user)

### V4. El vault de 414 agentes es un moat pero esta dormido
- Tener 414 agentes definidos es un asset enorme pero ninguno se ejecuta desde la UI
- **Quick win**: Hacer que los 10 agentes con mejor capability match se listen primero
- **Medium win**: Boton "activate" que los registra en `agent_registry` y los programa en cron
- **Long win**: Auto-suggestion — "Based on your pipeline, we recommend activating DEAL-QUALIFIER"

### V5. Metricas de negocio reales, no vanity
- El Control Tower muestra conteos (contacts, deals, signals)
- Falta: conversion rates, velocity (dias por stage), cost per lead, LTV, CAC
- **Idea**: Calcular metricas derivadas automaticamente:
  - `contact → deal conversion rate`
  - `average days in each pipeline stage`
  - `revenue per agent run` (ROI de cada agente)
  - `pipeline velocity` (deals/semana que avanzan)

### V6. Integracion con herramientas que ya usa el target
- PYMEs en Espana usan: WhatsApp (ya), Gmail (ya), Excel, Holded/Billin, Instagram
- **Quick wins de integracion**:
  - CSV import/export para todo (contactos, deals, finance)
  - Google Sheets sync bidireccional
  - Instagram DM automation (via Meta API)

---

## DEUDA TECNICA

### D1. 23+ modulos lazy-loaded sin code splitting strategy
- Todos se cargan con `lazy()` pero no hay prefetch strategy
- **Fix**: Prefetch los 4 modulos CORE cuando el user hace login
- Los modulos WORLD y OPERATIONS pueden ser lazy-on-demand

### D2. Zustand persist sin version migration
- `useAppStore` persiste en localStorage con key `oculops-v10`
- Si el schema cambia, el user tendra datos corruptos
- **Fix**: Añadir `version` y `migrate` function al persist config

### D3. No hay rate limiting en edge functions
- Cualquiera con el anon key puede llamar a las edge functions ilimitadamente
- **Fix**: Implementar rate limiting con `supabase-rate-limit` o custom counter en Redis/KV
- Critico antes de launch publico

### D4. Supabase offline mode es un stub
- `supabase.js` tiene `createOfflineQuery()` que retorna datos vacios
- Si Supabase cae, toda la app muestra "0 contacts, 0 deals"
- **Fix**: Cache local con `zustand/persist` como fallback layer

### D5. No hay migrations rollback strategy
- Las 2 migrations pendientes (pgvector, multi-tenancy) son destructivas (ALTER TABLE en 28 tablas)
- Si fallan a mitad, el schema queda corrupto
- **Fix**: Testear en un proyecto Supabase staging antes de push a prod
