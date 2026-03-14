# OCULOPS OS — Master API Registry & Integration Atlas

> **Objetivo**: Documento de referencia para activar progresivamente TODAS las APIs que componen la red de inteligencia del OS. Cada API tiene los pasos exactos para obtener las keys, configurar el `.env`, y activar la edge function correspondiente.

> **Actualización 2026-03-14**: Este documento se mantiene como vista ejecutiva/manual.  
> El registro canónico operativo ahora vive en:
> - `public/public-api-catalog/ecosystem-layer.json`
> - `docs/APIs_PROYECTO.md`
> - `reports/project-apis.usable-now.json`
> - `reports/project-apis.pending-registration.json`
> - `reports/n8n-api-trigger-pack.json`

---

## 📊 Estado Actual del Sistema

| Categoría | Activas | Pendientes | Planificadas |
|-----------|---------|------------|--------------|
| AI/ML | 2 | 2 | 1 |
| GeoIntelligence | 1 | 0 | 1 |
| Social Media | 0 | 4 | 2 |
| Financial/Markets | 0 | 0 | 3 |
| Blockchain | 0 | 0 | 2 |
| Live Feeds | 0 | 0 | 2 |
| Communication | 0 | 1 | 1 |
| Business Data | 0 | 0 | 3 |
| **TOTAL** | **3** | **7** | **15** |

---

## 🟢 TIER 1 — ACTIVAS (Funcionando ahora)

### 1. Google Gemini AI

| Campo | Valor |
|-------|-------|
| **Uso** | AI Strategy Advisor + AI Lead Qualifier |
| **Edge Function** | `ai-advisor`, `ai-qualifier` |
| **Env** | `GEMINI_API_KEY` |
| **Docs** | <https://ai.google.dev/docs> |
| **Coste** | Gratis (Flash) / $3.50/M tokens (Pro) |
| **Estado** | ✅ ACTIVA con fallback reglas |

### 2. Google Places API (New)

| Campo | Valor |
|-------|-------|
| **Uso** | Prospector — búsqueda de negocios por zona |
| **Edge Function** | `google-maps-search` |
| **Env** | `GOOGLE_MAPS_API_KEY` |
| **Docs** | <https://developers.google.com/maps/documentation/places/web-service> |
| **Coste** | $200/mes crédito gratis (~5,000 searches) |
| **Estado** | ✅ ACTIVA con fallback demo |

### 3. Google PageSpeed Insights

| Campo | Valor |
|-------|-------|
| **Uso** | Web Analyzer — performance + SEO score |
| **Edge Function** | `web-analyzer` |
| **Env** | Usa `GOOGLE_MAPS_API_KEY` (opcional) |
| **Docs** | <https://developers.google.com/speed/docs/insights/v5/get-started> |
| **Coste** | 100% GRATIS |
| **Estado** | ✅ ACTIVA |

---

## 🟡 TIER 2 — PENDIENTES (Edge function escrita, falta key)

### 4. OpenAI API

| Campo | Valor |
|-------|-------|
| **Uso** | Procesamiento de datos, extracción JSON, agents |
| **Env** | `OPENAI_API_KEY` |
| **Docs** | <https://platform.openai.com/docs> |
| **Coste** | GPT-4o: $2.50/M input, $10/M output |
| **Activar** | 1. <https://platform.openai.com> → API Keys → Create key 2. Añadir a `.env` y Supabase secrets |

### 5. Anthropic Claude API

| Campo | Valor |
|-------|-------|
| **Uso** | Estrategia compleja, copywriting, razonamiento |
| **Env** | `ANTHROPIC_API_KEY` |
| **Docs** | <https://docs.anthropic.com> |
| **Coste** | Sonnet: $3/M input, $15/M output |
| **Activar** | 1. <https://console.anthropic.com> → API Keys 2. Añadir a `.env` y Supabase secrets |

### 6. Meta Business / Instagram Graph API

| Campo | Valor |
|-------|-------|
| **Uso** | Business Discovery, Ad Library, insights de competidores |
| **Edge Function** | `meta-business-discovery` (escrita, no desplegada) |
| **Env** | `META_ACCESS_TOKEN` |
| **Docs** | <https://developers.facebook.com/docs/instagram-api> |
| **Coste** | GRATIS (requiere app review) |
| **Endpoints** | `GET /{user_id}/business_discovery`, Creator Marketplace API |
| **Permisos** | `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` |

### 7. TikTok Business API

| Campo | Valor |
|-------|-------|
| **Uso** | Tendencias, análisis competidores, Ad Library |
| **Edge Function** | `tiktok-business-search` (escrita, no desplegada) |
| **Env** | `TIKTOK_ACCESS_TOKEN` |
| **Docs** | <https://business-api.tiktok.com/portal/docs> |
| **Coste** | GRATIS (requiere approval) |
| **APIs** | Display API, Business API, Research API, Events API |

### 8. WhatsApp Cloud API

| Campo | Valor |
|-------|-------|
| **Uso** | Outreach automatizado, cualificación de leads |
| **Edge Function** | `whatsapp-webhook` (escrita, no desplegada) |
| **Env** | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| **Docs** | <https://developers.facebook.com/docs/whatsapp/cloud-api> |
| **Coste** | 1,000 conv/mes gratis, después ~$0.05/conv |

### 9. ManyChat API

| Campo | Valor |
|-------|-------|
| **Uso** | Embudos IG/Messenger, captura leads |
| **Edge Function** | `manychat-sync` (escrita, no desplegada) |
| **Env** | `MANYCHAT_API_KEY` |
| **Docs** | <https://api.manychat.com> |
| **Coste** | Free hasta 1,000 contactos |

---

## 🔴 TIER 3 — PLANIFICADAS (Por construir)

### 10. X / Twitter API v2

| Campo | Valor |
|-------|-------|
| **Uso** | Monitorización de tendencias, señales de mercado |
| **Coste** | Free: write-only. Basic ($200/mo): 15K reads. Pro ($5K/mo): 1M reads |
| **Docs** | <https://developer.x.com/en/docs/twitter-api> |
| **Nota** | ⚠️ Caro para lectura. Considerar Apify como alternativa |

### 11. Reddit API

| Campo | Valor |
|-------|-------|
| **Uso** | Social listening, detección de tendencias en nichos |
| **Coste** | Free: 100 QPM. Paid: $0.24/1K calls |
| **Docs** | <https://www.reddit.com/dev/api> |
| **Endpoints** | `/search`, `/r/{sub}/hot`, `/r/{sub}/new` |

### 12. Alpha Vantage (Mercados)

| Campo | Valor |
|-------|-------|
| **Uso** | Stocks, forex, crypto en tiempo real |
| **Coste** | GRATIS (5 calls/min, 500/día) |
| **Docs** | <https://www.alphavantage.co/documentation> |
| **Env** | `ALPHA_VANTAGE_KEY` |

### 13. Finnhub (Mercados + Noticias)

| Campo | Valor |
|-------|-------|
| **Uso** | Noticias financieras, earnings, sector perf |
| **Coste** | GRATIS (60 calls/min) |
| **Docs** | <https://finnhub.io/docs/api> |
| **Env** | `FINNHUB_API_KEY` |

### 14. CoinGecko (Crypto)

| Campo | Valor |
|-------|-------|
| **Uso** | Precios crypto, market caps, trending |
| **Coste** | GRATIS (30 calls/min), no key |
| **Docs** | <https://www.coingecko.com/en/api/documentation> |

### 15. XRP Ledger (Blockchain)

| Campo | Valor |
|-------|-------|
| **Uso** | Pagos instantáneos ($0.0002/tx, 3-5s), smart contracts |
| **Librería** | `xrpl.js` (npm: xrpl) |
| **Docs** | <https://xrpl.org/docs> |
| **2025** | Smart contracts nativos, EVM sidechain, DID, tokenización RWA |

### 16. Windy Webcams (Cámaras vivas)

| Campo | Valor |
|-------|-------|
| **Uso** | Feeds cámaras mundiales, análisis tráfico |
| **Coste** | GRATIS (tokens expiran 10min) |
| **Docs** | <https://api.windy.com/webcams> |
| **Env** | `WINDY_API_KEY` |

### 17. YouTube Data API v3

| Campo | Valor |
|-------|-------|
| **Uso** | Análisis competidores, tendencias contenido |
| **Coste** | GRATIS (10,000 units/día) |
| **Docs** | <https://developers.google.com/youtube/v3> |

### 18. Hunter.io (Email Finder)

| Campo | Valor |
|-------|-------|
| **Uso** | Email corporativos de leads |
| **Coste** | 25 búsquedas/mes gratis |
| **Docs** | <https://hunter.io/api-documentation/v2> |

### 19. Apollo.io (Company Enrichment)

| Campo | Valor |
|-------|-------|
| **Uso** | Revenue, tamaño empresa, industria |
| **Coste** | Free: 900 credits/mes |
| **Docs** | <https://docs.apollo.io> |

---

## 🔧 Variables de Entorno Completas

```env
# ═══ ACTIVAS ═══
GEMINI_API_KEY=
GOOGLE_MAPS_API_KEY=

# ═══ TIER 2 ═══
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
META_ACCESS_TOKEN=
TIKTOK_ACCESS_TOKEN=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
MANYCHAT_API_KEY=

# ═══ TIER 3 ═══
ALPHA_VANTAGE_KEY=
FINNHUB_API_KEY=
HUNTER_API_KEY=
WINDY_API_KEY=
YOUTUBE_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
X_BEARER_TOKEN=
XRP_WALLET_SEED=
APOLLO_API_KEY=
```

## 🚀 Orden de Activación (4 Semanas)

| Semana | APIs | Impacto |
|--------|------|---------|
| 1 | Google Maps Key, WhatsApp | Leads reales + outreach automático |
| 2 | Meta/IG, Alpha Vantage, Finnhub | Señales sociales + dashboard financiero |
| 3 | OpenAI, Anthropic, Hunter.io | AI multi-modelo + enriquecimiento leads |
| 4 | TikTok, Reddit, YouTube, XRP, Webcams | Ecosistema completo |
