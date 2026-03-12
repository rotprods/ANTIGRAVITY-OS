// OCULOPS — useAnalytics
// Time-series aggregations: revenue trend, contact acquisition,
// agent activity (7d), pipeline velocity.
// All queries are read-only against existing tables — no new schema needed.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function weekStart(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

export function useAnalytics() {
  const [revenueTrend, setRevenueTrend]       = useState([]) // [{label, month, value, count}]
  const [contactTrend, setContactTrend]       = useState([]) // [{label, week, count}]
  const [agentActivity, setAgentActivity]     = useState([]) // [{name, count, errors}]
  const [pipelineVelocity, setPipelineVelocity] = useState([]) // [{stage, avgDays, count}]
  const [loading, setLoading]                 = useState(true)

  // ─── Revenue trend — last 6 months of closed_won deals ─────────────────────
  async function fetchRevenueTrend(cancelled) {
    const since = new Date()
    since.setMonth(since.getMonth() - 6)

    const { data } = await supabase
      .from('deals')
      .select('value, updated_at')
      .eq('stage', 'closed_won')
      .gte('updated_at', since.toISOString())
      .order('updated_at', { ascending: true })

    if (cancelled || !data) return

    const byMonth = {}
    data.forEach(d => {
      const key = monthKey(new Date(d.updated_at))
      byMonth[key] = byMonth[key] || { value: 0, count: 0 }
      byMonth[key].value += parseFloat(d.value) || 0
      byMonth[key].count += 1
    })

    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = monthKey(d)
      months.push({
        month: key,
        label: d.toLocaleString('es', { month: 'short' }).toUpperCase(),
        value: byMonth[key]?.value || 0,
        count: byMonth[key]?.count || 0,
      })
    }

    if (!cancelled) setRevenueTrend(months)
  }

  // ─── Contact acquisition — last 4 weeks ────────────────────────────────────
  async function fetchContactTrend(cancelled) {
    const since = new Date()
    since.setDate(since.getDate() - 28)

    const { data } = await supabase
      .from('contacts')
      .select('created_at')
      .gte('created_at', since.toISOString())

    if (cancelled || !data) return

    const byWeek = {}
    data.forEach(c => {
      const key = weekStart(new Date(c.created_at))
      byWeek[key] = (byWeek[key] || 0) + 1
    })

    const weeks = []
    for (let i = 3; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 7)
      const key = weekStart(d)
      weeks.push({
        week: key,
        label: i === 0 ? 'ESTA' : `-${i}w`,
        count: byWeek[key] || 0,
      })
    }

    if (!cancelled) setContactTrend(weeks)
  }

  // ─── Agent activity — last 7 days, top 8 agents ────────────────────────────
  async function fetchAgentActivity(cancelled) {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const { data } = await supabase
      .from('agent_logs')
      .select('agent_code_name, action')
      .gte('created_at', since.toISOString())

    if (cancelled || !data) return

    const byAgent = {}
    data.forEach(log => {
      const name = (log.agent_code_name || 'unknown').toUpperCase()
      byAgent[name] = byAgent[name] || { count: 0, errors: 0 }
      byAgent[name].count += 1
      if (log.action && (log.action === 'error' || log.action.includes('fail'))) {
        byAgent[name].errors += 1
      }
    })

    const entries = Object.entries(byAgent)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    if (!cancelled) setAgentActivity(entries)
  }

  // ─── Pipeline velocity — avg days per active stage ─────────────────────────
  async function fetchPipelineVelocity(cancelled) {
    const { data } = await supabase
      .from('deals')
      .select('stage, created_at, updated_at')
      .not('stage', 'in', '("closed_won","closed_lost")')

    if (cancelled || !data) return

    const byStage = {}
    data.forEach(d => {
      const stage = d.stage || 'unknown'
      const ageDays = Math.max(0, Math.round(
        (new Date(d.updated_at) - new Date(d.created_at)) / 86400000
      ))
      byStage[stage] = byStage[stage] || { total: 0, count: 0 }
      byStage[stage].total += ageDays
      byStage[stage].count += 1
    })

    const ORDER = ['lead', 'contacted', 'meeting', 'proposal']
    const velocity = ORDER
      .map(s => ({
        stage: s.toUpperCase(),
        avgDays: byStage[s]?.count > 0 ? Math.round(byStage[s].total / byStage[s].count) : 0,
        count: byStage[s]?.count || 0,
      }))

    if (!cancelled) setPipelineVelocity(velocity)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      await Promise.all([
        fetchRevenueTrend(cancelled),
        fetchContactTrend(cancelled),
        fetchAgentActivity(cancelled),
        fetchPipelineVelocity(cancelled),
      ])
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { revenueTrend, contactTrend, agentActivity, pipelineVelocity, loading }
}
