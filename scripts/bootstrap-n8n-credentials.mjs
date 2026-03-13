#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  }
}

async function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, '.env')
  try {
    const content = await fs.readFile(envPath, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const [key, ...rest] = line.split('=')
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value
      }
    }
  } catch {
    // optional
  }
}

function normalizeError(error) {
  if (!error) return 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const message = error.message || error.error_description || error.details || error.hint
    if (message) return String(message)
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`)
  }
  return response.json()
}

async function createCredential({ apiBase, apiKey, name, type, data }) {
  const response = await fetch(`${apiBase}/credentials`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, type, data }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`create ${type} failed (${response.status}) ${text}`)
  }

  return response.json()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadEnvFile()

  const apiBase = String(process.env.N8N_API_URL || '').replace(/\/$/, '')
  const apiKey = process.env.N8N_API_KEY
  if (!apiBase || !apiKey) {
    console.error('N8N_API_URL and N8N_API_KEY are required')
    process.exitCode = 1
    return
  }

  const existingPayload = await fetchJson(`${apiBase}/credentials`, {
    'X-N8N-API-KEY': apiKey,
    Accept: 'application/json',
  })

  const existing = Array.isArray(existingPayload?.data) ? existingPayload.data : []
  const existingTypes = new Set(existing.map(item => item.type))

  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_WORKSPACE_CLI_CLIENT_ID || null
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_WORKSPACE_CLI_CLIENT_SECRET || null
  const blotatoApiKey = process.env.BLOTATO_API_KEY || process.env.BLOTATO_TOKEN || null
  const postizApiKey = process.env.POSTIZ_API_KEY || process.env.POSTIZ_TOKEN || null

  const specs = [
    {
      type: 'openAiApi',
      name: 'OCULOPS OpenAI API',
      enabled: Boolean(process.env.OPENAI_API_KEY),
      data: {
        apiKey: process.env.OPENAI_API_KEY || '',
        headerName: 'Authorization',
        headerValue: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      },
    },
    {
      type: 'githubApi',
      name: 'OCULOPS GitHub API',
      enabled: Boolean(process.env.GITHUB_TOKEN),
      data: {
        accessToken: process.env.GITHUB_TOKEN || '',
      },
    },
    {
      type: 'googleSheetsOAuth2Api',
      name: 'OCULOPS Google Sheets OAuth2',
      enabled: Boolean(googleClientId && googleClientSecret),
      data: {
        serverUrl: 'https://www.googleapis.com',
        clientId: googleClientId || '',
        clientSecret: googleClientSecret || '',
        sendAdditionalBodyProperties: false,
        additionalBodyProperties: '',
        allowedDomains: '',
      },
    },
    {
      type: 'googleDriveOAuth2Api',
      name: 'OCULOPS Google Drive OAuth2',
      enabled: Boolean(googleClientId && googleClientSecret),
      data: {
        serverUrl: 'https://www.googleapis.com',
        clientId: googleClientId || '',
        clientSecret: googleClientSecret || '',
        sendAdditionalBodyProperties: false,
        additionalBodyProperties: '',
        allowedDomains: '',
      },
    },
    {
      type: 'httpHeaderAuth',
      name: 'OCULOPS HTTP Header Auth',
      enabled: Boolean(process.env.GOOGLE_CLOUD_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      data: {
        name: 'x-goog-api-key',
        value: process.env.GOOGLE_CLOUD_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
      },
    },
    {
      type: 'httpBearerAuth',
      name: 'OCULOPS HTTP Bearer Auth',
      enabled: Boolean(process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY),
      data: {
        token: process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY || '',
      },
    },
    {
      type: 'blotatoApi',
      name: 'OCULOPS Blotato API',
      enabled: Boolean(blotatoApiKey),
      data: {
        apiKey: blotatoApiKey || '',
      },
    },
    {
      type: 'postizApi',
      name: 'OCULOPS Postiz API',
      enabled: Boolean(postizApiKey),
      data: {
        apiKey: postizApiKey || '',
      },
    },
    {
      type: 'openRouterApi',
      name: 'OCULOPS OpenRouter API',
      enabled: Boolean(process.env.OPENROUTER_API_KEY),
      data: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
      },
    },
    {
      type: 'perplexityApi',
      name: 'OCULOPS Perplexity API',
      enabled: Boolean(process.env.PERPLEXITY_API_KEY),
      data: {
        apiKey: process.env.PERPLEXITY_API_KEY || '',
      },
    },
  ]

  const plan = specs.map(spec => {
    if (existingTypes.has(spec.type)) return { ...spec, status: 'exists' }
    if (!spec.enabled) return { ...spec, status: 'missing_env' }
    return { ...spec, status: 'ready' }
  })

  if (!args.apply) {
    console.log('[bootstrap-n8n-credentials] Dry run plan:')
    for (const item of plan) {
      console.log(`- ${item.type}: ${item.status}`)
    }
    console.log('[bootstrap-n8n-credentials] Re-run with --apply to create ready credentials')
    return
  }

  const created = []
  const failed = []

  for (const item of plan.filter(entry => entry.status === 'ready')) {
    try {
      const row = await createCredential({
        apiBase,
        apiKey,
        name: item.name,
        type: item.type,
        data: item.data,
      })

      created.push({ type: item.type, id: row.id, name: row.name })
      console.log(`✓ created ${item.type} (${row.id})`)
    } catch (error) {
      failed.push({ type: item.type, error: normalizeError(error) })
      console.warn(`✗ failed ${item.type}: ${normalizeError(error)}`)
    }
  }

  console.log(`[bootstrap-n8n-credentials] completed created=${created.length} failed=${failed.length}`)
  if (failed.length > 0) {
    for (const item of failed) {
      console.warn(`- ${item.type}: ${item.error}`)
    }
  }
}

main().catch(error => {
  console.error('[bootstrap-n8n-credentials] failed:', normalizeError(error))
  process.exitCode = 1
})
