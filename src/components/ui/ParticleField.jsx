// ═══════════════════════════════════════════════════
// OCULOPS — TouchDesigner Particle Field
// Data-reactive generative canvas behind the entire app
// Gold particles · Network connections · Signal flares
// ═══════════════════════════════════════════════════

import { useRef, useEffect, useCallback } from 'react'
import useAgents from '../../hooks/useAgents'
import { useSignals } from '../../hooks/useSignals'
import { useDeals } from '../../hooks/useDeals'

// ── Constants ──
const MAX_PARTICLES = 150
const AMBIENT_COUNT = 70
const NETWORK_LINE_DIST = 140
const NETWORK_COMPUTE_INTERVAL = 3
const SIGNAL_BURST_COUNT = 6
const AGENT_PULSE_SPEED = 0.015
const PARTICLE_COLORS = {
    ambient: { r: 255, g: 212, b: 0 },
    agent: { r: 255, g: 212, b: 0 },
    signal: { r: 255, g: 212, b: 0 },
    error: { r: 255, g: 51, b: 51 },
    pipeline: { r: 255, g: 212, b: 0 },
    info: { r: 102, g: 178, b: 255 },
}

// ── Particle class ──
class Particle {
    constructor(type, w, h) {
        this.type = type
        this.reset(w, h, true)
    }

    reset(w, h, initial = false) {
        switch (this.type) {
            case 'ambient':
                this.x = Math.random() * w
                this.y = Math.random() * h
                this.vx = (Math.random() - 0.5) * 0.3
                this.vy = (Math.random() - 0.5) * 0.2
                this.size = 1 + Math.random() * 1.5
                this.alpha = 0.08 + Math.random() * 0.18
                this.maxAlpha = this.alpha
                this.life = Infinity
                this.color = PARTICLE_COLORS.ambient
                this.phase = Math.random() * Math.PI * 2
                break

            case 'agent':
                this.x = 100 + Math.random() * (w - 200)
                this.y = 80 + Math.random() * (h - 160)
                this.vx = (Math.random() - 0.5) * 0.15
                this.vy = (Math.random() - 0.5) * 0.1
                this.size = 2.5 + Math.random() * 2
                this.alpha = 0.45
                this.maxAlpha = 0.65
                this.life = Infinity
                this.color = PARTICLE_COLORS.agent
                this.phase = Math.random() * Math.PI * 2
                this.pulseSpeed = AGENT_PULSE_SPEED + Math.random() * 0.01
                break

            case 'signal': {
                // Spawn from random edge
                const edge = Math.floor(Math.random() * 4)
                if (edge === 0) { this.x = 0; this.y = Math.random() * h }
                else if (edge === 1) { this.x = w; this.y = Math.random() * h }
                else if (edge === 2) { this.x = Math.random() * w; this.y = 0 }
                else { this.x = Math.random() * w; this.y = h }
                const cx = w / 2, cy = h / 2
                const angle = Math.atan2(cy - this.y, cx - this.x) + (Math.random() - 0.5) * 0.8
                const speed = 1.5 + Math.random() * 2
                this.vx = Math.cos(angle) * speed
                this.vy = Math.sin(angle) * speed
                this.size = 2 + Math.random() * 2
                this.alpha = 0.9
                this.maxAlpha = 0.9
                this.life = 80 + Math.random() * 60
                this.maxLife = this.life
                this.color = PARTICLE_COLORS.signal
                this.phase = 0
                this.trail = []
                break
            }

            case 'pipeline':
                this.x = initial ? Math.random() * w : -10
                this.y = 100 + Math.random() * (h - 200)
                this.vx = 0.6 + Math.random() * 0.8
                this.vy = (Math.random() - 0.5) * 0.2
                this.size = 1 + Math.random() * 1
                this.alpha = 0.12 + Math.random() * 0.15
                this.maxAlpha = this.alpha
                this.life = Infinity
                this.color = PARTICLE_COLORS.pipeline
                this.phase = Math.random() * Math.PI * 2
                break

            case 'error':
                this.x = Math.random() * w
                this.y = Math.random() * h
                this.vx = (Math.random() - 0.5) * 1.5
                this.vy = (Math.random() - 0.5) * 1.5
                this.size = 1.5 + Math.random() * 1.5
                this.alpha = 0.5
                this.maxAlpha = 0.6
                this.life = 60 + Math.random() * 40
                this.maxLife = this.life
                this.color = PARTICLE_COLORS.error
                this.phase = 0
                break
        }
        this.alive = true
    }

    update(w, h, frame) {
        this.x += this.vx
        this.y += this.vy

        // Sinusoidal drift for ambient/agent
        if (this.type === 'ambient' || this.type === 'agent') {
            this.phase += 0.008
            this.x += Math.sin(this.phase) * 0.15
            this.y += Math.cos(this.phase * 0.7) * 0.1
        }

        // Agent pulsing
        if (this.type === 'agent') {
            this.alpha = this.maxAlpha * (0.5 + 0.5 * Math.sin(frame * this.pulseSpeed))
        }

        // Signal trail + decay
        if (this.type === 'signal') {
            this.trail.push({ x: this.x, y: this.y, a: this.alpha * 0.4 })
            if (this.trail.length > 12) this.trail.shift()
            this.vx *= 0.985
            this.vy *= 0.985
        }

        // Finite lifetime
        if (this.life !== Infinity) {
            this.life--
            if (this.life <= 0) {
                this.alive = false
                return
            }
            // Fade out in last 30% of life
            const fadeThreshold = this.maxLife * 0.3
            if (this.life < fadeThreshold) {
                this.alpha = this.maxAlpha * (this.life / fadeThreshold)
            }
        }

        // Wrap ambient/pipeline
        if (this.type === 'ambient') {
            if (this.x < -20) this.x = w + 20
            if (this.x > w + 20) this.x = -20
            if (this.y < -20) this.y = h + 20
            if (this.y > h + 20) this.y = -20
        }
        if (this.type === 'pipeline') {
            if (this.x > w + 20) this.reset(w, h, false)
        }
    }

    draw(ctx) {
        if (!this.alive || this.alpha < 0.01) return

        const { r, g, b } = this.color

        // Draw trail for signals
        if (this.type === 'signal' && this.trail.length > 1) {
            ctx.beginPath()
            ctx.moveTo(this.trail[0].x, this.trail[0].y)
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y)
            }
            ctx.strokeStyle = `rgba(${r},${g},${b},${this.alpha * 0.15})`
            ctx.lineWidth = this.size * 0.5
            ctx.stroke()
        }

        // Glow for agent/signal
        if (this.type === 'agent' || this.type === 'signal') {
            ctx.shadowBlur = this.type === 'agent' ? 12 : 18
            ctx.shadowColor = `rgba(${r},${g},${b},${this.alpha * 0.5})`
        }

        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${this.alpha})`
        ctx.fill()

        // Reset shadow
        ctx.shadowBlur = 0
    }
}

// ── React Component ──
export default function ParticleField() {
    const canvasRef = useRef(null)
    const particlesRef = useRef([])
    const frameRef = useRef(0)
    const animRef = useRef(null)
    const prevSignalCountRef = useRef(0)
    const prevErrorCountRef = useRef(0)
    const networkLinesRef = useRef([])

    // Data hooks
    const { agents, stats: agentStats } = useAgents()
    const { activeSignals } = useSignals()
    const { totalValue } = useDeals()

    // Keep refs for animation loop access
    const dataRef = useRef({ agentCount: 0, signalCount: 0, errorCount: 0, healthScore: 50, pipelineValue: 0 })

    useEffect(() => {
        const online = agentStats?.online || 0
        const errors = agentStats?.error || 0
        const activeCount = (activeSignals || []).length

        dataRef.current = {
            agentCount: online,
            signalCount: activeCount,
            errorCount: errors,
            healthScore: Math.min(100, Math.max(0,
                Math.round(
                    Math.min((totalValue || 0) / 500, 100) * 0.5 +
                    (agents?.length > 0 ? (online / agents.length) * 100 : 0) * 0.3 +
                    Math.min(activeCount * 10, 100) * 0.2
                )
            )),
            pipelineValue: totalValue || 0,
        }
    }, [agents, agentStats, activeSignals, totalValue])

    // Spawn signal bursts when new signals arrive
    useEffect(() => {
        const currentCount = (activeSignals || []).length
        if (currentCount > prevSignalCountRef.current && canvasRef.current) {
            const w = canvasRef.current.width / (window.devicePixelRatio || 1)
            const h = canvasRef.current.height / (window.devicePixelRatio || 1)
            const particles = particlesRef.current
            const burst = Math.min(SIGNAL_BURST_COUNT, MAX_PARTICLES - particles.length)
            for (let i = 0; i < burst; i++) {
                particles.push(new Particle('signal', w, h))
            }
        }
        prevSignalCountRef.current = currentCount
    }, [activeSignals])

    // Spawn error particles
    useEffect(() => {
        const currentErrors = agentStats?.error || 0
        if (currentErrors > prevErrorCountRef.current && canvasRef.current) {
            const w = canvasRef.current.width / (window.devicePixelRatio || 1)
            const h = canvasRef.current.height / (window.devicePixelRatio || 1)
            const particles = particlesRef.current
            const burst = Math.min(4, MAX_PARTICLES - particles.length)
            for (let i = 0; i < burst; i++) {
                particles.push(new Particle('error', w, h))
            }
        }
        prevErrorCountRef.current = currentErrors
    }, [agentStats?.error])

    // Initialize particles
    const initParticles = useCallback((w, h) => {
        const particles = []
        // Ambient
        for (let i = 0; i < AMBIENT_COUNT; i++) {
            particles.push(new Particle('ambient', w, h))
        }
        // Agent nodes
        const agentCount = Math.min(dataRef.current.agentCount || 3, 12)
        for (let i = 0; i < agentCount; i++) {
            particles.push(new Particle('agent', w, h))
        }
        // Pipeline flow
        for (let i = 0; i < 8; i++) {
            particles.push(new Particle('pipeline', w, h))
        }
        particlesRef.current = particles
    }, [])

    // Compute network lines (every N frames)
    const computeNetwork = useCallback(() => {
        const particles = particlesRef.current
        const lines = []
        // Only connect agent + ambient that are close enough
        const connectable = particles.filter(p => p.alive && (p.type === 'agent' || p.type === 'ambient') && p.alpha > 0.05)
        const len = connectable.length

        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                const dx = connectable[i].x - connectable[j].x
                const dy = connectable[i].y - connectable[j].y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < NETWORK_LINE_DIST) {
                    const opacity = (1 - dist / NETWORK_LINE_DIST) * 0.07 *
                        Math.min(connectable[i].alpha, connectable[j].alpha) * 3
                    if (opacity > 0.005) {
                        lines.push({ x1: connectable[i].x, y1: connectable[i].y, x2: connectable[j].x, y2: connectable[j].y, opacity })
                    }
                }
            }
        }
        networkLinesRef.current = lines
    }, [])

    // Main animation loop
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d', { alpha: true })
        const dpr = window.devicePixelRatio || 1

        const resize = () => {
            canvas.width = window.innerWidth * dpr
            canvas.height = window.innerHeight * dpr
            ctx.scale(dpr, dpr)
            if (particlesRef.current.length === 0) {
                initParticles(window.innerWidth, window.innerHeight)
            }
        }
        resize()
        window.addEventListener('resize', resize)

        let paused = false
        const handleVisibility = () => { paused = document.hidden }
        document.addEventListener('visibilitychange', handleVisibility)

        const animate = () => {
            animRef.current = requestAnimationFrame(animate)
            if (paused) return

            const w = window.innerWidth
            const h = window.innerHeight
            const frame = frameRef.current++
            const particles = particlesRef.current
            const data = dataRef.current

            // Clear
            ctx.clearRect(0, 0, w, h)

            // Health-based global brightness modifier
            const healthMod = 0.5 + (data.healthScore / 100) * 0.5

            // Update particles
            for (let i = particles.length - 1; i >= 0; i--) {
                particles[i].update(w, h, frame)
                if (!particles[i].alive) {
                    particles.splice(i, 1)
                }
            }

            // Keep ambient count steady
            while (particles.filter(p => p.type === 'ambient').length < AMBIENT_COUNT && particles.length < MAX_PARTICLES) {
                particles.push(new Particle('ambient', w, h))
            }

            // Keep pipeline particles flowing
            const pipelineCount = particles.filter(p => p.type === 'pipeline').length
            const targetPipeline = Math.min(12, Math.max(4, Math.floor(data.pipelineValue / 5000)))
            if (pipelineCount < targetPipeline && particles.length < MAX_PARTICLES) {
                particles.push(new Particle('pipeline', w, h))
            }

            // Sync agent node count (lazy — only add, let them drift)
            const agentParticles = particles.filter(p => p.type === 'agent')
            const targetAgents = Math.min(data.agentCount || 2, 12)
            if (agentParticles.length < targetAgents && particles.length < MAX_PARTICLES) {
                particles.push(new Particle('agent', w, h))
            }

            // Network lines (computed every N frames)
            if (frame % NETWORK_COMPUTE_INTERVAL === 0) {
                computeNetwork()
            }

            // Draw network lines
            const lines = networkLinesRef.current
            if (lines.length > 0) {
                ctx.lineWidth = 0.5
                for (const line of lines) {
                    ctx.beginPath()
                    ctx.moveTo(line.x1, line.y1)
                    ctx.lineTo(line.x2, line.y2)
                    ctx.strokeStyle = `rgba(255,212,0,${line.opacity * healthMod})`
                    ctx.stroke()
                }
            }

            // Draw particles
            ctx.globalAlpha = healthMod
            for (const p of particles) {
                p.draw(ctx)
            }
            ctx.globalAlpha = 1
        }

        animate()

        return () => {
            cancelAnimationFrame(animRef.current)
            window.removeEventListener('resize', resize)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [initParticles, computeNetwork])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 1,
                pointerEvents: 'none',
                willChange: 'transform',
            }}
        />
    )
}
