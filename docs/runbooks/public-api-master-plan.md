# Plan Maestro — Infraestructura Total de APIs Públicas (OCULOPS)

## Baseline operativo (Paso 1 — Gap Closure)
- Fecha: 2026-03-14
- Rama de trabajo: `codex/gap-closure-master`
- Commit base de arranque: `59923e9`
- Estado de workspace: cambios pendientes del bloque `Project APIs -> n8n bridge` (scripts/docs/reports/tests listos para cierre en Git)
- Validación técnica local:
  - `npm run lint` -> sin errores, 5 warnings existentes en `src/components/modules/FlightDeck.jsx`
  - `npm test` -> `27/27` test files en pass, `175/175` tests en pass
  - `npm run build` -> pass
- Evidencia de inyección n8n en este baseline:
  - `reports/n8n-api-context-injection.json` -> `mode=apply`, `updated=1`, `failed_updates=0`
  - `reports/n8n-api-trigger-pack.json` -> trigger packs generados para 6 eventos canónicos

## Objetivo
Construir una capa de infraestructura única para todo el catálogo público (1.426 APIs), con clasificación operativa, mapeo a agentes y automatizaciones, control de acceso/credenciales, y activación progresiva sin romper el core actual.

## Estado base confirmado
- Catálogo importado: 1.426 APIs / 51 categorías.
- Marketplace/UI: catálogo completo con paginación y filtros.
- Conectores live: fase inicial activada (7 live / 5 adapter-ready pendientes de credenciales).
- n8n: catálogo y reconciliación activos, pendiente de credenciales/community nodes en algunos casos.

## Arquitectura objetivo
1. Capa de Catálogo
- Fuente canónica: `public-apis/public-apis` README.
- Snapshot + seed + shards públicos.
- Normalización de auth/https/cors, scoring y tiering.

2. Capa de Integración
- `bridge_profile` por API: `docs_only`, `install_then_connector_proxy`, `connector_proxy`.
- `ecosystem_profile` por API:
  - acceso (`open_no_auth`, `registration_api_key`, etc.)
  - formatos esperados
  - modos de extracción
  - comandos y acciones recomendadas
  - patrones n8n
  - prioridad de integración

3. Capa de Persistencia
- `api_catalog_entries` (catálogo base)
- `api_connectors` (conectores instalados/live)
- `api_catalog_integration_map` (mapeo integral por API)
- `api_catalog_registration_backlog` (pendientes con URL directa de registro/docs)

4. Capa de Ejecución
- `run_connector` para conectores live vía `api-proxy`.
- `run_api` para APIs abiertas no autenticadas (fase de uso directo controlado).
- `launch_n8n` para orquestación por workflows.

5. Capa de Inteligencia Operativa
- Agentes consumen catálogo + bridge + ecosistema para decidir ruta:
  - live connector
  - n8n HTTP Request
  - docs-only research
- Solo conectores live ejecutan acciones críticas.

## Estrategia de importación
- Autoimport seguro: APIs públicas no-auth (`open_no_auth`) + HTTPS.
- Backlog de registro: APIs interesantes con auth requerida (api_key/oauth/header), con URL directa para alta.
- Pago/licencia: marcado como `unknown` hasta verificación del proveedor.

## Fases de ejecución
1. Inventario y mapa total (hecho en esta entrega)
- Generar capa de ecosistema y matriz agentes/automatizaciones/comandos.
- Emitir backlog de registro priorizado.

2. Activación por olas
- Ola A: open_no_auth de alta prioridad (sin credenciales).
- Ola B: adapter-ready con credenciales.
- Ola C: candidatas interesantes (nuevos templates).

3. Conexión completa con agentes y n8n
- Enlazar APIs por capacidades a prompts/skills/acciones.
- Crear workflows n8n por vertical (prospector, watchtower, finance, world_monitor).

4. Hardening
- Smokes por conector/API.
- Health checks recurrentes.
- Alertas por degradación.

## Checklist de cierre
- [x] `supabase db push` aplicado (incluye tablas ecosystem/backlog).
- [x] `npm run sync:public-apis` ejecutado sin errores.
- [x] `npm run build:public-api-infra-layer` actualizado.
- [x] `npm run build:public-api-ecosystem-layer` actualizado.
- [x] `api_catalog_integration_map` sincronizada en Supabase.
- [x] `api_catalog_registration_backlog` sincronizada en Supabase.
- [x] `reports/public-api-open-free-candidates.json` validado.
- [x] `reports/public-api-registration-backlog.json` validado.
- [x] `reports/public-api-agent-automation-matrix.csv` validado.
- [x] Inyección de APIs hacia n8n bridge activada (`build:project-apis` + `reconcile:n8n-oculops`).
- [ ] Activar credenciales de provider para backlog prioritario (GraphHopper, Aemet, Guardian, FRED).
- [ ] Re-ejecutar bootstrap + healthcheck de conectores tras cargar keys.
- [ ] Activar/validar workflows n8n vinculados a capacidades críticas.

## Comandos operativos
```bash
npm run sync:public-apis
npm run build:public-api-infra-layer
npm run build:public-api-ecosystem-layer
npm run build:project-apis
npm run public-apis:bootstrap -- --apply --healthcheck --strict
npm run public-apis:finalize -- --apply --strict
npm run reconcile-n8n-oculops -- --apply --recent-hours 72
```
