// ═══════════════════════════════════════════════════
// OCULOPS — useEdgeFunction Hook
// Generic hook to call any Supabase Edge Function
// ═══════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react'
import { callSupabaseFunction } from '../lib/supabase'

/**
 * Generic hook to call any Supabase Edge Function.
 * @param {string} functionName - Edge function name
 * @param {object} options
 * @param {number} options.cacheTTL - Cache duration in ms (default: 0 = no cache)
 * @returns {{ data, loading, error, execute, history }}
 */
export function useEdgeFunction(functionName, options = {}) {
    const { cacheTTL = 0 } = options
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [history, setHistory] = useState([])
    const cacheRef = useRef(new Map())

    const execute = useCallback(async (payload = {}) => {
        if (!functionName) {
            const message = 'Edge function name is required'
            setError(message)
            return { error: message }
        }

        setLoading(true)
        setError(null)

        // Check cache
        const cacheKey = JSON.stringify({ fn: functionName, ...payload })
        if (cacheTTL > 0) {
            const cached = cacheRef.current.get(cacheKey)
            if (cached && Date.now() - cached.time < cacheTTL) {
                setData(cached.data)
                setLoading(false)
                return cached.data
            }
        }

        try {
            const result = await callSupabaseFunction(functionName, { body: payload })
            setData(result)

            // Cache result
            if (cacheTTL > 0) {
                cacheRef.current.set(cacheKey, { data: result, time: Date.now() })
            }

            // Track history
            setHistory(prev => [{
                timestamp: new Date().toISOString(),
                payload,
                result: { success: true, recordCount: Array.isArray(result) ? result.length : 1 },
            }, ...prev].slice(0, 20))

            return result
        } catch (err) {
            const message = err.message || 'Unknown error'
            setError(message)
            setHistory(prev => [{
                timestamp: new Date().toISOString(),
                payload,
                result: { success: false, error: message },
            }, ...prev].slice(0, 20))
            return { error: message }
        } finally {
            setLoading(false)
        }
    }, [functionName, cacheTTL])

    const clearCache = useCallback(() => {
        cacheRef.current.clear()
    }, [])

    return { data, loading, error, execute, history, clearCache }
}
