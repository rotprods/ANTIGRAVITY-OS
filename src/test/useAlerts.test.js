import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockFetchAll, mockInsertRow, mockUpdateRow, mockSubscribeToTable } = vi.hoisted(() => ({
    mockFetchAll: vi.fn(),
    mockInsertRow: vi.fn(),
    mockUpdateRow: vi.fn(),
    mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

vi.mock('../lib/supabase', () => ({
    fetchAll: mockFetchAll,
    insertRow: mockInsertRow,
    updateRow: mockUpdateRow,
    subscribeToTable: mockSubscribeToTable,
}))

import { useAlerts } from '../hooks/useAlerts'

const mockAlerts = [
    { id: 'a1', title: 'API rate limit warning', status: 'active', severity: 4, created_at: '2026-03-10' },
    { id: 'a2', title: 'Agent HUNTER offline', status: 'active', severity: 3, created_at: '2026-03-09' },
    { id: 'a3', title: 'Pipeline stale 7d', status: 'active', severity: 1, created_at: '2026-03-08' },
    { id: 'a4', title: 'DB migration applied', status: 'resolved', severity: 2, resolved_at: '2026-03-07', created_at: '2026-03-06' },
]

describe('useAlerts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchAll.mockResolvedValue(mockAlerts)
    })

    it('loads alerts via fetchAll', async () => {
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockFetchAll).toHaveBeenCalledWith('alerts', {})
        expect(result.current.alerts).toHaveLength(4)
    })

    it('computes active alerts', async () => {
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.active).toHaveLength(3)
    })

    it('computes resolved alerts', async () => {
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.resolved).toHaveLength(1)
        expect(result.current.resolved[0].id).toBe('a4')
    })

    it('computes critical alerts (severity >= 3)', async () => {
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.critical).toHaveLength(2) // a1 (4) + a2 (3)
    })

    it('addAlert calls insertRow with active status and prepends', async () => {
        const newAlert = { id: 'a5', title: 'New alert', status: 'active', severity: 2 }
        mockInsertRow.mockResolvedValueOnce(newAlert)
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addAlert({ title: 'New alert', severity: 2 })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('alerts', { title: 'New alert', severity: 2, status: 'active' })
        expect(result.current.alerts[0].id).toBe('a5')
    })

    it('resolveAlert calls updateRow with resolved status and timestamp', async () => {
        const resolved = { ...mockAlerts[0], status: 'resolved', resolved_at: '2026-03-11T00:00:00.000Z' }
        mockUpdateRow.mockResolvedValueOnce(resolved)
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.resolveAlert('a1')
        })

        expect(mockUpdateRow).toHaveBeenCalledWith('alerts', 'a1', expect.objectContaining({
            status: 'resolved',
            resolved_at: expect.any(String),
        }))
        expect(result.current.alerts.find(a => a.id === 'a1').status).toBe('resolved')
    })

    it('subscribes to realtime changes', async () => {
        renderHook(() => useAlerts())
        expect(mockSubscribeToTable).toHaveBeenCalledWith('alerts', expect.any(Function))
    })

    it('handles empty alerts gracefully', async () => {
        mockFetchAll.mockResolvedValueOnce([])
        const { result } = renderHook(() => useAlerts())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.active).toHaveLength(0)
        expect(result.current.resolved).toHaveLength(0)
        expect(result.current.critical).toHaveLength(0)
    })
})
