import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeN8nApiBase } from '../src/lib/n8nApiConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const envPath = path.join(repoRoot, '.env')
const n8nDir = path.join(repoRoot, 'n8n')

const LIVE_WORKFLOW_EXPORTS = {
  'ARCHITECT OS - Auto Handoff': 'architect-os-auto-handoff.json',
}

function parseArgs(argv) {
  return {
    local: argv.includes('--local'),
    live: argv.includes('--live'),
    exportLive: argv.includes('--export-live'),
  }
}

function parseEnv(text) {
  const env = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue
    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function loadEnv() {
  const localText = await fs.readFile(envPath, 'utf8')
  return { ...parseEnv(localText), ...process.env }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function ensureHeaderParameters(node) {
  node.parameters = node.parameters || {}
  node.parameters.sendHeaders = true
  node.parameters.headerParameters = node.parameters.headerParameters || {}
  node.parameters.headerParameters.parameters = ensureArray(node.parameters.headerParameters.parameters)
  return node.parameters.headerParameters.parameters
}

function upsertHeader(node, name, value) {
  const parameters = ensureHeaderParameters(node)
  const index = parameters.findIndex((entry) => entry?.name === name)
  const next = { name, value }
  if (index === -1) parameters.push(next)
  else parameters[index] = { ...parameters[index], ...next }
}

function normalizeSupabaseHttpNode(node, mode, env) {
  if (node.type !== 'n8n-nodes-base.httpRequest') return false

  const url = node.parameters?.url
  if (typeof url !== 'string') return false
  const isSupabase = url.includes('supabase.co') || url.includes('SUPABASE_URL')
  if (!isSupabase) return false

  const isRest = url.includes('/rest/v1/')
  const isFunctions = url.includes('/functions/v1/')
  if (!isRest && !isFunctions) return false

  const nextAnon = mode === 'live'
    ? env.SUPABASE_ANON_KEY
    : '={{ $env.SUPABASE_ANON_KEY }}'
  const nextService = mode === 'live'
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : '{{ $env.SUPABASE_SERVICE_ROLE_KEY }}'

  delete node.parameters.authentication
  delete node.parameters.genericAuthType
  upsertHeader(node, 'Content-Type', 'application/json')
  upsertHeader(node, 'apikey', nextAnon)

  if (isRest) {
    upsertHeader(node, 'Authorization', `Bearer ${nextService}`)
    if ((node.parameters.method || '').toUpperCase() === 'POST' && !ensureArray(node.parameters.headerParameters?.parameters).some((entry) => entry?.name === 'Prefer')) {
      upsertHeader(node, 'Prefer', 'return=representation')
    }
  } else if (isFunctions) {
    upsertHeader(node, 'Authorization', `Bearer ${nextAnon}`)
  }

  return true
}

function normalizeArchitectWorkflow(workflow) {
  const responseNode = ensureArray(workflow.nodes).find((node) => node?.name === 'HTTP Response' && node?.type === 'n8n-nodes-base.respondToWebhook')
  if (!responseNode) return false

  responseNode.parameters = responseNode.parameters || {}
  responseNode.parameters.respondWith = 'text'
  responseNode.parameters.responseBody = "={{ JSON.stringify({ status: 'success', message: 'Handoff processed! Email notifications prepared.', qa_score: $json.body.qa_score || null }) }}"
  return true
}

function normalizeWorkflow(workflow, mode, env) {
  const original = JSON.stringify(workflow)

  for (const node of ensureArray(workflow.nodes)) {
    normalizeSupabaseHttpNode(node, mode, env)
  }

  if (workflow.name === 'ARCHITECT OS - Auto Handoff') {
    normalizeArchitectWorkflow(workflow)
  }

  return JSON.stringify(workflow) !== original
}

async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function putWorkflow(url, apiKey, workflow) {
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: {},
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`PUT ${url} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function repairLocal(env) {
  const entries = await fs.readdir(n8nDir)
  const changed = []

  for (const entry of entries.filter((file) => file.endsWith('.json'))) {
    const filePath = path.join(n8nDir, entry)
    const workflow = JSON.parse(await fs.readFile(filePath, 'utf8'))
    const nextWorkflow = deepClone(workflow)
    const didChange = normalizeWorkflow(nextWorkflow, 'local', env)
    if (!didChange) continue
    await fs.writeFile(filePath, `${JSON.stringify(nextWorkflow, null, 2)}\n`)
    changed.push(entry)
  }

  return changed
}

async function repairLive(env) {
  if (!env.N8N_API_URL || !env.N8N_API_KEY) {
    throw new Error('N8N_API_URL and N8N_API_KEY are required for --live')
  }

  const baseUrl = normalizeN8nApiBase(env.N8N_API_URL)
  const list = await fetchJson(`${baseUrl}/workflows?limit=200`, env.N8N_API_KEY)
  const changed = []

  for (const summary of ensureArray(list.data)) {
    const workflow = await fetchJson(`${baseUrl}/workflows/${summary.id}`, env.N8N_API_KEY)
    const nextWorkflow = deepClone(workflow)
    const didChange = normalizeWorkflow(nextWorkflow, 'live', env)
    if (!didChange) continue
    await putWorkflow(`${baseUrl}/workflows/${summary.id}`, env.N8N_API_KEY, nextWorkflow)
    changed.push(`${summary.id} ${workflow.name}`)
  }

  return changed
}

async function exportLiveWorkflows(env) {
  if (!env.N8N_API_URL || !env.N8N_API_KEY) {
    throw new Error('N8N_API_URL and N8N_API_KEY are required for --export-live')
  }

  const baseUrl = normalizeN8nApiBase(env.N8N_API_URL)
  const list = await fetchJson(`${baseUrl}/workflows?limit=200`, env.N8N_API_KEY)
  const exported = []

  for (const summary of ensureArray(list.data)) {
    if (!Object.prototype.hasOwnProperty.call(LIVE_WORKFLOW_EXPORTS, summary.name)) continue
    const workflow = await fetchJson(`${baseUrl}/workflows/${summary.id}`, env.N8N_API_KEY)
    const fileName = LIVE_WORKFLOW_EXPORTS[summary.name]
    const outputPath = path.join(n8nDir, fileName)
    await fs.writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`)
    exported.push(fileName)
  }

  return exported
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.local && !args.live && !args.exportLive) {
    console.error('Usage: node scripts/repair-n8n.mjs [--local] [--live] [--export-live]')
    process.exit(1)
  }

  const env = await loadEnv()

  if (args.local) {
    const changed = await repairLocal(env)
    console.log(`Local n8n templates normalized: ${changed.length}`)
    for (const entry of changed) console.log(`- ${entry}`)
  }

  if (args.live) {
    const changed = await repairLive(env)
    console.log(`Live n8n workflows repaired: ${changed.length}`)
    for (const entry of changed) console.log(`- ${entry}`)
  }

  if (args.exportLive) {
    const exported = await exportLiveWorkflows(env)
    console.log(`Live workflows exported: ${exported.length}`)
    for (const entry of exported) console.log(`- ${entry}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
