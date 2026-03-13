#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DEFAULT_OUTPUT_FILE = path.join(ROOT_DIR, 'reports/n8n-workflow-audit.json')

function parseArgs(argv) {
  const args = {
    recentHours: 48,
    output: DEFAULT_OUTPUT_FILE,
    json: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--recent-hours' && argv[index + 1]) {
      args.recentHours = Number(argv[index + 1]) || args.recentHours
      index += 1
    } else if (arg === '--output' && argv[index + 1]) {
      args.output = argv[index + 1]
      index += 1
    } else if (arg === '--no-json') {
      args.json = false
    }
  }

  return args
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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function extractCustomNodePackages(nodes = []) {
  const packages = new Set()
  const types = new Set()

  for (const node of nodes) {
    const type = String(node.type || '')
    if (!type) continue

    const packageToken = type.split('.')[0]
    const isOfficialPackage =
      packageToken === 'n8n-nodes-base' ||
      packageToken === '@n8n/n8n-nodes-langchain'
    if (isOfficialPackage) continue

    packages.add(packageToken)
    types.add(type)
  }

  return {
    customNodePackages: [...packages],
    customNodeTypes: [...types],
  }
}

function classifyTriggers(nodes = []) {
  const triggers = new Set()
  for (const node of nodes) {
    const type = String(node.type || '')
    if (/\.webhook$/i.test(type)) triggers.add('webhook')
    if (/scheduleTrigger/i.test(type)) triggers.add('schedule')
    if (/manualTrigger/i.test(type)) triggers.add('manual')
  }
  return [...triggers]
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`)
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

  const headers = {
    'X-N8N-API-KEY': apiKey,
    Accept: 'application/json',
  }

  const [workflowsPayload, credentialsPayload] = await Promise.all([
    fetchJson(`${apiBase}/workflows?limit=200`, headers),
    fetchJson(`${apiBase}/credentials`, headers),
  ])

  const workflows = Array.isArray(workflowsPayload?.data) ? workflowsPayload.data : []
  const credentialTypes = new Set((credentialsPayload?.data || []).map(credential => credential.type))

  const cutoff = Date.now() - args.recentHours * 60 * 60 * 1000
  const targetWorkflows = workflows
    .filter(workflow => {
      const updated = workflow.updatedAt ? new Date(workflow.updatedAt).getTime() : 0
      return Number.isFinite(updated) && updated >= cutoff
    })
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))

  const details = []

  for (const workflow of targetWorkflows) {
    const payload = await fetchJson(`${apiBase}/workflows/${workflow.id}`, headers)
    const nodes = payload.nodes || []

    const requiredCredentialTypes = unique(nodes.flatMap(node => Object.keys(node.credentials || {})))
    const missingCredentialTypes = requiredCredentialTypes.filter(type => !credentialTypes.has(type))
    const triggers = classifyTriggers(nodes)
    const { customNodePackages, customNodeTypes } = extractCustomNodePackages(nodes)
    const hasWebhook = triggers.includes('webhook')
    const hasSchedule = triggers.includes('schedule')
    const requiresCommunityNodes = customNodePackages.length > 0

    details.push({
      id: payload.id,
      name: payload.name,
      active: Boolean(payload.active),
      updatedAt: payload.updatedAt,
      triggers,
      nodeCount: nodes.length,
      requiredCredentialTypes,
      missingCredentialTypes,
      customNodePackages,
      customNodeTypes,
      requiresCommunityNodes,
      runnableNow: missingCredentialTypes.length === 0 && !requiresCommunityNodes,
      activatableNow: missingCredentialTypes.length === 0 && !requiresCommunityNodes && (hasWebhook || hasSchedule),
    })
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalWorkflowsInN8n: workflows.length,
    auditedWorkflows: details.length,
    recentHours: args.recentHours,
    runnableNow: details.filter(item => item.runnableNow).length,
    activatableNow: details.filter(item => item.activatableNow).length,
    activeNow: details.filter(item => item.active).length,
    blockedByCredentials: details.filter(item => item.missingCredentialTypes.length > 0).length,
    blockedByCommunityNodes: details.filter(item => item.requiresCommunityNodes).length,
    missingCredentialTypes: unique(details.flatMap(item => item.missingCredentialTypes)),
    missingCommunityNodePackages: unique(details.flatMap(item => item.customNodePackages)),
  }

  const report = { summary, details }

  if (args.json) {
    const outputPath = path.isAbsolute(args.output)
      ? args.output
      : path.join(ROOT_DIR, args.output)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`[audit-n8n-workflows] wrote ${outputPath}`)
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error('[audit-n8n-workflows] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
