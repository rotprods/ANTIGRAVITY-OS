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
    subscribeDebouncedToTable: mockSubscribeToTable,
    getCurrentUserId: mockGetCurrentUserId,
    scopeUserQuery: mockScopeUserQuery,
}))

import { useLeads } from '../hooks/useLeads'

const mockRawLeads = [
    { id: 'l1', business_name: 'Cafe Madrid', contact_name: 'Ana', email: 'ana@cafe.es', ai_score: 85, ai_reasoning: 'High engagement', source: 'atlas', status: 'qualified', created_at: '2026-03-10' },
    { id: 'l2', business_name: 'Dental Plus', contact_name: 'Carlos', email: null, ai_score: 60, ai_reasoning: null, source: 'hunter', status: 'raw', created_at: '2026-03-09' },
    { id: 'l3', name: 'Pet Shop Luna', email: 'luna@pets.es', score: 40, category: 'e-commerce', source: 'gtm', status: 'raw', created_at: '2026-03-08' },
]

describe('useLeads', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryResult.data = mockRawLeads
        mockQueryResult.error = null
    })

    it('loads and normalizes leads on mount', async () => {
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.leads).toHaveLength(3)
        // normalizeLead should populate .company and .confidence
        expect(result.current.leads[0].company).toBe('Cafe Madrid')
        expect(result.current.leads[0].confidence).toBe(85)
    })

    it('normalizes leads with fallback fields', async () => {
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))
        // l3 has no business_name, falls back to .name
        expect(result.current.leads[2].company).toBe('Pet Shop Luna')
        // l3 has .score instead of .ai_score
        expect(result.current.leads[2].confidence).toBe(40)
        // l3 has .category as buySignal fallback
        expect(result.current.leads[2].buySignal).toBe('e-commerce')
    })

    it('scopes query to current user', async () => {
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockGetCurrentUserId).toHaveBeenCalled()
        expect(mockScopeUserQuery).toHaveBeenCalled()
    })

    it('addLead calls insertRow with mapped payload', async () => {
        mockInsertRow.mockResolvedValueOnce({ id: 'l4', business_name: 'New Biz', ai_score: 70 })
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addLead({ name: 'New Biz', confidence: 70, source: 'gtm' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('prospector_leads', expect.objectContaining({
            business_name: 'New Biz',
            ai_score: 70,
            source: 'gtm',
        }))
    })

    it('updateLead calls updateRow with partial mapping', async () => {
        mockUpdateRow.mockResolvedValueOnce({ ...mockRawLeads[0], status: 'converted' })
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updateLead('l1', { status: 'converted' })
        })

        expect(mockUpdateRow).toHaveBeenCalledWith('prospector_leads', 'l1', expect.objectContaining({
            status: 'converted',
        }))
    })

    it('removeLead calls deleteRow', async () => {
        mockDeleteRow.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeLead('l2')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('prospector_leads', 'l2')
    })

    it('subscribes to realtime changes', async () => {
        renderHook(() => useLeads())
        expect(mockSubscribeToTable).toHaveBeenCalledWith('prospector_leads', expect.any(Function))
    })

    it('handles query error gracefully', async () => {
        mockQueryBuilder.order.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
        const { result } = renderHook(() => useLeads())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe('Network error')
        expect(result.current.leads).toHaveLength(0)
    })
})
