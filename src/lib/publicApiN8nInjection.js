import fs from 'node:fs/promises'
import path from 'node:path'

export const N8N_EVENT_MODULE_TARGET_MAP = {
  'lead.qualified': ['prospector'],
  'outreach.step_due': ['prospector', 'automation'],
  'content.requested': ['automation', 'knowledge'],
  'strategy.requested': ['watchtower', 'finance', 'knowledge', 'world_monitor'],
  'signal.detected': ['watchtower', 'world_monitor', 'finance'],
  'agent.completed': ['knowledge', 'automation'],
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function byPriorityThenFit(left, right) {
  const leftPriority = toNumber(left.ecosystem_profile?.integration_priority)
  const rightPriority = toNumber(right.ecosystem_profile?.integration_priority)
  if (leftPriority !== rightPriority) return rightPriority - leftPriority

  const leftFit = toNumber(left.business_fit_score)
  const rightFit = toNumber(right.business_fit_score)
  if (leftFit !== rightFit) return rightFit - leftFit

  return String(left.name || '').localeCompare(String(right.name || ''))
}

function toCompactEntry(entry) {
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
    registration_url: entry.ecosystem_profile?.registration_url || entry.docs_url,
  }
}

function matchesAnyModuleTarget(entry, moduleTargets = []) {
  const targets = entry.ecosystem_profile?.module_targets || entry.module_targets || []
  return moduleTargets.some(target => targets.includes(target))
}

function buildEventPackForModules(layer, moduleTargets = [], options = {}) {
  const entries = layer.entries || []
  const registrationBacklog = layer.registration_backlog || []

  const matchingEntries = entries
    .filter(entry => matchesAnyModuleTarget(entry, moduleTargets))
    .sort(byPriorityThenFit)

  const liveConnectorEntries = matchingEntries.filter(entry => entry.bridge_profile?.bridge_mode === 'connector_proxy')
  const openDirectEntries = matchingEntries.filter(entry => entry.ecosystem_profile?.auto_import_eligible)
  const installableEntries = matchingEntries.filter(entry => entry.bridge_profile?.bridge_mode === 'install_then_connector_proxy')
  const docsOnlyEntries = matchingEntries.filter(entry => entry.bridge_profile?.bridge_mode === 'docs_only')

  const backlogEntries = registrationBacklog
    .filter(entry => {
      const targets = entry.module_targets || []
      return moduleTargets.some(target => targets.includes(target))
    })
    .sort((left, right) => toNumber(right.integration_priority) - toNumber(left.integration_priority))

  const limits = {
    live: options.liveLimit || 25,
    open: options.openLimit || 120,
    installable: options.installableLimit || 80,
    docs: options.docsLimit || 80,
    backlog: options.backlogLimit || 120,
  }

  return {
    module_targets: moduleTargets,
    totals: {
      matching_entries: matchingEntries.length,
      live_connector: liveConnectorEntries.length,
      open_direct: openDirectEntries.length,
      installable_connector: installableEntries.length,
      docs_only: docsOnlyEntries.length,
      registration_pending: backlogEntries.length,
    },
    live_connector_entries: liveConnectorEntries.slice(0, limits.live).map(toCompactEntry),
    open_direct_entries: openDirectEntries.slice(0, limits.open).map(toCompactEntry),
    installable_entries: installableEntries.slice(0, limits.installable).map(toCompactEntry),
    docs_only_entries: docsOnlyEntries.slice(0, limits.docs).map(toCompactEntry),
    registration_backlog_entries: backlogEntries.slice(0, limits.backlog),
  }
}

export function buildN8nApiTriggerPack(layer, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString()
  const events = options.events || N8N_EVENT_MODULE_TARGET_MAP

  const eventPacks = {}
  for (const [eventKey, moduleTargets] of Object.entries(events)) {
    eventPacks[eventKey] = buildEventPackForModules(layer, moduleTargets, options)
  }

  return {
    generated_at: generatedAt,
    source: options.source || layer.source || 'ecosystem-layer',
    event_packs: eventPacks,
  }
}

export async function loadJsonFileIfExists(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}
