import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockQueryResult, mockQueryBuilder, mockInsertRow, mockUpdateRow, mockDeleteRow, mockSubscribeToTable, mockGetCurrentUserId, mockScopeUserQuery } = vi.hoisted(() => {
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
        mockUpdateRow: vi.fn(),
        mockDeleteRow: vi.fn(),
        mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
        mockGetCurrentUserId: vi.fn().mockResolvedValue('user-1'),
        mockScopeUserQuery: vi.fn((q) => q),
    }
})

vi.mock('../lib/supabase', () => ({
    supabase: { from: vi.fn(() => mockQueryBuilder) },
    insertRow: mockInsertRow,
    updateRow: mockUpdateRow,
    deleteRow: mockDeleteRow,
    subscribeToTable: mockSubscribeToTable,
    getCurrentUserId: mockGetCurrentUserId,
    scopeUserQuery: mockScopeUserQuery,
}))

import { useCompanies } from '../hooks/useCompanies'

const mockCompanies = [
    { id: 'c1', name: 'Madrid Lab', website: 'madridlab.es', industry: 'tech', created_at: '2026-03-10' },
    { id: 'c2', name: 'Petimetre', website: 'petimetre.com', industry: 'fashion', created_at: '2026-03-09' },
    { id: 'c3', name: 'Cafe de Paris', website: null, industry: 'hospitality', created_at: '2026-03-08' },
]

describe('useCompanies', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryResult.data = mockCompanies
        mockQueryResult.error = null
    })

    it('loads companies on mount', async () => {
        const { result } = renderHook(() => useCompanies())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.companies).toHaveLength(3)
        expect(result.current.companies[0].name).toBe('Madrid Lab')
    })

    it('scopes query to current user', async () => {
        const { result } = renderHook(() => useCompanies())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockGetCurrentUserId).toHaveBeenCalled()
        expect(mockScopeUserQuery).toHaveBeenCalled()
    })

    it('addCompany calls insertRow and reloads', async () => {
        mockInsertRow.mockResolvedValueOnce({ id: 'c4', name: 'New Corp' })
        const { result } = renderHook(() => useCompanies())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addCompany({ name: 'New Corp', website: 'newcorp.com' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('companies', { name: 'New Corp', website: 'newcorp.com' })
    })

    it('updateCompany calls updateRow and reloads', async () => {
        mockUpdateRow.mockResolvedValueOnce({ ...mockCompanies[0], industry: 'saas' })
        const { result } = renderHook(() => useCompanies())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updateCompany('c1', { industry: 'saas' })
        })

        expect(mockUpdateRow).toHaveBeenCalledWith('companies', 'c1', { industry: 'saas' })
    })

    it('removeCompany calls deleteRow and reloads', async () => {
        mockDeleteRow.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useCompanies())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeCompany('c2')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('companies', 'c2')
    })

    it('subscribes to realtime changes', async () => {
        renderHook(() => useCompanies())
        expect(mockSubscribeToTable).toHaveBeenCalledWith('companies', expect.any(Function))
    })

    it('handles query error gracefully', async () => {
        mockQueryBuilder.order.mockImplementationOnce(() => Promise.reject(new Error('Connection lost')))
        const { result } = renderHook(() => useCompanies())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe('Connection lost')
        expect(result.current.companies).toHaveLength(0)
    })
})
