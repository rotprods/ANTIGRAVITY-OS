# OCULOPS Stabilization Run

Updated: 2026-03-12

## Now

- Current source of truth for missing config is `missing/central-secrets.md` + `missing/go-live-checklist.md`.
- Primary live repair is n8n, not greenfield feature work.
- Supabase migration drift must be reconciled before any blanket repair command is run.

## In Progress

- Commit and push the stabilization batch without mixing unrelated concurrent edits.
- Push the current migration state to remote Supabase.
- Trigger/verify production deploy on Vercel for `www.oculops.com`.

## Fixed / Verified In This Run

- `ARCHITECT OS - Auto Handoff` live webhook was failing on invalid JSON in the response node.
- That workflow has been patched live and re-smoked so the webhook returns `200` again.
- `Speed-to-Lead` live workflow had broken Supabase auth and now returns `200` again.
- `STRATEGIST` live webhook had broken Supabase auth and now returns `200` again.
- Live n8n workflows with stale Supabase placeholders / hardcoded JWTs were normalized through the n8n API.
- Local `n8n/*.json` templates were mirrored to match the repaired live state.
- `missing/` confirms these are no longer current blockers: `ALPHA_VANTAGE_KEY`, `GOOGLE_MAPS_API_KEY`, Gmail OAuth, `N8N_WEBHOOK_URL`, core Supabase runtime group.

## Still Open

- Supabase local/remote migration history still needs reconciliation.
- Production deploy / alias verification still needs final confirmation on Vercel.

## External Blockers

- `APIFY_TOKEN` is still required if Reddit ingestion must be reliable from Supabase runtime.
- `TELEGRAM_CHAT_ID` is still required for default Herald/report delivery.
- Meta / WhatsApp / TikTok / ManyChat remain intentionally deferred.

## Next Verification

- Confirm recent n8n error queue contains no new auth failures for the repaired workflows.
- Run `supabase db push`.
- Push Git commit to `main`.
- Verify the production deployment bound to `www.oculops.com`.
