# n8n Workflows — OCULOPS OS Agent Network

## 🚀 Complete Workflow Library — 17 Templates

All workflows are pre-configured with your Supabase endpoints and OpenAI API key. Just import and activate.

## 🧩 Full n8n Template Catalog (8k+)

OCULOPS now supports syncing the full public n8n workflow catalog into the app for search, skills/action tagging, and install-ready selection.

```bash
npm run sync:n8n-templates
npm run audit:n8n-workflows
npm run reconcile:n8n-oculops -- --apply --recent-hours 72
```

This writes:

- `src/data/n8nTemplateCatalog.seed.json`
- `public/n8n-template-catalog/index.json`
- `public/n8n-template-catalog/shards/*.json`

To install one or more templates into your n8n instance:

```bash
# dry run
npm run n8n:install-template -- --id 6902

# install into n8n
npm run n8n:install-template -- --id 6902 --apply

# install top install-ready templates from seed
npm run n8n:install-template -- --all-install-ready --top 20 --apply
```

### Quick Setup

1. Open n8n → **Workflows** → **Import from File**
2. Import each `.json` file
3. **Activate** the workflow

---

## 🧠 CORTEX Agent Workflows (5)

| File | Schedule | Agents | Description |
| ---- | ---- | ---- | ---- |
| `cortex-orchestration.json` | Daily 8AM | CORTEX → SENTINEL + SCRIBE | Hourly orchestration cycle |
| `atlas-hunter-pipeline.json` | Daily 8AM | ATLAS → HUNTER | Market scan + lead qualification |
| `oracle-scribe-daily.json` | Daily 8AM | ORACLE → SCRIBE | Deep analytics + daily report |
| `forge-content-webhook.json` | Webhook | FORGE | On-demand content generation |
| `strategist-webhook.json` | Webhook | STRATEGIST | On-demand decision evaluation |

## 🔄 Master Orchestration (1)

| File | Schedule | Agents | Description |
| ---- | ---- | ---- | ---- |
| `master-full-cycle.json` | Daily 8AM | ALL 7 agents | ATLAS→HUNTER→ORACLE→SENTINEL+FORGE→SCRIBE→CORTEX |

## 🎯 Lead Generation & CRM (4)

| File | Schedule | Description |
| ---- | ---- | ---- |
| `speed-to-lead.json` | Webhook | Instant lead capture → CRM → HUNTER qualify → alert |
| `maps-lead-prospector.json` | Daily 8AM | GPT generates B2B prospect lists for Murcia |
| `chatbot-lead-qualifier.json` | Webhook | AI chatbot that qualifies visitors and logs conversations |
| `crm-deal-nurture.json` | Daily 8AM | Finds stale deals → GPT suggests nurture actions |

## 📱 Marketing & Content (3)

| File | Schedule | Description |
| ---- | ---- | ---- |
| `social-content-factory.json` | Daily 8AM | Generates LinkedIn, Instagram, Twitter, TikTok content |
| `email-outreach-weekly.json` | Daily 8AM | Generates personalized cold outreach emails via FORGE |
| `ad-campaign-optimizer.json` | Daily 8AM | Analyzes campaigns, suggests budget optimizations |

## 📊 Intelligence & Reporting (3)

| File | Schedule | Description |
| ---- | ---- | ---- |
| `competitor-monitor.json` | Daily 8AM | GPT competitive analysis → signals + knowledge base |
| `weekly-business-report.json` | Daily 8AM | Executive weekly report with KPIs and forecasts |
| `niche-discovery.json` | Daily 8AM | Discovers and scores new market niches |

## 💰 Pipeline & Monitoring (1)

| File | Schedule | Description |
| ---- | ---- | ---- |
| `pipeline-health-alerts.json` | Daily 8AM | Pipeline health check via SENTINEL |

---

## Webhook Endpoints (after activation)

```text
POST /webhook/new-lead           → Speed-to-Lead
POST /webhook/chatbot-message    → AI Chatbot
POST /webhook/forge-content      → FORGE Content
POST /webhook/strategist-evaluate → STRATEGIST Decisions
```

## Direct Agent Endpoints

```text
POST https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/agent-{name}
Header: Authorization: Bearer <anon-key>
Body: { "action": "cycle" }

Available: cortex, atlas, hunter, oracle, sentinel, forge, strategist, scribe
```
