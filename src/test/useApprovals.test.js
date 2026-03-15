import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockQueryResult, mockQueryBuilder, mockDispatchGovernedTool, mockSubscribeToTable } = vi.hoisted(() => {
    const mockQueryResult = { data: [], error: null }
    const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult)),
    }

    return {
        mockQueryResult,
        mockQueryBuilder,
        mockDispatchGovernedTool: vi.fn(),
        mockSubscribeToTable: vi.fn(() => ({ unsubscribe: vi.fn() })),
    }
})

vi.mock('../lib/supabase', () => ({
    supabase: { from: vi.fn(() => mockQueryBuilder) },
    subscribeDebouncedToTable: mockSubscribeToTable,
}))

vi.mock('../lib/controlPlane', () => ({
    dispatchGovernedTool: mockDispatchGovernedTool,
}))

import { useApprovals } from '../hooks/useApprovals'

const mockApprovals = [
    { id: 'a1', agent: 'outreach', skill: 'messaging-dispatch', status: 'pending', urgency: 'high', payload: { outreach_queue_id: 'q1', recipient_email: 'one@example.com' }, created_at: '2026-03-12T10:00:00.000Z', expires_at: '2026-03-12T10:30:00.000Z' },
    { id: 'a2', agent: 'outreach', skill: 'messaging-dispatch', status: 'approved', urgency: 'medium', payload: { outreach_queue_id: 'q2', recipient_email: 'two@example.com' }, created_at: '2026-03-12T11:00:00.000Z', expires_at: '2026-03-12T11:30:00.000Z' },
]

describe('useApprovals', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryResult.data = mockApprovals
        mockQueryResult.error = null
        mockDispatchGovernedTool.mockResolvedValue({ ok: true, sent: true })
    })

    it('loads approvals and computes stats', async () => {
        const { result } = renderHook(() => useApprovals('pending'))

        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.items).toHaveLength(1)
        expect(result.current.items[0].id).toBe('a1')
        expect(result.current.stats.pending).toBe(1)
        expect(result.current.stats.approved).toBe(1)
        expect(result.current.stats.rejected).toBe(0)
    })

    it('subscribes to approvals realtime updates', async () => {
        renderHook(() => useApprovals())
        await waitFor(() => expect(mockSubscribeToTable).toHaveBeenCalled())
        expect(mockSubscribeToTable).toHaveBeenCalledWith('approval_requests', expect.any(Function))
    })

    it('approveRequest resolves via control-plane and reloads', async () => {
        const { result } = renderHook(() => useApprovals())
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => {
            await result.current.approveRequest('a1', 'Ship it')
        })

        expect(mockDispatchGovernedTool).toHaveBeenCalledWith({
            sourceAgent: 'outreach',
            source: 'approvals_ui',
            targetRef: 'agent-outreach',
            riskClass: 'high',
            toolCodeName: 'agent-outreach',
            payload: {
                action: 'resolve_approval',
                approval_id: 'a1',
                decision: 'approved',
                comment: 'Ship it',
            },
            context: {
                approval_id: 'a1',
                decision: 'approved',
            },
        })
        expect(mockQueryBuilder.order).toHaveBeenCalledTimes(2)
    })
})
