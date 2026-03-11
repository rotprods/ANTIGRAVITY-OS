// ═══════════════════════════════════════════════════
// OCULOPS — useAgents Hook
// Manages agent registry, tasks, logs, and triggers
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { callSupabaseFunction, supabase, fetchAll, subscribeDebouncedToTable } from '../lib/supabase'

export function useAgents() {
    const [agents, setAgents] = useState([])
    const [tasks, setTasks] = useState([])
    const [logs, setLogs] = useState([])
    const [messages, setMessages] = useState([])
    const [apiLogs, setApiLogs] = useState([])
    const [pipelineRuns, setPipelineRuns] = useState([])
    const [pipelineStepRuns, setPipelineStepRuns] = useState([])
    const [eventDeliveries, setEventDeliveries] = useState([])
    const [recentEvents, setRecentEvents] = useState([])
    const [loading, setLoading] = useState(true)

    // ── Fetch all data ──
    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [agentsData, tasksData, logsData, msgsData, apiLogsData, pipelineRunsData, pipelineStepRunsData, eventDeliveriesData, recentEventsData] = await Promise.all([
                fetchAll('agent_registry', {}),
                fetchAll('agent_tasks', {}),
                supabase ? supabase.from('agent_logs').select('*').order('created_at', { ascending: false }).limit(50).then(r => r.data || []) : [],
                fetchAll('agent_messages', {}),
                supabase ? supabase.from('agent_api_logs').select('*').order('created_at', { ascending: false }).limit(200).then(r => r.data || []) : [],
                supabase ? supabase.from('pipeline_runs').select('*, pipeline_templates(name, code_name)').order('created_at', { ascending: false }).limit(25).then(r => r.data || []) : [],
                supabase ? supabase.from('pipeline_step_runs').select('*').order('created_at', { ascending: false }).limit(100).then(r => r.data || []) : [],
                supabase ? supabase.from('event_deliveries').select('*').order('created_at', { ascending: false }).limit(100).then(r => r.data || []) : [],
                supabase ? supabase.from('event_log').select('*').order('created_at', { ascending: false }).limit(100).then(r => r.data || []) : []
            ])
            setAgents(agentsData || [])
            setTasks(tasksData || [])
            setLogs(logsData || [])
            setMessages(msgsData || [])
            setApiLogs(apiLogsData || [])
            setPipelineRuns(pipelineRunsData || [])
            setPipelineStepRuns(pipelineStepRunsData || [])
            setEventDeliveries(eventDeliveriesData || [])
            setRecentEvents(recentEventsData || [])
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
            channels.push(subscribeDebouncedToTable('agent_registry', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('agent_tasks', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('agent_logs', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('agent_messages', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('agent_api_logs', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('pipeline_runs', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('pipeline_step_runs', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('event_deliveries', () => refresh(), 800))
            channels.push(subscribeDebouncedToTable('event_log', () => refresh(), 800))
        }

        return () => {
            channels.forEach(ch => ch && supabase?.removeChannel(ch))
        }
    }, [refresh])

    // ── Trigger an agent ──
    const triggerAgent = useCallback(async (codeName, action = 'cycle', payload = {}) => {
        try {
            const data = await callSupabaseFunction(`agent-${codeName}`, {
                body: { action, ...payload }
            })
            await refresh()
            return data
        } catch (err) {
            if (import.meta.env.DEV) console.error(`Error triggering ${codeName}:`, err)
            return { error: err.message }
        }
    }, [refresh])

    // ── Trigger all agents (CORTEX orchestration) ──
    const runCortexCycle = useCallback(() => triggerAgent('cortex', 'orchestrate'), [triggerAgent])

    // ── Query Public APIs via Harness ──
    const queryPublicApi = useCallback(async (apiName, endpoint, method = 'GET', params = {}, body = null) => {
        try {
            return await callSupabaseFunction('public_api_harness', {
                body: { api: apiName, endpoint, method, params, body }
            })
        } catch (err) {
            if (import.meta.env.DEV) console.error(`Error querying public API ${apiName}:`, err)
            return { error: err.message, success: false }
        }
    }, [])

    // ── Launch orchestration pipeline ──
    const launchPipeline = useCallback(async (templateCodeName, context = {}, goal = '') => {
        try {
            const data = await callSupabaseFunction('orchestration-engine', {
                body: {
                    action: 'create_run',
                    template_code_name: templateCodeName,
                    goal,
                    context,
                    auto_execute: true,
                    source: 'agents_hook',
                }
            })
            await refresh()
            return data
        } catch (err) {
            if (import.meta.env.DEV) console.error(`Error launching pipeline ${templateCodeName}:`, err)
            return { error: err.message }
        }
    }, [refresh])

    const getPipelineStatus = useCallback(async (pipelineRunId) => {
        try {
            return await callSupabaseFunction('orchestration-engine', {
                body: {
                    action: 'get_run',
                    pipeline_run_id: pipelineRunId,
                }
            })
        } catch (err) {
            if (import.meta.env.DEV) console.error(`Error getting pipeline ${pipelineRunId}:`, err)
            return { error: err.message }
        }
    }, [])

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
        completedToday: tasks.filter(t => t.status === 'completed' && t.completed_at?.startsWith(new Date().toISOString().split('T')[0])).length,
        activePipelineRuns: pipelineRuns.filter(r => r.status === 'running').length,
        failedPipelineRuns: pipelineRuns.filter(r => r.status === 'failed').length,
        pendingDeliveries: eventDeliveries.filter(d => d.status === 'pending').length
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
        pipelineRuns,
        pipelineStepRuns,
        eventDeliveries,
        recentEvents,
        loading,
        stats,
        getAgentApiStats,
        triggerAgent,
        runCortexCycle,
        queryPublicApi,
        launchPipeline,
        getPipelineStatus,
        refresh
    }
}

export default useAgents
