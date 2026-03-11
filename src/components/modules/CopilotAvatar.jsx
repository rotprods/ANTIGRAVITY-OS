import { useState, useMemo } from 'react'
import './CopilotChat.css'

export default function MasterIntelligence({ state = 'idle', energy = 75, phoneConnected = false }) {
  const [hovered, setHovered] = useState(false)
  const rings = useMemo(() => [0, 1, 2], [])

  // External state wins over hover (don't interrupt processing/responding)
  const effectiveState = (state === 'processing' || state === 'responding')
    ? state
    : hovered ? 'listening' : state

  // Energy fill via conic-gradient from bottom (270deg start)
  const energyAngle = Math.round((energy / 100) * 360)

  return (
    <div
      className={`master-intelligence master-intelligence--${effectiveState}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
      role="img"
      aria-label={`Master Intelligence — ${effectiveState}, energy ${energy}%`}
    >
      <div className="mi-glow" aria-hidden="true" />
      <div className="mi-rings" aria-hidden="true">
        {rings.map((_, idx) => (
          <span key={idx} className="mi-ring" style={{ animationDelay: `${idx * 0.35}s` }} />
        ))}
      </div>
      <div className="mi-orb">
        <div
          className="mi-energy-fill"
          style={{ '--energy-angle': `${energyAngle}deg` }}
          aria-hidden="true"
        />
        <div className="mi-core" aria-hidden="true" />
        {(effectiveState === 'processing' || effectiveState === 'responding') && (
          <div className="mi-particles" aria-hidden="true">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className="mi-particle" style={{ animationDelay: `${-(i * 0.35)}s` }} />
            ))}
          </div>
        )}
      </div>
      <div className="mi-metric">
        <span>ENERGY</span>
        <strong>{energy}%</strong>
        <small>{phoneConnected ? 'LINKED' : 'STANDBY'}</small>
      </div>
    </div>
  )
}
