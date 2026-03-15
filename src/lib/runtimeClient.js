const STORAGE_KEY = 'oculops.runtime.config'

const DEFAULT_CONFIG = {
  gatewayBase: import.meta.env.VITE_OCULOPS_GATEWAY_BASE || 'http://127.0.0.1:38793',
  dashboardBase: import.meta.env.VITE_OCULOPS_DASHBOARD_BASE || 'http://127.0.0.1:38791',
  hubBase: import.meta.env.VITE_OCULOPS_HUB_BASE || 'http://127.0.0.1:38792',
  omniBase: import.meta.env.VITE_OCULOPS_OMNI_BASE || 'http://127.0.0.1:40000',
  n8nBase: import.meta.env.VITE_OCULOPS_N8N_BASE || 'http://127.0.0.1:5680',
  gatewayToken: '',
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadRuntimeConfig() {
  if (!canUseStorage()) return { ...DEFAULT_CONFIG }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...(parsed || {}) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveRuntimeConfig(next) {
  const merged = { ...loadRuntimeConfig(), ...(next || {}) }
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  }
  return merged
}

function trimSlash(value) {
  const raw = String(value || '').trim()
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function buildHeaders(config, authenticated = false, extras = {}) {
  const headers = { ...extras }
  if (authenticated && config?.gatewayToken) {
    headers['X-OCULOPS-TOKEN'] = config.gatewayToken
  }
  return headers
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs || 8000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    })
    const text = await response.text()
    const json = (() => {
      try { return JSON.parse(text) } catch { return null }
    })()
    if (!response.ok) {
      throw new Error((json && json.error) || text || `HTTP ${response.status}`)
    }
    return json ?? text
  } finally {
    clearTimeout(timer)
  }
}

async function postJson(url, body, options = {}) {
  return await fetchJson(url, {
    method: 'POST',
    timeoutMs: options.timeoutMs || 15000,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(body || {}),
  })
}

export async function getRuntimeHealth(config = loadRuntimeConfig()) {
  return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/health`, { timeoutMs: 5000 })
}

export async function getRuntimeReadiness(config = loadRuntimeConfig()) {
  return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/readiness`, {
    timeoutMs: 8000,
    headers: buildHeaders(config, true),
  })
}

export async function getRuntimeSnapshot(config = loadRuntimeConfig()) {
  return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/snapshot`, {
    timeoutMs: 8000,
    headers: buildHeaders(config, true),
  })
}

export async function getRuntimeLogsTail(source = 'openclaw', lines = 20, config = loadRuntimeConfig()) {
  const url = `${trimSlash(config.gatewayBase)}/api/v1/logs/tail?source=${encodeURIComponent(source)}&lines=${lines}`
  return await fetchJson(url, {
    timeoutMs: 8000,
    headers: buildHeaders(config, true),
  })
}

export async function getRuntimeOpenClaw(config = loadRuntimeConfig()) {
  try {
    return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/openclaw`, {
      timeoutMs: 8000,
      headers: buildHeaders(config, true),
    })
  } catch {
    return await fetchJson(`${trimSlash(config.hubBase)}/api/integrations/openclaw`, { timeoutMs: 8000 })
  }
}

export async function getRuntimePm2(config = loadRuntimeConfig()) {
  return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/pm2`, {
    timeoutMs: 8000,
    headers: buildHeaders(config, true),
  })
}

export async function sendRuntimeClawbot({ agent = 'orchestrator', message }, config = loadRuntimeConfig()) {
  return await postJson(`${trimSlash(config.gatewayBase)}/api/v1/clawbot`, { agent, message }, {
    timeoutMs: 60000,
    headers: buildHeaders(config, true),
  })
}

export async function getRuntimeRegistries(config = loadRuntimeConfig()) {
  return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/registries`, {
    timeoutMs: 10000,
    headers: buildHeaders(config, true),
  })
}

export async function runRuntimeHeraldBriefing({ dryRun = true, approval = null } = {}, config = loadRuntimeConfig()) {
  return await postJson(`${trimSlash(config.gatewayBase)}/api/v1/herald/run`, {
    dryRun,
    approval,
  }, {
    timeoutMs: 125000,
    headers: buildHeaders(config, true),
  })
}

export async function runRuntimeLeadSlice({
  dryRun = true,
  approval = null,
  name = '',
  company = '',
  email = '',
  phone = '',
  website = '',
  location = '',
  source = '',
} = {}, config = loadRuntimeConfig()) {
  return await postJson(`${trimSlash(config.gatewayBase)}/api/v1/leads/run`, {
    dryRun,
    approval,
    name,
    company,
    email,
    phone,
    website,
    location,
    source,
  }, {
    timeoutMs: 125000,
    headers: buildHeaders(config, true),
  })
}

export async function probeRuntimeStack(config = loadRuntimeConfig()) {
  try {
    return await fetchJson(`${trimSlash(config.gatewayBase)}/api/v1/stack`, {
      timeoutMs: 8000,
      headers: buildHeaders(config, true),
    })
  } catch {
    const services = [
      { key: 'gateway', label: 'Gateway', role: 'Runtime API gateway', baseUrl: trimSlash(config.gatewayBase), healthPath: '/api/v1/health', auth: false },
      { key: 'dashboard', label: 'Dashboard API', role: 'System health and governance', baseUrl: trimSlash(config.dashboardBase), healthPath: '/api/sysinfo', auth: false },
      { key: 'hub', label: 'Integration Hub', role: 'OpenClaw and integrations', baseUrl: trimSlash(config.hubBase), healthPath: '/api/integrations/health', auth: false },
      { key: 'omni', label: 'OMNICENTER', role: 'NeuralNet and office visual layer', baseUrl: trimSlash(config.omniBase), healthPath: '/', auth: false },
      { key: 'n8n', label: 'n8n', role: 'Workflow conductor', baseUrl: trimSlash(config.n8nBase), healthPath: '/healthz', auth: false },
    ]

    return await Promise.all(
      services.map(async (service) => {
        const endpoint = `${service.baseUrl}${service.healthPath.startsWith('/') ? service.healthPath : `/${service.healthPath}`}`
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: buildHeaders(config, service.auth),
          })
          return {
            ...service,
            endpoint,
            online: response.ok,
            statusCode: response.status,
          }
        } catch {
          return {
            ...service,
            endpoint,
            online: false,
            statusCode: null,
          }
        }
      })
    )
  }
}
