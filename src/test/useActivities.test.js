import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockQueryResult, mockQueryBuilder, mockInsertRow, mockDeleteRow, mockSubscribeToTable, mockGetCurrentUserId, mockScopeUserQuery } = vi.hoisted(() => {
    const mockQueryResult = { data: [], error: null }
    const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult)),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
    }
    return {
        mockQueryResult,
        mockQueryBuilder,
        mockInsertRow: vi.fn(),
        mockDeleteRow: vi.fn(),
        mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
        mockGetCurrentUserId: vi.fn().mockResolvedValue('user-1'),
        mockScopeUserQuery: vi.fn((q) => q),
    }
})

vi.mock('../lib/supabase', () => ({
    supabase: { from: vi.fn(() => mockQueryBuilder) },
    insertRow: mockInsertRow,
    deleteRow: mockDeleteRow,
    subscribeToTable: mockSubscribeToTable,
    subscribeDebouncedToTable: mockSubscribeToTable,
    getCurrentUserId: mockGetCurrentUserId,
    scopeUserQuery: mockScopeUserQuery,
}))

import { useActivities } from '../hooks/useActivities'

const mockActivities = [
    { id: 'a1', type: 'call', note: 'Follow-up call', created_at: '2026-03-10T10:00:00Z', contact: { id: 'c1', name: 'John' }, company: null, deal: null },
    { id: 'a2', type: 'email', note: 'Sent proposal', created_at: '2026-03-09T10:00:00Z', contact: null, company: { id: 'co1', name: 'Acme' }, deal: null },
    { id: 'a3', type: 'meeting', note: 'Demo session', created_at: '2026-03-08T10:00:00Z', contact: null, company: null, deal: { id: 'd1', title: 'Alpha', stage: 'proposal' } },
]

describe('useActivities', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryResult.data = mockActivities
        mockQueryResult.error = null
    })

    it('loads activities on mount', async () => {
        const { result } = renderHook(() => useActivities())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.activities).toHaveLength(3)
        expect(result.current.activities[0].type).toBe('call')
    })

    it('scopes query to current user', async () => {
        const { result } = renderHook(() => useActivities())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockGetCurrentUserId).toHaveBeenCalled()
        expect(mockScopeUserQuery).toHaveBeenCalled()
    })

    it('addActivity calls insertRow and reloads', async () => {
        mockInsertRow.mockResolvedValueOnce({ id: 'a4', type: 'task', note: 'New task' })
        const { result } = renderHook(() => useActivities())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addActivity({ type: 'task', note: 'New task' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('crm_activities', { type: 'task', note: 'New task' })
    })

    it('removeActivity calls deleteRow', async () => {
        mockDeleteRow.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useActivities())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeActivity('a1')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('crm_activities', 'a1')
    })

    it('subscribes to realtime changes', async () => {
        const { result } = renderHook(() => useActivities())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockSubscribeToTable).toHaveBeenCalledWith('crm_activities', expect.any(Function))
    })

    it('handles query errors gracefully', async () => {
        mockQueryResult.data = null
        mockQueryResult.error = { message: 'DB error' }
        mockQueryBuilder.order.mockImplementationOnce(() => Promise.resolve(mockQueryResult))

        // The hook throws on error, which sets error state
        mockQueryBuilder.order.mockImplementationOnce(() => Promise.reject(new Error('DB error')))

        const { result } = renderHook(() => useActivities())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeTruthy()
    })
})
