# ANTIGRAVITY OS — Agency Context

> This file is read by AI agents (Antigravity + Claude Code) to understand the business.
> **Roberto**: Fill in the placeholders below with your real data.

## Agency Profile

- **Name**: [Tu nombre de agencia — ej: Antigravity Agency]
- **Founder**: Roberto Ortega
- **Location**: España
- **Founded**: 2024
- **Stage**: Pre-revenue → 0-20k€/mes
- **Mission**: Automatizar procesos empresariales con IA para PYMEs españolas y europeas

## Services Offered

1. **Automatización de procesos con IA**
   - Chatbots inteligentes (WhatsApp, web, Instagram)
   - Automatización de flujos de trabajo (n8n, Make)
   - Email marketing automatizado
   - Precio: [2000-5000€/mes]

2. **Sistemas de captación de leads**
   - Funnels automatizados
   - Landing pages con IA
   - Cualificación automática de leads
   - Precio: [1500-3500€/mes]

3. **Consultoría de IA aplicada**
   - Auditoría de procesos
   - Diseño de arquitectura de automatización
   - Formación de equipos
   - Precio: [por proyecto]

## ICP (Ideal Customer Profile)

- **Tamaño**: 10-200 empleados
- **Facturación**: 500k€ - 10M€/año
- **Sectores target**: E-commerce, Clínicas/Salud, Inmobiliarias, SaaS B2B
- **Decision Maker**: CEO, COO, Head of Marketing
- **Pain Points**: Procesos manuales, falta de automatización, costes de personal
- **Señales de compra**: Contratando, funding reciente, crecimiento rápido

## Tech Stack

- **Frontend**: React + Vite + Electron
- **Backend**: Supabase (PostgreSQL + Realtime + Edge Functions)
- **AI/ML**: OpenAI, Anthropic, Local LLMs (Ollama)
- **Automation**: n8n, Make
- **Messaging**: WhatsApp Cloud API, ManyChat
- **Analytics**: Google Analytics, Meta Pixel

## Marketing Studies (Historical Data Sources)
>
> Add references to existing marketing studies here:

- [ ] FOODBAB Smash Burger data collection
- [ ] Código Bushido YouTube analytics
- [ ] De Cuadros V2/V3 projects
- [ ] [Add more here...]

## Competitors

1. [Competidor 1 — nombre, URL, qué ofrecen]
2. [Competidor 2]
3. [Competidor 3]

## Case Studies
>
> Fill in as you close deals:

- [ ] [Cliente 1]: [Problema → Solución → Resultado]

## LLM Handoff Summary (GPT-5.4)

- **Current status**: Codex verified AGENTS.md, ANTIGRAVITY_OS master snapshot, `codex.md`, and `CURRENT_TRUTH.md` (2026-03-10) and confirms the React/Vite migration plus Supabase-backed automation surfaces are live.
- **Outstanding blockers**: Supabase CLI re-auth, blocked deploys for `ai-advisor`, `messaging-dispatch`, `api-proxy`, missing `ALPHA_VANTAGE_KEY`, scheduler gaps for `market-data`/`social-signals`, and unstable Reddit ingestion.
- **Integrations in flight**: Electron entrypoints (`electron/*.cjs`), Supabase Edge Functions holding provider secrets, and n8n agents coordinating automation dashboards with live data pushes.
- **Next actions for new LLMs**: Connect dashboards to real-time data feeds, verify n8n agents are routing through Supabase, keep secrets strictly in `.env` files, and refresh this doc once deployments pass.
- **Reference note**: Treat this section as the latest general-doc summary for GPT-5.4 and the follow-on LLM; maintain the list before expanding features.
