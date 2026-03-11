// ═══════════════════════════════════════════════════
// OCULOPS — Copilot Chat Module
// AI Brain with tool-calling orchestration
// ═══════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEdgeFunction } from '../../hooks/useEdgeFunction'
import CopilotAvatar from './CopilotAvatar'
import skills from '../../data/copilot-skills.json'
import './CopilotChat.css'

const TOOL_LABELS = {
  atlas_scan: { icon: '🔭', label: 'ATLAS SCAN' },
  hunter_qualify: { icon: '🎯', label: 'HUNTER QUALIFY' },
  cortex_orchestrate: { icon: '🧠', label: 'CORTEX PIPELINE' },
  oracle_analyze: { icon: '📊', label: 'ORACLE ANALYSIS' },
  sentinel_monitor: { icon: '🗼', label: 'SENTINEL MONITOR' },
  forge_generate: { icon: '🔨', label: 'FORGE GENERATE' },
  outreach_stage: { icon: '📧', label: 'OUTREACH STAGE' },
  outreach_list: { icon: '📋', label: 'OUTREACH LIST' },
  outreach_approve: { icon: '✅', label: 'OUTREACH APPROVE' },
  outreach_send: { icon: '📤', label: 'OUTREACH SEND' },
  proposal_generate: { icon: '📄', label: 'PROPOSAL' },
  scraper_analyze: { icon: '🕷️', label: 'SCRAPER' },
  herald_briefing: { icon: '📱', label: 'HERALD BRIEFING' },
  deal_score: { icon: '⚖️', label: 'DEAL SCORER' },
  crm_create_contact: { icon: '👤', label: 'CREATE CONTACT' },
  crm_create_deal: { icon: '💎', label: 'CREATE DEAL' },
  pipeline_move: { icon: '🔄', label: 'MOVE DEAL' },
  task_create: { icon: '📌', label: 'CREATE TASK' },
  query_data: { icon: '🔍', label: 'QUERY DATA' },
  navigate: { icon: '🧭', label: 'NAVIGATE' },
}

function ToolBadge({ tool, success, error }) {
  const info = TOOL_LABELS[tool] || { icon: '⚙️', label: tool.toUpperCase() }
  return (
    <span
      className="copilot-tool-badge"
      style={{
        borderColor: error ? 'var(--color-danger)' : success ? 'var(--color-primary)' : 'var(--border-subtle)',
        color: error ? 'var(--color-danger)' : 'var(--color-text-2)',
      }}
      title={error || 'Executed successfully'}
    >
      {info.icon} {info.label}
      {success && <span style={{ color: 'var(--color-primary)', marginLeft: '4px' }}>OK</span>}
      {error && <span style={{ color: 'var(--color-danger)', marginLeft: '4px' }}>ERR</span>}
    </span>
  )
}

function CopilotChat() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'COPILOT ONLINE — 20 TOOLS ARMED — AWAITING DIRECTIVE' },
  ])
  const [listening, setListening] = useState(false)
  const [energy, setEnergy] = useState(48)
  const [phoneConnected, setPhoneConnected] = useState(false)
  const [navIntent, setNavIntent] = useState(null)
  const [matchedSkill, setMatchedSkill] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const navIntentTimer = useRef(null)
  const navigate = useNavigate()
  const { execute } = useEdgeFunction('agent-copilot')

  const triggerNavigation = useCallback((path, label) => {
    if (!path) return
    setNavIntent({ label: label || path.replace('/', '').replace('-', ' ').toUpperCase() })
    if (navIntentTimer.current) {
      window.clearTimeout(navIntentTimer.current)
    }
    navIntentTimer.current = window.setTimeout(() => setNavIntent(null), 3800)
    navigate(path)
  }, [navigate])

  useEffect(() => {
    return () => {
      if (navIntentTimer.current) window.clearTimeout(navIntentTimer.current)
    }
  }, [])

  const findSkillForText = useCallback((text) => {
    if (!text) return null
    return skills.find(skill =>
      skill.triggers.some(trigger => text.toLowerCase().includes(trigger.toLowerCase()))
    )
  }, [])

  useEffect(() => {
    let stream
    let context
    let analyser
    let animationFrame
    let fallbackInterval

    const stopFallback = () => {
      if (fallbackInterval) window.clearInterval(fallbackInterval)
    }

    const computeEnergy = (data) => {
      const rms = Math.sqrt(data.reduce((acc, value) => {
        const norm = value / 128 - 1
        return acc + norm * norm
      }, 0) / data.length)
      return Math.min(99, Math.max(15, Math.round(rms * 240)))
    }

    const startFallback = () => {
      fallbackInterval = window.setInterval(() => {
        setListening(value => !value)
        setEnergy(cur => Math.min(99, Math.max(32, Math.round(cur + (Math.random() * 12 - 6)))))
      }, 6000)
    }

    const initMicrophone = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        startFallback()
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setListening(true)
        setEnergy(54)
        context = new (window.AudioContext || window.webkitAudioContext)()
        const source = context.createMediaStreamSource(stream)
        analyser = context.createAnalyser()
        analyser.fftSize = 256
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        source.connect(analyser)

        const tick = () => {
          analyser.getByteTimeDomainData(dataArray)
          const level = computeEnergy(dataArray)
          setEnergy(level)
          setListening(level > 40)
          animationFrame = window.requestAnimationFrame(tick)
        }

        tick()
      } catch (err) {
        startFallback()
      }
    }

    initMicrophone()

    return () => {
      stopFallback()
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      if (analyser) analyser.disconnect()
      if (stream) stream.getTracks().forEach(track => track.stop())
      if (context) context.close()
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])
  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const skillMatch = findSkillForText(text)
    setMessages(prev => {
      const next = [...prev, { role: 'user', content: text }]
      if (skillMatch) {
        next.push({ role: 'system', content: `SKILL ACTIVATED — ${skillMatch.label}` })
      }
      return next
    })
    setInput('')
    setSending(true)

    // Show thinking indicator
    setMatchedSkill(skillMatch || null)
    if (skillMatch?.panel) {
      triggerNavigation(skillMatch.panel, skillMatch.label)
    }
    setMessages(prev => [...prev, { role: 'thinking', content: 'PROCESSING...' }])

    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const result = await execute({ message: text, history })

      // Remove thinking indicator
      setMessages(prev => prev.filter(m => m.role !== 'thinking'))

      if (result?.response) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.response,
          tools: result.tools_executed || [],
          actions: result.actions || [],
        }])

        // Execute navigation actions
        if (result.actions?.length > 0) {
          for (const action of result.actions) {
            if (action.type === 'navigate' && action.payload?.path) {
              setTimeout(() => triggerNavigation(action.payload.path, action.payload?.label || action.payload.path.replace('/', ' ').trim()), 500)
            }
          }
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'NO RESPONSE — CHECK EDGE FUNCTION STATUS',
        }])
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.role !== 'thinking'))
      setMessages(prev => [...prev, {
        role: 'system',
        content: `ERROR: ${err.message?.toUpperCase() || 'UNKNOWN FAILURE'}`,
      }])
    }

    setSending(false)
  }, [input, sending, messages, execute, navigate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Quick action buttons
  const quickActions = [
    { label: 'PIPELINE STATUS', cmd: 'Dame el estado actual del pipeline y los deals activos' },
    { label: 'FULL SCAN', cmd: 'Lanza un scan completo con Cortex: restaurantes en Madrid' },
    { label: 'DAILY BRIEFING', cmd: 'Genera el briefing diario y envíalo por Telegram' },
    { label: 'HEALTH CHECK', cmd: 'Ejecuta Sentinel para detectar anomalías en el sistema' },
  ]

  const navShortcuts = [
    { label: 'PROSPECTOR HUB', path: '/prospector', hint: 'Mira la base de leads y Gmail' },
    { label: 'MESSAGING', path: '/messaging', hint: 'Revisa canales Gmail + WA' },
    { label: 'CONTROL TOWER', path: '/control-tower', hint: 'Dashboard ejecutivo' },
    { label: 'WORLD MONITOR', path: '/world-monitor', hint: 'Señales macro y forecast' },
  ]

  const skillPreview = skills.slice(0, 6)

  const handleNavigation = useCallback((path) => {
    if (!path) return
    setMessages(prev => [...prev, {
      role: 'system',
      content: `NAVIGATING TO ${path.replace('/', '').toUpperCase()}`
    }])
    navigate(path)
  }, [navigate])

  const togglePhone = () => setPhoneConnected(state => !state)

  return (
    <div className="copilot-container fade-in">
      <div className="copilot-header">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-editorial)',
            color: 'var(--color-primary)',
            letterSpacing: '0.05em',
            margin: 0,
            fontSize: '24px',
          }}>
            COPILOT
          </h1>
          <span className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
            AI BRAIN — 20 TOOLS — FUNCTION CALLING ORCHESTRATOR
          </span>
        </div>
        <div className="mono" style={{
          fontSize: '10px',
          color: sending ? 'var(--color-warning)' : 'var(--color-success)',
          letterSpacing: '0.1em',
        }}>
          {sending ? '[ EXECUTING... ]' : '[ ARMED ]'}
        </div>
      </div>

      <div className="copilot-body">
        <div className="copilot-avatar-column">
          <CopilotAvatar listening={listening} energy={energy} phoneConnected={phoneConnected} />
          <div className="copilot-status-grid">
            <span className="copilot-status-pill">{listening ? 'LISTENING' : 'MIC STANDBY'}</span>
            <span className="copilot-status-pill">{phoneConnected ? 'PHONE LINKED' : 'PHONE STANDBY'}</span>
            <span className="copilot-status-pill">{sending ? 'ENGINE BUSY' : 'ENGINE READY'}</span>
            <span className="copilot-status-pill">{energy > 60 ? 'HIGH ENERGY' : 'STABILIZING'}</span>
          </div>
          {matchedSkill && (
            <div className="copilot-active-skill">
              <span>Active skill</span>
              <strong>{matchedSkill.label}</strong>
            </div>
          )}
          <div className="copilot-skill-list">
            {skillPreview.map(skill => (
              <div key={skill.id} className="copilot-skill-card">
                <span className="label">{skill.label}</span>
                <span className="description">{skill.description}</span>
                <span className="mode">{skill.category} · {skill.mode}</span>
              </div>
            ))}
          </div>
          <button
            className="copilot-action-btn"
            onClick={togglePhone}
            style={{ width: '100%', marginTop: '6px' }}
          >
            {phoneConnected ? '[ SEVER PHONE LINK ]' : '[ LINK REMOTE DEVICE ]'}
          </button>
        </div>

        <div className="copilot-chat-column">
          <div className="copilot-quick-actions">
            {quickActions.map((qa, i) => (
              <button
                key={i}
                className="copilot-action-btn"
                style={{ flex: '1 1 auto' }}
                onClick={() => { setInput(qa.cmd); inputRef.current?.focus() }}
                disabled={sending}
              >
                {qa.label}
              </button>
            ))}
          </div>
          <div className="copilot-nav-actions">
            {navShortcuts.map((nav) => (
              <button
                key={nav.path}
                className="copilot-nav-btn mono"
                onClick={() => triggerNavigation(nav.path, nav.label)}
              >
                <span>{nav.label}</span>
                <small>{nav.hint}</small>
              </button>
            ))}
          </div>
          {navIntent && (
            <div className="copilot-nav-intent">
              <span>Navegando hacia</span>
              <strong>{navIntent.label}</strong>
            </div>
          )}
          <div className="copilot-messages">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'thinking' && (
                  <div className="copilot-message copilot-message--system" style={{ opacity: 0.6 }}>
                    <span className="copilot-thinking-pulse">
                      COPILOT IS EXECUTING TOOLS...
                    </span>
                  </div>
                )}

                {msg.role !== 'thinking' && (
                  <div className={`copilot-message copilot-message--${msg.role === 'assistant' ? 'ai' : msg.role}`}>
                    {msg.content}
                  </div>
                )}

                {msg.tools?.length > 0 && (
                  <div className="copilot-tools-row">
                    {msg.tools.map((t, j) => (
                      <ToolBadge key={j} tool={t.tool} success={t.success} error={t.error} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="copilot-input-bar">
            <input
              ref={inputRef}
              className="copilot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Busca restaurantes en Barcelona... / Genera un email para... / Estado del pipeline..."
              disabled={sending}
            />
            <button
              className="copilot-send"
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? '...' : 'EXEC'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CopilotChat
