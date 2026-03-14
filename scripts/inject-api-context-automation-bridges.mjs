#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DEFAULT_TRIGGER_PACK = path.join(ROOT_DIR, 'reports/n8n-api-trigger-pack.json')
const DEFAULT_REPORT = path.join(ROOT_DIR, 'reports/n8n-api-context-injection.json')

function parseArgs(argv = []) {
  const args = {
    apply: false,
    triggerPack: DEFAULT_TRIGGER_PACK,
    output: DEFAULT_REPORT,
    limit: 2000,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--apply') {
      args.apply = true
    } else if (arg === '--trigger-pack' && argv[i + 1]) {
      args.triggerPack = argv[i + 1]
      i += 1
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[i + 1]
      i += 1
    } else if (arg === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[i + 1]) || args.limit
      i += 1
    }
  }

  return args
}

async function loadEnvFileAt(filePath, { override = false } = {}) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const [key, ...rest] = line.split('=')
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
      const envKey = key.trim()
      if (override || !process.env[envKey]) {
        process.env[envKey] = value
      }
    }
  } catch {
    // optional
  }
}

async function loadEnv() {
  await loadEnvFileAt(path.join(ROOT_DIR, '.env'))
  await loadEnvFileAt(path.join(ROOT_DIR, 'supabase/.env.deploy'), { override: true })
}

function asText(value) {
  if (typeof value === 'string') return value.trim()
  return String(value || '').trim()
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function inferEventKey(workflow = {}, availableEventKeys = []) {
  const trigger = asRecord(workflow.trigger_config)
  const byTrigger = asText(trigger.key)
  if (byTrigger && availableEventKeys.includes(byTrigger)) return byTrigger

  const name = asText(workflow.name).toLowerCase()
  if (/(lead|prospect|crm|sales|deal|qualification)/.test(name)) return 'lead.qualified'
  if (/(outreach|email|whatsapp|message)/.test(name)) return 'outreach.step_due'
  if (/(content|canva|video|social|creative)/.test(name)) return 'content.requested'
  if (/(strategy|decision|seo|research|analysis)/.test(name)) return 'strategy.requested'
  if (/(monitor|alert|security|incident|anomaly)/.test(name)) return 'signal.detected'
  if (/(cortex|orchestration|loop|cron|scheduler|daily|weekly)/.test(name)) return 'agent.completed'
  if (/(report|brief|digest|summary)/.test(name)) return 'agent.completed'
  return null
}

function buildApiInjection(triggerPack, eventKey) {
  const eventPack = triggerPack?.event_packs?.[eventKey]
  if (!eventPack) return null

  return {
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
}

function patchStepsWithInjection(steps = [], apiInjection) {
  let changed = false
  const patched = (Array.isArray(steps) ? steps : []).map((step) => {
    if (asText(step?.type) !== 'launch_n8n') return step
    const currentConfig = asRecord(step.config)
    const nextConfig = {
      ...currentConfig,
      apiInjection,
    }

    const same = JSON.stringify(currentConfig.apiInjection || null) === JSON.stringify(apiInjection || null)
    if (!same) changed = true

    return {
      ...step,
      config: nextConfig,
    }
  })

  return {
    changed,
    steps: patched,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await loadEnv()

  const triggerPackPath = path.isAbsolute(args.triggerPack)
    ? args.triggerPack
    : path.join(ROOT_DIR, args.triggerPack)
  const triggerPack = JSON.parse(await fs.readFile(triggerPackPath, 'utf8'))
  const availableEventKeys = Object.keys(triggerPack?.event_packs || {})

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: workflows, error } = await supabase
    .from('automation_workflows')
    .select('id,name,trigger_config,steps,metadata,is_active,updated_at')
    .order('updated_at', { ascending: false })
    .limit(args.limit)

  if (error) throw error

  const rows = []

  for (const workflow of workflows || []) {
    const currentMetadata = asRecord(workflow.metadata)
    const hasLaunchN8nStep = (workflow.steps || []).some(step => asText(step?.type) === 'launch_n8n')
    const isN8nBridge =
      hasLaunchN8nStep ||
      asText(currentMetadata.bridge_source) === 'n8n_live_bridge' ||
      asText(currentMetadata.n8n_workflow_id) !== ''

    if (!isN8nBridge) {
      const cleanupMetadata = { ...currentMetadata }
      const hadInjection = Object.prototype.hasOwnProperty.call(cleanupMetadata, 'api_injection')
      if (hadInjection) {
        delete cleanupMetadata.api_injection
      }

      rows.push({
        id: workflow.id,
        name: workflow.name,
        event_key: null,
        has_launch_n8n_step: false,
        injected: false,
        totals: null,
        updated: args.apply ? hadInjection : false,
        dry_run_would_update: !args.apply && hadInjection,
      })

      if (args.apply && hadInjection) {
        const { error: cleanupError } = await supabase
          .from('automation_workflows')
          .update({ metadata: cleanupMetadata })
          .eq('id', workflow.id)

        if (cleanupError) {
          rows[rows.length - 1].update_error = cleanupError.message || String(cleanupError)
        }
      }

      continue
    }

    const eventKey = inferEventKey(workflow, availableEventKeys)
    const apiInjection = eventKey ? buildApiInjection(triggerPack, eventKey) : null
    const patchedSteps = patchStepsWithInjection(workflow.steps, apiInjection)

    const nextMetadata = {
      ...currentMetadata,
      api_injection: apiInjection
        ? {
            generated_at: apiInjection.generated_at,
            event_key: apiInjection.event_key,
            module_targets: apiInjection.module_targets,
            totals: apiInjection.totals,
          }
        : null,
    }

    const metadataChanged = JSON.stringify(currentMetadata.api_injection || null) !== JSON.stringify(nextMetadata.api_injection || null)
    const needsUpdate = patchedSteps.changed || metadataChanged

    rows.push({
      id: workflow.id,
      name: workflow.name,
      event_key: eventKey,
      has_launch_n8n_step: hasLaunchN8nStep,
      injected: Boolean(apiInjection),
      totals: apiInjection?.totals || null,
      updated: args.apply ? needsUpdate : false,
      dry_run_would_update: !args.apply && needsUpdate,
    })

    if (!args.apply || !needsUpdate) continue

    const { error: updateError } = await supabase
      .from('automation_workflows')
      .update({
        steps: patchedSteps.steps,
        metadata: nextMetadata,
      })
      .eq('id', workflow.id)

    if (updateError) {
      rows[rows.length - 1].update_error = updateError.message || String(updateError)
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry_run',
    trigger_pack: triggerPackPath,
    summary: {
      workflows_scanned: rows.length,
      with_launch_n8n_step: rows.filter(row => row.has_launch_n8n_step).length,
      with_event_mapping: rows.filter(row => row.event_key).length,
      injected_profiles: rows.filter(row => row.injected).length,
      updated: rows.filter(row => row.updated).length,
      dry_run_would_update: rows.filter(row => row.dry_run_would_update).length,
      failed_updates: rows.filter(row => row.update_error).length,
    },
    rows,
  }

  const outputPath = path.isAbsolute(args.output) ? args.output : path.join(ROOT_DIR, args.output)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log('[inject-api-context-automation-bridges] completed')
  console.log(JSON.stringify(report.summary, null, 2))
  console.log(`report: ${outputPath}`)
}

main().catch((error) => {
  console.error('[inject-api-context-automation-bridges] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
