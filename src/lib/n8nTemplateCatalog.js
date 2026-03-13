const MODULE_KEYWORD_MAP = {
  prospector: ['lead', 'prospect', 'crm', 'sales', 'contact', 'linkedin', 'enrich'],
  watchtower: ['monitor', 'alert', 'incident', 'security', 'uptime', 'ops'],
  finance: ['finance', 'invoice', 'billing', 'payment', 'accounting', 'stripe'],
  automation: ['automation', 'workflow', 'integrate', 'sync', 'webhook', 'trigger'],
  knowledge: ['knowledge', 'document', 'rag', 'research', 'notion', 'sheet', 'database'],
  world_monitor: ['market', 'news', 'weather', 'macro', 'stock', 'economy', 'geo'],
}

const AGENT_HINT_MAP = {
  atlas: ['market', 'research', 'intel', 'trend', 'competitor', 'prospect'],
  hunter: ['lead', 'sales', 'crm', 'enrich', 'prospect', 'qualify'],
  strategist: ['strategy', 'analysis', 'decision', 'forecast', 'planning'],
  cortex: ['orchestration', 'automation', 'agent', 'workflow', 'multi-agent'],
  outreach: ['email', 'whatsapp', 'outreach', 'campaign', 'follow-up', 'message'],
  sentinel: ['monitor', 'alert', 'incident', 'security', 'ops', 'anomaly'],
  forge: ['content', 'social', 'creative', 'copy', 'publish'],
  oracle: ['analytics', 'report', 'insight', 'finance', 'kpi'],
  scribe: ['report', 'summary', 'document', 'brief'],
  herald: ['telegram', 'notification', 'digest'],
}

const ACTION_RULES = [
  { key: 'trigger_webhook', pattern: /(webhook|trigger)/i },
  { key: 'fetch_api', pattern: /(httprequest|graphql|rest|api\b)/i },
  { key: 'ai_inference', pattern: /(openai|anthropic|gemini|cohere|mistral|langchain|llm|ai\b|agent)/i },
  { key: 'send_email', pattern: /(gmail|email|outlook|mailchimp|sendgrid)/i },
  { key: 'send_message', pattern: /(slack|telegram|discord|twilio|whatsapp|teams|mattermost)/i },
  { key: 'sync_data', pattern: /(airtable|sheets|excel|notion|postgres|mysql|mongodb|supabase|redis|snowflake)/i },
  { key: 'file_ops', pattern: /(drive|dropbox|onedrive|s3|box|ftp|file)/i },
  { key: 'crm_sales', pattern: /(hubspot|salesforce|pipedrive|zoho|crm|deal|lead)/i },
  { key: 'transform_or_route', pattern: /(if|switch|merge|set|code|function|loop|wait|filter|split)/i },
]

function sanitizeText(value) {
  return String(value || '').trim()
}

export function slugify(value) {
  return sanitizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function toArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeNodeType(rawName) {
  const name = sanitizeText(rawName)
  if (!name) return ''
  const withoutPrefix = name
    .replace(/^n8n-nodes-base\./i, '')
    .replace(/^n8n-nodes-langchain\./i, 'langchain-')
    .replace(/^n8n-nodes-/, '')

  return withoutPrefix
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .toLowerCase()
}

function normalizeSkillTag(raw) {
  const base = sanitizeText(raw).toLowerCase()
  if (!base) return ''

  return base
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function extractNodeSkillTags(node) {
  const codex = node?.codex?.data || {}
  const alias = toArray(codex.alias)
  const categories = toArray(codex.categories)
  const subcategories = Object.values(codex.subcategories || {}).flatMap(value => toArray(value))
  const nodeCategories = toArray(node?.nodeCategories).map(category => category?.name || category)

  return unique([
    ...alias,
    ...categories,
    ...subcategories,
    ...nodeCategories,
    node?.displayName,
    node?.name,
  ].map(normalizeSkillTag)).filter(Boolean)
}

function extractActionKeys(nodeTypes) {
  const keys = new Set()
  for (const nodeType of nodeTypes) {
    for (const rule of ACTION_RULES) {
      if (rule.pattern.test(nodeType)) {
        keys.add(rule.key)
      }
    }
  }

  return [...keys]
}

function deriveTargets(payloadText) {
  const text = payloadText.toLowerCase()
  const moduleTargets = []
  const agentTargets = []

  for (const [moduleName, keywords] of Object.entries(MODULE_KEYWORD_MAP)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      moduleTargets.push(moduleName)
    }
  }

  for (const [agentName, keywords] of Object.entries(AGENT_HINT_MAP)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      agentTargets.push(agentName)
    }
  }

  if (moduleTargets.length === 0) {
    moduleTargets.push('automation')
  }

  return {
    moduleTargets: unique(moduleTargets),
    agentTargets: unique(agentTargets),
  }
}

function computeInstallTier(entry) {
  if (!entry.is_installable) return 'catalog_only'
  if (entry.author_verified && entry.recent_views >= 50) return 'priority'
  if (entry.total_views >= 1000) return 'priority'
  return 'install_ready'
}

export function normalizeN8nWorkflowTemplate(rawWorkflow) {
  const id = Number(rawWorkflow?.id)
  const name = sanitizeText(rawWorkflow?.name)

  if (!Number.isFinite(id) || !name) {
    return null
  }

  const nodes = toArray(rawWorkflow?.nodes)
  const nodeTypes = unique(nodes.map(node => normalizeNodeType(node?.name))).filter(Boolean).slice(0, 20)
  const skillTags = unique(nodes.flatMap(extractNodeSkillTags)).filter(Boolean).slice(0, 24)
  const actionKeys = extractActionKeys(nodeTypes).slice(0, 12)

  const payloadText = [
    name,
    ...nodeTypes,
    ...skillTags,
    sanitizeText(rawWorkflow?.user?.username),
  ].join(' ')

  const { moduleTargets, agentTargets } = deriveTargets(payloadText)

  const totalViews = Number(rawWorkflow?.totalViews || 0)
  const recentViews = Number(rawWorkflow?.recentViews || 0)
  const hasPrice = rawWorkflow?.price !== null && rawWorkflow?.price !== undefined
  const isInstallable = !hasPrice

  const slugBase = slugify(name) || `template-${id}`

  const entry = {
    template_id: id,
    slug: `n8n-${id}-${slugBase}`,
    name,
    description: null,
    author_username: sanitizeText(rawWorkflow?.user?.username) || null,
    author_verified: Boolean(rawWorkflow?.user?.verified),
    total_views: Number.isFinite(totalViews) ? totalViews : 0,
    recent_views: Number.isFinite(recentViews) ? recentViews : 0,
    price: hasPrice ? String(rawWorkflow.price) : null,
    purchase_url: sanitizeText(rawWorkflow?.purchaseUrl) || null,
    ready_to_demo: Boolean(rawWorkflow?.readyToDemo),
    page_url: `https://n8n.io/workflows/${id}`,
    api_url: `https://api.n8n.io/templates/workflows/${id}`,
    node_types: nodeTypes,
    action_keys: actionKeys,
    skill_tags: skillTags,
    module_targets: moduleTargets,
    agent_targets: agentTargets,
    is_installable: isInstallable,
    install_tier: 'catalog_only',
    raw_source: {
      id,
      author: sanitizeText(rawWorkflow?.user?.username) || null,
      verified_author: Boolean(rawWorkflow?.user?.verified),
      node_count: nodes.length,
      has_price: hasPrice,
    },
    is_listed: true,
  }

  entry.install_tier = computeInstallTier(entry)

  return entry
}

export function sortN8nTemplates(entries = []) {
  return [...entries].sort((left, right) => {
    const tierScore = {
      priority: 3,
      install_ready: 2,
      catalog_only: 1,
    }

    const tierDelta = (tierScore[right.install_tier] || 0) - (tierScore[left.install_tier] || 0)
    if (tierDelta !== 0) return tierDelta

    const recentDelta = (right.recent_views || 0) - (left.recent_views || 0)
    if (recentDelta !== 0) return recentDelta

    const totalDelta = (right.total_views || 0) - (left.total_views || 0)
    if (totalDelta !== 0) return totalDelta

    return left.name.localeCompare(right.name)
  })
}

export function filterN8nTemplates(entries = [], filters = {}) {
  const search = sanitizeText(filters.search).toLowerCase()
  const installTier = sanitizeText(filters.installTier)
  const moduleTarget = sanitizeText(filters.moduleTarget)
  const agentTarget = sanitizeText(filters.agentTarget)
  const installableOnly = Boolean(filters.installableOnly)
  const limit = Number(filters.limit || 0)

  const filtered = entries.filter(entry => {
    if (installableOnly && !entry.is_installable) return false
    if (installTier && entry.install_tier !== installTier) return false
    if (moduleTarget && !entry.module_targets?.includes(moduleTarget)) return false
    if (agentTarget && !entry.agent_targets?.includes(agentTarget)) return false

    if (!search) return true

    const haystack = [
      entry.name,
      entry.slug,
      entry.author_username,
      ...(entry.node_types || []),
      ...(entry.action_keys || []),
      ...(entry.skill_tags || []),
      ...(entry.module_targets || []),
      ...(entry.agent_targets || []),
    ].join(' ').toLowerCase()

    return haystack.includes(search)
  })

  const sorted = sortN8nTemplates(filtered)
  return limit > 0 ? sorted.slice(0, limit) : sorted
}

export function summarizeN8nTemplates(entries = []) {
  const installReady = entries.filter(entry => entry.install_tier === 'install_ready').length
  const priority = entries.filter(entry => entry.install_tier === 'priority').length
  const installable = entries.filter(entry => entry.is_installable).length

  const moduleCounts = {}
  const agentCounts = {}
  for (const entry of entries) {
    for (const moduleTarget of entry.module_targets || []) {
      moduleCounts[moduleTarget] = (moduleCounts[moduleTarget] || 0) + 1
    }
    for (const agentTarget of entry.agent_targets || []) {
      agentCounts[agentTarget] = (agentCounts[agentTarget] || 0) + 1
    }
  }

  return {
    total: entries.length,
    installable,
    installReady,
    priority,
    moduleCounts,
    agentCounts,
  }
}

export function buildN8nTemplateCatalogSnapshot({ workflows = [], syncedAt = new Date().toISOString() } = {}) {
  const normalized = workflows
    .map(normalizeN8nWorkflowTemplate)
    .filter(Boolean)

  const entries = sortN8nTemplates(normalized)
  const stats = summarizeN8nTemplates(entries)

  return {
    generated_at: syncedAt,
    source: 'n8n/template-catalog',
    sync_run: {
      source_url: 'https://api.n8n.io/templates/workflows',
      total_workflows: workflows.length,
      synced_at: syncedAt,
    },
    stats,
    entries,
  }
}

export function toN8nTemplateOption(entry) {
  if (!entry) return null
  return {
    value: String(entry.template_id),
    label: `#${entry.template_id} · ${entry.name}`,
    pageUrl: entry.page_url,
    downloadUrl: entry.api_url,
    source: 'n8n_catalog',
    moduleTargets: entry.module_targets || [],
    actionKeys: entry.action_keys || [],
    skillTags: entry.skill_tags || [],
    installTier: entry.install_tier,
    installable: Boolean(entry.is_installable),
    templateId: entry.template_id,
  }
}
