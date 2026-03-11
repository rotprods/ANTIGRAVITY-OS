// ═══════════════════════════════════════════════════
// OCULOPS — useAgents Hook
// Manages agent registry, tasks, logs, and triggers
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAll, subscribeToTable } from '../lib/supabase'

async function getAccessToken() {
    if (!supabase) return import.meta.env.VITE_SUPABASE_ANON_KEY || null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY || null
}

export function useAgents() {
    const [agents, setAgents] = useState([])
    const [tasks, setTasks] = useState([])
    const [logs, setLogs] = useState([])
    const [messages, setMessages] = useState([])
    const [apiLogs, setApiLogs] = useState([])
    const [loading, setLoading] = useState(true)

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

    // ── Fetch all data ──
    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [agentsData, tasksData, logsData, msgsData, apiLogsData] = await Promise.all([
                fetchAll('agent_registry', {}),
                fetchAll('agent_tasks', {}),
                supabase ? supabase.from('agent_logs').select('*').order('created_at', { ascending: false }).limit(50).then(r => r.data || []) : [],
                fetchAll('agent_messages', {}),
                supabase ? supabase.from('agent_api_logs').select('*').order('created_at', { ascending: false }).limit(200).then(r => r.data || []) : []
            ])
            setAgents(agentsData || [])
            setTasks(tasksData || [])
            setLogs(logsData || [])
            setMessages(msgsData || [])
            setApiLogs(apiLogsData || [])
        } catch (err) {
            if (import.meta.env.DEV) console.error('useAgents fetch error:', err)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        refresh()

        // Realtime subscriptions
        const channels = []
        if (supabase) {
            channels.push(subscribeToTable('agent_registry', () => refresh()))
            channels.push(subscribeToTable('agent_tasks', () => refresh()))
            channels.push(subscribeToTable('agent_logs', () => refresh()))
            channels.push(subscribeToTable('agent_messages', () => refresh()))
            channels.push(subscribeToTable('agent_api_logs', () => refresh()))
        }

        return () => {
            channels.forEach(ch => ch && supabase?.removeChannel(ch))
        }
    }, [refresh])

    // ── Trigger an agent ──
    const triggerAgent = useCallback(async (codeName, action = 'cycle', payload = {}) => {
        if (!SUPABASE_URL) return { error: 'No Supabase URL' }

        try {
            const token = await getAccessToken()
            const url = `${SUPABASE_URL}/functions/v1/agent-${codeName}`
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ action, ...payload })
            })
            const data = await res.json()
            await refresh()
            return data
        } catch (err) {
            if (import.meta.env.DEV) console.error(`Error triggering ${codeName}:`, err)
            return { error: err.message }
        }
    }, [SUPABASE_URL, refresh])

    // ── Trigger all agents (CORTEX orchestration) ──
    const runCortexCycle = useCallback(() => triggerAgent('cortex', 'orchestrate'), [triggerAgent])

    // ── Query Public APIs via Harness ──
    const queryPublicApi = useCallback(async (apiName, endpoint, method = 'GET', params = {}, body = null) => {
        if (!SUPABASE_URL) return { error: 'No Supabase URL' }

        try {
            const token = await getAccessToken()
            const url = `${SUPABASE_URL}/functions/v1/public_api_harness`
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ api: apiName, endpoint, method, params, body })
            })
            const data = await res.json()
            return data
        } catch (err) {
            if (import.meta.env.DEV) console.error(`Error querying public API ${apiName}:`, err)
            return { error: err.message, success: false }
        }
    }, [SUPABASE_URL])

    // ── Get stats ──
    const stats = {
        total: agents.length,
        online: agents.filter(a => a.status === 'online').length,
        running: agents.filter(a => a.status === 'running').length,
        error: agents.filter(a => a.status === 'error').length,
        totalRuns: agents.reduce((s, a) => s + (a.total_runs || 0), 0),
        totalTokens: agents.reduce((s, a) => s + (a.total_tokens || 0), 0),
        queuedTasks: tasks.filter(t => t.status === 'queued').length,
        runningTasks: tasks.filter(t => t.status === 'running').length,
        completedToday: tasks.filter(t => t.status === 'completed' && t.completed_at?.startsWith(new Date().toISOString().split('T')[0])).length
    }

    // ── API usage stats per agent ──
    const getAgentApiStats = (codeName) => {
        const agentLogs = apiLogs.filter(l => l.agent_code_name === codeName)
        const apis = [...new Set(agentLogs.map(l => l.api_name))]
        return {
            totalCalls: agentLogs.length,
            successCalls: agentLogs.filter(l => l.status_code >= 200 && l.status_code < 300).length,
            failedCalls: agentLogs.filter(l => l.error).length,
            apisUsed: apis,
            avgDuration: agentLogs.length > 0 ? Math.round(agentLogs.reduce((s, l) => s + (l.duration_ms || 0), 0) / agentLogs.length) : 0,
            recentCalls: agentLogs.slice(0, 10)
        }
    }

    return {
        agents,
        tasks,
        logs,
        messages,
        apiLogs,
        loading,
        stats,
        getAgentApiStats,
        triggerAgent,
        runCortexCycle,
        queryPublicApi,
        refresh
    }
}

export default useAgents
