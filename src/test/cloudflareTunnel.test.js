import { describe, it, expect } from 'vitest'
import { extractTryCloudflareUrl, buildN8nBridgeUrls } from '../lib/cloudflareTunnel'

describe('cloudflareTunnel', () => {
  it('extracts the most recent trycloudflare URL from logs', () => {
    const log = [
      'INF Initial protocol quic',
      'INF +--------------------------------------------------------------------------------------------+',
      'INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |',
      'INF |  https://old-url.trycloudflare.com                                                         |',
      'INF +--------------------------------------------------------------------------------------------+',
      'INF |  https://new-url.trycloudflare.com                                                         |',
    ].join('\n')

    expect(extractTryCloudflareUrl(log)).toBe('https://new-url.trycloudflare.com')
  })

  it('builds n8n api and webhook URLs from public tunnel URL', () => {
    const result = buildN8nBridgeUrls('https://n8n-bridge.trycloudflare.com/')

    expect(result).toEqual({
      publicUrl: 'https://n8n-bridge.trycloudflare.com',
      apiUrl: 'https://n8n-bridge.trycloudflare.com/api/v1',
      webhookBase: 'https://n8n-bridge.trycloudflare.com/webhook',
    })
  })
})
