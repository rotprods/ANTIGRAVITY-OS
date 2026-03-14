#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const STATE_FILE = path.join(ROOT_DIR, 'reports/n8n-cloudflare-bridge.json')

async function loadState() {
  const text = await fs.readFile(STATE_FILE, 'utf8')
  return JSON.parse(text)
}

async function main() {
  let state
  try {
    state = await loadState()
  } catch {
    console.log('[n8n-cloudflare-bridge] no active state file found')
    return
  }

  const pid = Number(state?.pid)
  if (!Number.isFinite(pid)) {
    console.log('[n8n-cloudflare-bridge] state file found but pid is invalid')
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
    console.log(`[n8n-cloudflare-bridge] stopped tunnel process pid=${pid}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[n8n-cloudflare-bridge] could not stop pid=${pid}: ${message}`)
  }

  await fs.rm(STATE_FILE, { force: true })
  console.log(`[n8n-cloudflare-bridge] removed ${STATE_FILE}`)
}

main().catch(error => {
  console.error('[n8n-cloudflare-bridge] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
