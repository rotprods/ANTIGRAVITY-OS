// ═══════════════════════════════════════════════════
// OCUL OFFICE — War Building
// Real-time pixel world of OCULOPS agents
// ═══════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react'
import { COLS, ROWS, TILE, SCALE, ROOMS, AGENT_CONFIG } from '../../pixel/officeConfig'
import { draw } from '../../pixel/officeRenderer'
import { usePixelOffice } from '../../pixel/usePixelOffice'
import './PixelOffice.css'

const CANVAS_W = COLS * TILE * SCALE
const CANVAS_H = ROWS * TILE * SCALE

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value, color }) {
  return (
    <div className="ocul-stat-badge">
      <div className="ocul-stat-dot" style={{ background: color }} />
      <span className="ocul-stat-label">{label}</span>
      <span className="ocul-stat-value" style={{ color }}>{value}</span>
    </div>
  )
}

function FeedEntry({ entry }) {
  const icons = { started: '▶', completed: '✓', error: '✗', lead: '◆', signal: '◉' }
  const icon = icons[entry.event] || '·'
  const ts = entry.ts
    ? new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''
  return (
    <div className="feed-entry">
      <span className="feed-ts">{ts}</span>
      <span className="feed-icon" style={{ color: entry.color }}>{icon}</span>
      <span className="feed-agent" style={{ color: entry.color }}>
        {(entry.codeName || '').toUpperCase()}
      </span>
      <span className="feed-text">{entry.text}</span>
    </div>
  )
}

function AgentPanel({ agentId, onClose }) {
  const cfg = AGENT_CONFIG[agentId]
  const room = ROOMS.find(r => r.agent === agentId)
  if (!cfg || !room) return null

  return (
    <div className="ocul-agent-panel" style={{ '--agent-color': cfg.color }}>
      <div className="ocul-agent-panel-header">
        <div className="ocul-agent-panel-title">
          <span className="ocul-agent-panel-dot" />
          <span>{cfg.label}</span>
        </div>
        <button className="ocul-agent-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="ocul-agent-panel-room">{room.label}</div>
      <div className="ocul-agent-panel-desc">{room.description}</div>
      <div className="ocul-agent-panel-objects">
        <div className="ocul-panel-section-label">ROOM OBJECTS</div>
        {room.objects.map((obj, i) => (
          <div key={i} className="ocul-agent-panel-obj">
            <span className="ocul-panel-obj-dot" />
            {obj.type.replace(/([A-Z])/g, ' $1').toUpperCase()}
            {obj.label && <span className="ocul-panel-obj-label"> · {obj.label}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function DemoControls({ spawnAgent, completeAgent, errorAgent, agentStatesRef }) {
  const [open, setOpen] = useState(false)
  const agents = Object.keys(AGENT_CONFIG)

  return (
    <div className="ocul-demo">
      <button className="ocul-demo-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲ DEMO' : '▼ DEMO'}
      </button>
      {open && (
        <div className="ocul-demo-panel">
          <div className="ocul-demo-label">SPAWN AGENT</div>
          <div className="ocul-demo-grid">
            {agents.map(id => {
              const cfg = AGENT_CONFIG[id]
              return (
                <button
                  key={id}
                  className="ocul-demo-btn"
                  style={{ '--btn-color': cfg.color }}
                  onClick={() => spawnAgent(id, `test task for ${id}`)}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
          <div className="ocul-demo-row">
            <button className="ocul-demo-action" onClick={() => {
              agents.forEach((id, i) => setTimeout(() => spawnAgent(id, `batch task ${i + 1}`), i * 500))
            }}>
              ⚡ ALL AGENTS
            </button>
            <button className="ocul-demo-action danger" onClick={() => {
              const id = agents[Math.floor(Math.random() * agents.length)]
              errorAgent(id, 'rate limit exceeded')
            }}>
              ✗ ERROR
            </button>
            <button className="ocul-demo-action success" onClick={() => {
              const working = Object.entries(agentStatesRef.current)
                .find(([, v]) => v?.state === 'working')
              const id = working ? working[0] : agents[0]
              completeAgent(id, '24 leads found')
            }}>
              ✓ COMPLETE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PixelOffice() {
  const canvasRef = useRef(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [renderTick, setRenderTick] = useState(0)

  const {
    agentStatesRef,
    particlesRef,
    activeLinksRef,
    tickRef,
    liveFeed,
    stats,
    tick,
    spawnAgent,
    completeAgent,
    errorAgent,
  } = usePixelOffice()

  // ── RAF render loop ──────────────────────────────────────────────────────────

  useEffect(() => {
    let rafId

    const loop = () => {
      tick()

      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        draw(ctx, {
          tick: tickRef.current,
          agentStates: agentStatesRef.current,
          particles: particlesRef.current,
          activeLinks: activeLinksRef.current,
        })
      }

      // Sync active count to React state every 60 frames
      if (tickRef.current % 60 === 0) {
        setRenderTick(t => t + 1)
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [tick, agentStatesRef, particlesRef, activeLinksRef, tickRef])

  // ── Canvas click → select agent room ────────────────────────────────────────

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY
    const S = TILE * SCALE

    const clicked = ROOMS.find(r =>
      cx >= r.x * S && cx <= (r.x + r.w) * S &&
      cy >= r.y * S && cy <= (r.y + r.h) * S
    )

    setSelectedAgent(prev => clicked ? (prev === clicked.agent ? null : clicked.agent) : null)
  }, [])

  // Derived stats (re-computed every 60 frames via renderTick)
  const activeCount = Object.values(agentStatesRef.current)
    .filter(s => ['walking', 'working'].includes(s?.state)).length

  const successRate = stats.total > 0
    ? Math.round(((stats.total - stats.errors) / stats.total) * 100)
    : 100

  return (
    <div className="ocul-office">

      {/* ── Header HUD ── */}
      <div className="ocul-hud">
        <div className="ocul-hud-left">
          <div className="ocul-hud-logo">
            <span className="ocul-hud-pulse" />
            OCUL OFFICE
          </div>
          <div className="ocul-hud-sub">WAR BUILDING · FLOOR 01</div>
        </div>

        <div className="ocul-hud-stats">
          <StatBadge label="ACTIVE" value={activeCount} color="var(--color-primary)" />
          <StatBadge label="DEPLOYED" value={stats.total} color="#8b5cf6" />
          <StatBadge label="SUCCESS" value={`${successRate}%`} color="#10b981" />
          <StatBadge label="ERRORS" value={stats.errors} color="#ef4444" />
        </div>

        <div className="ocul-hud-right">
          <DemoControls
            spawnAgent={spawnAgent}
            completeAgent={completeAgent}
            errorAgent={errorAgent}
            agentStatesRef={agentStatesRef}
          />
        </div>
      </div>

      {/* ── World ── */}
      <div className="ocul-world">
        <div className={`ocul-viewport ${selectedAgent ? 'has-panel' : ''}`}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="ocul-canvas"
            onClick={handleCanvasClick}
            title="Click a room to inspect"
          />
        </div>

        {selectedAgent && (
          <AgentPanel
            agentId={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>

      {/* ── Live Feed ── */}
      <div className="ocul-feed">
        <div className="ocul-feed-label">
          <span className="ocul-feed-pulse" />
          LIVE FEED
        </div>
        <div className="ocul-feed-scroll">
          {liveFeed.length === 0 ? (
            <span className="ocul-feed-empty">Waiting for agent activity…</span>
          ) : (
            liveFeed.map(entry => <FeedEntry key={entry.id} entry={entry} />)
          )}
        </div>
      </div>

    </div>
  )
}
