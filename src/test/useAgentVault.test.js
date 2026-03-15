import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockAgentDefs, mockDispatchGovernedTool, mockSupabase } = vi.hoisted(() => {
    const mockAgentDefs = [
        { id: '1', code_name: 'atlas-scraper', display_name: 'Atlas Scraper', namespace: 'research', description: 'Research scraper', is_active: true, total_runs: 10, tags: [] },
        { id: '2', code_name: 'data-pipeline', display_name: 'Data Pipeline', namespace: 'data', description: 'Data processing', is_active: true, total_runs: 5, tags: [] },
        { id: '3', code_name: 'product-owl', display_name: 'Product Owl', namespace: 'product', description: 'Product strategy', is_active: true, total_runs: 3, tags: [] },
        { id: '4', code_name: 'sentinel-guard', display_name: 'Sentinel Guard', namespace: 'security', description: 'Security auditor', is_active: false, total_runs: 1, tags: [] },
    ]

    function createQueryBuilder(data) {
        const builder = {
            select: vi.fn(() => builder),
            order: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            update: vi.fn(() => builder),
            then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
        }
        return builder
    }

    const mockSupabase = {
        from: vi.fn(() => createQueryBuilder(mockAgentDefs)),
    }

    return {
        mockAgentDefs,
        mockDispatchGovernedTool: vi.fn(async () => ({ success: true })),
        mockSupabase,
    }
})

vi.mock('../lib/supabase', () => ({
    supabase: mockSupabase,
    isSupabaseConfigured: true,
}))

vi.mock('../lib/controlPlane', () => ({
    dispatchGovernedTool: mockDispatchGovernedTool,
}))

import { useAgentVault, ROLE_CAPABILITY_MAP } from '../hooks/useAgentVault'

function createQueryBuilder(data) {
    const builder = {
        select: vi.fn(() => builder),
        order: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        update: vi.fn(() => builder),
        then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
    }
    return builder
}

describe('useAgentVault', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSupabase.from.mockImplementation(() => createQueryBuilder(mockAgentDefs))
        mockDispatchGovernedTool.mockResolvedValue({ success: true })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('loads agents from Supabase agent_definitions', async () => {
        const { result } = renderHook(() => useAgentVault())

        expect(result.current.loading).toBe(true)

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.allAgents).toHaveLength(4)
        expect(result.current.totalAgents).toBe(4)
        expect(result.current.canonicalCount).toBe(4)
    })

    it('returns all agents when no filters applied', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.filteredAgents).toHaveLength(4)
    })

    it('filters by namespace', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setNamespace('research'))

        expect(result.current.filteredAgents).toHaveLength(1)
        expect(result.current.filteredAgents[0].namespace).toBe('research')
    })

    it('filters by search text against code_name', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setSearch('atlas'))

        expect(result.current.filteredAgents).toHaveLength(1)
        expect(result.current.filteredAgents[0].code_name).toBe('atlas-scraper')
    })

    it('filters by role using ROLE_CAPABILITY_MAP namespaces', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setRole('sentinel'))

        // sentinel maps to ['security', 'testing', 'infra']
        // sentinel-guard has namespace 'security' — matches
        const names = result.current.filteredAgents.map(a => a.code_name)
        expect(names).toContain('sentinel-guard')
    })

    it('suggestRole returns best matching role for agent namespace', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        const role = result.current.suggestRole({ namespace: 'security' })
        expect(role).toBe('sentinel')
    })

    it('suggestRole returns null for unrecognized namespace', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        const role = result.current.suggestRole({ namespace: 'unknown-namespace-xyz' })
        expect(role).toBeNull()
    })

    it('handles Supabase error gracefully', async () => {
        mockSupabase.from.mockImplementation(() => {
            const builder = {
                select: vi.fn(() => builder),
                order: vi.fn(() => builder),
                then: (resolve, reject) => Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve, reject),
            }
            return builder
        })

        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.error).toBeTruthy()
        expect(result.current.allAgents).toHaveLength(0)
    })

    it('returns namespaces derived from loaded agents', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.namespaces).toContain('research')
        expect(result.current.namespaces).toContain('data')
        expect(result.current.namespaces).toContain('product')
        expect(result.current.namespaces).toContain('security')
    })

    it('runs agents through control-plane agent-runner', async () => {
        const { result } = renderHook(() => useAgentVault())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.runAgent('atlas-scraper', 'Find prospects', { niche: 'restaurants' })
        })

        expect(mockDispatchGovernedTool).toHaveBeenCalledWith({
            sourceAgent: 'copilot',
            source: 'agent_vault_ui',
            targetRef: 'agent-runner',
            riskClass: 'medium',
            toolCodeName: 'agent-runner',
            functionName: 'agent-runner',
            payload: {
                agent: 'atlas-scraper',
                goal: 'Find prospects',
                context: { niche: 'restaurants' },
            },
            context: {
                requested_agent: 'atlas-scraper',
                goal: 'Find prospects',
            },
        })
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

    it('each role has array of namespaces', () => {
        Object.values(ROLE_CAPABILITY_MAP).forEach(namespaces => {
            expect(Array.isArray(namespaces)).toBe(true)
            expect(namespaces.length).toBeGreaterThan(0)
        })
    })
})
