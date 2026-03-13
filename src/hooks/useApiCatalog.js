import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, insertRow } from '../lib/supabase'
import {
  computeActivationTier,
  filterCatalogEntries,
  getAgentTargetsForEntry,
  mergeCatalogEntriesWithConnectors,
  summarizeCatalog,
} from '../lib/publicApiCatalog.js'
import {
  buildCatalogMiniApp,
  buildConnectorInstallPayload,
  getTemplateByCatalogSlug,
} from '../lib/publicApiConnectorTemplates.js'

let seedCatalogPromise = null
const shardedSeedIndexUrl = `${import.meta.env.BASE_URL}public-api-catalog/index.json`
const shardedSeedFallbackUrl = `${import.meta.env.BASE_URL}public-api-catalog/full.json`

function decorateEntry(entry) {
  const agentTargets = getAgentTargetsForEntry(entry)

  return {
    ...entry,
    module_targets: entry.module_targets || [],
    agent_targets: entry.agent_targets?.length ? entry.agent_targets : agentTargets,
    tags: [...new Set([...(entry.tags || []), ...agentTargets])],
  }
}

async function getSeedCatalog() {
  if (!seedCatalogPromise) {
    seedCatalogPromise = (import.meta.env.MODE === 'test'
      ? import('../data/publicApiCatalog.seed.json').then(module => module.default || module)
      : (async () => {
          const indexResponse = await fetch(shardedSeedIndexUrl)
          if (!indexResponse.ok) {
            throw new Error(`Failed to load shard index: ${indexResponse.status}`)
          }

          const index = await indexResponse.json()
          const baseUrl = new URL(shardedSeedIndexUrl, window.location.origin)
          const shards = await Promise.all((index.shards || []).map(async shard => {
            const shardUrl = new URL(shard.path, baseUrl).toString()
            const shardResponse = await fetch(shardUrl)

            if (!shardResponse.ok) {
              throw new Error(`Failed to load shard ${shard.path}: ${shardResponse.status}`)
            }

            return shardResponse.json()
          }))

          return {
            ...index,
            entries: shards.flatMap(shard => shard.entries || []),
          }
        })().catch(async () => {
          const response = await fetch(shardedSeedFallbackUrl)
          if (!response.ok) {
            throw new Error(`Failed to load seed catalog: ${response.status}`)
          }

          return response.json()
        })
    )
      .catch(() => ({ entries: [], sync_run: null }))
  }

  return seedCatalogPromise
}

function applyConnectorState(entries, connectors) {
  const merged = mergeCatalogEntriesWithConnectors(entries.map(decorateEntry), connectors)

  return merged.map(entry => {
    if (!entry.is_installed) {
      return {
        ...entry,
        activation_tier: computeActivationTier(entry, {
          adapterReadySlugs: new Set(
            merged
              .filter(candidate => candidate.activation_tier === 'adapter_ready' || candidate.activation_tier === 'live')
              .map(candidate => candidate.slug)
          ),
        }),
      }
    }

    return {
      ...entry,
      activation_tier: entry.health_status === 'live' ? 'live' : entry.activation_tier,
    }
  })
}

export function useApiCatalog(filters = {}) {
  const [allEntries, setAllEntries] = useState([])
  const [connectors, setConnectors] = useState([])
  const [syncRun, setSyncRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('loading')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const applySeedFallback = async (nextConnectors = [], nextSyncRun = null, nextError = null) => {
      const seedCatalog = await getSeedCatalog()

      if (nextError) {
        setError(nextError)
      }

      setAllEntries((seedCatalog.entries || []).map(decorateEntry))
      setConnectors(nextConnectors)
      setSyncRun(nextSyncRun || seedCatalog.sync_run || null)
      setSource(seedCatalog.entries?.length ? 'seed' : 'empty')
      setLoading(false)
    }

    if (!supabase) {
      await applySeedFallback()
      return
    }

    try {
      const [entriesResult, connectorsResult, syncResult] = await Promise.all([
        supabase
          .from('api_catalog_entries')
          .select('*')
          .eq('is_listed', true)
          .order('business_fit_score', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('api_connectors')
          .select('id,catalog_slug,template_key,normalizer_key,capabilities,health_status,last_healthcheck_at,last_synced_at,metadata,created_at,is_active')
          .not('catalog_slug', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('api_catalog_sync_runs')
          .select('*')
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (entriesResult.error) throw entriesResult.error
      if (connectorsResult.error) throw connectorsResult.error
      if (syncResult.error) throw syncResult.error

      const fetchedEntries = entriesResult.data || []
      const fetchedConnectors = connectorsResult.data || []

      if (fetchedEntries.length === 0) {
        await applySeedFallback(fetchedConnectors, syncResult.data || null)
      } else {
        setAllEntries(fetchedEntries.map(decorateEntry))
        setConnectors(fetchedConnectors)
        setSyncRun(syncResult.data || null)
        setSource('supabase')
        setLoading(false)
      }
    } catch (err) {
      await applySeedFallback([], null, err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const entriesWithConnectorState = useMemo(
    () => applyConnectorState(allEntries, connectors),
    [allEntries, connectors]
  )

  const entries = useMemo(
    () => filterCatalogEntries(entriesWithConnectorState, filters),
    [entriesWithConnectorState, filters]
  )

  const stats = useMemo(() => {
    const summary = summarizeCatalog(entriesWithConnectorState)
    const installedCount = connectors.length
    const liveCount = connectors.filter(connector => connector.health_status === 'live').length

    return {
      ...summary,
      installedCount,
      liveCount,
      source,
    }
  }, [connectors, entriesWithConnectorState, source])

  const adapterReadyEntries = useMemo(
    () => entriesWithConnectorState.filter(entry => entry.activation_tier === 'adapter_ready' && !entry.is_installed),
    [entriesWithConnectorState]
  )

  const installedApps = useMemo(
    () => connectors
      .map(connector => {
        const entry = entriesWithConnectorState.find(candidate => candidate.slug === connector.catalog_slug)
        if (!entry) return null
        return buildCatalogMiniApp(entry, {
          connector,
          template: getTemplateByCatalogSlug(entry.slug),
        })
      })
      .filter(Boolean),
    [connectors, entriesWithConnectorState]
  )

  const installConnector = useCallback(async (entryOrSlug) => {
    const slug = typeof entryOrSlug === 'string' ? entryOrSlug : entryOrSlug?.slug
    const entry = entriesWithConnectorState.find(candidate => candidate.slug === slug)
    if (!entry) return { error: 'Catalog entry not found' }

    if (entry.activation_tier !== 'adapter_ready') {
      return { error: 'Only adapter-ready catalog entries can be installed' }
    }

    const existing = connectors.find(connector => connector.catalog_slug === slug)
    if (existing) return { data: existing, existing: true }

    const template = getTemplateByCatalogSlug(slug)
    if (!template || template.internalOnly) {
      return { error: 'No installable connector template for this API' }
    }

    if (!supabase) {
      return { error: 'Supabase is not configured, connector install is disabled' }
    }

    const payload = buildConnectorInstallPayload(entry, template)
    const result = await insertRow('api_connectors', payload)
    if (!result) return { error: 'Failed to create connector' }

    setConnectors(prev => [result, ...prev])
    return { data: result, existing: false }
  }, [connectors, entriesWithConnectorState])

  return {
    entries,
    loading,
    error,
    stats,
    syncRun,
    source,
    connectors,
    installedApps,
    adapterReadyEntries,
    installConnector,
    reload: load,
  }
}
