import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockFetchAll, mockInsertRow, mockUpdateRow, mockDeleteRow, mockSubscribeToTable } = vi.hoisted(() => ({
    mockFetchAll: vi.fn(),
    mockInsertRow: vi.fn(),
    mockUpdateRow: vi.fn(),
    mockDeleteRow: vi.fn(),
    mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

vi.mock('../lib/supabase', () => ({
    fetchAll: mockFetchAll,
    insertRow: mockInsertRow,
    updateRow: mockUpdateRow,
    deleteRow: mockDeleteRow,
    subscribeToTable: mockSubscribeToTable,
    subscribeDebouncedToTable: mockSubscribeToTable,
}))

import { useTasks } from '../hooks/useTasks'

const mockTasks = [
    { id: 't1', title: 'Setup CRM', status: 'done', priority: 'high', day: 1, created_at: '2026-03-01' },
    { id: 't2', title: 'Deploy agents', status: 'in_progress', priority: 'high', day: 2, created_at: '2026-03-02' },
    { id: 't3', title: 'Write tests', status: 'pending', priority: 'medium', day: null, created_at: '2026-03-03' },
    { id: 't4', title: 'Review docs', status: 'done', priority: 'low', day: 3, created_at: '2026-03-04' },
]

describe('useTasks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchAll.mockResolvedValue(mockTasks)
    })

    it('loads tasks via fetchAll', async () => {
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(mockFetchAll).toHaveBeenCalledWith('tasks', {})
        expect(result.current.tasks).toHaveLength(4)
    })

    it('groups tasks byStatus', async () => {
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.byStatus.done).toHaveLength(2)
        expect(result.current.byStatus.in_progress).toHaveLength(1)
        expect(result.current.byStatus.pending).toHaveLength(1)
    })

    it('computes completionRate', async () => {
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.completionRate).toBe(50) // 2/4 = 50%
    })

    it('computes currentDay from max done day', async () => {
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.currentDay).toBe(3) // max(1, 3) from done tasks
    })

    it('addTask calls insertRow and prepends', async () => {
        const newTask = { id: 't5', title: 'New task', status: 'pending' }
        mockInsertRow.mockResolvedValueOnce(newTask)
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.addTask({ title: 'New task' })
        })

        expect(mockInsertRow).toHaveBeenCalledWith('tasks', { title: 'New task' })
        expect(result.current.tasks[0].id).toBe('t5')
    })

    it('updateTask calls updateRow and patches in place', async () => {
        const updated = { ...mockTasks[1], status: 'done' }
        mockUpdateRow.mockResolvedValueOnce(updated)
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.updateTask('t2', { status: 'done' })
        })

        expect(mockUpdateRow).toHaveBeenCalledWith('tasks', 't2', { status: 'done' })
        expect(result.current.tasks.find(t => t.id === 't2').status).toBe('done')
    })

    it('removeTask calls deleteRow and removes', async () => {
        mockDeleteRow.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.removeTask('t3')
        })

        expect(mockDeleteRow).toHaveBeenCalledWith('tasks', 't3')
        expect(result.current.tasks.find(t => t.id === 't3')).toBeUndefined()
    })

    it('subscribes to realtime changes', async () => {
        renderHook(() => useTasks())
        expect(mockSubscribeToTable).toHaveBeenCalledWith('tasks', expect.any(Function))
    })

    it('handles tasks with missing status gracefully', async () => {
        mockFetchAll.mockResolvedValueOnce([
            { id: 't1', title: 'No status', created_at: '2026-03-01' },
        ])
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.byStatus.pending).toHaveLength(1)
        expect(result.current.completionRate).toBe(0)
    })
})
