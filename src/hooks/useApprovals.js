import { useCallback, useEffect, useMemo, useState } from 'react'
import { subscribeDebouncedToTable, supabase } from '../lib/supabase'
import { dispatchGovernedTool } from '../lib/controlPlane'

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired']

function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value
}

function buildStats(rows) {
    return APPROVAL_STATUSES.reduce((acc, status) => {
        acc[status] = rows.filter((row) => row.status === status).length
        return acc
    }, { all: rows.length })
}

function normalizeRows(rows) {
    return (rows || []).map((row) => ({
        ...row,
        payload: asRecord(row.payload),
    }))
}

export function useApprovals(initialStatus = 'pending') {
    const [rows, setRows] = useState([])
    const [statusFilter, setStatusFilter] = useState(initialStatus)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [busyKey, setBusyKey] = useState(null)

    const loadApprovals = useCallback(async () => {
        if (!supabase) {
            setRows([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { data, error: queryError } = await supabase
                .from('approval_requests')
                .select('*')
                .eq('agent', 'outreach')
                .eq('skill', 'messaging-dispatch')
                .order('created_at', { ascending: false })

            if (queryError) throw queryError
            setRows(normalizeRows(data))
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadApprovals()
        const channel = subscribeDebouncedToTable('approval_requests', () => loadApprovals())
        return () => channel?.unsubscribe?.()
    }, [loadApprovals])

    const resolveApproval = useCallback(async (approvalId, decision, comment = '', nextBusyKey = decision) => {
        setBusyKey(nextBusyKey)
        setError(null)

        try {
            const result = await dispatchGovernedTool({
                sourceAgent: 'outreach',
                source: 'approvals_ui',
                targetRef: 'agent-outreach',
                riskClass: 'high',
                toolCodeName: 'agent-outreach',
                payload: {
                    action: 'resolve_approval',
                    approval_id: approvalId,
                    decision,
                    comment,
                },
                context: {
                    approval_id: approvalId,
                    decision,
                },
            })
            await loadApprovals()
            return result
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setBusyKey(null)
        }
    }, [loadApprovals])

    const items = useMemo(() => {
        if (statusFilter === 'all') return rows
        return rows.filter((row) => row.status === statusFilter)
    }, [rows, statusFilter])

    const stats = useMemo(() => buildStats(rows), [rows])

    return {
        items,
        stats,
        statusFilter,
        loading,
        error,
        busyKey,
        setStatusFilter,
        approveRequest: (id, comment) => resolveApproval(id, 'approved', comment, `approve:${id}`),
        rejectRequest: (id, comment) => resolveApproval(id, 'rejected', comment, `reject:${id}`),
        reload: loadApprovals,
    }
}

export default useApprovals
