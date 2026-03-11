import { useMemo } from 'react'
import './CopilotChat.css'

export default function CopilotAvatar({ listening, energy, phoneConnected }) {
  const rings = useMemo(() => Array.from({ length: 3 }, (_, i) => i), [])
  return (
    <div className="copilot-avatar-shell">
      <div className="copilot-avatar-glow" aria-hidden />
      <div className={`copilot-figure ${listening ? 'listening' : ''}`}>
        <div className="copilot-figure-head" />
        <div className="copilot-figure-torso">
          <span className="copilot-figure-core" />
        </div>
        <div className="copilot-figure-limb left" />
        <div className="copilot-figure-limb right" />
        <div className="copilot-figure-base" />
      </div>
      <div className="copilot-avatar-targets">
        {rings.map((ring, idx) => (
          <span key={ring} className="copilot-avatar-ring" style={{ animationDelay: `${idx * 0.2}s` }} />
        ))}
      </div>
      <div className="copilot-avatar-metric">
        <span className="mono">ENERGY</span>
        <strong>{energy}%</strong>
        <small>{phoneConnected ? 'PHONE LINKED' : 'PHONE STANDBY'}</small>
      </div>
    </div>
  )
}
