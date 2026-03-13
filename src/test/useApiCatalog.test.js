import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockInsertRow = vi.fn()

function createThenableResult(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    not: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
  }
  return builder
}

function createSupabaseMock({ entries, connectors, syncRun, failEntries = false }) {
  return {
    from: (table) => {
      if (table === 'api_catalog_entries') {
        if (failEntries) {
          return createThenableResult({ data: null, error: { message: 'entries failed' } })
        }
        return createThenableResult({ data: entries, error: null })
      }
      if (table === 'api_connectors') {
        return createThenableResult({ data: connectors, error: null })
      }
      if (table === 'api_catalog_sync_runs') {
        return createThenableResult({ data: syncRun, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

async function loadHookModule({ supabaseMock, seedData }) {
  vi.resetModules()
  vi.doMock('../lib/supabase', () => ({
    supabase: supabaseMock,
    insertRow: mockInsertRow,
  }))
  vi.doMock('../data/publicApiCatalog.seed.json', () => ({
    default: seedData,
  }))
  return import('../hooks/useApiCatalog')
}

describe('useApiCatalog fallback order', () => {
  beforeEach(() => {
    mockInsertRow.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads from Supabase first when data is available', async () => {
    const supabase = createSupabaseMock({
      entries: [{
        slug: 'finance-fred-fred-stlouisfed-org',
        name: 'FRED',
        category: 'Finance',
        docs_url: 'https://fred.stlouisfed.org/docs/api/fred/',
        description: 'Macro indicators',
        auth_type: 'api_key',
        https_only: true,
        cors_policy: 'Unknown',
        module_targets: ['finance', 'world_monitor'],
        agent_targets: ['strategist', 'cortex'],
        tags: ['finance'],
        business_fit_score: 75,
        activation_tier: 'adapter_ready',
        is_listed: true,
      }],
      connectors: [],
      syncRun: { id: 'sync-1', status: 'completed' },
    })

    const { useApiCatalog } = await loadHookModule({
      supabaseMock: supabase,
      seedData: { entries: [], sync_run: null },
    })

    const { result } = renderHook(() => useApiCatalog({}))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.source).toBe('supabase')
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].name).toBe('FRED')
  })

  it('falls back to seed data when Supabase fails', async () => {
    const supabase = createSupabaseMock({
      entries: [],
      connectors: [],
      syncRun: null,
      failEntries: true,
    })

    const seedData = {
      entries: [{
        slug: 'weather-open-meteo-open-meteo-com',
        name: 'Open-Meteo',
        category: 'Weather',
        docs_url: 'https://open-meteo.com/',
        description: 'Forecast API',
        auth_type: 'none',
        https_only: true,
        cors_policy: 'Unknown',
        module_targets: ['watchtower', 'world_monitor'],
        agent_targets: ['atlas', 'cortex'],
        tags: ['weather'],
        business_fit_score: 65,
        activation_tier: 'adapter_ready',
        is_listed: true,
      }],
      sync_run: { id: 'seed-sync' },
    }

    const { useApiCatalog } = await loadHookModule({
      supabaseMock: supabase,
      seedData,
    })

    const { result } = renderHook(() => useApiCatalog({}))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.source).toBe('seed')
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].name).toBe('Open-Meteo')
  })

  it('returns empty-state when both Supabase and seed are unavailable', async () => {
    const supabase = createSupabaseMock({
      entries: [],
      connectors: [],
      syncRun: null,
      failEntries: true,
    })

    const { useApiCatalog } = await loadHookModule({
      supabaseMock: supabase,
      seedData: { entries: [], sync_run: null },
    })

    const { result } = renderHook(() => useApiCatalog({}))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.source).toBe('empty')
    expect(result.current.entries).toHaveLength(0)
    expect(result.current.stats.entryCount).toBe(0)
  })

  it('blocks installs for non adapter-ready entries', async () => {
    const supabase = createSupabaseMock({
      entries: [{
        slug: 'weather-candidate',
        name: 'Weather Candidate',
        category: 'Weather',
        docs_url: 'https://example.com/weather',
        description: 'Candidate only',
        auth_type: 'none',
        https_only: true,
        cors_policy: 'Unknown',
        module_targets: ['watchtower'],
        agent_targets: ['atlas'],
        tags: ['weather'],
        business_fit_score: 65,
        activation_tier: 'candidate',
        is_listed: true,
      }],
      connectors: [],
      syncRun: { id: 'sync-2', status: 'completed' },
    })

    const { useApiCatalog } = await loadHookModule({
      supabaseMock: supabase,
      seedData: { entries: [], sync_run: null },
    })

    const { result } = renderHook(() => useApiCatalog({}))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const install = await result.current.installConnector('weather-candidate')
    expect(install.error).toMatch(/Only adapter-ready/i)
    expect(mockInsertRow).not.toHaveBeenCalled()
  })
})
