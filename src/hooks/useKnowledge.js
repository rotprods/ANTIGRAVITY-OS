// ═══════════════════════════════════════════════════
// OCULOPS — React Hook: useKnowledge
// Supabase-connected hook for knowledge vault + pgvector semantic search
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { fetchAll, insertRow, updateRow, deleteRow, subscribeToTable, supabase } from '../lib/supabase'

export function useKnowledge(filters = {}) {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchResults, setSearchResults] = useState(null)
    const [searching, setSearching] = useState(false)
    const filtersKey = JSON.stringify(filters)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchAll('knowledge_entries', JSON.parse(filtersKey))
            setEntries(data || [])
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }, [filtersKey])

    useEffect(() => {
        load()
        const channel = subscribeToTable('knowledge_entries', (payload) => {
            if (payload.eventType === 'INSERT') setEntries(prev => [payload.new, ...prev])
            else if (payload.eventType === 'UPDATE') setEntries(prev => prev.map(e => e.id === payload.new.id ? payload.new : e))
            else if (payload.eventType === 'DELETE') setEntries(prev => prev.filter(e => e.id !== payload.old.id))
        })
        return () => channel?.unsubscribe()
    }, [load])

    const addEntry = async (entry) => {
        const result = await insertRow('knowledge_entries', entry)
        if (result) {
            setEntries(prev => [result, ...prev])
            // Trigger embedding generation in background
            embedEntry(result.id).catch(() => {})
        }
        return result
    }

    const updateEntry = async (id, updates) => {
        const result = await updateRow('knowledge_entries', id, updates)
        if (result) {
            setEntries(prev => prev.map(e => e.id === id ? result : e))
            // Re-embed if content changed
            if (updates.title || updates.content || updates.tags) {
                embedEntry(id).catch(() => {})
            }
        }
        return result
    }

    const removeEntry = async (id) => {
        const success = await deleteRow('knowledge_entries', id)
        if (success) setEntries(prev => prev.filter(e => e.id !== id))
        return success
    }

    const embedEntry = async (id) => {
        const { data, error: err } = await supabase.functions.invoke('knowledge-embed', {
            body: { id },
        })
        if (err && import.meta.env.DEV) console.warn('Embedding failed:', err.message)
        return data
    }

    const searchSemantic = async (query, options = {}) => {
        if (!query?.trim()) {
            setSearchResults(null)
            return []
        }
        setSearching(true)
        try {
            const { data, error: err } = await supabase.functions.invoke('knowledge-embed/search', {
                body: {
                    query,
                    match_count: options.matchCount || 10,
                    threshold: options.threshold || 0.7,
                    filter_type: options.filterType || null,
                },
            })
            if (err) throw new Error(err.message)
            const results = data?.results || []
            setSearchResults(results)
            return results
        } catch (err) {
            if (import.meta.env.DEV) console.warn('Semantic search failed:', err.message)
            setSearchResults(null)
            return []
        } finally {
            setSearching(false)
        }
    }

    const embedAll = async () => {
        const { data, error: err } = await supabase.functions.invoke('knowledge-embed/batch', {
            body: {},
        })
        if (err && import.meta.env.DEV) console.warn('Batch embed failed:', err.message)
        return data
    }

    const clearSearch = useCallback(() => {
        setSearchResults(null)
    }, [])

    const byType = entries.reduce((acc, e) => {
        const type = e.type || 'learning'
        if (!acc[type]) acc[type] = []
        acc[type].push(e)
        return acc
    }, {})

    const embeddedCount = entries.filter(e => e.embedding).length

    return {
        entries,
        loading,
        error,
        addEntry,
        updateEntry,
        removeEntry,
        reload: load,
        byType,
        // Semantic search
        searchSemantic,
        searchResults,
        searching,
        clearSearch,
        embedEntry,
        embedAll,
        embeddedCount,
    }
}
