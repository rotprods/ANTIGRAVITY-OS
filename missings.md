# OCULOPS — Pendientes manuales

---

## Pendientes reales de esta sesión (2026-03-14)

### n8n / MCP / Mac Mini
- [ ] Reiniciar la sesión MCP/Codex para que `n8n-mcp` deje de usar el host viejo en runtime y tome el host actual:
  - `https://ended-frontpage-frequencies-rolls.trycloudflare.com`
- [ ] Re-ejecutar por MCP (no por curl) tras reinicio:
  - `n8n_health_check` (status/diagnostic)
  - `n8n_list_workflows`
- [ ] Mantener túnel Cloudflare estable (si cambia URL, actualizar `.mcp.json` y `~/.codex/config.toml`).

### Google Workspace / Gmail (bloqueo actual)
- [ ] Completar OAuth de Google por CLI:
  - `npm run gws -- auth login -s gmail`
  - Nota: ahora bloquea por app OAuth no verificada / usuario de test no autorizado.
- [ ] Alta de canal Gmail real por CLI (ya implementado):
  - `npm run gws:bootstrap:gmail -- --org-id a11b1e98-7fd9-4789-aab9-ab5a77494627`
- [ ] Validar runtime real de Gmail:
  - `node scripts/smoke-provider-runtime.mjs --sync-gmail`
- [ ] Regenerar readiness tras alta real:
  - `npm run readiness:gate`

### Readiness producción
- [ ] Para pasar a `production` gate:
  - definir `READINESS_ORG_ID`
  - mover `messaging` de `simulated` a `connected` (Gmail real activo)
  - cerrar warnings de `governance/control_tower` en modo advisory
- [ ] Ejecutar:
  - `npm run readiness:gate:production`
  - opcional estricto: `npm run readiness:gate:production:strict`

### Provider-backed pendiente (si se quiere full connected)
- [ ] WhatsApp runtime: faltan secrets mínimos
  - `WHATSAPP_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
- [ ] (Inbound verificación avanzada): `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`

## Google Workspace — Sheets + Calendar + Drive
> Backend 100% deployado. Solo pasos manuales en el navegador.
> NO necesitas gcloud CLI ni ninguna herramienta — solo el navegador.

### PASO 1 — Habilitar las 3 APIs
URL directa: https://console.cloud.google.com/apis/library?project=hale-carport-488011-i1

Busca y activa una por una:
- [ ] **Google Sheets API** → buscar "Sheets" → Enable
- [ ] **Google Drive API** → buscar "Drive" → Enable
- [ ] **Google Calendar API** → buscar "Calendar" → Enable

---

### PASO 2 — Añadir scopes al OAuth consent screen
URL directa: https://console.cloud.google.com/apis/credentials/consent?project=hale-carport-488011-i1

1. Click **Edit App**
2. Ir a la sección **Scopes** → click **Add or remove scopes**
3. En el buscador pegar uno por uno y activar:
   - [ ] `https://www.googleapis.com/auth/spreadsheets`
   - [ ] `https://www.googleapis.com/auth/drive.file`
   - [ ] `https://www.googleapis.com/auth/calendar.events`
4. **Update** → **Save and continue** hasta el final

---

### PASO 3 — Verificar redirect URI
URL directa: https://console.cloud.google.com/apis/credentials?project=hale-carport-488011-i1

1. Click en el OAuth 2.0 client: `478773528360-vpdi7i5d1mf80398m7nbrsdl92e6tg7i`
2. En **Authorized redirect URIs** debe existir exactamente:
   ```
   https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/messaging-channel-oauth
   ```
   - [ ] URI presente → OK
   - Si no está → **Add URI** → pegar → **Save**

---

### PASO 4 — Reconectar Gmail en la app (ÚLTIMO PASO)
> Solo después de completar los pasos 1-3

1. Abrir OCULOPS → módulo **Messaging**
2. Canal **Email** → click **Reconnect**
3. Se abre ventana de Google → aceptar TODOS los permisos nuevos
4. Ventana se cierra → canal queda **Active**
- [ ] Gmail reconectado

### TEST final
- **CRM** → botón **Sheets** → debe abrir Google Sheet nuevo con tus datos
- **Pipeline** → click en un deal → botón **Follow-up** → debe crear evento en Calendar

---

## Channels pendientes (secrets no configurados)
- [ ] WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- [ ] Meta Ads: `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`
- [ ] TikTok: `TIKTOK_API_KEY`, `TIKTOK_API_SECRET`
- [ ] ManyChat: `MANYCHAT_API_KEY`
- [ ] Telegram: `TELEGRAM_CHAT_ID`, `TELEGRAM_THREAD_ID`

## n8n
- [ ] Regenerar API key antes de 2026-04-07
- [ ] Limpiar secret stray: `supabase secrets unset FEPGQ5TC1RSITP`

---

## AG2-C6 (estado actual + siguiente)

### Cerrado (sin credenciales de provider)
- [x] Harness sintético AG2-C6 validado:
  - `outbound -> inbound -> outreach_queue.status=replied`
  - `outreach_queue.provider_status=replied`
  - `outreach_queue.message_id` enlazado al inbound
  - `conversations.last_inbound_at` actualizado
- Evidencia:
  - `docs/runbooks/ag2-c6-synthetic-smoke.md`
  - `docs/runbooks/ag2-c6-synthetic-smoke.latest.json`

### Lo que va después (bloque real)
- [ ] AG2-C6 live round-trip con provider real (Gmail/WhatsApp): outbound real -> inbound real -> `outreach_queue.status=replied`
- [ ] Smoke operador provider-backed completo: `docs/smoke-operator-loop.md` (secciones 5 y 6)
- [ ] Integration deploy gate final: deploy de edge functions + deploy app + smoke post-deploy

### Orden operativo siguiente (ejecución)
1. [ ] Cerrar AG2-C2 real:
   - Gmail reconnect (OAuth en app)
   - Cargar secretos WhatsApp outbound: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
   - Cargar secretos WhatsApp inbound: `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`
2. [ ] Ejecutar AG2-C6 live round-trip real:
   - outbound real (`messaging-dispatch`)
   - inbound real (`gmail-inbound` o `whatsapp-webhook`)
   - verificar `outreach_queue.status = replied`
3. [ ] Ejecutar smoke operador provider-backed:
   - `docs/smoke-operator-loop.md` secciones 5 y 6
4. [ ] Integration gate final:
   - deploy funciones
   - `lint + test + build`
   - deploy app
   - smoke post-deploy

---

## Registro vivo — pendientes y errores detectados (no omitir)

### Estado técnico de enforcement (AG2)
- [x] `compose_message sendLive` rerouteado a `control-plane -> tool_dispatch -> tool-bus -> messaging-dispatch`
- [x] `run_connector` con riesgo `high/critical` rerouteado a `control-plane -> tool_dispatch -> tool-bus -> api-proxy`
- [x] `run_api` con riesgo `high/critical` rerouteado a `control-plane -> tool_dispatch -> tool-bus -> endpoint`
- [x] Hard-block server-side en `messaging-dispatch` para rutas legacy `high/critical` sin evidencia `control-plane + tool-bus`
- [x] Hard-block server-side en `api-proxy` para rutas legacy `high/critical` sin evidencia `control-plane + tool-bus`

### Pendientes inmediatos (validación operativa real)
- [x] Smoke remoto de bloqueo esperado:
  - [x] llamada legacy directa `high` a `api-proxy` responde `409` (`legacy_high_risk_route_required`)
  - [x] llamada legacy directa `high` a `messaging-dispatch` responde `409` (`legacy_high_risk_route_required`)
- [x] Smoke remoto de ruta permitida:
  - [x] workflow legacy `run_connector` con `risk_class=high` ejecuta por `tool_dispatch` sin bloqueo
  - [x] workflow legacy `run_api` con `risk_class=high` ejecuta por `tool_dispatch` sin bloqueo
- [x] Verificar en `event_log` correlación completa:
  - `tool_bus.invocation` existente para `correlation_id` en `run_connector` y `run_api`
  - evidencia en `docs/runbooks/hard-block-routing-smoke.latest.json`

### Incidente resuelto (2026-03-13)
- [x] `api-proxy` devolvía `503 BOOT_ERROR` en runtime.
  - causa raíz: redeclaración de `const payload` en el mismo scope (error de parseo del edge runtime).
  - fix aplicado: renombrado de payload de respuesta a `responsePayload` + hardening de auth interna para tokens `service_role` por claim JWT.
  - validación: `node scripts/smoke-hard-block-routing.mjs` con resultado `ok: true` (`4/4 PASS`).

### Riesgos/errores detectados (registrados)
- [ ] `run_api` high/critical depende de permisos en `agent_tool_permissions` y/o `tool_registry` para el `endpoint` usado como `tool_code_name`; si falta permiso, `tool-bus` bloqueará (esperado por política, pero requiere configuración).
- [x] Secrets locales para smoke de control-plane presentes (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) y validados en ejecución remota.
- [ ] CLI actual de Supabase no incluye `functions invoke`; el smoke remoto debe hacerse con cliente HTTP (curl/Postman) o desde la app.
- [ ] `deno` no está instalado localmente, por lo que no se puede ejecutar `deno check` local de edge functions (deploy remoto sí funciona).

---

## Ecosystem convergence (code-first) — estado actualizado

### Cerrado en este bloque
- [x] `control-plane` expone acciones nuevas:
  - `ecosystem_readiness`
  - `run_trace`
  - `governor_metrics` (alias de snapshot de gobernanza)
- [x] Control Tower consume readiness canónico y muestra estado por módulo (`connected|simulated|degraded|offline|planned`).
- [x] Convergencia visual baseline fuera de Control Tower:
  - Messaging muestra `messaging` route status + reason + trace shortcut
  - Automation muestra badges readiness (`automation`, `connector_proxy`, `n8n_catalog`)
  - Marketplace muestra `marketplace` route status + reason
- [x] Control Tower consume `run_trace` por `correlation_id` para resumen de estado final/pasos.
- [x] Script de artifact operativo:
  - `npm run readiness:generate`
  - genera `docs/runbooks/ecosystem-readiness.latest.json`
  - genera `docs/runbooks/ecosystem-readiness.md`
- [x] Gate automático de readiness (sintético) implementado:
  - `npm run readiness:check` (valida artifact contra policy sintética)
  - `npm run readiness:gate` (genera artifact + valida gate)
  - script: `scripts/check-ecosystem-readiness-gate.mjs`
- [x] Integración de gate en pipeline:
  - `scripts/deploy-gate.mjs` ahora ejecuta `npm run readiness:gate`
  - CI GitHub (`.github/workflows/ci.yml`) ejecuta readiness gate cuando existen secretos
  - Deploy Supabase (`.github/workflows/supabase-deploy.yml`) ejecuta readiness gate post-deploy cuando existen secretos
- [x] Smoke control-plane extendido y validado:
  - `goal_parse` + `metrics` + `ecosystem_readiness` + `run_trace`
  - `npm run smoke:control-plane` devuelve `ok: true`
- [x] Deploy remoto de `control-plane` con estas rutas realizado.

### Incidente resuelto en convergencia (2026-03-14)
- [x] `run_trace` fallaba con `500` en remoto.
  - causa raíz: desalineación de columnas con schema real (`pipeline_runs.pipeline_template_id` y `pipeline_step_runs.finished_at` no existen).
  - fix aplicado: uso de `pipeline_runs.template_id` y `pipeline_step_runs.completed_at` en `buildRunTraceView`.
  - validación: `npm run smoke:control-plane` con `run_trace.status = 200`.

### Pendiente inmediato para cerrar el gap completo
- [x] Integrar `readiness:generate` al gate de release/CI como criterio objetivo.
- [x] Añadir smoke/CI explícito para `build:project-apis` + `inject:n8n-api-context` (dry-run/apply por entorno):
  - script: `scripts/smoke-project-apis-n8n-bridge.mjs`
  - npm: `npm run smoke:project-apis-bridge`
  - integrado en `.github/workflows/ci.yml`, `.github/workflows/supabase-deploy.yml` y `scripts/deploy-gate.mjs`
- [ ] Completar configuración de secretos en GitHub para que el gate corra en todos los entornos:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [x] Gate `production` endurecido:
  - módulos críticos obligatorios en `connected` (configurable por `READINESS_PRODUCTION_CRITICAL_MODULES`)
  - estados permitidos de módulos no críticos configurables por `READINESS_PRODUCTION_NON_CRITICAL_STATES`
  - modo ultra estricto disponible (`READINESS_PRODUCTION_STRICT_ALL_CONNECTED=true` o `npm run readiness:gate:production:strict`)
  - `READINESS_ORG_ID` obligatorio en `production` y validado contra `governance_metrics.org_id` del artifact
- [x] CI/deploy ya parametrizados para switch sin código:
  - `READINESS_GATE_MODE` (default `synthetic`)
  - `READINESS_PRODUCTION_CRITICAL_MODULES`
  - `READINESS_PRODUCTION_NON_CRITICAL_STATES`
  - `READINESS_PRODUCTION_STRICT_ALL_CONNECTED`
  - `READINESS_ORG_ID`
- [x] Runbook de cutover a producción documentado:
  - `docs/runbooks/readiness-production-cutover.md`
- [ ] Definir fecha de corte y setear `READINESS_GATE_MODE=production` en GitHub Variables.
- [ ] Endurecer convergencia visual ya añadida:
  - [x] estandarizar `state_reason_code` visible por módulo (Control Tower, Messaging, Automation, Marketplace)
  - [x] enlazar `remediation_action` desde cada módulo a ruta concreta cuando aplica (`/route`)
  - [ ] añadir cobertura E2E de estas superficies de readiness
- [ ] Ejecutar generación de artifact con `READINESS_ORG_ID` fijo en pipeline para evitar modo advisory (`org_id=null`).
- [ ] Cerrar loop provider-backed real (Gmail/WhatsApp) para pasar de `simulated/offline` a `connected` en módulos de mensajería/conectores.

### Estado actual del artifact (última ejecución)
- [x] Artifact generado correctamente:
  - `overall_state = green`
  - `smokes = pass (hard_block_routing, ag2_c6_synthetic, governor_runtime)`
- [x] Módulos cerrados en este bloque:
  - `control_tower` y `governance` ya no degradan por warning advisory `no_org_scope`.
  - `simulation` pasa a `simulated` cuando hay guardrails activos pero smoke sintético en verde.
