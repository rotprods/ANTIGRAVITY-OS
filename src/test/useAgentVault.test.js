import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgentVault, ROLE_CAPABILITY_MAP } from '../hooks/useAgentVault'

const mockManifest = {
    total_agents: 5,
    canonical_count: 4,
    namespaces: ['research', 'product', 'data'],
    agents: [
        { name: 'atlas-scraper', namespace: 'research', capabilities: ['research', 'web-scraping'], is_alias: false },
        { name: 'data-pipeline', namespace: 'data', capabilities: ['data-engineering', 'ml-ai'], is_alias: false },
        { name: 'product-owl', namespace: 'product', capabilities: ['product', 'orchestration'], is_alias: false },
        { name: 'sentinel-guard', namespace: 'research', capabilities: ['security', 'code-review'], is_alias: false },
        { name: 'alias-agent', namespace: 'research', capabilities: ['research'], is_alias: true },
    ],
}

describe('useAgentVault', () => {
    beforeEach(() => {
        // Mock fetch to return manifest
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(mockManifest) })
        ))
        // Ensure no Electron API
        delete window.electronAPI
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('loads manifest from fetch', async () => {
        const { result } = renderHook(() => useAgentVault())

        expect(result.current.loading).toBe(true)

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.manifest).toEqual(mockManifest)
        expect(result.current.totalAgents).toBe(5)
        expect(result.current.canonicalCount).toBe(4)
    })

    it('filters out aliases from agents list', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.agents).toHaveLength(4)
        expect(result.current.agents.find(a => a.is_alias)).toBeUndefined()
    })

    it('filters by namespace', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setNamespace('research'))

        expect(result.current.filteredAgents).toHaveLength(2)
        expect(result.current.filteredAgents.every(a => a.namespace === 'research')).toBe(true)
    })

    it('filters by search text', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setSearch('atlas'))

        expect(result.current.filteredAgents).toHaveLength(1)
        expect(result.current.filteredAgents[0].name).toBe('atlas-scraper')
    })

    it('filters by role using capability mapping', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setRole('sentinel'))

        // sentinel maps to ['security', 'research', 'code-review']
        // sentinel-guard has ['security', 'code-review'] — matches
        // atlas-scraper has ['research', 'web-scraping'] — matches ('research')
        const names = result.current.filteredAgents.map(a => a.name)
        expect(names).toContain('sentinel-guard')
        expect(names).toContain('atlas-scraper')
    })

    it('suggestRole returns best matching role', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        const role = result.current.suggestRole({ capabilities: ['security', 'code-review', 'research'] })
        expect(role).toBe('sentinel')
    })

    it('suggestRole returns null for agent with no matching capabilities', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        const role = result.current.suggestRole({ capabilities: ['unknown-cap'] })
        expect(role).toBeNull()
    })

    it('handles fetch failure gracefully', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })))

        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.error).toBeTruthy()
        expect(result.current.agents).toHaveLength(0)
    })

    it('returns namespaces from manifest', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.namespaces).toEqual(['research', 'product', 'data'])
    })
})

describe('ROLE_CAPABILITY_MAP', () => {
    it('has expected roles', () => {
        expect(ROLE_CAPABILITY_MAP).toHaveProperty('atlas')
        expect(ROLE_CAPABILITY_MAP).toHaveProperty('hunter')
        expect(ROLE_CAPABILITY_MAP).toHaveProperty('oracle')
        expect(ROLE_CAPABILITY_MAP).toHaveProperty('sentinel')
        expect(ROLE_CAPABILITY_MAP).toHaveProperty('cortex')
    })

    it('each role has array of capabilities', () => {
        Object.values(ROLE_CAPABILITY_MAP).forEach(caps => {
            expect(Array.isArray(caps)).toBe(true)
            expect(caps.length).toBeGreaterThan(0)
        })
    })
})
