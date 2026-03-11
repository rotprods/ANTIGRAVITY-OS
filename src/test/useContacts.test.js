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
    getCurrentUserId: vi.fn(async () => 'test-user-id'),
    scopeUserQuery: vi.fn((q) => q),
}))

import { useContacts } from '../hooks/useContacts'

const mockContactData = [
    { id: '1', name: 'Alice', email: 'alice@test.com', created_at: '2026-01-01' },
    { id: '2', name: 'Bob', email: 'bob@test.com', created_at: '2026-01-02' },
]

describe('useContacts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryResult.data = mockContactData
        mockQueryResult.error = null
        mockQueryBuilder.order.mockImplementation(() => Promise.resolve(mockQueryResult))
        mockInsertRow.mockResolvedValue({ id: '3', name: 'New' })
        mockUpdateRow.mockResolvedValue({ id: '1', name: 'Updated' })
        mockDeleteRow.mockResolvedValue(true)
    })

    it('loads contacts on mount', async () => {
        const { result } = renderHook(() => useContacts())

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.contacts).toEqual(mockContactData)
        expect(result.current.error).toBeNull()
    })

    it('addContact calls insertRow and reloads', async () => {
        const { result } = renderHook(() => useContacts())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addContact({ name: 'Charlie' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('contacts', { name: 'Charlie' })
    })

    it('updateContact calls updateRow', async () => {
        const { result } = renderHook(() => useContacts())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updateContact('1', { name: 'Alice Updated' })
        })

        expect(mockUpdateRow).toHaveBeenCalledWith('contacts', '1', { name: 'Alice Updated' })
    })

    it('removeContact calls deleteRow', async () => {
        const { result } = renderHook(() => useContacts())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeContact('1')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('contacts', '1')
    })

    it('subscribes to realtime on mount', async () => {
        renderHook(() => useContacts())
        await waitFor(() => expect(mockSubscribeToTable).toHaveBeenCalledWith('contacts', expect.any(Function)))
    })
})
