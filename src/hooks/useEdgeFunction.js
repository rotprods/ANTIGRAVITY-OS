// ═══════════════════════════════════════════════════
// OCULOPS — useEdgeFunction Hook
// Generic hook to call any Supabase Edge Function
// ═══════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_SUPABASE_URL

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
            // Get auth token (user JWT or fallback to anon key)
            let token = null
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession()
                token = session?.access_token
            }
            if (!token) {
                token = import.meta.env.VITE_SUPABASE_ANON_KEY
            }

            if (!BASE) throw new Error('Supabase URL not configured')

            const res = await fetch(`${BASE}/functions/v1/${functionName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const errText = await res.text().catch(() => `HTTP ${res.status}`)
                throw new Error(errText)
            }

            const result = await res.json()
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
