#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildN8nApiTriggerPack,
  writeJsonFile,
} from '../src/lib/publicApiN8nInjection.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

const ECOSYSTEM_LAYER_PATH = path.join(ROOT_DIR, 'public/public-api-catalog/ecosystem-layer.json')
const DOC_OUTPUT_PATH = path.join(ROOT_DIR, 'docs/APIs_PROYECTO.md')
const USABLE_OUTPUT_PATH = path.join(ROOT_DIR, 'reports/project-apis.usable-now.json')
const REGISTRATION_OUTPUT_PATH = path.join(ROOT_DIR, 'reports/project-apis.pending-registration.json')
const N8N_TRIGGER_PACK_PATH = path.join(ROOT_DIR, 'reports/n8n-api-trigger-pack.json')

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function byPriorityThenName(left, right) {
  const leftPriority = toNumber(left.ecosystem_profile?.integration_priority || left.integration_priority)
  const rightPriority = toNumber(right.ecosystem_profile?.integration_priority || right.integration_priority)
  if (leftPriority !== rightPriority) return rightPriority - leftPriority
  return String(left.name || '').localeCompare(String(right.name || ''))
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function toUsableEntry(entry) {
  return {
    slug: entry.slug,
    name: entry.name,
    category: entry.category,
    docs_url: entry.docs_url,
    auth_type: entry.auth_type,
    activation_tier: entry.activation_tier,
    bridge_mode: entry.bridge_profile?.bridge_mode || 'docs_only',
    executable_now: Boolean(entry.bridge_profile?.executable_now),
    integration_priority: toNumber(entry.ecosystem_profile?.integration_priority),
    module_targets: entry.ecosystem_profile?.module_targets || entry.module_targets || [],
    agent_targets: entry.ecosystem_profile?.agent_targets || entry.agent_targets || [],
    command_bindings: entry.ecosystem_profile?.command_bindings || [],
    automation_actions: entry.ecosystem_profile?.automation_actions || [],
    n8n_patterns: entry.ecosystem_profile?.n8n_patterns || [],
  }
}

function buildProjectApisMarkdown({ summary, usableEntries, pendingEntries, eventPack }) {
  const lines = []

  lines.push('# APIs de Proyecto — OCULOPS')
  lines.push('')
  lines.push(`Generado: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Resumen')
  lines.push(`- Catálogo total analizado: ${summary.total_catalog_entries}`)
  lines.push(`- APIs usables ahora (sin pago obligatorio conocido): ${usableEntries.length}`)
  lines.push(`- APIs pendientes por registro/credenciales (interesantes): ${pendingEntries.length}`)
  lines.push(`- APIs live por conector: ${summary.live_connector_entries}`)
  lines.push('')

  lines.push('## APIs usables ahora')
  lines.push('| API | Categoría | Auth | Modo | Prioridad | Docs | Módulos | Agentes |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const entry of usableEntries) {
    lines.push(`| ${entry.name} | ${entry.category} | ${entry.auth_type} | ${entry.bridge_mode} | ${entry.integration_priority} | ${entry.docs_url} | ${(entry.module_targets || []).join(', ')} | ${(entry.agent_targets || []).join(', ')} |`)
  }
  lines.push('')

  lines.push('## Pendientes de registro (interesantes)')
  lines.push('| Prioridad | API | Categoría | Auth | Registro / Docs | Módulos | Agentes |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const entry of pendingEntries) {
    lines.push(`| ${entry.integration_priority} | ${entry.name} | ${entry.category} | ${entry.auth_type} | ${entry.registration_url || entry.docs_url} | ${(entry.module_targets || []).join(', ')} | ${(entry.agent_targets || []).join(', ')} |`)
  }
  lines.push('')

  lines.push('## Inyección a n8n (trigger packs)')
  for (const [eventKey, pack] of Object.entries(eventPack.event_packs || {})) {
    lines.push(`### ${eventKey}`)
    lines.push(`- module_targets: ${(pack.module_targets || []).join(', ')}`)
    lines.push(`- matching_entries: ${pack.totals?.matching_entries || 0}`)
    lines.push(`- live_connector: ${pack.totals?.live_connector || 0}`)
    lines.push(`- open_direct: ${pack.totals?.open_direct || 0}`)
    lines.push(`- installable_connector: ${pack.totals?.installable_connector || 0}`)
    lines.push(`- registration_pending: ${pack.totals?.registration_pending || 0}`)
    lines.push('')
  }

  lines.push('## Fuentes técnicas')
  lines.push(`- ecosystem layer: ${path.relative(ROOT_DIR, ECOSYSTEM_LAYER_PATH)}`)
  lines.push(`- trigger pack: ${path.relative(ROOT_DIR, N8N_TRIGGER_PACK_PATH)}`)
  lines.push(`- usable json: ${path.relative(ROOT_DIR, USABLE_OUTPUT_PATH)}`)
  lines.push(`- pending json: ${path.relative(ROOT_DIR, REGISTRATION_OUTPUT_PATH)}`)
  lines.push('')

  return `${lines.join('\n')}\n`
}

async function main() {
  const content = await fs.readFile(ECOSYSTEM_LAYER_PATH, 'utf8')
  const layer = JSON.parse(content)

  const usableEntries = (layer.entries || [])
    .filter(entry => {
      const profile = entry.ecosystem_profile || {}
      return Boolean(profile.auto_import_eligible) || entry.bridge_profile?.bridge_mode === 'connector_proxy'
    })
    .map(toUsableEntry)
    .sort(byPriorityThenName)

  const pendingEntries = (layer.registration_backlog || [])
    .slice()
    .sort(byPriorityThenName)

  const triggerPack = buildN8nApiTriggerPack(layer, {
    generatedAt: new Date().toISOString(),
    source: 'project-apis-builder',
  })

  await Promise.all([
    writeJsonFile(USABLE_OUTPUT_PATH, usableEntries),
    writeJsonFile(REGISTRATION_OUTPUT_PATH, pendingEntries),
    writeJsonFile(N8N_TRIGGER_PACK_PATH, triggerPack),
  ])

  const markdown = buildProjectApisMarkdown({
    summary: layer.summary || {},
    usableEntries,
    pendingEntries,
    eventPack: triggerPack,
  })

  await fs.mkdir(path.dirname(DOC_OUTPUT_PATH), { recursive: true })
  await fs.writeFile(DOC_OUTPUT_PATH, markdown, 'utf8')

  console.log('[build-project-apis] completed')
  console.log(JSON.stringify({
    total_catalog_entries: layer.summary?.total_catalog_entries || 0,
    usable_now: usableEntries.length,
    pending_registration: pendingEntries.length,
    doc: DOC_OUTPUT_PATH,
    usable_json: USABLE_OUTPUT_PATH,
    pending_json: REGISTRATION_OUTPUT_PATH,
    trigger_pack: N8N_TRIGGER_PACK_PATH,
  }, null, 2))
}

main().catch(error => {
  console.error('[build-project-apis] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
