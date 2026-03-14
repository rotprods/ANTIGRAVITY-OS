# Public API Injection → n8n (OCULOPS)

## Objetivo
Inyectar automáticamente APIs utilizables dentro de los bridges de n8n (`automation_workflows` + step `launch_n8n`) para que cada workflow reciba contexto operativo por evento.

## Fuentes
- `public/public-api-catalog/ecosystem-layer.json`
- `reports/n8n-api-trigger-pack.json`
- `reports/project-apis.usable-now.json`
- `reports/project-apis.pending-registration.json`

## Comandos
```bash
npm run build:public-api-ecosystem-layer
npm run build:project-apis
npm run reconcile-n8n-oculops -- --apply --recent-hours 72
```

## Qué se inyecta
Por workflow n8n puenteado:
- `step.config.apiInjection`
  - `event_key`
  - `module_targets`
  - `totals` (matching/live/open/installable/registration_pending)
  - `live_connector_entries`
  - `open_direct_entries`
  - `installable_entries`
  - `registration_backlog_entries`
- `metadata.api_injection` (resumen compacto)

## Mapeo evento → módulos
- `lead.qualified` → `prospector`
- `outreach.step_due` → `prospector`, `automation`
- `content.requested` → `automation`, `knowledge`
- `strategy.requested` → `watchtower`, `finance`, `knowledge`, `world_monitor`
- `signal.detected` → `watchtower`, `world_monitor`, `finance`
- `agent.completed` → `knowledge`, `automation`

## Resultado esperado
- n8n recibe en cada webhook un `step_config` enriquecido con APIs utilizables para ese caso.
- Agentes y automatizaciones comparten el mismo contrato operativo de APIs.
- APIs con registro quedan separadas en backlog con URL directa de alta.
