// ═══════════════════════════════════════════════════
// OCUL OFFICE — Canvas 2D Renderer
// Pure drawing functions, no React, no state
// ═══════════════════════════════════════════════════

import {
  TILE, SCALE, COLS, ROWS, CORRIDOR_ROW, CORRIDOR_H,
  ROOMS, AGENT_CONFIG, SPRITE_FRAMES, WALK_FRAMES,
} from './officeConfig'

const S = TILE * SCALE   // canvas pixels per tile
const SKIN = '#F5CBA7'
const DARK = '#111122'

// ─── Utilities ────────────────────────────────────────────────────────────────

function tx(col) { return col * S }
function ty(row) { return row * S }


function ease(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// ─── Background ───────────────────────────────────────────────────────────────

export function drawBackground(ctx) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, tx(COLS), ty(ROWS))
}

// ─── Corridor ─────────────────────────────────────────────────────────────────

export function drawCorridor(ctx, tick) {
  const x = 0
  const y = ty(CORRIDOR_ROW)
  const w = tx(COLS)
  const h = ty(CORRIDOR_H)

  ctx.fillStyle = '#060606'
  ctx.fillRect(x, y, w, h)

  // Tile grid in corridor
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'
  ctx.lineWidth = 1
  for (let c = 0; c < COLS; c++) {
    ctx.strokeRect(tx(c), y, S, h)
  }

  // Animated dotted center stripe
  const stripeY = y + h / 2 - 1
  ctx.fillStyle = 'rgba(255,200,0,0.12)'
  ctx.fillRect(x, stripeY, w, 2)

  const dashW = S * 1.5
  const dashGap = S
  const offset = -(tick * 0.5) % (dashW + dashGap)
  ctx.fillStyle = 'rgba(255,200,0,0.4)'
  for (let cx2 = offset; cx2 < w; cx2 += dashW + dashGap) {
    ctx.fillRect(cx2, stripeY, dashW, 2)
  }

  // CORRIDOR label
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.font = `bold ${Math.floor(S * 0.45)}px "JetBrains Mono",monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('— CORRIDOR —', w / 2, y + h / 2)
  ctx.textBaseline = 'alphabetic'
}

// ─── Room Floor ───────────────────────────────────────────────────────────────

function drawRoomFloor(ctx, room) {
  const rx = tx(room.x)
  const ry = ty(room.y)
  const rw = tx(room.w)
  const rh = ty(room.h)

  ctx.fillStyle = room.floorColor
  ctx.fillRect(rx, ry, rw, rh)

  // Tile grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'
  ctx.lineWidth = 1
  for (let c = 0; c < room.w; c++) {
    for (let r = 0; r < room.h; r++) {
      ctx.strokeRect(rx + tx(c), ry + ty(r), S, S)
    }
  }
}

function drawRoomBorder(ctx, room, isActive, tick) {
  const rx = tx(room.x)
  const ry = ty(room.y)
  const rw = tx(room.w)
  const rh = ty(room.h)
  const [r, g, b] = room.rgb
  const pulse = isActive ? 0.5 + 0.5 * Math.sin(tick * 0.06) : 0
  const alpha = isActive ? 0.5 + 0.3 * pulse : 0.18

  ctx.shadowColor = `rgba(${r},${g},${b},${alpha})`
  ctx.shadowBlur = isActive ? 18 + 6 * pulse : 6
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha + 0.1})`
  ctx.lineWidth = isActive ? 2 : 1
  ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2)
  ctx.shadowBlur = 0
}

function drawRoomLabel(ctx, room, isActive) {
  const rx = tx(room.x)
  const ry = ty(room.y)
  const rw = tx(room.w)
  const [r, g, b] = room.rgb
  const alpha = isActive ? 0.9 : 0.4

  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
  ctx.font = `bold ${Math.floor(S * 0.38)}px "JetBrains Mono",monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(room.label, rx + rw / 2, ry + Math.floor(S * 0.25))

  ctx.fillStyle = `rgba(255,255,255,${isActive ? 0.3 : 0.12})`
  ctx.font = `${Math.floor(S * 0.24)}px "JetBrains Mono",monospace`
  ctx.fillText(room.description, rx + rw / 2, ry + Math.floor(S * 0.7))
  ctx.textBaseline = 'alphabetic'
}

// ─── Objects ──────────────────────────────────────────────────────────────────

function drawTripleMonitor(ctx, ox, oy, active, tick, rgb, label) {
  const [r, g, b] = rgb
  const frameW = S * 3
  const frameH = S * 2

  ctx.fillStyle = '#0e0e1a'
  ctx.fillRect(ox, oy + 4, frameW, frameH - 4)

  for (let i = 0; i < 3; i++) {
    const sw = Math.floor(frameW / 3) - 4
    const sx = ox + i * Math.floor(frameW / 3) + 2
    const sy = oy + 6
    const sh = frameH - 14

    if (active) {
      const flicker = 0.8 + 0.2 * Math.sin(tick * 0.12 + i * 1.4)
      ctx.fillStyle = `rgba(${r},${g},${b},${flicker * 0.12})`
      ctx.fillRect(sx, sy, sw, sh)

      ctx.shadowColor = `rgba(${r},${g},${b},0.9)`
      ctx.shadowBlur = 8
      ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`
      ctx.lineWidth = 1
      ctx.strokeRect(sx, sy, sw, sh)
      ctx.shadowBlur = 0

      // Scan line
      const scanY = Math.floor(((tick * 0.8 + i * 25) % sh) + sy)
      ctx.fillStyle = `rgba(${r},${g},${b},0.35)`
      ctx.fillRect(sx, scanY, sw, 1)

      // Data lines
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
      for (let ln = 0; ln < 3; ln++) {
        const lineLen = sw * (0.4 + 0.5 * Math.abs(Math.sin(tick * 0.04 + ln * 1.5 + i * 2)))
        ctx.fillRect(sx + 2, sy + 4 + ln * 5, lineLen, 1)
      }
    } else {
      ctx.fillStyle = '#0a0a12'
      ctx.fillRect(sx, sy, sw, sh)
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 1
      ctx.strokeRect(sx, sy, sw, sh)
    }
  }

  // Stand
  ctx.fillStyle = '#151520'
  ctx.fillRect(ox + Math.floor(frameW / 2) - 4, oy + frameH - 4, 8, 6)

  // Label
  if (label && active) {
    ctx.fillStyle = `rgba(${r},${g},${b},0.6)`
    ctx.font = `${Math.floor(S * 0.2)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, ox + frameW / 2, oy + 4)
    ctx.textBaseline = 'alphabetic'
  }
}

function drawStatusBoard(ctx, ox, oy, active, tick, rgb, _label) {
  const [r, g, b] = rgb
  const bw = S * 2
  const bh = S * 3

  ctx.fillStyle = '#0c0c18'
  ctx.fillRect(ox, oy, bw, bh)

  if (active) {
    ctx.shadowColor = `rgba(${r},${g},${b},0.7)`
    ctx.shadowBlur = 12
    ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
    ctx.shadowBlur = 0

    // Status bars
    for (let i = 0; i < 5; i++) {
      const barVal = 0.3 + 0.7 * Math.abs(Math.sin(tick * 0.03 + i * 1.1))
      const barW = Math.floor((bw - 8) * barVal)
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`
      ctx.fillRect(ox + 4, oy + 6 + i * 9, barW, 4)
    }
  } else {
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
  }
}

function drawRoundTable(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const tw = S * 3
  const th = S * 2

  ctx.fillStyle = active ? '#1a1428' : '#111118'
  ctx.fillRect(ox, oy, tw, th)
  ctx.strokeStyle = active ? `rgba(${r},${g},${b},0.4)` : '#1e1e2e'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, tw, th)

  // Chairs suggestion
  ctx.fillStyle = active ? `rgba(${r},${g},${b},0.25)` : 'rgba(255,255,255,0.05)'
  ctx.fillRect(ox + 4, oy + th - 6, 8, 4)
  ctx.fillRect(ox + tw - 12, oy + th - 6, 8, 4)
}

function drawDataScreen(ctx, ox, oy, active, tick, rgb, _label) {
  const [r, g, b] = rgb
  const sw = S * 2
  const sh = S * 3

  ctx.fillStyle = '#0a0a14'
  ctx.fillRect(ox, oy, sw, sh)

  if (active) {
    ctx.shadowColor = `rgba(${r},${g},${b},0.8)`
    ctx.shadowBlur = 14
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)
    ctx.shadowBlur = 0

    // Animated data bars (chart)
    for (let i = 0; i < 5; i++) {
      const h2 = Math.floor((sh - 12) * (0.2 + 0.8 * Math.abs(Math.sin(tick * 0.04 + i * 0.9))))
      const bx = ox + 4 + i * Math.floor((sw - 8) / 5)
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`
      ctx.fillRect(bx, oy + sh - 6 - h2, Math.floor((sw - 8) / 5) - 2, h2)
    }

    // Blinking cursor
    if (Math.floor(tick / 20) % 2 === 0) {
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
      ctx.fillRect(ox + 4, oy + 4, 3, 6)
    }
  } else {
    ctx.strokeStyle = '#14142a'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)
  }
}

function drawChartBoard(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const bw = S * 3
  const bh = S * 3

  ctx.fillStyle = '#0c0c1a'
  ctx.fillRect(ox, oy, bw, bh)

  if (active) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)

    // Draw line chart
    ctx.beginPath()
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      const px = ox + 4 + i * Math.floor((bw - 8) / 7)
      const py = oy + bh - 8 - Math.floor((bh - 16) * Math.abs(Math.sin(tick * 0.025 + i * 0.7)))
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // Grid lines
    ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(ox + 2, oy + i * Math.floor(bh / 4))
      ctx.lineTo(ox + bw - 2, oy + i * Math.floor(bh / 4))
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
  }
}

function drawConsole(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const cw = S * 2
  const ch = S * 2

  ctx.fillStyle = '#080810'
  ctx.fillRect(ox, oy, cw, ch)

  if (active) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, cw, ch)

    // Terminal lines
    ctx.fillStyle = `rgba(${r},${g},${b},0.7)`
    ctx.font = `${Math.floor(S * 0.18)}px monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const lines = ['> EXEC', '> OK', '> RUN..']
    lines.slice(0, Math.floor(tick / 30) % 4 + 1).forEach((ln, i) => {
      ctx.fillText(ln, ox + 3, oy + 4 + i * 7)
    })
    // Blink cursor
    if (Math.floor(tick / 15) % 2 === 0) {
      ctx.fillText('▌', ox + 3, oy + 4 + Math.floor(tick / 30) % 4 * 7)
    }
    ctx.textBaseline = 'alphabetic'
  } else {
    ctx.strokeStyle = '#111122'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, cw, ch)
  }
}

function drawTypewriter(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const tw = S * 2
  const th = S * 2

  ctx.fillStyle = '#1a1510'
  ctx.fillRect(ox, oy, tw, th)
  ctx.strokeStyle = active ? `rgba(${r},${g},${b},0.6)` : '#2a1f10'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, tw, th)

  if (active) {
    // Paper strip
    ctx.fillStyle = `rgba(255,255,255,0.85)`
    ctx.fillRect(ox + 4, oy, tw - 8, 5)

    // Keys bouncing
    const keyRow = Math.floor(tick / 4) % 3
    for (let k = 0; k < 5; k++) {
      const ky = oy + th - 12 + (k === keyRow ? 2 : 0)
      ctx.fillStyle = k === keyRow && active ? `rgba(${r},${g},${b},0.8)` : '#2a1a08'
      ctx.fillRect(ox + 4 + k * 8, ky, 6, 6)
    }

    // Text on paper
    ctx.fillStyle = `rgba(0,0,0,0.7)`
    ctx.font = `${Math.floor(S * 0.15)}px monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('GEN..', ox + 4, oy + 1)
    ctx.textBaseline = 'alphabetic'
  }
}

function drawContentBoard(ctx, ox, oy, active, tick, rgb, _label) {
  const [r, g, b] = rgb
  const bw = S * 3
  const bh = S * 3

  ctx.fillStyle = '#0e140e'
  ctx.fillRect(ox, oy, bw, bh)

  if (active) {
    ctx.shadowColor = `rgba(${r},${g},${b},0.6)`
    ctx.shadowBlur = 10
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
    ctx.shadowBlur = 0

    // Content lines
    ctx.fillStyle = `rgba(${r},${g},${b},0.6)`
    for (let i = 0; i < 6; i++) {
      const lineW = (bw - 10) * (0.5 + 0.5 * Math.abs(Math.sin(tick * 0.02 + i)))
      ctx.fillRect(ox + 5, oy + 6 + i * 8, lineW, 3)
    }
  } else {
    ctx.strokeStyle = '#1a2a1a'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
  }
}

function drawRenderScreen(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const sw = S * 4
  const sh = S * 2

  ctx.fillStyle = '#0a120a'
  ctx.fillRect(ox, oy, sw, sh)

  if (active) {
    ctx.shadowColor = `rgba(${r},${g},${b},0.7)`
    ctx.shadowBlur = 10
    ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)
    ctx.shadowBlur = 0

    // Render progress bar
    const progress = (Math.sin(tick * 0.03) + 1) / 2
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
    ctx.fillRect(ox + 4, oy + sh - 10, sw - 8, 6)
    ctx.fillStyle = `rgba(${r},${g},${b},0.8)`
    ctx.fillRect(ox + 4, oy + sh - 10, Math.floor((sw - 8) * progress), 6)
  } else {
    ctx.strokeStyle = '#0f1f0f'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)
  }
}

function drawRadioTower(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb

  // Tower mast
  ctx.fillStyle = active ? `rgba(${r},${g},${b},0.8)` : '#2a2a10'
  ctx.fillRect(ox + S - 2, oy, 4, S * 4)

  // Horizontal bars
  for (let i = 0; i < 4; i++) {
    const barW = (4 - i) * 8
    ctx.fillRect(ox + S - barW / 2, oy + i * S + 4, barW, 2)
  }

  // Animated signal arcs
  if (active) {
    const maxArcs = 3
    for (let a = 0; a < maxArcs; a++) {
      const progress = ((tick * 0.02 + a / maxArcs) % 1)
      const radius = progress * S * 4
      const alpha = (1 - progress) * 0.7
      ctx.beginPath()
      ctx.arc(ox + S, oy, radius, -Math.PI * 0.7, -Math.PI * 0.3)
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

function drawCommsBoard(ctx, ox, oy, active, tick, rgb, _label) {
  const [r, g, b] = rgb
  const bw = S * 4
  const bh = S * 3

  ctx.fillStyle = '#12100a'
  ctx.fillRect(ox, oy, bw, bh)

  if (active) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
    ctx.shadowColor = `rgba(${r},${g},${b},0.5)`
    ctx.shadowBlur = 8
    ctx.shadowBlur = 0

    // Broadcast waveform
    ctx.beginPath()
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`
    ctx.lineWidth = 2
    for (let x = 0; x < bw - 8; x++) {
      const wave = Math.sin((x + tick * 2) * 0.15) * (bh / 4 - 4)
      const py = oy + bh / 2 + wave
      if (x === 0) ctx.moveTo(ox + 4 + x, py)
      else ctx.lineTo(ox + 4 + x, py)
    }
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#1e1a08'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
  }
}

function drawMicrophone(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb

  // Body
  ctx.fillStyle = active ? `rgba(${r},${g},${b},0.7)` : '#252520'
  ctx.fillRect(ox + S / 2 - 4, oy, 8, S)
  // Stand
  ctx.fillStyle = '#1a1a18'
  ctx.fillRect(ox + S / 2 - 6, oy + S, 12, 4)
  ctx.fillRect(ox + S / 2 - 2, oy + S - 8, 4, 10)

  if (active) {
    // Sound wave rings
    const pulse = Math.abs(Math.sin(tick * 0.1))
    ctx.strokeStyle = `rgba(${r},${g},${b},${pulse * 0.6})`
    ctx.lineWidth = 1
    ctx.strokeRect(ox + S / 2 - 8, oy - 4, 16, S + 8)
  }
}

function drawWorldMap(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const mw = S * 5
  const mh = S * 3

  ctx.fillStyle = '#080c14'
  ctx.fillRect(ox, oy, mw, mh)
  ctx.strokeStyle = active ? `rgba(${r},${g},${b},0.6)` : '#0f1825'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, mw, mh)

  // Grid lines (lat/lon)
  ctx.strokeStyle = `rgba(${r},${g},${b},${active ? 0.12 : 0.05})`
  for (let i = 1; i < 5; i++) ctx.strokeRect(ox + 1, oy + i * Math.floor(mh / 4), mw - 2, 1)
  for (let i = 1; i < 10; i++) ctx.strokeRect(ox + i * Math.floor(mw / 9), oy + 1, 1, mh - 2)

  // Geo pins
  const pins = [
    { px: 0.2, py: 0.4 }, { px: 0.5, py: 0.5 }, { px: 0.75, py: 0.35 },
    { px: 0.35, py: 0.65 }, { px: 0.85, py: 0.6 },
  ]
  pins.forEach((pin, i) => {
    const pinX = ox + pin.px * mw
    const pinY = oy + pin.py * mh
    const pulse = active ? 0.5 + 0.5 * Math.sin(tick * 0.08 + i * 1.3) : 0.3
    ctx.fillStyle = `rgba(${r},${g},${b},${pulse})`
    ctx.beginPath()
    ctx.arc(pinX, pinY, active ? 3 + 2 * Math.abs(Math.sin(tick * 0.06 + i)) : 2, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawGeoScanner(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const sw = S * 2
  const sh = S * 2

  ctx.fillStyle = '#080c10'
  ctx.fillRect(ox, oy, sw, sh)

  if (active) {
    const cx2 = ox + sw / 2
    const cy2 = oy + sh / 2
    const radius = Math.min(sw, sh) / 2 - 4

    // Radar circles
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = `rgba(${r},${g},${b},0.2)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx2, cy2, (radius * i) / 3, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Sweep line
    const angle = (tick * 0.04) % (Math.PI * 2)
    ctx.shadowColor = `rgba(${r},${g},${b},0.8)`
    ctx.shadowBlur = 6
    ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx2, cy2)
    ctx.lineTo(cx2 + Math.cos(angle) * radius, cy2 + Math.sin(angle) * radius)
    ctx.stroke()
    ctx.shadowBlur = 0
  } else {
    ctx.strokeStyle = '#0f1820'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)
  }
}

function drawTargetBoard(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const size = S * 4
  const cx2 = ox + size / 2
  const cy2 = oy + size / 2

  // Background
  ctx.fillStyle = '#140808'
  ctx.fillRect(ox, oy, size, size)

  const rings = active
    ? ['#ef4444', '#ffffff', '#ef4444', '#ffffff', '#ef4444']
    : ['#2a0808', '#1a1a1a', '#2a0808', '#1a1a1a', '#2a0808']

  rings.forEach((color, i) => {
    const radius = (size / 2 - 4) * (1 - i * 0.18)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx2, cy2, radius, 0, Math.PI * 2)
    ctx.fill()
  })

  if (active) {
    // Crosshair
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1)
    ctx.strokeStyle = `rgba(${r},${g},${b},${pulse})`
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(cx2 - size / 2 + 2, cy2)
    ctx.lineTo(cx2 + size / 2 - 2, cy2)
    ctx.moveTo(cx2, cy2 - size / 2 + 2)
    ctx.lineTo(cx2, cy2 + size / 2 - 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawLeadScanner(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const sw = S * 2
  const sh = S * 2

  ctx.fillStyle = '#120e08'
  ctx.fillRect(ox, oy, sw, sh)

  if (active) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)

    // Scanning bar
    const scanY = oy + ((tick * 1.2) % sh)
    ctx.fillStyle = `rgba(${r},${g},${b},0.3)`
    ctx.fillRect(ox, scanY, sw, 3)

    // Hit dots
    const numHits = 4
    for (let i = 0; i < numHits; i++) {
      if (Math.sin(tick * 0.05 + i * 2.1) > 0.3) {
        ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
        ctx.fillRect(
          ox + 4 + Math.floor(Math.abs(Math.sin(i * 1.7)) * (sw - 8)),
          oy + 4 + Math.floor(Math.abs(Math.sin(i * 2.3)) * (sh - 8)),
          3, 3
        )
      }
    }
  } else {
    ctx.strokeStyle = '#1e1408'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, sw, sh)
  }
}

function drawThreatMonitor(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const mw = S * 4
  const mh = S * 3

  ctx.fillStyle = '#140808'
  ctx.fillRect(ox, oy, mw, mh)

  if (active) {
    const warningPulse = 0.5 + 0.5 * Math.sin(tick * 0.15)
    ctx.shadowColor = `rgba(${r},${g},${b},${warningPulse})`
    ctx.shadowBlur = 16
    ctx.strokeStyle = `rgba(${r},${g},${b},${warningPulse + 0.2})`
    ctx.lineWidth = 2
    ctx.strokeRect(ox, oy, mw, mh)
    ctx.shadowBlur = 0

    // WARNING text
    ctx.fillStyle = `rgba(${r},${g},${b},${warningPulse})`
    ctx.font = `bold ${Math.floor(S * 0.32)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('⚠ MONITOR', ox + mw / 2, oy + mh / 2)
    ctx.textBaseline = 'alphabetic'

    // Threat bars
    for (let i = 0; i < 4; i++) {
      const threat = Math.abs(Math.sin(tick * 0.05 + i * 1.3))
      const threatColor = threat > 0.7 ? `rgba(${r},${g},${b},0.9)` : `rgba(${r},${g},${b},0.3)`
      ctx.fillStyle = threatColor
      ctx.fillRect(ox + 4, oy + 6 + i * 8, Math.floor((mw - 8) * threat), 4)
    }
  } else {
    ctx.strokeStyle = '#200808'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, mw, mh)
    ctx.fillStyle = 'rgba(239,68,68,0.1)'
    ctx.font = `${Math.floor(S * 0.22)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('STANDBY', ox + mw / 2, oy + mh / 2)
    ctx.textBaseline = 'alphabetic'
  }
}

function drawAlertLight(ctx, ox, oy, active, tick) {
  const radius = S / 2 - 2
  const cx2 = ox + S / 2
  const cy2 = oy + S / 2

  if (active) {
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.2)
    ctx.shadowColor = `rgba(239,68,68,${pulse})`
    ctx.shadowBlur = 14
    ctx.fillStyle = `rgba(239,68,68,${0.6 + 0.4 * pulse})`
  } else {
    ctx.fillStyle = '#2a1010'
    ctx.shadowBlur = 0
  }
  ctx.beginPath()
  ctx.arc(cx2, cy2, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawCameraArray(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const aw = S * 5
  const ah = S * 2

  ctx.fillStyle = '#0e0a0a'
  ctx.fillRect(ox, oy, aw, ah)
  ctx.strokeStyle = active ? `rgba(${r},${g},${b},0.4)` : '#1a0808'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, aw, ah)

  for (let i = 0; i < 4; i++) {
    const camX = ox + 8 + i * Math.floor((aw - 16) / 3)
    const camY = oy + ah / 2
    const isLive = active && Math.sin(tick * 0.1 + i * 1.5) > 0
    ctx.fillStyle = isLive ? `rgba(${r},${g},${b},0.9)` : '#1a0808'
    ctx.beginPath()
    ctx.arc(camX, camY, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPhoneBank(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb

  for (let i = 0; i < 2; i++) {
    const px = ox + i * (S + 4)
    const ringing = active && Math.floor(tick / 15) % 3 === i
    ctx.fillStyle = ringing ? `rgba(${r},${g},${b},0.7)` : '#1a1018'
    ctx.fillRect(px, oy, S, S * 3)
    ctx.strokeStyle = ringing ? `rgba(${r},${g},${b},0.9)` : '#2a1828'
    ctx.lineWidth = 1
    ctx.strokeRect(px, oy, S, S * 3)

    // Keypad dots
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = ringing ? `rgba(${r},${g},${b},0.5)` : '#111'
      ctx.fillRect(px + 4 + (k % 3) * 7, oy + 8 + Math.floor(k / 3) * 8, 4, 4)
    }
  }
}

function drawEmailBoard(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const bw = S * 3
  const bh = S * 3

  ctx.fillStyle = '#100814'
  ctx.fillRect(ox, oy, bw, bh)

  if (active) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)

    // Envelope icons
    for (let i = 0; i < 3; i++) {
      const ey = oy + 6 + i * 10
      const alpha = Math.sin(tick * 0.05 + i * 1.5) > 0 ? 0.9 : 0.3
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.fillRect(ox + 4, ey, bw - 8, 7)
      ctx.fillStyle = `rgba(0,0,0,0.5)`
      ctx.fillRect(ox + 4, ey, (bw - 8) / 2, 3) // flap
    }
  } else {
    ctx.strokeStyle = '#1a0f22'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, bw, bh)
  }
}

function drawServerRack(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const rw = S * 2
  const rh = S * 6

  ctx.fillStyle = '#0a0a10'
  ctx.fillRect(ox, oy, rw, rh)
  ctx.strokeStyle = active ? `rgba(${r},${g},${b},0.5)` : '#1a1a20'
  ctx.lineWidth = 1
  ctx.strokeRect(ox, oy, rw, rh)

  // Server units
  const unitH = 8
  const numUnits = Math.floor(rh / (unitH + 4))
  for (let i = 0; i < numUnits; i++) {
    const uy = oy + 4 + i * (unitH + 4)
    const isActive = active && Math.sin(tick * 0.1 + i * 0.7) > -0.2
    ctx.fillStyle = isActive ? '#0e1020' : '#08080e'
    ctx.fillRect(ox + 2, uy, rw - 4, unitH)

    // Status LED
    const ledColor = isActive ? `rgba(${r},${g},${b},0.9)` : '#111120'
    ctx.fillStyle = ledColor
    ctx.fillRect(ox + rw - 7, uy + 2, 3, 3)
  }
}

function drawNetGraph(ctx, ox, oy, active, tick, rgb) {
  const [r, g, b] = rgb
  const gw = S * 3
  const gh = S * 3

  ctx.fillStyle = '#080c10'
  ctx.fillRect(ox, oy, gw, gh)

  if (active) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, gw, gh)

    // Network nodes
    const nodes = [
      { nx: 0.5, ny: 0.25 },
      { nx: 0.2, ny: 0.7 }, { nx: 0.8, ny: 0.7 },
      { nx: 0.5, ny: 0.8 },
    ]
    // Lines between nodes
    ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`
    ctx.lineWidth = 1
    const lineAlpha = 0.3 + 0.3 * Math.sin(tick * 0.05)
    ctx.setLineDash([2, 2])
    ctx.lineDashOffset = -(tick % 4)
    ;[[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([a, b2]) => {
      ctx.beginPath()
      ctx.moveTo(ox + nodes[a].nx * gw, oy + nodes[a].ny * gh)
      ctx.lineTo(ox + nodes[b2].nx * gw, oy + nodes[b2].ny * gh)
      ctx.strokeStyle = `rgba(${r},${g},${b},${lineAlpha})`
      ctx.stroke()
    })
    ctx.setLineDash([])

    // Node dots
    nodes.forEach((node, i) => {
      const pulse = 0.6 + 0.4 * Math.sin(tick * 0.08 + i * 1.2)
      ctx.shadowColor = `rgba(${r},${g},${b},${pulse})`
      ctx.shadowBlur = 6
      ctx.fillStyle = `rgba(${r},${g},${b},${pulse})`
      ctx.beginPath()
      ctx.arc(ox + node.nx * gw, oy + node.ny * gh, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    })
  } else {
    ctx.strokeStyle = '#0f1820'
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, gw, gh)
  }
}

function drawObject(ctx, room, obj, active, tick) {
  const ox = tx(room.x + obj.lx)
  const oy = ty(room.y + obj.ly)
  const rgb = room.rgb
  const label = obj.label || null

  switch (obj.type) {
    case 'tripleMonitor': return drawTripleMonitor(ctx, ox, oy, active, tick, rgb, label)
    case 'statusBoard': return drawStatusBoard(ctx, ox, oy, active, tick, rgb, label)
    case 'roundTable': return drawRoundTable(ctx, ox, oy, active, tick, rgb)
    case 'dataScreen': return drawDataScreen(ctx, ox, oy, active, tick, rgb, label)
    case 'chartBoard': return drawChartBoard(ctx, ox, oy, active, tick, rgb)
    case 'console': return drawConsole(ctx, ox, oy, active, tick, rgb)
    case 'typewriter': return drawTypewriter(ctx, ox, oy, active, tick, rgb)
    case 'contentBoard': return drawContentBoard(ctx, ox, oy, active, tick, rgb, label)
    case 'renderScreen': return drawRenderScreen(ctx, ox, oy, active, tick, rgb)
    case 'radioTower': return drawRadioTower(ctx, ox, oy, active, tick, rgb)
    case 'commsBoard': return drawCommsBoard(ctx, ox, oy, active, tick, rgb, label)
    case 'microphone': return drawMicrophone(ctx, ox, oy, active, tick, rgb)
    case 'worldMap': return drawWorldMap(ctx, ox, oy, active, tick, rgb)
    case 'geoScanner': return drawGeoScanner(ctx, ox, oy, active, tick, rgb)
    case 'targetBoard': return drawTargetBoard(ctx, ox, oy, active, tick, rgb)
    case 'leadScanner': return drawLeadScanner(ctx, ox, oy, active, tick, rgb)
    case 'threatMonitor': return drawThreatMonitor(ctx, ox, oy, active, tick, rgb)
    case 'alertLight': return drawAlertLight(ctx, ox, oy, active, tick)
    case 'cameraArray': return drawCameraArray(ctx, ox, oy, active, tick, rgb)
    case 'phoneBank': return drawPhoneBank(ctx, ox, oy, active, tick, rgb)
    case 'emailBoard': return drawEmailBoard(ctx, ox, oy, active, tick, rgb)
    case 'serverRack': return drawServerRack(ctx, ox, oy, active, tick, rgb)
    case 'netGraph': return drawNetGraph(ctx, ox, oy, active, tick, rgb)
    default: break
  }
}

// ─── Agent Sprite ─────────────────────────────────────────────────────────────

const SPRITE_PX = 4

function getSpritePalette(primaryColor) {
  const r = parseInt(primaryColor.slice(1, 3), 16)
  const g = parseInt(primaryColor.slice(3, 5), 16)
  const b = parseInt(primaryColor.slice(5, 7), 16)
  const darkColor = `rgb(${Math.floor(r * 0.55)},${Math.floor(g * 0.55)},${Math.floor(b * 0.55)})`
  return [null, primaryColor, SKIN, DARK, '#ffffff', darkColor]
}

function drawSprite(ctx, frame, cx, cy, primaryColor, shakeX = 0) {
  const palette = getSpritePalette(primaryColor)
  const spriteW = frame[0].length * SPRITE_PX
  const spriteH = frame.length * SPRITE_PX
  const startX = Math.floor(cx - spriteW / 2) + shakeX
  const startY = Math.floor(cy - spriteH / 2)

  frame.forEach((row, ry) => {
    row.forEach((colorIdx, px) => {
      if (!colorIdx || !palette[colorIdx]) return
      ctx.fillStyle = palette[colorIdx]
      ctx.fillRect(startX + px * SPRITE_PX, startY + ry * SPRITE_PX, SPRITE_PX, SPRITE_PX)
    })
  })
}

function getAgentFrame(state, tick) {
  switch (state) {
    case 'idle':    return tick % 60 < 30 ? SPRITE_FRAMES.idle0 : SPRITE_FRAMES.idle1
    case 'walking': return Math.floor(tick / 6) % 2 === 0 ? SPRITE_FRAMES.walk0 : SPRITE_FRAMES.walk1
    case 'working': return SPRITE_FRAMES.work
    case 'success': return SPRITE_FRAMES.success
    case 'error':   return SPRITE_FRAMES.error
    default:        return SPRITE_FRAMES.idle0
  }
}

function getAgentCanvasPos(agentData, room, tick) {
  const entranceX = tx(room.x + room.entrance.lx) + S / 2
  const entranceY = ty(room.y + room.entrance.ly) + S / 2
  const workX = tx(room.x + room.workstation.lx) + S / 2
  const workY = ty(room.y + room.workstation.ly) + S / 2

  if (agentData.state === 'walking') {
    const elapsed = tick - (agentData.spawnTick || 0)
    const t = Math.min(1, elapsed / WALK_FRAMES)
    return {
      x: entranceX + (workX - entranceX) * ease(t),
      y: entranceY + (workY - entranceY) * ease(t),
    }
  }
  if (agentData.state === 'idle') {
    return { x: workX, y: workY }
  }
  return { x: workX, y: workY }
}

function drawAgent(ctx, room, agentId, agentData, tick) {
  const cfg = AGENT_CONFIG[agentId]
  if (!cfg) return

  const pos = getAgentCanvasPos(agentData, room, tick)
  const frame = getAgentFrame(agentData.state, tick)
  const shakeX = agentData.state === 'error' ? Math.floor(Math.sin(tick * 0.6) * 3) : 0

  // Idle bob
  const bobY = agentData.state === 'idle' ? Math.sin(tick * 0.08) * 1.5 : 0

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.ellipse(pos.x, pos.y + (frame.length * SPRITE_PX) / 2 + 2, 10, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Success glow
  if (agentData.state === 'success') {
    ctx.shadowColor = cfg.color
    ctx.shadowBlur = 20
  }

  // Error glow
  if (agentData.state === 'error') {
    ctx.shadowColor = '#ef4444'
    ctx.shadowBlur = 15
  }

  drawSprite(ctx, frame, pos.x + shakeX, pos.y + bobY, cfg.color)
  ctx.shadowBlur = 0

  // Name tag
  const tagY = pos.y - (frame.length * SPRITE_PX) / 2 - 12
  const [r, g, b] = room.rgb
  const tagAlpha = ['working', 'success', 'error'].includes(agentData.state) ? 1 : 0.7

  ctx.fillStyle = `rgba(0,0,0,0.75)`
  ctx.fillRect(pos.x - 22, tagY - 6, 44, 11)
  ctx.strokeStyle = `rgba(${r},${g},${b},${tagAlpha})`
  ctx.lineWidth = 1
  ctx.strokeRect(pos.x - 22, tagY - 6, 44, 11)

  ctx.fillStyle = `rgba(${r},${g},${b},${tagAlpha})`
  ctx.font = `bold ${Math.floor(S * 0.28)}px "JetBrains Mono",monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(cfg.label, pos.x, tagY)
  ctx.textBaseline = 'alphabetic'

  // State dot
  const dotColor = agentData.state === 'working' ? cfg.color
    : agentData.state === 'success' ? '#10b981'
    : agentData.state === 'error' ? '#ef4444'
    : 'rgba(255,255,255,0.3)'
  const dotPulse = ['working', 'success', 'error'].includes(agentData.state)
    ? 0.6 + 0.4 * Math.sin(tick * 0.15) : 1
  ctx.fillStyle = dotColor
  ctx.globalAlpha = dotPulse
  ctx.beginPath()
  ctx.arc(pos.x + 26, tagY, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Speech bubble with current task
  if (agentData.task && (agentData.state === 'working' || agentData.state === 'walking')) {
    drawSpeechBubble(ctx, pos.x, tagY - 8, agentData.task, cfg.color)
  }
  if (agentData.result && agentData.state === 'success') {
    drawSpeechBubble(ctx, pos.x, tagY - 8, '✓ ' + agentData.result, '#10b981')
  }
  if (agentData.error && agentData.state === 'error') {
    drawSpeechBubble(ctx, pos.x, tagY - 8, '✗ ' + agentData.error, '#ef4444')
  }
}

// ─── Speech Bubble ────────────────────────────────────────────────────────────

function drawSpeechBubble(ctx, cx, cy, text, color) {
  const maxW = 130
  ctx.font = `${Math.floor(S * 0.22)}px "JetBrains Mono",monospace`

  let displayText = text.length > 28 ? text.slice(0, 27) + '…' : text
  const textW = Math.min(ctx.measureText(displayText).width + 14, maxW)
  const textH = 14
  const bx = cx - textW / 2
  const by = cy - textH - 8

  ctx.fillStyle = 'rgba(0,0,0,0.92)'
  ctx.fillRect(bx, by, textW, textH)
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(bx, by, textW, textH)

  // Tail
  ctx.fillStyle = 'rgba(0,0,0,0.92)'
  ctx.fillRect(cx - 3, by + textH, 6, 5)
  ctx.fillStyle = color
  ctx.fillRect(cx - 3, by + textH, 1, 5)
  ctx.fillRect(cx + 2, by + textH, 1, 5)

  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(displayText, cx, by + textH / 2)
  ctx.textBaseline = 'alphabetic'
}

// ─── Inter-agent Link ─────────────────────────────────────────────────────────

function drawAgentLink(ctx, fromRoom, toRoom, tick, alpha = 0.5) {
  const x1 = tx(fromRoom.x + fromRoom.workstation.lx) + S / 2
  const y1 = ty(fromRoom.y + fromRoom.workstation.ly) + S / 2
  const x2 = tx(toRoom.x + toRoom.workstation.lx) + S / 2
  const y2 = ty(toRoom.y + toRoom.workstation.ly) + S / 2

  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.lineDashOffset = -(tick % 8)
  ctx.strokeStyle = `rgba(255,212,0,${alpha})`
  ctx.lineWidth = 1.5
  ctx.shadowColor = 'rgba(255,212,0,0.4)'
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.setLineDash([])
  ctx.restore()
}

// ─── Particles ────────────────────────────────────────────────────────────────

function drawParticles(ctx, particles) {
  particles.forEach(p => {
    if (p.life <= 0) return
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 4
    ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  })
}

// ─── Scanlines ────────────────────────────────────────────────────────────────

// Cached scanline+vignette overlay — built once, drawn as single image
let _overlayCache = null
function getOverlay(W, H) {
  if (_overlayCache) return _overlayCache
  const oc = document.createElement('canvas')
  oc.width = W; oc.height = H
  const oc2d = oc.getContext('2d')
  oc2d.globalAlpha = 0.03
  oc2d.fillStyle = '#000000'
  for (let y = 0; y < H; y += 3) oc2d.fillRect(0, y, W, 1)
  oc2d.globalAlpha = 1
  const grad = oc2d.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.35)')
  oc2d.fillStyle = grad
  oc2d.fillRect(0, 0, W, H)
  _overlayCache = oc
  return oc
}

function drawScanlines(ctx) {
  const W = tx(COLS)
  const H = ty(ROWS)
  ctx.drawImage(getOverlay(W, H), 0, 0)
}

// ─── Main Draw ────────────────────────────────────────────────────────────────

export function draw(ctx, { tick, agentStates, particles, activeLinks }) {
  drawBackground(ctx)
  drawCorridor(ctx, tick)

  // Draw all rooms
  ROOMS.forEach(room => {
    const agentData = agentStates[room.agent]
    const isActive = agentData && ['walking', 'working', 'success'].includes(agentData.state)

    drawRoomFloor(ctx, room)
    room.objects.forEach(obj => drawObject(ctx, room, obj, isActive, tick))
    drawRoomBorder(ctx, room, isActive, tick)
    drawRoomLabel(ctx, room, isActive)
  })

  // Draw active inter-agent links (CORTEX → others)
  if (activeLinks) {
    activeLinks.forEach(([fromId, toId]) => {
      const fromRoom = ROOMS.find(r => r.agent === fromId)
      const toRoom = ROOMS.find(r => r.agent === toId)
      if (fromRoom && toRoom) {
        const alpha = 0.3 + 0.3 * Math.sin(tick * 0.08)
        drawAgentLink(ctx, fromRoom, toRoom, tick, alpha)
      }
    })
  }

  // Draw agents on top of rooms
  ROOMS.forEach(room => {
    const agentData = agentStates[room.agent]
    if (agentData) drawAgent(ctx, room, room.agent, agentData, tick)
  })

  // Particles
  drawParticles(ctx, particles)

  // Atmospheric overlay
  drawScanlines(ctx)
}
