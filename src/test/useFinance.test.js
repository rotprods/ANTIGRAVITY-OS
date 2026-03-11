import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockFetchAll, mockInsertRow, mockDeleteRow, mockSubscribeToTable } = vi.hoisted(() => ({
    mockFetchAll: vi.fn(),
    mockInsertRow: vi.fn(),
    mockDeleteRow: vi.fn(),
    mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

vi.mock('../lib/supabase', () => ({
    fetchAll: mockFetchAll,
    insertRow: mockInsertRow,
    deleteRow: mockDeleteRow,
    subscribeToTable: mockSubscribeToTable,
    subscribeDebouncedToTable: mockSubscribeToTable,
}))

import { useFinance } from '../hooks/useFinance'

const mockEntries = [
    { id: 'f1', type: 'revenue', amount: '5000', description: 'Client A retainer', is_recurring: true, created_at: '2026-03-01' },
    { id: 'f2', type: 'revenue', amount: '2000', description: 'Project B', is_recurring: false, created_at: '2026-03-05' },
    { id: 'f3', type: 'expense', amount: '800', description: 'OpenAI API', is_recurring: true, created_at: '2026-03-02' },
    { id: 'f4', type: 'expense', amount: '200', description: 'Hosting', is_recurring: false, created_at: '2026-03-03' },
]

describe('useFinance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchAll.mockResolvedValue(mockEntries)
    })

    it('loads entries via fetchAll', async () => {
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockFetchAll).toHaveBeenCalledWith('finance_entries', {})
        expect(result.current.entries).toHaveLength(4)
    })

    it('computes totalRevenue correctly', async () => {
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.totalRevenue).toBe(7000) // 5000 + 2000
    })

    it('computes totalExpenses correctly', async () => {
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.totalExpenses).toBe(1000) // 800 + 200
    })

    it('computes netIncome correctly', async () => {
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.netIncome).toBe(6000) // 7000 - 1000
    })

    it('computes MRR from recurring revenue only', async () => {
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.mrr).toBe(5000) // only f1 is recurring revenue
    })

    it('addEntry calls insertRow and prepends optimistically', async () => {
        const newEntry = { id: 'f5', type: 'revenue', amount: '3000', description: 'New client' }
        mockInsertRow.mockResolvedValueOnce(newEntry)
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addEntry({ type: 'revenue', amount: '3000', description: 'New client' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('finance_entries', { type: 'revenue', amount: '3000', description: 'New client' })
        expect(result.current.entries[0].id).toBe('f5')
    })

    it('removeEntry calls deleteRow and removes optimistically', async () => {
        mockDeleteRow.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeEntry('f3')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('finance_entries', 'f3')
        expect(result.current.entries.find(e => e.id === 'f3')).toBeUndefined()
    })

    it('subscribes to realtime changes', async () => {
        renderHook(() => useFinance())
        expect(mockSubscribeToTable).toHaveBeenCalledWith('finance_entries', expect.any(Function))
    })

    it('handles missing amount gracefully', async () => {
        mockFetchAll.mockResolvedValueOnce([
            { id: 'f1', type: 'revenue', amount: null, is_recurring: false },
            { id: 'f2', type: 'expense', amount: undefined, is_recurring: false },
        ])
        const { result } = renderHook(() => useFinance())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.totalRevenue).toBe(0)
        expect(result.current.totalExpenses).toBe(0)
        expect(result.current.netIncome).toBe(0)
    })
})
