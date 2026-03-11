# OCULOPS — Implementation Plan
> Generated: 2026-03-11 | Branch: audit/2026-02-23
> Covers all outstanding P0–P3 issues. Execute top-to-bottom; each block lists deps.

---

## P0 — Crash Bugs (fix before any other work)

### P0-1: Rules-of-hooks violation in AgentVaultContext

**Root cause**: `useAgentVaultContext()` calls `useAgentVault()` inside a conditional branch — line 22 of `src/contexts/AgentVaultContext.jsx`:
```js
if (!ctx) return useAgentVault() // fallback if provider not mounted  ← illegal
```
React's rules of hooks forbid calling a hook inside a conditional. If `AgentVaultProvider` is not mounted this crashes React's dispatcher.

**Fix**: Replace the conditional hook call with an unconditional hook call at the top of a wrapper, then branch on the result.

**File**: `src/contexts/AgentVaultContext.jsx`

**Strategy**:
- Remove the conditional `return useAgentVault()`.
- Add a `AgentVaultFallback` component (or inline wrapper) that calls `useAgentVault()` unconditionally and passes data down.
- Alternatively: ensure `AgentVaultProvider` is always mounted above every consumer in `App.jsx` and throw a clear error if context is missing.
- Preferred minimum fix: always mount the provider in `App.jsx` (it already exists), and replace the fallback with `throw new Error('AgentVaultProvider not mounted')` so mis-wiring fails loudly.

**Vault agent**: `engineering/debug.md` (rules-of-hooks diagnosis) + `engineering/react-specialist.md` (context pattern)

**Complexity**: S

**Dependencies**: none

---

### P0-2: 17 ESLint errors (unused vars + missing hook deps)

**Files likely affected** (based on hook usage patterns in codebase):
- `src/components/modules/Agents.jsx` — large useCallback/useEffect blocks
- `src/components/modules/Automation.jsx`
- `src/components/modules/Watchtower.jsx`
- `src/hooks/useAgentVault.js`

**Fix strategy**:
1. Run `npm run lint 2>&1 | tee /tmp/eslint-report.txt` to get the exact 17 errors with file+line.
2. For unused vars: remove or prefix with `_` if intentionally unused.
3. For missing `useEffect` / `useCallback` deps: add the missing dep OR wrap the dep in `useRef` if it is a stable callback that should not re-trigger the effect.
4. Do NOT blindly add all warned deps — reason through each one to avoid infinite loops.

**Vault agent**: `engineering/react-specialist.md`

**Complexity**: S

**Dependencies**: none (but fix P0-1 first to avoid masking errors)

---

## P1 — Missing Critical Wiring

### P1-3: Auto-register leads → CRM (lead.captured not wired to contact creation)

**Current state**: The DB trigger `emit_lead_captured_event()` in migration `20260318110000_event_bus_auto_emit_triggers.sql` fires correctly when a contact is inserted with a non-manual source. The `event-dispatcher` edge function routes `lead.captured` to n8n `/speed-to-lead`. But the reverse path — "a lead detected by HUNTER/ATLAS creates a CRM contact" — has no explicit consumer on the Supabase side.

**The gap**: `agent-hunter` writes to `detected_leads` (raw capture), not to `contacts` (CRM). There is no bridge that promotes a `detected_lead` into a `contacts` row automatically.

**Fix**:
1. Create a Postgres trigger on `detected_leads` AFTER INSERT that calls `emit_lead_captured_event()` variant which inserts into `contacts` with `status = 'lead'` and `source = NEW.source`.
2. OR: wire the `event-dispatcher` `lead.captured` handler to call a new `crm-ingest` edge function that upserts into `contacts`.
3. Recommended path (least new code): add a SQL trigger on `detected_leads` that upserts a row in `contacts` when a new lead is inserted.

**Files**:
- New migration: `supabase/migrations/YYYYMMDDHHMMSS_auto_promote_leads_to_contacts.sql`
- Optional: `supabase/functions/event-dispatcher/index.ts` (add handler for `lead.captured` → call contacts upsert)

**Vault agent**: `data/supabase-schema-architect.md`

**Complexity**: S

**Dependencies**: P0 bugs resolved (stable build)

---

### P1-4: Pipeline stage triggers (deal.stage_changed not triggering follow-up)

**Current state**: `event-dispatcher` has `deal.stage_changed` routed to n8n `/deal-stage-changed`. The n8n webhook path exists in the route map. But:
1. There is no DB trigger that emits `deal.stage_changed` when a deal's `stage` column changes.
2. The `useDeals` hook calls `update()` on deals directly — no event is emitted client-side either.

**Fix**:
1. Add Postgres trigger on `deals` AFTER UPDATE OF `stage` that inserts into `event_log` with `event_type = 'deal.stage_changed'` and payload `{deal_id, contact_id, old_stage, new_stage, value}`.
2. Verify n8n has an active workflow listening at `/deal-stage-changed` (currently it may be a stub).

**Files**:
- New migration: `supabase/migrations/YYYYMMDDHHMMSS_deal_stage_change_trigger.sql`
- `n8n/` — ensure deal-stage-changed workflow is activated

**Vault agent**: `data/supabase-schema-architect.md`

**Complexity**: S

**Dependencies**: P1-3 (same migration pattern — batch them in one migration file)

---

### P1-5: RESEND_API_KEY not set → welcome email broken

**Current state**: `supabase/functions/welcome-email/index.ts` and `supabase/functions/send-email/index.ts` both read `RESEND_API_KEY` from env. The key is missing from Supabase secrets (confirmed: not in the secrets inventory in CLAUDE.md).

**Fix**:
1. Create a Resend account at resend.com → get API key → verify sending domain `oculops.com`.
2. Set the secret: `supabase secrets set RESEND_API_KEY=re_xxxx FROM_EMAIL="OCULOPS <noreply@oculops.com>"`
3. Set in Vercel if any server action calls send-email directly: `vercel env add RESEND_API_KEY production`
4. Test: `curl -X POST https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/welcome-email -H "Authorization: Bearer <anon_key>" -d '{"email":"test@test.com","name":"Test"}'`

**Files**: No code changes needed — purely secret configuration.

**Vault agent**: none needed (ops task, not code)

**Complexity**: S

**Dependencies**: none

---

## P2 — Low-Coverage Layers

### P2-6: Outreach layer (20% coverage)

**Current gaps**:
- `agent-outreach` edge function exists but drip sequence logic is minimal
- No drip sequence scheduler in the DB (no `outreach_sequences` table or `outreach_queue` populated)
- Inbox parsing (`gmail-inbound`) exists as an edge function but is not connected to contact status updates

**Files to modify / create**:
- `supabase/functions/agent-outreach/index.ts` — add drip step executor
- New migration: `outreach_sequences` table + `outreach_queue` table + cron trigger for `outreach.step_due` events
- `supabase/functions/gmail-inbound/index.ts` — wire reply detection → update `contacts.status` to `responded`
- `src/components/modules/` — `Outreach.jsx` or extend `Automation.jsx` with drip sequence UI

**Approach** (minimum viable):
1. Migration: `outreach_sequences(id, org_id, name, steps jsonb[])` + `outreach_queue(id, contact_id, sequence_id, step_index, scheduled_at, status)`.
2. Cron edge function (or pg_cron) that reads due queue items → emits `outreach.step_due` events.
3. `event-dispatcher` already routes `outreach.step_due` → n8n `/drip-outreach-step`. Wire n8n to call `send-email`.
4. `gmail-inbound` webhook: on reply detected, UPDATE contacts SET status = 'responded' WHERE email = sender.

**Vault agents**: `content/email-marketing-specialist.md` + `data/supabase-schema-architect.md`

**Complexity**: L

**Dependencies**: P1-5 (RESEND_API_KEY must be set first), P1-4 (event bus triggers pattern)

---

### P2-7: Creative layer (15% coverage)

**Current gaps**:
- `agent-forge` generates content but there is no `social_posts` table or publishing pipeline
- No content templates stored in DB
- `CreativeStudio.jsx` exists as a module but has no backend wiring

**Files to modify / create**:
- New migration: `content_templates(id, org_id, type, name, body_template, variables jsonb)` + `social_posts(id, org_id, template_id, platform, content, status, scheduled_at, published_at)`
- `supabase/functions/agent-forge/index.ts` — add `publish_post` action that writes to `social_posts`
- `src/components/modules/CreativeStudio.jsx` — connect to `social_posts` via new `useSocialPosts` hook
- `src/hooks/useSocialPosts.js` — new hook (CRUD + realtime on `social_posts`)

**Vault agent**: `content/social-media-copywriter.md`

**Complexity**: M

**Dependencies**: P0 bugs resolved

---

### P2-8: Analytics (30% coverage)

**Current state**: `Analytics.jsx` exists as a shell. `ControlTower.jsx` has live KPIs but they are count-only (no trends, no funnel conversion, no revenue metrics). `ORACLE` agent is active but its output is not plumbed into an analytics surface.

**Files to modify**:
- `src/components/modules/Analytics.jsx` — implement with real data from hooks
- `src/hooks/useAnalytics.js` (new) — aggregation queries against `contacts`, `deals`, `crm_activities`, `agent_logs`, `event_log`
- Supabase: create a `analytics_snapshots` table (populated by `daily-snapshot` edge function, which already exists) — verify `daily-snapshot` is writing data and add if missing

**Key KPIs to connect**:
- Lead → Contact conversion rate (detected_leads vs contacts count, last 30d)
- Pipeline velocity (average days per stage from crm_activities)
- Email open/click (once Resend is live, pull from Resend webhooks)
- Agent activity (agent_logs count by agent, 7d rolling)
- Revenue forecast (weighted pipeline value from deals hook — already computed in `useDeals`)

**Vault agent**: `data/supabase-schema-architect.md` + `data/analytics-engineer.md` (if available, else `data/postgres-pro.md`)

**Complexity**: M

**Dependencies**: P1-3 (lead data), P1-4 (deal data flowing)

---

## P3 — SaaS Readiness

### P3-9: Stripe billing integration

**Current state**: `stripe-checkout` and `stripe-webhook` edge functions exist and are well-structured. Missing:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE` not set in Supabase secrets
- No `subscriptions` table in DB (stripe-webhook tries to UPDATE `organizations` directly — fragile)
- `Billing.jsx` is a placeholder

**Fix**:
1. Stripe Dashboard: create 3 products (Starter $99/mo, Pro $299/mo, Enterprise custom) → get price IDs.
2. Set secrets: `supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx STRIPE_PRICE_STARTER=price_xxx STRIPE_PRICE_PRO=price_xxx`
3. New migration: `subscriptions(id, org_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)` — decouple from `organizations`.
4. Update `stripe-webhook/index.ts` to write to `subscriptions` table.
5. Wire `Billing.jsx` to a `useSubscription` hook that reads from `subscriptions`.
6. Add Stripe webhook URL to Stripe Dashboard: `https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/stripe-webhook`

**Files**:
- New migration: `YYYYMMDDHHMMSS_subscriptions_table.sql`
- `supabase/functions/stripe-webhook/index.ts` — update org_id logic
- `src/components/modules/Billing.jsx` — implement
- `src/hooks/useSubscription.js` — new hook

**Vault agent**: `engineering/fintech-engineer.md`

**Complexity**: M

**Dependencies**: P0 resolved, Stripe account with live keys

---

### P3-10: CI/CD GitHub Actions

**Current gaps**: no `.github/workflows/` directory exists. Deploys are manual (`vercel --prod`, `supabase functions deploy`).

**Minimal pipeline needed**:
1. `ci.yml` — on every PR to `main`: `npm ci` → `npm run build` → `npm run lint` → `npm test`
2. `deploy-vercel.yml` — on push to `main`: deploy to Vercel production via `vercel --prod`
3. `deploy-supabase.yml` — on push to `main` when `supabase/functions/**` changes: deploy changed edge functions

**Files to create**:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml` (combine Vercel + Supabase deploys, triggered after CI passes)

**Required GitHub secrets**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`

**Vault agent**: `infra/github-actions-expert.md`

**Complexity**: S

**Dependencies**: P0 resolved (lint must pass for CI to be green on day 1)

---

### P3-11: Sentry error tracking

**Current gaps**: PostHog is configured (`POSTHOG_API_KEY` set) for product analytics, but there is no error boundary or exception tracking.

**Fix**:
1. `npm install @sentry/react @sentry/vite-plugin`
2. Init in `src/main.jsx`: `Sentry.init({ dsn, environment, integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()] })`
3. Wrap `<App />` with `<Sentry.ErrorBoundary fallback={<ErrorFallback />}>` in `main.jsx`
4. Add `VITE_SENTRY_DSN` to `.env`, Vercel env, and `vite.config.js` sentryVitePlugin for source maps
5. For edge functions: add `Sentry.captureException(e)` in the catch blocks of critical functions (`agent-cortex`, `event-dispatcher`, `stripe-webhook`)

**Files**:
- `src/main.jsx` — Sentry init + ErrorBoundary
- `vite.config.js` — sentryVitePlugin
- `supabase/functions/agent-cortex/index.ts` — Sentry DSN via `SENTRY_DSN` secret
- `.env` — add `VITE_SENTRY_DSN`

**Vault agent**: `infra/monitoring-specialist.md`

**Complexity**: S

**Dependencies**: P0 resolved (source maps only useful once build is clean)

---

## Execution Order

```
P0-1  →  P0-2  →  P1-5 (ops)  →  P1-3 + P1-4 (one migration)
  →  P3-10 (CI — so CI validates everything from here on)
  →  P2-8  →  P2-7  →  P2-6
  →  P3-9  →  P3-11
```

**Rationale**:
- P0 first: hooks violation can crash the app tree in production. ESLint errors block clean CI.
- P1-5 is a pure secrets ops task — do it in 5 minutes while P0 PRs are in review.
- P1-3 + P1-4 share the same migration pattern — batch in one PR.
- CI/CD (P3-10) goes in early so all subsequent work has automated validation.
- P2 layers (outreach, creative, analytics) are independent of each other after CI is green.
- Stripe (P3-9) requires external account setup — schedule for a dedicated session.
- Sentry (P3-11) last, once builds are clean and source maps are stable.

---

## Agent Activation Map

| Issue | Vault Agent to Load | Namespace |
|-------|--------------------|-----------|
| P0-1 hooks violation | `react-specialist` | engineering |
| P0-2 ESLint | `react-specialist` | engineering |
| P1-3 lead→CRM trigger | `supabase-schema-architect` | data |
| P1-4 deal stage trigger | `supabase-schema-architect` | data |
| P2-6 outreach schema | `supabase-schema-architect` + `email-marketing-specialist` (if available) | data + content |
| P2-7 creative layer | `social-media-copywriter` | content |
| P2-8 analytics | `postgres-pro` | data |
| P3-9 Stripe | `fintech-engineer` | engineering |
| P3-10 CI/CD | `github-actions-expert` | infra |
| P3-11 Sentry | `monitoring-specialist` | infra |

Load at most 2 agents per session. Suggested pairings:
- Session A: `react-specialist` (P0-1 + P0-2)
- Session B: `supabase-schema-architect` (P1-3 + P1-4 + migration batch)
- Session C: `github-actions-expert` (P3-10)
- Session D: `supabase-schema-architect` + `social-media-copywriter` (P2-6 + P2-7)
- Session E: `fintech-engineer` (P3-9)
- Session F: `monitoring-specialist` (P3-11)
```
