#!/usr/bin/env node

import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { extractTryCloudflareUrl, buildN8nBridgeUrls } from '../src/lib/cloudflareTunnel.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const REPORTS_DIR = path.join(ROOT_DIR, 'reports')
const LOG_FILE = path.join(REPORTS_DIR, 'n8n-cloudflare-bridge.log')
const STATE_FILE = path.join(REPORTS_DIR, 'n8n-cloudflare-bridge.json')

function parseArgs(argv) {
  const args = {
    upstream: 'http://127.0.0.1:5680',
    writeEnv: false,
    timeoutSeconds: 45,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--upstream' && argv[index + 1]) {
      args.upstream = String(argv[index + 1]).trim()
      index += 1
    } else if (arg === '--write-env') {
      args.writeEnv = true
    } else if (arg === '--timeout' && argv[index + 1]) {
      args.timeoutSeconds = Number(argv[index + 1]) || args.timeoutSeconds
      index += 1
    }
  }

  return args
}

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true })
}

async function checkCloudflaredInstalled() {
  const maybePath = ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared']
  for (const candidate of maybePath) {
    if (fsSync.existsSync(candidate)) return candidate
  }
  return 'cloudflared'
}

async function isUpstreamReachable(upstream) {
  const targets = [`${upstream.replace(/\/+$/, '')}/healthz`, upstream]
  for (const url of targets) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok || response.status === 401 || response.status === 403) {
        return { reachable: true, url, status: response.status }
      }
    } catch {
      // keep trying
    }
  }
  return { reachable: false, url: targets[0], status: null }
}

async function waitForTunnelUrl({ timeoutSeconds }) {
  const started = Date.now()
  while ((Date.now() - started) / 1000 < timeoutSeconds) {
    try {
      const text = await fs.readFile(LOG_FILE, 'utf8')
      const url = extractTryCloudflareUrl(text)
      if (url) return url
    } catch {
      // log not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 750))
  }
  return null
}

async function loadStateIfAny() {
  try {
    const text = await fs.readFile(STATE_FILE, 'utf8')
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function killIfRunning(pid) {
  if (!Number.isFinite(pid)) return
  try {
    process.kill(pid, 0)
  } catch {
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // ignore
  }
}

async function upsertEnv({ apiUrl, webhookBase }) {
  const envPath = path.join(ROOT_DIR, '.env')
  let envText = ''
  try {
    envText = await fs.readFile(envPath, 'utf8')
  } catch {
    // create file
  }

  const lines = envText ? envText.split('\n') : []
  const next = []
  let wroteApi = false
  let wroteWebhook = false

  for (const rawLine of lines) {
    if (rawLine.startsWith('N8N_API_URL=')) {
      next.push(`N8N_API_URL=${apiUrl}`)
      wroteApi = true
      continue
    }
    if (rawLine.startsWith('N8N_WEBHOOK_URL=')) {
      next.push(`N8N_WEBHOOK_URL=${webhookBase}`)
      wroteWebhook = true
      continue
    }
    next.push(rawLine)
  }

  if (!wroteApi) next.push(`N8N_API_URL=${apiUrl}`)
  if (!wroteWebhook) next.push(`N8N_WEBHOOK_URL=${webhookBase}`)

  await fs.writeFile(envPath, `${next.join('\n').replace(/\n+$/g, '')}\n`, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await ensureReportsDir()

  const cloudflaredBin = await checkCloudflaredInstalled()
  const reachable = await isUpstreamReachable(args.upstream)

  if (!reachable.reachable) {
    console.warn(`[n8n-cloudflare-bridge] warning: upstream ${args.upstream} is not reachable right now`)
  } else {
    console.log(`[n8n-cloudflare-bridge] upstream OK via ${reachable.url} (${reachable.status})`)
  }

  const previousState = await loadStateIfAny()
  if (previousState?.pid) {
    await killIfRunning(Number(previousState.pid))
  }

  await fs.writeFile(LOG_FILE, '', 'utf8')
  const out = fsSync.openSync(LOG_FILE, 'a')
  const child = spawn(
    cloudflaredBin,
    ['tunnel', '--no-autoupdate', '--url', args.upstream],
    {
      cwd: ROOT_DIR,
      detached: true,
      stdio: ['ignore', out, out],
    }
  )
  child.unref()
  fsSync.closeSync(out)

  const publicUrl = await waitForTunnelUrl({ timeoutSeconds: args.timeoutSeconds })
  if (!publicUrl) {
    console.error('[n8n-cloudflare-bridge] failed to obtain trycloudflare URL in time')
    process.exitCode = 1
    return
  }

  const urls = buildN8nBridgeUrls(publicUrl)
  const state = {
    startedAt: new Date().toISOString(),
    pid: child.pid,
    upstream: args.upstream,
    cloudflaredBin,
    logFile: LOG_FILE,
    ...urls,
  }

  await fs.writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8')

  if (args.writeEnv) {
    await upsertEnv({
      apiUrl: urls.apiUrl,
      webhookBase: urls.webhookBase,
    })
    console.log('[n8n-cloudflare-bridge] .env updated with N8N_API_URL/N8N_WEBHOOK_URL')
  }

  console.log(`[n8n-cloudflare-bridge] tunnel ready: ${urls.publicUrl}`)
  console.log(`[n8n-cloudflare-bridge] api base: ${urls.apiUrl}`)
  console.log(`[n8n-cloudflare-bridge] webhook base: ${urls.webhookBase}`)
  console.log(`[n8n-cloudflare-bridge] state: ${STATE_FILE}`)
  console.log(`[n8n-cloudflare-bridge] logs: ${LOG_FILE}`)
}

main().catch(error => {
  console.error('[n8n-cloudflare-bridge] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
