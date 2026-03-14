# Prompt de Cutover Final (Mac Mini)

Usa este prompt tal cual en una sesión nueva de Codex/Claude ejecutándose **en el Mac Mini** (donde sí corre n8n local).

---

Eres mi agente de release para OCULOPS. Quiero cerrar producción de forma completa, sin dejar tareas a medias.

## Contexto obligatorio
- Repositorio: `/Users/robertoortega/Documents/AI OPS/ANTIGRAVITY-OS`
- Rama: `main`
- n8n corre en este Mac Mini
- Objetivo: dejar GitHub + Supabase + Vercel + Web + n8n reconciliados y operativos

## Reglas de ejecución
1. No pidas confirmaciones intermedias; ejecuta end-to-end.
2. Si falla algo, aplica fix y reintenta.
3. Al final, deja `git status` limpio y todo pusheado.
4. No expongas secretos en salida.
5. Si hay claves inválidas, indícalo con nombre de variable exacta y continúa con lo demás.

## Variables que debes validar al inicio
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_API_URL`
- `N8N_API_KEY`
- `GRAPHHOPPER_API_KEY`
- `AEMET_API_KEY`
- `THE_GUARDIAN_API_KEY` (o `GUARDIAN_API_KEY`)
- `FRED_API_KEY`

## Ejecución obligatoria (orden exacto)
1. Validación base
```bash
cd "/Users/robertoortega/Documents/AI OPS/ANTIGRAVITY-OS"
git pull --rebase origin main
npm run test -- src/test/publicApiEcosystem.test.js src/test/publicApiInfrastructure.test.js src/test/publicApiCatalog.test.js src/test/useApiCatalog.test.js src/test/publicApiN8nInjection.test.js src/test/n8nApiConfig.test.js src/test/cloudflareTunnel.test.js
npx eslint scripts src/test
npm run build
```

2. Supabase (DB + Functions)
```bash
supabase db push
supabase functions deploy api-proxy
```

3. Sync de catálogos y capas
```bash
npm run sync:public-apis
npm run build:public-api-ecosystem-layer
npm run build:project-apis
npm run sync:n8n-templates
```

4. Conectores públicos (deben quedar live si hay keys)
```bash
npm run public-apis:bootstrap -- --apply --healthcheck --strict
```

5. n8n + automatizaciones
```bash
npm run audit:n8n-workflows -- --recent-hours 72
npm run inject:n8n-api-context -- --apply
npm run reconcile:n8n-oculops -- --apply --recent-hours 72
```

6. Readiness y deploy web
```bash
npm run readiness:generate
npm run readiness:check:production
npx vercel deploy --prod --yes
```

7. Cierre git
```bash
git add -A
git commit -m "chore: final mac production cutover sync" || true
git push origin main
git status --short
```

## Criterios de éxito (debes reportarlos)
- `sync:public-apis` completo y sin errores de DB.
- `public-apis:bootstrap --strict` sin `missing_keys`.
- `reconcile:n8n-oculops` sin `Invalid API key`.
- `readiness:check:production` en verde o con warnings explícitos no bloqueantes.
- Deploy de Vercel en producción con alias activo.
- `git status` limpio.

## Formato de salida final
Entrega:
1. Resumen ejecutivo (5-10 líneas).
2. Tabla “Componente / Estado / Evidencia”.
3. Lista de bloqueos residuales (si existen) con comando exacto para resolver.
4. Hash commit final en `main`.

---

Si detectas que `N8N_API_URL` apunta a un túnel caído, corrige la URL antes de ejecutar reconciliación y deja evidencia del endpoint activo.
