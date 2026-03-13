# Guía de Integración: N8N AIRDROP + OCULOPS

Actualizado: 2026-03-13

## 1) Qué se instaló e integró

Se integró el paquete N8N AIRDROP en dos capas de OCULOPS:

- `Marketplace`: panel de inteligencia con skills, categorías y combos.
- `CommandCenter`: monitoreo del core stack (`n8n`, `Agent Zero`, `ComfyUI`) con health checks.

También se conectaron URLs reales por entorno y se desplegó en Vercel.

Paquete origen analizado:

- `~/Downloads/N8N_AIRDROP_PACK/`
- Docs revisadas del pack: `00_AGENT_READINESS_MAP.md`, `01_MASTER_SKILL_REGISTRY.md`, `02_N8N_REPOS_INTEL.md`, `n8n-skills/README.md`.

## 2) Archivos clave y qué hace cada uno

- `src/data/n8nAirdropIntel.js`
  - Fuente única de verdad para:
  - Métricas del airdrop (`7 packs`, `4343 JSON`, `2061 workflows únicos`, `1234 skills`).
  - Packs expertos (`@n8n-code-javascript`, `@n8n-code-python`, etc.).
  - Categorías top de workflows.
  - Combos sugeridos por tipo de tarea.
  - Definición de servicios AI stack y endpoints de health.

- `src/components/modules/Marketplace.jsx`
  - Añade panel `N8N AIRDROP INTEL`.
  - Muestra stats, packs, categorías y combos.
  - Incluye copy-to-clipboard para invocación rápida (`Use @skill to`).

- `src/components/modules/CommandCenter.jsx`
  - Añade tab `CORE STACK`.
  - Hace polling de health checks para `n8n`, `Agent Zero`, `ComfyUI`.
  - Muestra contador online/offline y estado HTTP por servicio.

- `.env` y `.env.example`
  - Variables frontend del stack:
  - `VITE_N8N_BASE_URL`
  - `VITE_AGENT_ZERO_BASE_URL`
  - `VITE_COMFYUI_BASE_URL`

- `~/Downloads/N8N_AIRDROP_PACK/n8n-workflows/ai-stack/`
  - Stack Docker para levantar localmente:
  - `n8n` en `http://localhost:5678`
  - `Agent Zero` en `http://localhost:50080`
  - `ComfyUI` en `http://localhost:8188`
  - Arranque rápido en Mac: `./start.sh`
  - Stop: `./start.sh --stop`

## 3) Variables y entornos conectados

Configurado en local y en Vercel (`Production` y `Preview`):

- `VITE_N8N_BASE_URL=https://rotprods.app.n8n.cloud`
- `VITE_AGENT_ZERO_BASE_URL=http://localhost:50080`
- `VITE_COMFYUI_BASE_URL=http://localhost:8188`

Nota:
- Variables `VITE_*` son públicas en frontend (visible desde navegador).
- `localhost` solo responde en la máquina del usuario que abre la app.

## 4) Cómo se compenetra dentro del sistema

Flujo funcional:

1. `Marketplace` te dice qué skill usar y qué combo conviene para la tarea.
2. Esa estrategia aterriza en automatizaciones/workflows (n8n + skills del airdrop).
3. `CommandCenter` valida en tiempo real que el core stack esté vivo.
4. Si un servicio cae, se ve inmediatamente en estado `OFFLINE` + código HTTP.

Beneficio directo:

- Menos tiempo para decidir "cómo empezar" un flujo.
- Más confiabilidad operativa al tener health checks visibles.
- Mayor velocidad para montar pipelines IA (agente + automatización + generación visual).

## 5) Cómo invocar skills y combos (patrón práctico)

Patrón de invocación:

- `Use @n8n-workflow-patterns to build a webhook automation for lead capture`
- `Use @n8n-mcp-tools-expert to validate and deploy this workflow`
- `Use @n8n-code-javascript to normalize incoming payload data`

Combos recomendados:

1. Build n8n workflow:
   - `@n8n-workflow-patterns` + `@n8n-mcp-tools-expert` + `@n8n-code-javascript`
2. Build Telegram bot:
   - `@telegram-bot-builder` + `@n8n-workflow-patterns` + `@n8n-expression-syntax`
3. AI agent system:
   - `@agent-orchestrator` + `@rag-engineer` + `@llm-ops` + `@langfuse`
4. Image generator:
   - `@comfyui-gateway` + `@fal-generate` + `@n8n-workflow-patterns`

## 6) Operación recomendada diaria

1. Arrancar servicios locales si se usan:
   - Docker para `Agent Zero`/`ComfyUI` en local.
2. Abrir OCULOPS y revisar `CommandCenter > CORE STACK`.
3. Confirmar `ONLINE` en servicios críticos.
4. Diseñar flujo desde `Marketplace > N8N AIRDROP INTEL`.
5. Ejecutar y validar logs/eventos en CommandCenter.

## 7) Estado de despliegue

- Deploy productivo completado en Vercel.
- URL de producción activa: `https://oculops.com`
