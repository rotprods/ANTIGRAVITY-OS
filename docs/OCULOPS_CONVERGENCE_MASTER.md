# OCULOPS — CONVERGENCE MASTER DOCUMENT
## Versión: 2.0 (Fusión Metaprompt + Estado Real)
## Fecha: 2026-03-14
## Estado: MAC MINI VIVO — CLOUDFLARE TUNNEL ACTIVO — N8N OPERATIVO

---

## VERDAD ABSOLUTA DEL SISTEMA HOY

### Hardware
| Nodo | Estado | Función |
|------|--------|---------|
| **Mac Mini 24GB** | 🟢 CORE SOBERANO | AI Server, n8n, Docker, PM2, Agent Zero, ComfyUI, CloudHub, 1200+ skills |
| **MacBook Pro** | 🟡 CONSOLA REMOTA | Dashboard, desarrollo, supervisión, acceso admin |
| **Supabase Cloud** | 🟢 BBDD CENTRAL | 29 tablas, Edge Functions, triggers, RLS, event-dispatcher |
| **Vercel** | 🟢 FRONTEND LIVE | SaaS Dashboard React/Vite en antigravity-os-theta.vercel.app |
| **Cloudflare Tunnel** | 🟢 BRIDGE ACTIVO | `https://baseline-cooked-candidate-vehicles.trycloudflare.com` → `localhost:5680` (n8n) |

### Infraestructura real en el Mac Mini
- **PM2**: `n8n`, `n8n-executor`, `opencloud-planner`, `cloudbot`, `auto-mejora loop`, `dashboard UI/API`, `integration hub`, `RR planner`
- **OpenCloud Agents**: `Main`, `Orquestador`, `Coder`, `QA`, `Arquitecto`, `Cloud`
- **Skills instaladas**: `Experto Antigravity Diseñando`, `Mental State`, `Deep Research`, `Architect Review`, `Agent Memory System`, `Antigravity Workflows`, `Deep Thinking`
- **CloudHub**: 1.233+ skills disponibles
- **LLM local disponible**: `Qwen 3:8b` + embeddings en AnythingLLM (RAG)
- **LLM recomendado para instalar**: `Qwen2.5-Coder:32B` (Q4_K_M, ~19GB) o `DeepSeek-R1:14B` (~9GB, máxima velocidad)
- **OpenRouter**: Acceso a Hunter Alpha 1T y otros modelos masivos en la nube

### Conectividad MCP (Herramientas de Control Remoto)
- **n8n-mcp** configurado en Antigravity MacBook Pro → apunta al Cloudflare Tunnel
- **API Key de n8n**: JWT activo (expira 2026-04-10)
- **Supabase MCP**: Activo con full access al proyecto `vpjcwheuqmwbpcufbbkj`

---

## GAP ACTUAL (Lo que falta para 100%)

### BLOQUE A — Backend/Control-Plane (45-55% completado)
| Item | Estado | Prioridad |
|------|--------|-----------|
| `ecosystem-readiness.latest.json` generado por Edge Function | ❌ FALTA | P0 |
| `ecosystem_readiness` cableado a `orchestrator-core` | ❌ FALTA | P0 |
| `run_trace` expuesto vía RPC a Frontend | ❌ FALTA | P1 |
| Estado determinista `connected/simulated/degraded/offline` | ❌ FALTA | P0 |
| Hard-block routing smoke 4/4 PASS | ✅ HECHO | — |
| AG2-C6 synthetic smoke outbound→replied | ✅ HECHO | — |
| `LEVEL7_CONTROL_PLANE_SCHEMAS.json` | ✅ HECHO | — |
| `ecosystem-readiness.ts` scaffold | ✅ HECHO | — |
| `control-plane-types.ts` scaffold | ✅ HECHO | — |

### BLOQUE B — Frontend/UI (30-40% completado)
| Item | Estado | Prioridad |
|------|--------|-----------|
| Panel "System Readiness" con semáforos | ❌ FALTA | P0 |
| Botones inteligentes que lean Readiness Contract | ❌ FALTA | P1 |
| E2E smoke completo (click→n8n→DB→Dashboard) | ❌ FALTA | P0 |
| Todos los dashboards 100% funcionales | ❌ FALTA | P1 |

### BLOQUE C — Provider-Backed Real (0% — Gate Final)
| Item | Estado | Prioridad |
|------|--------|-----------|
| WhatsApp Cloud API conectada | ❌ PENDIENTE | P2 |
| Gmail/Mailgun configurado | ❌ PENDIENTE | P2 |
| Stripe Live Keys | ❌ PENDIENTE | P2 |
| Google Maps API activa | ❌ PENDIENTE | P2 |
| Switch `AGENCY_ENV=production` | ❌ PENDIENTE | ÚLTIMO |

### BLOQUE D — CloudBot (Mac Mini Director Interno)
| Item | Estado | Prioridad |
|------|--------|-----------|
| `CLOUDBOT_MASTER_OPERATING_SYSTEM.md` definido | ❌ FALTA | P1 |
| CloudBot vigilando health de servicios PM2/Docker | ❌ FALTA | P1 |
| CloudBot como decision router entre agentes | ❌ FALTA | P2 |
| Loops de auto-mejora formalizados | 🟡 PARCIAL | P2 |

---

## PLAN DE IMPLEMENTACIÓN REAL (Fases de 1 día)

### FASE 0 — System Freeze & Audit (HOY — MacBook Pro)
**Objetivo**: Confirmar estado exacto antes de picar más código.

**Entregables**:
- [ ] Ejecutar `docker ps` en Mac Mini y documentar contenedores vivos
- [ ] Ejecutar `pm2 list` y documentar procesos
- [ ] Confirmar que tunnel Cloudflare es estable (o migrar a tunnel permanente)
- [ ] Regenear URL Cloudflare y actualizar MCP settings + variable Supabase `N8N_BASE`

**Código de inicio**:
```bash
# En Mac Mini
pm2 list
docker ps
cloudflared tunnel --url http://localhost:5680
```

---

### FASE 1 — Ecosystem Readiness (2-4 horas)
**Objetivo**: Crear la única fuente de verdad del estado del sistema.

**Entregables**:
- [ ] Edge Function `GET /ecosystem-readiness` → verifica ping a Cloudflare tunnel, estado de Supabase, últimos 5 logs
- [ ] Genera y cachea `ecosystem-readiness.latest.json` en Supabase Storage o tabla
- [ ] Expone vía RPC `get_ecosystem_readiness()` al frontend
- [ ] Schema: `{ status: 'connected'|'simulated'|'degraded'|'offline', nodes: [...], last_checked: ISO }`

**Nodo a crear**: `supabase/functions/ecosystem-readiness/index.ts`

---

### FASE 2 — System Readiness Panel (2-3 horas)
**Objetivo**: Hacer visible el estado real del sistema en el dashboard.

**Entregables**:
- [ ] Componente React `<SystemReadinessPanel>` en Control Tower
- [ ] Semáforos: 🟢 `connected`, 🟡 `simulated`, 🟠 `degraded`, 🔴 `offline`, 🔵 `planned`
- [ ] Polling cada 30s a `get_ecosystem_readiness()`
- [ ] Botones críticos (Scrapear, Publicar) se bloquean si status ≠ `connected`

---

### FASE 3 — CloudBot Foundation (1 día)
**Objetivo**: Formalizar CloudBot como director interno del Mac Mini.

**Entregables**:
- [ ] `docs/CLOUDBOT_MASTER_OPERATING_SYSTEM.md` con: identidad, funciones, skills, memoria, parámetros, seguridad
- [ ] CloudBot como workflow de n8n con cron cada 5 minutos que:
  - Lee salud de PM2 (`pm2 jlist`)
  - Lee salud de Docker (`docker ps --format json`)
  - Scribe a Supabase tabla `agent_logs`
  - Si hay proceso caído, activa alertas

---

### FASE 4 — SaaS ↔ Runtime Wiring (1-2 días)
**Objetivo**: Que cada botón del dashboard ejecute algo real.

**Prioridad de verticales**:
1. **Prospector Hub** → n8n workflow de scraping → Google Maps API → DB
2. **Content Lab** → n8n → DeepSeek/Qwen → genera texto → DB
3. **WhatsApp Outreach** → n8n → Meta API → envía mensaje → actualiza DB

---

### FASE 5 — Registries & Governance (1 día)
**Objetivo**: Formalizar los registros maestros para que los agentes sepan qué pueden tocar.

**Registros a crear**:
```
tool_registry          → qué tools existen y quién las puede llamar
workflow_registry      → workflows de n8n registrados con su trigger y scope
agent_registry         → agentes activos, su estado y permisos
credential_scope_registry → qué API Key puede tocar qué sistema
```

---

### FASE 6 — Live Gate (Cuando tú decidas)
**Objetivo**: Pasar de simulado a producción real.

**Checklist**:
- [ ] WhatsApp Cloud API key puesta en n8n credentials
- [ ] Gmail SMTP / Mailgun key puesta en n8n credentials
- [ ] Stripe Live keys en Supabase secrets
- [ ] Google Maps API key en n8n credentials
- [ ] `AGENCY_ENV` cambiado de `sandbox` a `production` en Supabase
- [ ] Tunnel permanente Cloudflare (no temporal) configurado

---

## LOS 20 PRIMEROS MOVIMIENTOS DE CÓDIGO (Secuencia exacta)

1. Regenerar Cloudflare tunnel permanente en Mac Mini
2. Actualizar `N8N_BASE` en Supabase secrets con nueva URL
3. Crear `supabase/functions/ecosystem-readiness/index.ts`
4. Crear tabla/vista `ecosystem_readiness_cache` en Supabase
5. Exponer RPC `get_ecosystem_readiness()` en Supabase
6. Crear componente React `<SystemReadinessPanel />`
7. Añadir panel de semáforos al layout de Control Tower
8. Bloquear botones críticos según `readiness.status`
9. Crear `docs/CLOUDBOT_MASTER_OPERATING_SYSTEM.md`
10. Crear workflow n8n "CloudBot Health Monitor" (cron 5min)
11. Crear tabla `cloudbot_decisions` en Supabase para logs de CloudBot
12. Definir `tool_registry` schema en Supabase
13. Definir `workflow_registry` con los N workflows de n8n ya existentes
14. Conectar workflow "Prospector Hub" de n8n al botón del dashboard
15. Descargar `Qwen2.5-Coder:32B` con Ollama en Mac Mini (`ollama pull qwen2.5-coder:32b`)
16. Configurar credencial Ollama en n8n (`http://host.docker.internal:11434/v1`)
17. Activar `n8n-mcp` en Codex para que pueda construir workflows en remoto
18. Crear primer vertical E2E: click → n8n → LLM → Supabase → dashboard update
19. Smoke test completo del loop con harness sintético
20. Documentar CloudBot incidents log en `missings.md`

---

## NOTAS DE ARQUITECTURA CRÍTICAS

### El principio de la telaraña soberana
El Mac Mini NO es un servidor de apoyo. Es el **núcleo soberano**. Todo fluye desde y hacia él. El MacBook Pro, Vercel y Supabase son extensiones que sirven al núcleo, no al revés.

### CloudBot como sistema nervioso central
CloudBot no es "otro agente más". Es el **director interno** que vigila, decide, activa y bloquea. Ningún agente debe ejecutar acciones de producción sin pasar por el policy layer de CloudBot.

### El contrato de Readiness como única fuente de verdad
Ningún botón del dashboard debe ejecutar nada si antes el sistema no puede responder: `ecosystem_readiness.status === 'connected'`. Este es el gate universal que protege de disparar workflows en vacío.

### LLM Strategy
- **Razonamiento / Agencia**: Qwen2.5-Coder:32B (local, privado, gratis)
- **Velocidad / RAG**: DeepSeek-R1:14B (local, 40+ tokens/s)  
- **Modelos ultra-pesados**: OpenRouter (`hunter-alpha-1t`, etc.) para tareas específicas
- **NUNCA**: No usar OpenAI para inferencia de producción (coste no escala)
