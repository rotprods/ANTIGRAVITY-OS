#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildN8nApiTriggerPack, loadJsonFileIfExists } from '../src/lib/publicApiN8nInjection.js'
import { normalizeN8nApiBase, resolveN8nWebhookBase } from '../src/lib/n8nApiConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DEFAULT_REPORT = path.join(ROOT_DIR, 'reports/n8n-oculops-reconcile.json')
const DEFAULT_ECOSYSTEM_LAYER_PATH = path.join(ROOT_DIR, 'public/public-api-catalog/ecosystem-layer.json')
const DEFAULT_N8N_TRIGGER_PACK_PATH = path.join(ROOT_DIR, 'reports/n8n-api-trigger-pack.json')

function parseArgs(argv) {
  const args = {
    recentHours: 72,
    apply: false,
    activate: true,
    bridge: true,
    output: DEFAULT_REPORT,
    ids: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') {
      args.apply = true
    } else if (arg === '--no-activate') {
      args.activate = false
    } else if (arg === '--no-bridge') {
      args.bridge = false
    } else if (arg === '--recent-hours' && argv[index + 1]) {
      args.recentHours = Number(argv[index + 1]) || args.recentHours
      index += 1
    } else if (arg === '--output' && argv[index + 1]) {
      args.output = argv[index + 1]
      index += 1
    } else if (arg === '--id' && argv[index + 1]) {
      args.ids.push(String(argv[index + 1]))
      index += 1
    } else if (arg === '--ids' && argv[index + 1]) {
      args.ids.push(...argv[index + 1].split(',').map(value => value.trim()).filter(Boolean))
      index += 1
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

function extractWebhookPath(nodes = []) {
  const webhookNode = nodes.find(node => /\.webhook$/i.test(String(node.type || '')) && typeof node?.parameters?.path === 'string')
  if (!webhookNode) return null
  return String(webhookNode.parameters.path || '').replace(/^\/+/, '') || null
}

function inferEventKey(workflowName = '') {
  const name = workflowName.toLowerCase()
  if (/(lead|prospect|crm|sales|deal|qualification)/.test(name)) return 'lead.qualified'
  if (/(outreach|email|whatsapp|message)/.test(name)) return 'outreach.step_due'
  if (/(content|canva|video|social|creative)/.test(name)) return 'content.requested'
  if (/(strategy|decision|seo|research|analysis)/.test(name)) return 'strategy.requested'
  if (/(monitor|alert|security|incident|anomaly)/.test(name)) return 'signal.detected'
  if (/(report|brief|digest|summary)/.test(name)) return 'agent.completed'
  return null
}

function inferAgentCodeName(eventKey) {
  switch (eventKey) {
    case 'lead.qualified':
      return 'hunter'
    case 'outreach.step_due':
      return 'outreach'
    case 'content.requested':
      return 'forge'
    case 'strategy.requested':
      return 'strategist'
    case 'signal.detected':
      return 'sentinel'
    case 'agent.completed':
      return 'scribe'
    default:
      return null
  }
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`)
  }
  return response.json()
}

async function putWorkflow(apiBase, apiKey, workflow) {
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {},
  }

  const response = await fetch(`${apiBase}/workflows/${workflow.id}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`PUT /workflows/${workflow.id} failed (${response.status}) ${text}`)
  }

  return response.json()
}

async function activateWorkflow(apiBase, apiKey, workflowId) {
  const response = await fetch(`${apiBase}/workflows/${workflowId}/activate`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`POST /workflows/${workflowId}/activate failed (${response.status}) ${text}`)
  }

  return response.json().catch(() => ({}))
}

function reconcileCredentials(nodes, credentialsByType) {
  let changed = false
  let mappedCount = 0
  const unresolved = new Set()

  const nextNodes = nodes.map(node => {
    const credentials = node.credentials || {}
    let nodeChanged = false
    const nextCredentials = { ...credentials }

    for (const [credentialType, credentialValue] of Object.entries(credentials)) {
      const current = credentialValue || {}
      const hasId = typeof current.id === 'string' && current.id.length > 0
      const hasName = typeof current.name === 'string' && current.name.length > 0
      if (hasId && hasName) continue

      const available = credentialsByType.get(credentialType) || []
      if (available.length === 1) {
        nextCredentials[credentialType] = {
          id: available[0].id,
          name: available[0].name,
        }
        mappedCount += 1
        nodeChanged = true
      } else {
        unresolved.add(credentialType)
      }
    }

    if (nodeChanged) {
      changed = true
      return {
        ...node,
        credentials: nextCredentials,
      }
    }

    return node
  })

  return {
    nodes: nextNodes,
    changed,
    mappedCount,
    unresolvedCredentialTypes: [...unresolved],
  }
}

async function upsertAutomationBridge({
  supabase,
  existingBridgesByWorkflowId,
  workflow,
  eventKey,
  webhookUrl,
  webhookPath,
  apiInjection,
  apiBase,
}) {
  const existing = existingBridgesByWorkflowId.get(String(workflow.id)) || null
  const agentCodeName = inferAgentCodeName(eventKey)

  const payload = {
    name: `n8n · ${workflow.name}`,
    description: `Auto bridge to n8n workflow ${workflow.id}`,
    trigger_type: 'event',
    trigger_config: {
      key: eventKey,
      label: eventKey,
      source: 'n8n_bridge',
    },
    steps: [
      {
        id: 'step-1',
        type: 'launch_n8n',
        config: {
          agentCodeName,
          n8nWebhookUrl: webhookUrl,
          webhookUrl,
          workflowTemplate: String(workflow.id),
          workflowTemplateLabel: workflow.name,
          workflowTemplateUrl: `https://n8n.io/workflows/${workflow.id}`,
          workflowTemplateDownloadUrl: apiBase ? `${apiBase}/workflows/${workflow.id}` : '',
          workflowTemplateSource: 'n8n_live_bridge',
          apiInjection: apiInjection || null,
        },
      },
    ],
    metadata: {
      ...(existing?.metadata || {}),
      bridge_source: 'n8n_live_bridge',
      n8n_workflow_id: String(workflow.id),
      n8n_workflow_name: workflow.name,
      n8n_webhook_path: webhookPath,
      n8n_webhook_url: webhookUrl,
      api_injection: apiInjection
        ? {
            generated_at: apiInjection.generated_at || null,
            event_key: apiInjection.event_key || eventKey,
            module_targets: apiInjection.module_targets || [],
            totals: apiInjection.totals || {},
          }
        : null,
    },
    is_active: true,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('automation_workflows')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return { mode: 'updated', row: data }
  }

  const { data, error } = await supabase
    .from('automation_workflows')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return { mode: 'created', row: data }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadEnvFile()

  const apiBase = normalizeN8nApiBase(process.env.N8N_API_URL)
  const apiKey = process.env.N8N_API_KEY
  if (!apiBase || !apiKey) {
    console.error('N8N_API_URL and N8N_API_KEY are required')
    process.exitCode = 1
    return
  }

  const webhookBase = resolveN8nWebhookBase({
    apiUrl: process.env.N8N_API_URL,
    explicitWebhookUrl: process.env.N8N_WEBHOOK_URL,
  })
  const ecosystemLayer = await loadJsonFileIfExists(DEFAULT_ECOSYSTEM_LAYER_PATH)
  const triggerPackFile = await loadJsonFileIfExists(DEFAULT_N8N_TRIGGER_PACK_PATH)
  const computedTriggerPack = ecosystemLayer
    ? buildN8nApiTriggerPack(ecosystemLayer, {
        generatedAt: new Date().toISOString(),
        source: 'reconcile-n8n-oculops',
      })
    : null
  const triggerPack = triggerPackFile || computedTriggerPack
  const headers = {
    'X-N8N-API-KEY': apiKey,
    Accept: 'application/json',
  }

  const [workflowsPayload, credentialsPayload] = await Promise.all([
    fetchJson(`${apiBase}/workflows?limit=200`, headers),
    fetchJson(`${apiBase}/credentials`, headers),
  ])

  const workflows = Array.isArray(workflowsPayload?.data) ? workflowsPayload.data : []
  const credentials = Array.isArray(credentialsPayload?.data) ? credentialsPayload.data : []

  const credentialsByType = new Map()
  for (const credential of credentials) {
    const list = credentialsByType.get(credential.type) || []
    list.push({ id: credential.id, name: credential.name })
    credentialsByType.set(credential.type, list)
  }

  const now = Date.now()
  const cutoff = now - args.recentHours * 60 * 60 * 1000

  const targetSummaries = args.ids.length > 0
    ? workflows.filter(workflow => args.ids.includes(String(workflow.id)))
    : workflows.filter(workflow => {
        const updated = workflow.updatedAt ? new Date(workflow.updatedAt).getTime() : 0
        return !workflow.active && Number.isFinite(updated) && updated >= cutoff
      })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null
  const canBridge = Boolean(args.bridge && supabaseUrl && serviceRoleKey && webhookBase)

  let supabase = null
  const existingBridgesByWorkflowId = new Map()

  if (canBridge) {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: existingRows, error } = await supabase
      .from('automation_workflows')
      .select('id,name,metadata')
      .order('updated_at', { ascending: false })
      .limit(2000)

    if (error) throw error

    for (const row of existingRows || []) {
      const workflowId = row?.metadata?.n8n_workflow_id
      if (workflowId) {
        existingBridgesByWorkflowId.set(String(workflowId), row)
      }
    }
  }

  const reportItems = []

  const allWorkflowDetails = await Promise.all(
    targetSummaries.map(summary => fetchJson(`${apiBase}/workflows/${summary.id}`, headers))
  )

  const activeCustomNodePackages = new Set()
  for (const detail of allWorkflowDetails) {
    if (!detail.active) continue
    const { customNodePackages } = extractCustomNodePackages(detail.nodes || [])
    for (const packageName of customNodePackages) {
      activeCustomNodePackages.add(packageName)
    }
  }

  for (const detail of allWorkflowDetails) {
    const originalNodes = detail.nodes || []

    const reconciled = reconcileCredentials(originalNodes, credentialsByType)

    let updated = false
    let activation = 'skipped'
    let bridge = 'skipped'
    let bridgeEvent = null
    let bridgeWebhookUrl = null
    let workflowActive = Boolean(detail.active)

    const triggers = classifyTriggers(reconciled.nodes)
    const { customNodePackages, customNodeTypes } = extractCustomNodePackages(reconciled.nodes)
    const unresolvedCommunityNodePackages = customNodePackages.filter(packageName => !activeCustomNodePackages.has(packageName))
    const webhookPath = extractWebhookPath(reconciled.nodes)
    const hasWebhook = Boolean(webhookPath)
    const hasSchedule = triggers.includes('schedule')
    const runnableNow = reconciled.unresolvedCredentialTypes.length === 0 && unresolvedCommunityNodePackages.length === 0
    const activatableNow = runnableNow && (hasWebhook || hasSchedule)

    if (reconciled.changed && args.apply) {
      await putWorkflow(apiBase, apiKey, {
        ...detail,
        nodes: reconciled.nodes,
      })
      updated = true
    }

    if (args.apply && args.activate && activatableNow && !workflowActive) {
      try {
        await activateWorkflow(apiBase, apiKey, detail.id)
        activation = 'activated'
        workflowActive = true
      } catch (error) {
        activation = `failed: ${normalizeError(error)}`
      }
    } else if (workflowActive) {
      activation = 'already_active'
    }

    if (args.apply && canBridge && workflowActive && hasWebhook) {
      const eventKey = inferEventKey(detail.name)
      if (eventKey) {
        const webhookUrl = `${webhookBase}/${webhookPath}`
        const eventPack = triggerPack?.event_packs?.[eventKey] || null
        const apiInjection = eventPack
          ? {
              generated_at: triggerPack.generated_at || null,
              source: triggerPack.source || null,
              event_key: eventKey,
              module_targets: eventPack.module_targets || [],
              totals: eventPack.totals || {},
              live_connector_entries: eventPack.live_connector_entries || [],
              open_direct_entries: eventPack.open_direct_entries || [],
              installable_entries: eventPack.installable_entries || [],
              registration_backlog_entries: eventPack.registration_backlog_entries || [],
            }
          : null
        try {
          const result = await upsertAutomationBridge({
            supabase,
            existingBridgesByWorkflowId,
            workflow: detail,
            eventKey,
            webhookUrl,
            webhookPath,
            apiInjection,
            apiBase,
          })
          bridge = result.mode
          bridgeEvent = eventKey
          bridgeWebhookUrl = webhookUrl
          existingBridgesByWorkflowId.set(String(detail.id), result.row)
        } catch (error) {
          bridge = `failed: ${normalizeError(error)}`
        }
      } else {
        bridge = 'no_event_mapping'
      }
    } else if (!canBridge && args.bridge) {
      bridge = 'disabled_missing_supabase_or_webhook_base'
    } else if (!hasWebhook) {
      bridge = 'no_webhook_trigger'
    }

    reportItems.push({
      id: detail.id,
      name: detail.name,
      updated,
      mappedCredentials: reconciled.mappedCount,
      unresolvedCredentialTypes: reconciled.unresolvedCredentialTypes,
      customNodePackages,
      customNodeTypes,
      unresolvedCommunityNodePackages,
      triggers,
      hasWebhook,
      hasSchedule,
      runnableNow,
      activatableNow,
      activation,
      bridge,
      bridgeEvent,
      bridgeWebhookUrl,
    })
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry_run',
    targetCount: reportItems.length,
    updatedCount: reportItems.filter(item => item.updated).length,
    activatedCount: reportItems.filter(item => item.activation === 'activated').length,
    bridgeCreatedCount: reportItems.filter(item => item.bridge === 'created').length,
    bridgeUpdatedCount: reportItems.filter(item => item.bridge === 'updated').length,
    runnableNowCount: reportItems.filter(item => item.runnableNow).length,
    blockedCount: reportItems.filter(item => item.unresolvedCredentialTypes.length > 0).length,
    blockedByCommunityNodesCount: reportItems.filter(item => item.unresolvedCommunityNodePackages.length > 0).length,
    unresolvedCredentialTypes: unique(reportItems.flatMap(item => item.unresolvedCredentialTypes)),
    unresolvedCommunityNodePackages: unique(reportItems.flatMap(item => item.unresolvedCommunityNodePackages)),
  }

  const report = { summary, items: reportItems }

  const outputPath = path.isAbsolute(args.output)
    ? args.output
    : path.join(ROOT_DIR, args.output)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`[reconcile-n8n-oculops] wrote ${outputPath}`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error('[reconcile-n8n-oculops] failed:', normalizeError(error))
  process.exitCode = 1
})
