// ═══════════════════════════════════════════════════
// OCULOPS — Copilot Chat Module
// AI Brain with tool-calling orchestration
// ═══════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEdgeFunction } from '../../hooks/useEdgeFunction'
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
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { execute } = useEdgeFunction('agent-copilot')

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])
  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setSending(true)

    // Show thinking indicator
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
              setTimeout(() => navigate(action.payload.path), 500)
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

  return (
    <div className="copilot-container fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border)',
      }}>
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

      {/* Quick Actions */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto',
      }}>
        {quickActions.map((qa, i) => (
          <button
            key={i}
            className="mono"
            style={{
              fontSize: '9px',
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--color-text-2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onClick={() => { setInput(qa.cmd); inputRef.current?.focus() }}
            disabled={sending}
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="copilot-messages">
        {messages.map((msg, i) => (
          <div key={i}>
            {/* Thinking indicator */}
            {msg.role === 'thinking' && (
              <div className="copilot-message copilot-message--system" style={{ opacity: 0.6 }}>
                <span className="copilot-thinking-pulse">
                  COPILOT IS EXECUTING TOOLS...
                </span>
              </div>
            )}

            {/* Regular messages */}
            {msg.role !== 'thinking' && (
              <div className={`copilot-message copilot-message--${msg.role === 'assistant' ? 'ai' : msg.role}`}>
                {msg.content}
              </div>
            )}

            {/* Tool execution badges */}
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

      {/* Input */}
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
  )
}

export default CopilotChat
