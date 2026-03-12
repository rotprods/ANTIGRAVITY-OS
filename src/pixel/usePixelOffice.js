// ═══════════════════════════════════════════════════
// OCUL OFFICE — Pixel Office State Hook
// Bridges Supabase events → canvas animation state
// ═══════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEventBus } from '../hooks/useEventBus'
import { useAgentState } from '../hooks/useAgentState'
import { TILE, SCALE, ROOMS, AGENT_CONFIG, SUCCESS_TTL, ERROR_TTL } from './officeConfig'

const ROOM_BY_AGENT = Object.fromEntries(ROOMS.map(r => [r.agent, r]))
const S = TILE * SCALE

function createParticleBurst(room, color, type) {
  const cx = (room.x + room.workstation.lx + 0.5) * S
  const cy = (room.y + room.workstation.ly + 0.5) * S
  const count = type === 'success' ? 18 : 10

  return Array.from({ length: count }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    x: cx, y: cy,
    vx: (Math.random() - 0.5) * 7,
    vy: -Math.random() * 6 - 0.5,
    life: 1,
    color: type === 'error' ? '#ef4444' : color,
    size: Math.random() * 4 + 1,
  }))
}

// Real event shape from agents.ts:
// { event_type, sourceAgent, payload: { title, action, summary, error }, ... }
function resolveCodeName(evt) {
  return (
    evt?.sourceAgent ||
    evt?.agent_code_name ||
    evt?.payload?.agent_code_name ||
    null
  )
}

function resolveTask(evt) {
  return (
    evt?.payload?.title ||
    evt?.payload?.action ||
    evt?.payload?.goal ||
    evt?.goal ||
    ''
  ).toString().slice(0, 50)
}

function resolveResult(evt) {
  return (
    evt?.payload?.summary ||
    evt?.payload?.result ||
    evt?.result ||
    ''
  ).toString().slice(0, 50)
}

function resolveError(evt) {
  return (
    evt?.payload?.error ||
    evt?.error ||
    ''
  ).toString().slice(0, 50)
}

export function usePixelOffice() {
  // Canvas animation state — lives in refs, NOT React state
  const agentStatesRef = useRef({})
  const particlesRef = useRef([])
  const activeLinksRef = useRef([])  // [[fromAgent, toAgent], ...]
  const tickRef = useRef(0)

  // React state — drives UI chrome only
  const [liveFeed, setLiveFeed] = useState([])
  const [stats, setStats] = useState({ active: 0, total: 0, errors: 0 })

  const { subscribe } = useEventBus()
  const { runningAgents } = useAgentState()

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const pushFeed = useCallback((entry) => {
    setLiveFeed(prev => [{ id: Date.now(), ts: new Date(), ...entry }, ...prev].slice(0, 25))
  }, [])

  const spawnAgent = useCallback((codeName, task = '') => {
    const cfg = AGENT_CONFIG[codeName]
    const room = ROOM_BY_AGENT[codeName]
    if (!cfg || !room) return

    agentStatesRef.current[codeName] = {
      state: 'walking',
      spawnTick: tickRef.current,
      task: task.slice(0, 50),
      result: '',
      error: '',
    }

    setStats(prev => ({ ...prev, active: prev.active + 1, total: prev.total + 1 }))
    pushFeed({ codeName, event: 'started', text: task || 'started', color: cfg.color })
  }, [pushFeed])

  const completeAgent = useCallback((codeName, result = '') => {
    const cfg = AGENT_CONFIG[codeName]
    const room = ROOM_BY_AGENT[codeName]
    // Auto-spawn if agent completed without a prior started event (brain-v2 agents)
    if (!agentStatesRef.current[codeName] && cfg && room) {
      agentStatesRef.current[codeName] = {
        state: 'working',
        spawnTick: tickRef.current,
        task: '',
        result: '', error: '',
      }
      setStats(prev => ({ ...prev, total: prev.total + 1 }))
    }
    const st = agentStatesRef.current[codeName]
    if (!st) return

    st.state = 'success'
    st.successTick = tickRef.current
    st.result = result.slice(0, 50)

    if (cfg && room) {
      particlesRef.current = [
        ...particlesRef.current,
        ...createParticleBurst(room, cfg.color, 'success'),
      ]
    }

    setStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1) }))
    pushFeed({ codeName, event: 'completed', text: result || 'done', color: '#10b981' })
  }, [pushFeed])

  const errorAgent = useCallback((codeName, error = '') => {
    const room = ROOM_BY_AGENT[codeName]
    const st = agentStatesRef.current[codeName]
    if (!st) return

    st.state = 'error'
    st.errorTick = tickRef.current
    st.error = error.slice(0, 50)

    if (room) {
      particlesRef.current = [
        ...particlesRef.current,
        ...createParticleBurst(room, '#ef4444', 'error'),
      ]
    }

    setStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1), errors: prev.errors + 1 }))
    pushFeed({ codeName, event: 'error', text: error || 'error', color: '#ef4444' })
  }, [pushFeed])

  // ── Event bus subscriptions ───────────────────────────────────────────────────

  useEffect(() => {
    const unsubStart = subscribe('agent.started', (evt) => {
      const codeName = resolveCodeName(evt)
      if (!codeName) return
      const task = resolveTask(evt)
      spawnAgent(codeName, task)

      // If cortex → also link to orchestrated agents
      if (codeName === 'cortex') {
        const targets = evt?.payload?.targets || []
        activeLinksRef.current = targets.map(t => ['cortex', t])
        setTimeout(() => { activeLinksRef.current = [] }, 8000)
      }
    })

    const unsubDone = subscribe('agent.completed', (evt) => {
      const codeName = resolveCodeName(evt)
      if (!codeName) return
      completeAgent(codeName, resolveResult(evt))
    })

    const unsubErr = subscribe('agent.error', (evt) => {
      const codeName = resolveCodeName(evt)
      if (!codeName) return
      errorAgent(codeName, resolveError(evt))
    })

    // domain events trigger ambient effects
    const unsubLead = subscribe('lead.captured', (evt) => {
      if (!agentStatesRef.current['hunter']) {
        agentStatesRef.current['hunter'] = {
          state: 'walking',
          spawnTick: tickRef.current,
          task: 'lead captured',
          result: '', error: '',
        }
      }
      pushFeed({ codeName: 'hunter', event: 'lead', text: evt?.payload?.name || 'lead captured', color: '#f59e0b' })
    })

    const unsubSignal = subscribe('signal.detected', (evt) => {
      if (!agentStatesRef.current['oracle']) {
        agentStatesRef.current['oracle'] = {
          state: 'walking',
          spawnTick: tickRef.current,
          task: evt?.payload?.signal || 'signal detected',
          result: '', error: '',
        }
      }
      pushFeed({ codeName: 'oracle', event: 'signal', text: evt?.payload?.signal || 'signal', color: '#8b5cf6' })
    })

    return () => {
      unsubStart?.()
      unsubDone?.()
      unsubErr?.()
      unsubLead?.()
      unsubSignal?.()
    }
  }, [subscribe, spawnAgent, completeAgent, errorAgent, pushFeed])

  // ── Sync from useAgentState → DB pipeline_step_runs realtime ─────────────────

  useEffect(() => {
    if (!runningAgents?.length) return
    runningAgents.forEach(codeName => {
      if (agentStatesRef.current[codeName]) return  // already spawned
      const cfg = AGENT_CONFIG[codeName]
      if (!cfg) return
      agentStatesRef.current[codeName] = {
        state: 'walking',
        spawnTick: tickRef.current,
        task: 'running',
        result: '', error: '',
      }
      pushFeed({ codeName, event: 'started', text: 'running', color: cfg.color })
    })
  }, [runningAgents, pushFeed])

  // ── RAF tick updater (called by canvas loop) ──────────────────────────────────

  const tick = useCallback(() => {
    const t = ++tickRef.current

    // Update agent states (walking → working, success/error → offline after TTL)
    const states = agentStatesRef.current
    Object.keys(states).forEach(id => {
      const st = states[id]
      if (!st) return

      if (st.state === 'walking') {
        const elapsed = t - (st.spawnTick || 0)
        if (elapsed >= 90) st.state = 'working'
      }
      if (st.state === 'success' && t - (st.successTick || 0) > SUCCESS_TTL) {
        delete states[id]
      }
      if (st.state === 'error' && t - (st.errorTick || 0) > ERROR_TTL) {
        delete states[id]
      }
    })

    // Advance particles
    particlesRef.current = particlesRef.current
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.1, life: p.life - 0.022 }))
      .filter(p => p.life > 0)
  }, [])

  return {
    agentStatesRef,
    particlesRef,
    activeLinksRef,
    tickRef,
    liveFeed,
    stats,
    tick,
    spawnAgent,   // for demo/debug buttons
    completeAgent,
    errorAgent,
  }
}
