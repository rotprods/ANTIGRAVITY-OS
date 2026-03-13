import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { filterN8nTemplates, summarizeN8nTemplates, sortN8nTemplates } from '../lib/n8nTemplateCatalog'

let seedCatalogPromise = null
const shardedSeedIndexUrl = `${import.meta.env.BASE_URL}n8n-template-catalog/index.json`
const shardedSeedFallbackUrl = `${import.meta.env.BASE_URL}n8n-template-catalog/full.json`

async function getSeedCatalog() {
  if (!seedCatalogPromise) {
    seedCatalogPromise = (import.meta.env.MODE === 'test'
      ? import('../data/n8nTemplateCatalog.seed.json').then(module => module.default || module)
      : (async () => {
          const indexResponse = await fetch(shardedSeedIndexUrl)
          if (!indexResponse.ok) {
            throw new Error(`Failed to load n8n shard index: ${indexResponse.status}`)
          }

          const index = await indexResponse.json()
          const baseUrl = new URL(shardedSeedIndexUrl, window.location.origin)

          const shards = await Promise.all((index.shards || []).map(async shard => {
            const shardUrl = new URL(shard.path, baseUrl).toString()
            const shardResponse = await fetch(shardUrl)
            if (!shardResponse.ok) {
              throw new Error(`Failed to load n8n shard ${shard.path}: ${shardResponse.status}`)
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
            throw new Error(`Failed to load n8n seed catalog: ${response.status}`)
          }

          return response.json()
        })
    ).catch(() => ({ entries: [], sync_run: null }))
  }

  return seedCatalogPromise
}

export function useN8nTemplateCatalog(filters = {}) {
  const [allEntries, setAllEntries] = useState([])
  const [syncRun, setSyncRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('loading')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const applySeedFallback = async (nextSyncRun = null, nextError = null) => {
      const seedCatalog = await getSeedCatalog()

      if (nextError) {
        setError(nextError)
      }

      setAllEntries(sortN8nTemplates(seedCatalog.entries || []))
      setSyncRun(nextSyncRun || seedCatalog.sync_run || null)
      setSource(seedCatalog.entries?.length ? 'seed' : 'empty')
      setLoading(false)
    }

    if (!supabase) {
      await applySeedFallback()
      return
    }

    try {
      const [entriesResult, syncResult] = await Promise.all([
        supabase
          .from('n8n_template_entries')
          .select('*')
          .eq('is_listed', true)
          .order('recent_views', { ascending: false })
          .order('total_views', { ascending: false }),
        supabase
          .from('n8n_template_sync_runs')
          .select('*')
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (entriesResult.error) throw entriesResult.error
      if (syncResult.error) throw syncResult.error

      const fetchedEntries = entriesResult.data || []

      if (fetchedEntries.length === 0) {
        await applySeedFallback(syncResult.data || null)
      } else {
        setAllEntries(sortN8nTemplates(fetchedEntries))
        setSyncRun(syncResult.data || null)
        setSource('supabase')
        setLoading(false)
      }
    } catch (err) {
      await applySeedFallback(null, err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const entries = useMemo(
    () => filterN8nTemplates(allEntries, filters),
    [allEntries, filters]
  )

  const stats = useMemo(() => {
    const summary = summarizeN8nTemplates(allEntries)
    return {
      ...summary,
      source,
    }
  }, [allEntries, source])

  const byTemplateId = useMemo(
    () => new Map(allEntries.map(entry => [String(entry.template_id), entry])),
    [allEntries]
  )

  const getByTemplateId = useCallback((templateId) => {
    if (templateId === null || templateId === undefined) return null
    return byTemplateId.get(String(templateId)) || null
  }, [byTemplateId])

  return {
    entries,
    allEntries,
    loading,
    error,
    stats,
    syncRun,
    source,
    getByTemplateId,
    reload: load,
  }
}
