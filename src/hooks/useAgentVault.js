// ═══════════════════════════════════════════════════
// OCULOPS — useAgentVault Hook
// Reads agent_definitions from Supabase + runs agents via agent-runner
// ═══════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { dispatchGovernedTool } from '../lib/controlPlane'

// Business role mapping: which vault namespaces map to OCULOPS agents
export const ROLE_CAPABILITY_MAP = {
  atlas: ['research', 'data', 'content'],
  hunter: ['data', 'engineering', 'product'],
  oracle: ['data', 'research', 'architecture'],
  forge: ['content', 'design', 'engineering'],
  sentinel: ['security', 'testing', 'infra'],
  herald: ['content', 'research', 'orchestration'],
  outreach: ['content', 'product', 'orchestration'],
  cortex: ['orchestration', 'engineering', 'data'],
  nexus: ['orchestration', 'product', 'research'],
}

export function useAgentVault() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ namespace: 'all', search: '', role: 'all' })
  const [runningAgent, setRunningAgent] = useState(null)

  // ── Load from Supabase ──
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }
    const { data, error: err } = await supabase
      .from('agent_definitions')
      .select('*')
      .order('namespace')
      .order('code_name')
    if (err) {
      setError(err.message)
    } else {
      setAgents(data || [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ── Derived data ──
  const namespaces = useMemo(() =>
    [...new Set(agents.map(a => a.namespace).filter(Boolean))].sort(),
    [agents]
  )

  const filteredAgents = useMemo(() => {
    let result = agents
    if (filters.namespace !== 'all') {
      result = result.filter(a => a.namespace === filters.namespace)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(a =>
        a.code_name.toLowerCase().includes(q) ||
        (a.display_name || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.namespace || '').toLowerCase().includes(q) ||
        (a.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (filters.role !== 'all') {
      const roleNs = ROLE_CAPABILITY_MAP[filters.role] || []
      result = result.filter(a => roleNs.includes(a.namespace))
    }
    return result
  }, [agents, filters])

  const suggestRole = useCallback((agent) => {
    const ns = agent.namespace || ''
    let bestRole = null
    let bestScore = 0
    for (const [role, roleNs] of Object.entries(ROLE_CAPABILITY_MAP)) {
      const score = roleNs.includes(ns) ? 1 : 0
      if (score > bestScore) {
        bestScore = score
        bestRole = role
      }
    }
    return bestRole
  }, [])

  // ── Toggle active ──
  const toggleActive = useCallback(async (id, currentState) => {
    await supabase
      .from('agent_definitions')
      .update({ is_active: !currentState })
      .eq('id', id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a))
  }, [])

  // ── Run agent via control-plane -> agent-runner ──
  const runAgent = useCallback(async (codeName, goal, context = {}) => {
    setRunningAgent(codeName)
    try {
      const data = await dispatchGovernedTool({
        sourceAgent: 'copilot',
        source: 'agent_vault_ui',
        targetRef: 'agent-runner',
        riskClass: 'medium',
        toolCodeName: 'agent-runner',
        functionName: 'agent-runner',
        payload: { agent: codeName, goal, context },
        context: {
          requested_agent: codeName,
          goal: goal || null,
        },
      })
      // Update local stats
      setAgents(prev => prev.map(a =>
        a.code_name === codeName
          ? { ...a, total_runs: (a.total_runs || 0) + 1, last_run_at: new Date().toISOString() }
          : a
      ))
      return data
    } catch (err) {
      return { success: false, error: err.message || 'Agent execution failed' }
    } finally {
      setRunningAgent(null)
    }
  }, [])

  // ── Filter setters ──
  const setNamespace = useCallback((ns) => setFilters(f => ({ ...f, namespace: ns })), [])
  const setSearch = useCallback((s) => setFilters(f => ({ ...f, search: s })), [])
  const setRole = useCallback((r) => setFilters(f => ({ ...f, role: r })), [])

  return {
    agents: filteredAgents,
    allAgents: agents,
    filteredAgents,
    namespaces,
    loading,
    error,
    filters,
    setNamespace,
    setSearch,
    setRole,
    suggestRole,
    toggleActive,
    runAgent,
    runningAgent,
    refresh,
    totalAgents: agents.length,
    activeCount: agents.filter(a => a.is_active).length,
    canonicalCount: agents.length,
  }
}
