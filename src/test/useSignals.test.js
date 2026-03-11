import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import { useSignals } from '../hooks/useSignals'
import { fetchAll, insertRow, updateRow, deleteRow, subscribeToTable } from '../lib/supabase'

const mockSignals = [
    { id: '1', title: 'Meta API Change', category: 'tech', status: 'active', created_at: '2026-01-01' },
    { id: '2', title: 'TikTok Shop EU', category: 'market', status: 'active', created_at: '2026-01-02' },
    { id: '3', title: 'Old Signal', category: 'tech', status: 'archived', created_at: '2025-06-01' },
]

describe('useSignals', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fetchAll.mockResolvedValue(mockSignals)
    })

    it('loads signals via fetchAll', async () => {
        const { result } = renderHook(() => useSignals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.signals).toHaveLength(3)
        expect(fetchAll).toHaveBeenCalledWith('signals', {})
    })

    it('groups by category', async () => {
        const { result } = renderHook(() => useSignals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.byCategory.tech).toHaveLength(2)
        expect(result.current.byCategory.market).toHaveLength(1)
    })

    it('filters activeSignals', async () => {
        const { result } = renderHook(() => useSignals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.activeSignals).toHaveLength(2)
        expect(result.current.activeSignals.every(s => s.status === 'active')).toBe(true)
    })

    it('addSignal calls insertRow and prepends optimistically', async () => {
        const newSignal = { title: 'New Signal', category: 'market' }
        insertRow.mockResolvedValueOnce({ id: '4', ...newSignal })

        const { result } = renderHook(() => useSignals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addSignal(newSignal)
        })

        expect(insertRow).toHaveBeenCalledWith('signals', newSignal)
        expect(result.current.signals[0].id).toBe('4')
    })

    it('updateSignal calls updateRow and updates locally', async () => {
        updateRow.mockResolvedValueOnce({ id: '1', title: 'Updated', category: 'tech', status: 'active' })

        const { result } = renderHook(() => useSignals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updateSignal('1', { title: 'Updated' })
        })

        expect(updateRow).toHaveBeenCalledWith('signals', '1', { title: 'Updated' })
    })

    it('removeSignal calls deleteRow and removes locally', async () => {
        deleteRow.mockResolvedValueOnce(true)

        const { result } = renderHook(() => useSignals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeSignal('1')
        })

        expect(deleteRow).toHaveBeenCalledWith('signals', '1')
        expect(result.current.signals.find(s => s.id === '1')).toBeUndefined()
    })

    it('subscribes to realtime on mount', async () => {
        renderHook(() => useSignals())
        await waitFor(() => expect(subscribeToTable).toHaveBeenCalledWith('signals', expect.any(Function)))
    })
})
