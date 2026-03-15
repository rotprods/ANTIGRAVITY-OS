#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

USE_N8N_BRIDGE=0
SKIP_VERCEL=0
RECENT_HOURS=72

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-n8n-bridge)
      USE_N8N_BRIDGE=1
      shift
      ;;
    --skip-vercel)
      SKIP_VERCEL=1
      shift
      ;;
    --recent-hours)
      RECENT_HOURS="${2:-72}"
      shift 2
      ;;
    *)
      echo "[cutover] unknown argument: $1"
      exit 1
      ;;
  esac
done

log() {
  printf '[cutover] %s\n' "$*"
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[cutover] missing required environment variable: ${name}" >&2
    exit 1
  fi
}

load_env_file() {
  if [[ -f ".env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
  fi
}

resolve_readiness_org() {
  if [[ -n "${READINESS_ORG_ID:-}" ]]; then
    echo "${READINESS_ORG_ID}"
    return 0
  fi

  node <<'NODE'
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const endpoint = `${url.replace(/\/+$/,'')}/rest/v1/organizations?select=id&order=created_at.asc&limit=1`;
fetch(endpoint, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
})
  .then(async (res) => {
    if (!res.ok) process.exit(1);
    const rows = await res.json();
    const id = Array.isArray(rows) ? rows[0]?.id : null;
    if (!id) process.exit(1);
    process.stdout.write(String(id));
  })
  .catch(() => process.exit(1));
NODE
}

log "loading .env"
load_env_file

if [[ "$USE_N8N_BRIDGE" -eq 1 ]]; then
  log "opening Cloudflare bridge for n8n and writing N8N_API_URL/N8N_WEBHOOK_URL into .env"
  npm run n8n:bridge:cloudflare -- --write-env
  load_env_file
fi

require_var "SUPABASE_URL"
require_var "SUPABASE_SERVICE_ROLE_KEY"

log "warning-only check for connector API keys"
for key in GRAPHHOPPER_API_KEY AEMET_API_KEY GUARDIAN_API_KEY THE_GUARDIAN_API_KEY FRED_API_KEY; do
  if [[ -n "${!key:-}" ]]; then
    log "detected ${key}"
  fi
done

if [[ -z "${GUARDIAN_API_KEY:-}" && -z "${THE_GUARDIAN_API_KEY:-}" ]]; then
  log "missing GUARDIAN_API_KEY/THE_GUARDIAN_API_KEY (The Guardian connector will stay pending)"
fi

log "syncing repository"
git pull --rebase origin main

log "running validation suite"
npm run test -- src/test/publicApiEcosystem.test.js src/test/publicApiInfrastructure.test.js src/test/publicApiCatalog.test.js src/test/useApiCatalog.test.js src/test/variableRuntimeV2.test.js src/test/controlPlaneV2.integration.test.js src/test/controlPlaneV2.performance.test.js
npx eslint scripts/check-ecosystem-readiness-gate.mjs scripts/smoke-control-plane-v2.mjs src/components/modules/Automation.jsx src/components/modules/ControlTower.jsx src/test/controlPlaneV2.integration.test.js src/test/controlPlaneV2.performance.test.js src/test/variableRuntimeV2.test.js
npm run build

log "applying database migrations"
supabase db push --include-all

log "deploying critical Supabase functions"
supabase functions deploy api-proxy control-plane automation-runner messaging-dispatch event-dispatcher orchestration-engine evaluation-engine simulation-engine

log "syncing public API ecosystem layers"
npm run sync:public-apis
npm run build:public-api-ecosystem-layer
npm run build:project-apis

log "bootstrapping public connectors"
npm run public-apis:bootstrap -- --apply --healthcheck --strict

if [[ -n "${N8N_API_URL:-}" && -n "${N8N_API_KEY:-}" ]]; then
  log "n8n URL/API key detected, running n8n cutover tasks"
  npm run sync:n8n-templates
  npm run bootstrap:n8n-credentials -- --apply || true
  npm run audit:n8n-workflows -- --recent-hours "${RECENT_HOURS}"
  npm run inject:n8n-api-context -- --apply
  npm run reconcile:n8n-oculops -- --apply --recent-hours "${RECENT_HOURS}"
else
  log "N8N_API_URL/N8N_API_KEY not configured, skipping n8n reconcile steps"
fi

READINESS_ORG="$(resolve_readiness_org || true)"
if [[ -n "${READINESS_ORG}" ]]; then
  log "running readiness gate in production mode for org ${READINESS_ORG}"
  READINESS_ORG_ID="${READINESS_ORG}" npm run readiness:generate
  READINESS_ORG_ID="${READINESS_ORG}" npm run readiness:check:production
else
  log "unable to resolve READINESS_ORG_ID automatically; generating readiness report only"
  npm run readiness:generate
fi

if [[ "$SKIP_VERCEL" -eq 0 ]]; then
  log "deploying Vercel production"
  npx vercel --prod --yes
else
  log "skipping Vercel deploy (--skip-vercel)"
fi

log "final git status"
git status --short
log "cutover run completed"
