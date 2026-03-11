// ═══════════════════════════════════════════════════
// OCULOPS — useAgentVault Hook
// Loads Agent-OS vault manifest (414 agents, 13 namespaces)
// ═══════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'

// Agent-OS manifest is loaded as static JSON at build time
// In Electron: reads from ~/agent-os/registry/manifest.json
// In web: fetched from /data/agent-manifest.json (must be copied)
const MANIFEST_PATHS = [
    '/data/agent-manifest.json',
    './data/agent-manifest.json',
]

// Business role mapping: which vault capabilities map to OCULOPS agents
export const ROLE_CAPABILITY_MAP = {
    atlas: ['research', 'data-engineering', 'web-scraping'],
    hunter: ['data-engineering', 'web-scraping', 'api-design'],
    oracle: ['data-engineering', 'ml-ai', 'data'],
    forge: ['content', 'documentation', 'copywriting'],
    sentinel: ['security', 'research', 'code-review'],
    scribe: ['documentation', 'content', 'reporting'],
    strategist: ['orchestration', 'research', 'product'],
    cortex: ['orchestration', 'ml-ai'],
}

export function useAgentVault() {
    const [manifest, setManifest] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filters, setFilters] = useState({ namespace: 'all', search: '', role: 'all' })

    useEffect(() => {
        async function loadManifest() {
            // Try Electron IPC first
            if (window.electronAPI?.readFile) {
                try {
                    const homeDir = await window.electronAPI.getHomeDir?.() || ''
                    const data = await window.electronAPI.readFile(`${homeDir}/agent-os/registry/manifest.json`)
                    if (data) {
                        setManifest(JSON.parse(data))
                        setLoading(false)
                        return
                    }
                } catch (_) { /* fall through to fetch */ }
            }

            // Try web fetch
            for (const path of MANIFEST_PATHS) {
                try {
                    const res = await fetch(path)
                    if (res.ok) {
                        const data = await res.json()
                        setManifest(data)
                        setLoading(false)
                        return
                    }
                } catch (_) { /* try next */ }
            }

            setError('Agent-OS manifest not found. Copy ~/agent-os/registry/manifest.json to public/data/agent-manifest.json')
            setLoading(false)
        }
        loadManifest()
    }, [])

    const agents = useMemo(() => {
        if (!manifest?.agents) return []
        return manifest.agents.filter(a => !a.is_alias)
    }, [manifest])

    const namespaces = useMemo(() => {
        if (!manifest?.namespaces) return []
        return manifest.namespaces
    }, [manifest])

    const filteredAgents = useMemo(() => {
        let result = agents
        if (filters.namespace !== 'all') {
            result = result.filter(a => a.namespace === filters.namespace)
        }
        if (filters.search) {
            const q = filters.search.toLowerCase()
            result = result.filter(a =>
                a.name.toLowerCase().includes(q) ||
                (a.capabilities || []).some(c => c.toLowerCase().includes(q)) ||
                (a.namespace || '').toLowerCase().includes(q)
            )
        }
        if (filters.role !== 'all') {
            const roleCaps = ROLE_CAPABILITY_MAP[filters.role] || []
            result = result.filter(a =>
                (a.capabilities || []).some(c => roleCaps.includes(c))
            )
        }
        return result
    }, [agents, filters])

    const suggestRole = useCallback((agent) => {
        const caps = agent.capabilities || []
        let bestRole = null
        let bestScore = 0
        for (const [role, roleCaps] of Object.entries(ROLE_CAPABILITY_MAP)) {
            const score = caps.filter(c => roleCaps.includes(c)).length
            if (score > bestScore) {
                bestScore = score
                bestRole = role
            }
        }
        return bestRole
    }, [])

    const setNamespace = useCallback((ns) => setFilters(f => ({ ...f, namespace: ns })), [])
    const setSearch = useCallback((s) => setFilters(f => ({ ...f, search: s })), [])
    const setRole = useCallback((r) => setFilters(f => ({ ...f, role: r })), [])

    return {
        manifest,
        agents,
        filteredAgents,
        namespaces,
        loading,
        error,
        filters,
        setNamespace,
        setSearch,
        setRole,
        suggestRole,
        totalAgents: manifest?.total_agents || 0,
        canonicalCount: manifest?.canonical_count || 0,
    }
}
