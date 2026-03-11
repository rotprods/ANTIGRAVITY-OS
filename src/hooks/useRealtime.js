// ═══════════════════════════════════════════════════
// OCULOPS — useRealtime Hook
// Generic real-time subscription for any Supabase table
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Generic real-time hook for any Supabase table.
 * @param {string} table - Table name
 * @param {object} options
 * @param {object} options.filters - Key-value filters for the query
 * @param {string} options.orderBy - Column to order by (default: 'created_at')
 * @param {boolean} options.ascending - Sort order (default: false = newest first)
 * @param {number} options.limit - Max rows to fetch
 * @returns {{ data, loading, error, refetch, insert, update, remove }}
 */
export function useRealtime(table, options = {}) {
    const { filters = {}, orderBy = 'created_at', ascending = false, limit } = options
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const channelRef = useRef(null)
    const filtersKey = JSON.stringify(filters)

    const fetchData = useCallback(async () => {
        if (!supabase) {
            setLoading(false)
            return
        }
        try {
            const activeFilters = JSON.parse(filtersKey)
            let query = supabase.from(table).select('*')
            Object.entries(activeFilters).forEach(([key, value]) => {
                query = query.eq(key, value)
            })
            query = query.order(orderBy, { ascending })
            if (limit) query = query.limit(limit)

            const { data: rows, error: err } = await query
            if (err) throw err
            setData(rows || [])
            setError(null)
        } catch (err) {
            if (import.meta.env.DEV) console.error(`[useRealtime] ${table}:`, err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [table, filtersKey, orderBy, ascending, limit])

    // Initial fetch + realtime subscription
    useEffect(() => {
        fetchData()

        if (!supabase) return

        const channel = supabase
            .channel(`rt_${table}_${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table,
            }, (payload) => {
                // Optimistic local update
                if (payload.eventType === 'INSERT') {
                    setData(prev => ascending
                        ? [...prev, payload.new]
                        : [payload.new, ...prev]
                    )
                } else if (payload.eventType === 'UPDATE') {
                    setData(prev => prev.map(row =>
                        row.id === payload.new.id ? payload.new : row
                    ))
                } else if (payload.eventType === 'DELETE') {
                    setData(prev => prev.filter(row => row.id !== payload.old.id))
                }
            })
            .subscribe()

        channelRef.current = channel
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
            }
        }
    }, [ascending, fetchData, table])

    // CRUD helpers
    const insert = useCallback(async (row) => {
        if (!supabase) return null
        const { data: inserted, error: err } = await supabase.from(table).insert(row).select().single()
        if (err) { if (import.meta.env.DEV) console.error(`[insert] ${table}:`, err); return null }
        return inserted
    }, [table])

    const update = useCallback(async (id, updates) => {
        if (!supabase) return null
        const { data: updated, error: err } = await supabase.from(table).update(updates).eq('id', id).select().single()
        if (err) { if (import.meta.env.DEV) console.error(`[update] ${table}:`, err); return null }
        return updated
    }, [table])

    const remove = useCallback(async (id) => {
        if (!supabase) return false
        const { error: err } = await supabase.from(table).delete().eq('id', id)
        if (err) { if (import.meta.env.DEV) console.error(`[remove] ${table}:`, err); return false }
        return true
    }, [table])

    return { data, loading, error, refetch: fetchData, insert, update, remove }
}
