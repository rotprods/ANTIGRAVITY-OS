# OCULOPS — Missings (pendientes no bloqueantes)

## Sentry — Error Tracking
- [ ] Crear proyecto en [sentry.io](https://sentry.io) → obtener DSN
- [ ] `VITE_SENTRY_DSN=https://...@sentry.io/...` en `.env` y Vercel env vars
- [ ] `VITE_APP_VERSION=10.0.0` en `.env` y Vercel env vars
- [ ] Verificar en prod: provocar error JS → confirmar que aparece en Sentry dashboard
- El código ya está listo: `src/lib/sentry.js` + `SentryErrorBoundary` en `App.jsx`

## Stripe — Billing
- [ ] Crear productos y precios en Stripe Dashboard
- [ ] `STRIPE_SECRET_KEY=sk_live_...` en Supabase secrets + Vercel
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` en Supabase secrets + Vercel
- [ ] `STRIPE_PRICE_STARTER=price_...` en Supabase secrets
- [ ] `STRIPE_PRICE_PRO=price_...` en Supabase secrets
- [ ] `STRIPE_PRICE_ENTERPRISE=price_...` en Supabase secrets
- [ ] Registrar webhook en Stripe Dashboard → endpoint: `https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/stripe-webhook`
- [ ] Redeploy `stripe-webhook` + `stripe-checkout` edge functions con los secrets nuevos
- El código ya está listo: firma HMAC verificada, `onboarding` tiene plan CTAs, `Billing.jsx` lee `currentOrg.plan`

## Playwright E2E — Auth real
- [ ] Crear usuario de test en Supabase Dashboard (email/password, org ya creada)
- [ ] Añadir `PLAYWRIGHT_TEST_EMAIL` como GitHub secret
- [ ] Añadir `PLAYWRIGHT_TEST_PASSWORD` como GitHub secret
- [ ] Verificar que `npm run test:e2e` pasa los nuevos tests autenticados (`dashboard.spec.js`)
- El código ya está listo: `auth.setup.js`, `dashboard.spec.js`, `playwright.config.js` con proyecto `authenticated`

## Email
- [ ] `RESEND_API_KEY` — configurar en Supabase secrets (`npx supabase secrets set RESEND_API_KEY=re_xxx --linked`)
- [ ] Verificar dominio `oculops.com` en Resend (o usar sandbox para testing)
- [ ] Welcome email trigger (`trigger_welcome_email`) ya está en DB, solo falta la API key para que funcione
- [ ] `FROM_EMAIL` env opcional — default: `OCULOPS <noreply@oculops.com>`
