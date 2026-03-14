function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function normalizePathname(pathname) {
  const trimmed = stripTrailingSlash(pathname || '')

  if (!trimmed || trimmed === '/') {
    return '/api/v1'
  }

  if (/\/settings\/api$/i.test(trimmed)) {
    return trimmed.replace(/\/settings\/api$/i, '/api/v1')
  }

  if (/\/api\/v1$/i.test(trimmed)) {
    return '/api/v1'
  }

  if (/\/api\/v1\//i.test(trimmed)) {
    return trimmed.replace(/(\/api\/v1).*/i, '$1')
  }

  return trimmed
}

function normalizeExplicitWebhookBase(explicitWebhookUrl) {
  const explicit = stripTrailingSlash(String(explicitWebhookUrl || '').trim())
  if (!explicit) return ''

  try {
    const parsed = new URL(explicit)
    const pathname = stripTrailingSlash(parsed.pathname || '')

    let nextPathname = pathname
    if (/\/webhook-test(\/|$)/i.test(pathname)) {
      nextPathname = pathname.replace(/(\/webhook-test).*/i, '$1')
    } else if (/\/webhook(\/|$)/i.test(pathname)) {
      nextPathname = pathname.replace(/(\/webhook).*/i, '$1')
    } else if (pathname.includes('/')) {
      nextPathname = pathname.replace(/\/[^/]+$/, '')
    }

    parsed.pathname = nextPathname || ''
    parsed.search = ''
    parsed.hash = ''
    return stripTrailingSlash(parsed.toString())
  } catch {
    if (/\/webhook-test(\/|$)/i.test(explicit)) {
      return explicit.replace(/(\/webhook-test).*/i, '$1')
    }
    if (/\/webhook(\/|$)/i.test(explicit)) {
      return explicit.replace(/(\/webhook).*/i, '$1')
    }
    return explicit
  }
}

export function normalizeN8nApiBase(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''

  const stripped = stripTrailingSlash(raw)

  try {
    const parsed = new URL(stripped)
    parsed.pathname = normalizePathname(parsed.pathname)
    parsed.search = ''
    parsed.hash = ''
    return stripTrailingSlash(parsed.toString())
  } catch {
    return normalizePathname(stripped)
  }
}

export function resolveN8nWebhookBase({ apiUrl, explicitWebhookUrl } = {}) {
  const explicit = normalizeExplicitWebhookBase(explicitWebhookUrl)
  if (explicit) return explicit

  const apiBase = normalizeN8nApiBase(apiUrl)
  if (!apiBase) return ''

  if (/\/api\/v1$/i.test(apiBase)) {
    return apiBase.replace(/\/api\/v1$/i, '/webhook')
  }

  return apiBase
}
