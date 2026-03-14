#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeN8nApiBase } from '../src/lib/n8nApiConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DEFAULT_SEED_FILE = path.join(ROOT_DIR, 'src/data/n8nTemplateCatalog.seed.json')

function parseArgs(argv) {
  const args = {
    ids: [],
    allInstallReady: false,
    top: 0,
    apply: false,
    activate: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--id' && argv[index + 1]) {
      args.ids.push(Number(argv[index + 1]))
      index += 1
    } else if (arg === '--ids' && argv[index + 1]) {
      args.ids.push(...argv[index + 1].split(',').map(value => Number(value.trim())).filter(Number.isFinite))
      index += 1
    } else if (arg === '--all-install-ready') {
      args.allInstallReady = true
    } else if (arg === '--top' && argv[index + 1]) {
      args.top = Number(argv[index + 1]) || 0
      index += 1
    } else if (arg === '--apply') {
      args.apply = true
    } else if (arg === '--activate') {
      args.activate = true
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
    // .env optional
  }
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`)
  }
  return response.json()
}

async function loadTemplateIdsFromSeed({ top = 0 } = {}) {
  const seedRaw = await fs.readFile(DEFAULT_SEED_FILE, 'utf8')
  const seed = JSON.parse(seedRaw)
  const installReady = (seed.entries || []).filter(entry => entry.is_installable)
  const bounded = top > 0 ? installReady.slice(0, top) : installReady
  return bounded.map(entry => Number(entry.template_id)).filter(Number.isFinite)
}

async function fetchTemplateDetail(templateId) {
  const payload = await fetchJson(`https://api.n8n.io/templates/workflows/${templateId}`)
  if (!payload?.workflow?.workflow) {
    throw new Error(`Template #${templateId} did not include workflow definition`)
  }
  return payload.workflow
}

async function createWorkflowInN8n({ apiBase, apiKey, template, activate = false }) {
  const workflowDefinition = template.workflow
  const payload = {
    name: workflowDefinition.name || template.name || `Template ${template.id}`,
    nodes: workflowDefinition.nodes || [],
    connections: workflowDefinition.connections || {},
    settings: workflowDefinition.settings || {},
  }

  const createResponse = await fetch(`${apiBase}/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!createResponse.ok) {
    throw new Error(`Failed creating workflow from template #${template.id} (${createResponse.status})`)
  }

  const created = await createResponse.json()

  if (activate && created?.id) {
    const activateResponse = await fetch(`${apiBase}/workflows/${created.id}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': apiKey,
        Accept: 'application/json',
      },
    })

    if (!activateResponse.ok) {
      throw new Error(`Workflow ${created.id} created but activation failed (${activateResponse.status})`)
    }
  }

  return created
}

async function listExistingWorkflowNames({ apiBase, apiKey }) {
  const payload = await fetchJson(`${apiBase}/workflows?limit=200`, {
    'X-N8N-API-KEY': apiKey,
    Accept: 'application/json',
  })

  const workflows = Array.isArray(payload?.data) ? payload.data : []
  return new Set(workflows.map(workflow => String(workflow?.name || '').trim()).filter(Boolean))
}

async function main() {
  await loadEnvFile()
  const args = parseArgs(process.argv.slice(2))

  if (args.ids.length === 0 && !args.allInstallReady) {
    console.error('Usage: node scripts/install-n8n-template.mjs --id <templateId> [--apply] [--activate]')
    console.error('   or: node scripts/install-n8n-template.mjs --all-install-ready [--top 50] [--apply] [--activate]')
    process.exitCode = 1
    return
  }

  const apiBase = normalizeN8nApiBase(process.env.N8N_API_URL)
  const apiKey = process.env.N8N_API_KEY

  if (!apiBase || !apiKey) {
    console.error('N8N_API_URL and N8N_API_KEY are required')
    process.exitCode = 1
    return
  }

  const selectedIds = args.allInstallReady
    ? await loadTemplateIdsFromSeed({ top: args.top })
    : args.ids

  const uniqueIds = [...new Set(selectedIds.filter(Number.isFinite))]

  if (uniqueIds.length === 0) {
    console.error('No template IDs selected for install')
    process.exitCode = 1
    return
  }

  const templates = []
  const skipped = []
  for (const templateId of uniqueIds) {
    try {
      const detail = await fetchTemplateDetail(templateId)
      templates.push(detail)
    } catch (error) {
      skipped.push({
        templateId,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (skipped.length > 0) {
    console.warn(`[install-n8n-template] Skipped ${skipped.length} templates that are no longer available:`)
    for (const item of skipped.slice(0, 20)) {
      console.warn(`- #${item.templateId}: ${item.reason}`)
    }
    if (skipped.length > 20) {
      console.warn(`...and ${skipped.length - 20} more`)
    }
  }

  if (templates.length === 0) {
    console.error('[install-n8n-template] No valid templates available after filtering/skips')
    process.exitCode = 1
    return
  }

  if (!args.apply) {
    console.log(`[install-n8n-template] Dry run. Selected templates: ${templates.length}`)
    for (const template of templates.slice(0, 25)) {
      console.log(`- #${template.id} ${template.name}`)
    }
    if (templates.length > 25) {
      console.log(`...and ${templates.length - 25} more`)
    }
    console.log('[install-n8n-template] Re-run with --apply to create workflows in n8n')
    return
  }

  console.log(`[install-n8n-template] Installing ${templates.length} templates into ${apiBase}...`)

  const existingNames = await listExistingWorkflowNames({ apiBase, apiKey })
  const created = []
  const failed = []
  const alreadyPresent = []
  for (const template of templates) {
    const templateWorkflowName = String(template?.workflow?.name || template?.name || '').trim()
    if (templateWorkflowName && existingNames.has(templateWorkflowName)) {
      alreadyPresent.push({ templateId: template.id, templateName: template.name, workflowName: templateWorkflowName })
      console.log(`↺ Skipped #${template.id} (${templateWorkflowName}) already exists in n8n`)
      continue
    }

    try {
      const workflow = await createWorkflowInN8n({
        apiBase,
        apiKey,
        template,
        activate: args.activate,
      })

      created.push({
        templateId: template.id,
        templateName: template.name,
        workflowId: workflow.id,
        workflowName: workflow.name,
      })

      if (workflow?.name) {
        existingNames.add(String(workflow.name).trim())
      }

      console.log(`✓ Installed #${template.id} -> workflow ${workflow.id} (${workflow.name})`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failed.push({ templateId: template.id, templateName: template.name, reason })
      console.warn(`✗ Failed #${template.id} (${template.name}): ${reason}`)
    }
  }

  console.log(`[install-n8n-template] Completed. Installed=${created.length}, existing=${alreadyPresent.length}, failed=${failed.length}`)

  if (failed.length > 0) {
    console.warn('[install-n8n-template] Failed templates:')
    for (const item of failed) {
      console.warn(`- #${item.templateId} ${item.templateName}: ${item.reason}`)
    }
  }
}

main().catch(error => {
  console.error('[install-n8n-template] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
