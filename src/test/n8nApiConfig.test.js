import { describe, it, expect } from 'vitest'
import { normalizeN8nApiBase, resolveN8nWebhookBase } from '../lib/n8nApiConfig'

describe('n8nApiConfig', () => {
  it('normalizes settings/api URL into API v1 base', () => {
    const result = normalizeN8nApiBase('http://localhost:5680/settings/api')
    expect(result).toBe('http://localhost:5680/api/v1')
  })

  it('adds /api/v1 when only host is provided', () => {
    const result = normalizeN8nApiBase('https://n8n.example.com/')
    expect(result).toBe('https://n8n.example.com/api/v1')
  })

  it('keeps explicit /api/v1 URL stable', () => {
    const result = normalizeN8nApiBase('https://n8n.example.com/api/v1/')
    expect(result).toBe('https://n8n.example.com/api/v1')
  })

  it('derives webhook base from API URL when explicit URL is missing', () => {
    const result = resolveN8nWebhookBase({
      apiUrl: 'http://localhost:5680/settings/api',
    })
    expect(result).toBe('http://localhost:5680/webhook')
  })

  it('uses explicit webhook URL and trims endpoint path', () => {
    const result = resolveN8nWebhookBase({
      apiUrl: 'http://localhost:5680/api/v1',
      explicitWebhookUrl: 'http://localhost:5680/webhook/lead-qualifier',
    })
    expect(result).toBe('http://localhost:5680/webhook')
  })
})
