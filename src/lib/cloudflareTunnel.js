export function extractTryCloudflareUrl(logText) {
  if (!logText) return null

  const match = String(logText).match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/gi)
  if (!match || match.length === 0) return null
  return match[match.length - 1]
}

export function buildN8nBridgeUrls(publicUrl) {
  const base = String(publicUrl || '').replace(/\/+$/, '')
  if (!base) {
    return {
      publicUrl: '',
      apiUrl: '',
      webhookBase: '',
    }
  }

  return {
    publicUrl: base,
    apiUrl: `${base}/api/v1`,
    webhookBase: `${base}/webhook`,
  }
}
