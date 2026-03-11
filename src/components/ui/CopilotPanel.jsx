// ═══════════════════════════════════════════════════
// OCULOPS — CopilotPanel (Global Side-Panel)
// Persistent copilot accessible from every screen
// ═══════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEdgeFunction } from '../../hooks/useEdgeFunction'
import MasterIntelligence from '../modules/CopilotAvatar'
import './CopilotPanel.css'

const TOOL_ICONS = {
  atlas_scan: '🔭', hunter_qualify: '🎯', cortex_orchestrate: '🧠',
  oracle_analyze: '📊', sentinel_monitor: '🗼', forge_generate: '🔨',
  outreach_stage: '📧', deal_score: '⚖️', query_data: '🔍', navigate: '🧭',
  crm_create_contact: '👤', crm_create_deal: '💎', pipeline_move: '🔄',
  task_create: '📌', proposal_generate: '📄', scraper_analyze: '🕷️',
}

function CopilotPanel({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'COPILOT STANDBY — READY FOR DIRECTIVES' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { execute } = useEdgeFunction('agent-copilot')

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'thinking', content: 'PROCESSING...' }])

    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-16)
        .map(m => ({ role: m.role, content: m.content }))

      const result = await execute({ message: text, history })

      setMessages(prev => prev.filter(m => m.role !== 'thinking'))

      if (result?.response) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.response,
          tools: result.tools_executed || [],
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'system', content: 'NO RESPONSE — CHECK SYSTEM STATUS',
        }])
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.role !== 'thinking'))
      setMessages(prev => [...prev, {
        role: 'system', content: `ERROR: ${err.message?.toUpperCase() || 'UNKNOWN'}`,
      }])
    }

    setSending(false)
  }, [input, sending, messages, execute])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const quickActions = [
    { label: 'PIPELINE STATUS', cmd: 'Show me the current pipeline status and deals' },
    { label: 'SCAN LEADS', cmd: 'Run a lead discovery scan for restaurants in Madrid' },
    { label: 'HEALTH CHECK', cmd: 'Run a system health check with Sentinel' },
  ]

  if (!open) return null

  return (
    <>
      <div className="copilot-overlay" onClick={onClose} />
      <div className="copilot-panel">
        {/* Header */}
        <div className="copilot-panel__header">
          <div className="copilot-panel__title">
            <MasterIntelligence state={sending ? 'processing' : 'idle'} energy={sending ? 75 : 45} />
            <div>
              <h2 className="copilot-panel__name">MASTER INTELLIGENCE</h2>
              <span className="copilot-panel__status mono">
                {sending ? '[ EXECUTING ]' : '[ ARMED ]'}
              </span>
            </div>
          </div>
          <button className="copilot-panel__close" onClick={onClose}>&times;</button>
        </div>

        {/* Quick Actions */}
        <div className="copilot-panel__actions">
          {quickActions.map((qa, i) => (
            <button
              key={i}
              className="copilot-panel__action-btn mono"
              onClick={() => { setInput(qa.cmd); inputRef.current?.focus() }}
              disabled={sending}
            >
              {qa.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="copilot-panel__messages">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'thinking' ? (
                <div className="copilot-panel__msg copilot-panel__msg--system" style={{ opacity: 0.5 }}>
                  <span className="copilot-panel__thinking-pulse">EXECUTING...</span>
                </div>
              ) : (
                <div className={`copilot-panel__msg copilot-panel__msg--${msg.role === 'assistant' ? 'ai' : msg.role}`}>
                  {msg.content}
                </div>
              )}
              {msg.tools?.length > 0 && (
                <div className="copilot-panel__tools">
                  {msg.tools.map((t, j) => (
                    <span key={j} className="copilot-panel__tool-badge">
                      {TOOL_ICONS[t.tool] || '⚙️'} {t.tool?.replace(/_/g, ' ')}
                      <span style={{ color: t.success ? 'var(--color-success)' : 'var(--color-danger)', marginLeft: 4 }}>
                        {t.success ? 'OK' : 'ERR'}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="copilot-panel__input-bar">
          <input
            ref={inputRef}
            className="copilot-panel__input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Directive..."
            disabled={sending}
          />
          <button
            className="copilot-panel__send"
            onClick={handleSend}
            disabled={sending || !input.trim()}
          >
            {sending ? '...' : 'EXEC'}
          </button>
        </div>
      </div>
    </>
  )
}

export default CopilotPanel
