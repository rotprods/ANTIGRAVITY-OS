import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockQueryResult, mockQueryBuilder, mockInsertRow, mockUpdateRow, mockDeleteRow, mockSubscribeToTable } = vi.hoisted(() => {
    const mockQueryResult = { data: [], error: null }
    const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult)),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    }
    return {
        mockQueryResult,
        mockQueryBuilder,
        mockInsertRow: vi.fn(),
        mockUpdateRow: vi.fn(),
        mockDeleteRow: vi.fn(),
        mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
    }
})

vi.mock('../lib/supabase', () => ({
    supabase: { from: vi.fn(() => mockQueryBuilder), auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'test-user-id' } } })) } },
    isSupabaseConfigured: true,
    insertRow: mockInsertRow,
    updateRow: mockUpdateRow,
    deleteRow: mockDeleteRow,
    subscribeToTable: mockSubscribeToTable,
    subscribeDebouncedToTable: mockSubscribeToTable,
    getCurrentUserId: vi.fn(async () => 'test-user-id'),
    scopeUserQuery: vi.fn((q) => q),
}))

import { useDeals } from '../hooks/useDeals'

const mockDeals = [
    { id: '1', title: 'Deal A', stage: 'lead', value: '5000', probability: 30, created_at: '2026-01-01' },
    { id: '2', title: 'Deal B', stage: 'proposal', value: '10000', probability: 60, created_at: '2026-01-02' },
    { id: '3', title: 'Deal C', stage: 'lead', value: '2000', probability: 20, created_at: '2026-01-03' },
]

describe('useDeals', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryResult.data = mockDeals
        mockQueryResult.error = null
        mockInsertRow.mockResolvedValue({ id: '4', title: 'New Deal' })
        mockUpdateRow.mockResolvedValue({ id: '1', stage: 'proposal' })
        mockDeleteRow.mockResolvedValue(true)
    })

    it('loads deals and computes totalValue', async () => {
        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.deals).toHaveLength(3)
        expect(result.current.totalValue).toBe(17000)
    })

    it('computes weightedValue correctly', async () => {
        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        // 5000*0.3 + 10000*0.6 + 2000*0.2 = 1500 + 6000 + 400 = 7900
        expect(result.current.weightedValue).toBe(7900)
    })

    it('groups deals by stage in pipelineView', async () => {
        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.pipelineView.lead).toHaveLength(2)
        expect(result.current.pipelineView.proposal).toHaveLength(1)
    })

    it('addDeal calls insertRow', async () => {
        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addDeal({ title: 'New Deal', value: '3000' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('deals', { title: 'New Deal', value: '3000' })
    })

    it('updateDeal calls updateRow', async () => {
        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updateDeal('1', { stage: 'proposal' })
        })

        expect(mockUpdateRow).toHaveBeenCalledWith('deals', '1', { stage: 'proposal' })
    })

    it('removeDeal calls deleteRow', async () => {
        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeDeal('1')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('deals', '1')
    })

    it('handles deals with missing value gracefully', async () => {
        mockQueryResult.data = [{ id: '1', title: 'No Value', stage: 'lead', created_at: '2026-01-01' }]

        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.totalValue).toBe(0)
        expect(result.current.weightedValue).toBe(0)
    })

    it('handles deals with missing stage in pipelineView', async () => {
        mockQueryResult.data = [{ id: '1', title: 'No Stage', created_at: '2026-01-01' }]

        const { result } = renderHook(() => useDeals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.pipelineView.lead).toHaveLength(1)
    })
})
