# OCULOPS — Pendientes manuales

---

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
- [ ] Smoke remoto de bloqueo esperado:
  - llamada legacy directa `high` a `api-proxy` debe responder `409` (`legacy_high_risk_route_required`)
  - llamada legacy directa `high` a `messaging-dispatch` debe responder `409` (`legacy_high_risk_route_required`)
- [ ] Smoke remoto de ruta permitida:
  - workflow legacy `run_connector` con `risk_class=high` debe ejecutar por `tool_dispatch` sin bloqueo
  - workflow legacy `run_api` con `risk_class=high` debe ejecutar por `tool_dispatch` sin bloqueo
- [ ] Verificar en `event_log` correlación completa:
  - `tool_bus.invocation` existente para `correlation_id`
  - evento final del endpoint con resultado esperado

### Riesgos/errores detectados (registrados)
- [ ] `run_api` high/critical depende de permisos en `agent_tool_permissions` y/o `tool_registry` para el `endpoint` usado como `tool_code_name`; si falta permiso, `tool-bus` bloqueará (esperado por política, pero requiere configuración).
- [ ] En entorno local faltan secretos para smoke de control-plane:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] CLI actual de Supabase no incluye `functions invoke`; el smoke remoto debe hacerse con cliente HTTP (curl/Postman) o desde la app.
- [ ] `deno` no está instalado localmente, por lo que no se puede ejecutar `deno check` local de edge functions (deploy remoto sí funciona).
