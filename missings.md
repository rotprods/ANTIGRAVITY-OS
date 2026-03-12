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
