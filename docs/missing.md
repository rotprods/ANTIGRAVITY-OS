# OCULOPS — Missing / Pending Items
> Updated: 2026-03-10

---

## ENV VARS NEEDED (not set yet)

### Stripe (blocks billing)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```
Action: Create products in Stripe Dashboard, copy price IDs, set in Supabase secrets + Vercel env.

### Sentry (blocks error tracking)
```
VITE_SENTRY_DSN=https://...@sentry.io/...
```
Action: Create Sentry project, copy DSN, add to .env + Vercel env.
Also run: `npm install @sentry/react`

### Channel APIs (blocks messaging module)
```
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
TIKTOK_API_KEY=
TIKTOK_API_SECRET=
MANYCHAT_API_KEY=
TELEGRAM_CHAT_ID=
TELEGRAM_THREAD_ID=
```

### GitHub Actions (blocks CI/CD)
```
SUPABASE_ACCESS_TOKEN (in GitHub repo secrets)
```

---

## NPM PACKAGES TO INSTALL

~~`npm install @sentry/react`~~ — DONE (installed)

---

## MIGRATIONS TO PUSH

```bash
npx supabase db push --linked
```
Pending migrations:
- `20260310150000_knowledge_pgvector.sql` — pgvector + embeddings
- `20260310160000_multi_tenancy.sql` — org_id on 28 tables + RLS

---

## EDGE FUNCTIONS TO DEPLOY

```bash
supabase functions deploy knowledge-embed
supabase functions deploy stripe-webhook
supabase functions deploy stripe-checkout
```

---

## CODE PENDING

### ~~Sentry wiring~~ — DONE
- ~~Call `initSentry()` in `src/main.jsx` before `createRoot()`~~
- ~~Wrap app with `<SentryErrorBoundary>` in App.jsx~~

### n8n webhooks (Phase 3.2)
- Create/activate webhook endpoints in n8n instance for EVENT_ROUTES paths:
  - `/agent-completed`, `/agent-error`, `/speed-to-lead`
  - `/deal-stage-changed`, `/deal-closed-won`
  - `/forge-content-webhook`, `/strategist-webhook`, `/signal-detected`

### Shell modules to flesh out
- ~~Automation.jsx~~ — DONE (vault agent arsenal + workflow builder)
- ~~Execution.jsx~~ — DONE (vault agents integrated)
- ~~Experiments.jsx~~ — DONE (vault agents integrated)
- ~~Opportunities.jsx~~ — DONE (vault agents integrated)
- ~~Decisions.jsx~~ — DONE (vault agents integrated)
- ~~Niches.jsx~~ — DONE (vault agents integrated)
- ~~Portfolio.jsx~~ — DONE (vault agents integrated)
- ~~Simulation.jsx~~ — DONE (vault agents integrated)

### ~~Tests (Phase 5.4)~~ — DONE (foundation)
- ~~vitest config + setup~~
- 3 test files: useAppStore (12 tests), usePipelineStore (6 tests), components (2 tests)
- 20/20 passing in 1.13s
- TODO: expand coverage (hooks with Supabase mocks, more component tests)

---

## INFRA PENDING

### Vercel
- Rename project URL from antigravity-os-theta to oculops
- Set new Stripe env vars when ready

### Supabase
- Clean stray secret: `supabase secrets unset FEPGQ5TC1RSITP`
- Push 2 pending migrations
- Deploy 3 new edge functions

### n8n
- API key expires 2026-04-07 — regenerate before
- Create webhook endpoints for event dispatcher routes

### Security sweep (LAST before public)
- Set `VITE_DEV_MODE=false` in production
- Verify RLS policies after multi-tenancy migration
- Rate limiting on public endpoints
- Input validation audit
- Remove console.logs from production build

---

## NICE TO HAVE (not blocking)

- @tanstack/virtual for list virtualization (large contact/agent lists)
- pgvector IVFFlat → HNSW index upgrade when > 10k knowledge entries
- Workflow builder UI in Automation module
- PDF invoice generation in Billing
- Email templates for onboarding flow
- Dark/light theme toggle (currently OLED-only)

## SESSION 2026-03-10 (current)

- [ ] Redeploy the frontend to Vercel once DNS to `api.vercel.com` is reachable (both project and team lookups fail with ENOTFOUND).  
- [ ] Supply `APIFY_TOKEN` or valid Reddit credentials so `social-signals` can complete live ingestion without blocking on external `403` responses.  
- [ ] Provide `TELEGRAM_CHAT_ID` (and optional thread) for Herald/Scribe report delivery to avoid manual routing.  
- [ ] Map the refreshed API catalog (access/theme/open-only groupings) into the automation/n8n flows so the agents can leverage the new filters.
