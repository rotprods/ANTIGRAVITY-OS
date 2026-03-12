// ═══════════════════════════════════════════════════
// OCULOPS — Control Tower v11.0
// Main Dashboard — Autonomous Intelligence OS
// ═══════════════════════════════════════════════════

import { useMemo } from 'react'
import { useContacts } from '../../hooks/useContacts'
import { useCompanies } from '../../hooks/useCompanies'
import { useDeals } from '../../hooks/useDeals'
import { useActivities } from '../../hooks/useActivities'
import { useSignals } from '../../hooks/useSignals'
import useAgents from '../../hooks/useAgents'
import { usePipelineRuns } from '../../hooks/usePipelineRuns'
import { useAlerts } from '../../hooks/useAlerts'
import {
    UserGroupIcon,
    BuildingOfficeIcon,
    CurrencyEuroIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
    SignalIcon,
    CpuChipIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    RocketLaunchIcon,
    BellAlertIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline'
import './ControlTower.css'

// ── Sparkline ──
function Sparkline({ data = [], color = 'var(--accent-primary)', width = 60, height = 20 }) {
    if (data.length < 2) return null
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ')
    return (
        <svg className="ct-sparkline" width={width} height={height}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" opacity="0.15" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'blur(2px)' }} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// ── Health Ring ──
function HealthRing({ score, size = 120, strokeWidth = 6 }) {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const color = score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--accent-primary)' : 'var(--color-danger)'

    return (
        <div className="ct-health-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle className="ct-health-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
                <circle
                    className="ct-health-ring-fill"
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="ct-health-score" style={{ color }}>{score}</div>
        </div>
    )
}

const ALERT_SEVERITY_STYLES = {
    3: { color: 'var(--color-danger)', bg: 'var(--color-danger-muted)', label: 'CRITICAL' },
    2: { color: 'var(--color-warning)', bg: 'var(--color-warning-muted)', label: 'WARNING' },
    1: { color: 'var(--color-info)', bg: 'var(--color-info-muted)', label: 'INFO' },
}

function AlertsSection({ alerts, resolveAlert }) {
    const topAlerts = [...alerts]
        .sort((a, b) => (b.severity || 0) - (a.severity || 0))
        .slice(0, 5)

    if (topAlerts.length === 0) return null

    return (
        <div className="ct-section">
            <div className="ct-section-header">
                <span className="ct-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BellAlertIcon width={14} height={14} style={{ color: 'var(--color-warning)' }} />
                    Anomaly alerts
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>
                    {topAlerts.length} active
                </span>
            </div>
            <div className="ct-section-body stagger-children">
                {topAlerts.map(alert => {
                    const sev = ALERT_SEVERITY_STYLES[alert.severity] || ALERT_SEVERITY_STYLES[2]
                    return (
                        <div key={alert.id} className="ct-agent-row" style={{ borderLeft: `2px solid ${sev.color}` }}>
                            <div className="ct-agent-status-icon" style={{ background: sev.bg }}>
                                <ExclamationTriangleIcon width={18} height={18} style={{ color: sev.color }} />
                            </div>
                            <div className="ct-agent-info">
                                <div className="ct-agent-name">{alert.title}</div>
                                <div className="ct-agent-desc">{alert.description}</div>
                            </div>
                            <div className="ct-agent-badges">
                                <span className="badge" style={{ color: sev.color, borderColor: sev.color, background: sev.bg }}>
                                    {sev.label}
                                </span>
                                <button
                                    onClick={() => resolveAlert(alert.id)}
                                    title="Dismiss"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-quaternary)' }}
                                >
                                    <XMarkIcon width={12} height={12} />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function ControlTower() {
    const { contacts, loading: contactsLoading } = useContacts()
    const { companies, loading: companiesLoading } = useCompanies()
    const { deals, loading: dealsLoading, totalValue, weightedValue } = useDeals()
    const { activities, loading: activitiesLoading } = useActivities()
    const { signals, activeSignals, loading: signalsLoading } = useSignals()
    const { agents, stats: agentStats } = useAgents()
    const { runs: pipelineRuns, stats: pipelineStats } = usePipelineRuns()
    const { active: activeAlerts, resolveAlert } = useAlerts()

    const loading = contactsLoading || companiesLoading || dealsLoading || activitiesLoading || signalsLoading

    const recentActivitiesCount = useMemo(() => {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        return (activities || []).filter(a => new Date(a.created_at) >= sevenDaysAgo).length
    }, [activities])

    const avgSignalImpact = useMemo(() => {
        const active = activeSignals || []
        if (active.length === 0) return 0
        return Math.round(active.reduce((sum, s) => sum + (s.impact || 0), 0) / active.length)
    }, [activeSignals])

    const healthScore = useMemo(() => {
        const pipelineScore = Math.min(totalValue / 500, 100)
        const agentUptime = agentStats?.total > 0 ? (agentStats.online / agentStats.total) * 100 : 0
        const signalScore = Math.min((activeSignals || []).length * 10, 100)
        return Math.round((pipelineScore * 0.5) + (agentUptime * 0.3) + (signalScore * 0.2))
    }, [totalValue, agentStats, activeSignals])

    const kpis = [
        { label: 'Contacts', value: (contacts || []).length, icon: UserGroupIcon, target: '100+' },
        { label: 'Companies', value: (companies || []).length, icon: BuildingOfficeIcon, target: '50+' },
        { label: 'Pipeline', value: `€${Math.round(totalValue).toLocaleString()}`, icon: CurrencyEuroIcon, target: '€50K' },
        { label: 'Weighted', value: `€${Math.round(weightedValue).toLocaleString()}`, icon: ArrowTrendingUpIcon, color: 'var(--color-success)', target: '€25K' },
        { label: 'Activities (7d)', value: recentActivitiesCount, icon: ClockIcon, color: recentActivitiesCount > 0 ? 'var(--color-success)' : 'var(--color-warning)', target: '20+' },
        { label: 'Active signals', value: (activeSignals || []).length, icon: SignalIcon, color: 'var(--accent-primary)', target: '10+', subtitle: `Avg impact: ${avgSignalImpact}` },
    ]

    const recentSignals = (signals || []).slice(-5).reverse()
    const agentStatusColor = (status) => {
        if (status === 'online') return 'var(--color-success)'
        if (status === 'running') return 'var(--accent-primary)'
        if (status === 'error') return 'var(--color-danger)'
        return 'var(--text-quaternary)'
    }

    return (
        <div className="module-page ct fade-in">
            {/* ── Hero Greeting ── */}
            <div className="ct-hero">
                <div className="ct-greeting">
                    <h1>Control Tower</h1>
                    <p>System overview and real-time business intelligence</p>
                </div>
                <div className="ct-status-pill">
                    <div className={`ct-status-dot ${loading ? 'syncing' : 'online'}`} />
                    <span>{loading ? 'Syncing...' : 'Operational'}</span>
                    <span style={{ color: 'var(--text-quaternary)', marginLeft: 'var(--space-2)' }}>
                        {(deals || []).length} deals
                    </span>
                </div>
            </div>

            {/* ── Agent Network Bar ── */}
            <div className="ct-agents-bar">
                <span className="ct-agents-bar-label">Agents</span>
                {(agents || []).slice(0, 10).map(agent => (
                    <div key={agent.id} className="ct-agent-chip">
                        <div className="ct-agent-chip-dot" style={{ background: agentStatusColor(agent.status) }} />
                        <span>{(agent.code_name || agent.name || 'Unknown').slice(0, 8)}</span>
                    </div>
                ))}
                <span className="ct-agents-bar-summary">{agentStats?.online || 0} online</span>
                {pipelineStats.running > 0 && (
                    <span className="ct-agents-bar-summary" style={{ color: 'var(--color-warning)' }}>
                        <RocketLaunchIcon width={12} height={12} style={{ display: 'inline', verticalAlign: 'middle'}} /> {pipelineStats.running} pipeline{pipelineStats.running > 1 ? 's' : ''} running
                    </span>
                )}
            </div>

            {/* ── KPI Grid ── */}
            <div className="ct-kpi-grid stagger-children">
                {kpis.map((kpi, i) => {
                    const Icon = kpi.icon
                    return (
                        <div key={i} className="ct-kpi">
                            <div className="ct-kpi-header">
                                <span className="ct-kpi-label">{kpi.label}</span>
                                <Icon className="ct-kpi-icon" />
                            </div>
                            <div className="ct-kpi-value" style={kpi.color ? { color: kpi.color } : undefined}>
                                {kpi.value}
                            </div>
                            <div className="ct-kpi-meta">
                                <span className="ct-kpi-target">Target: {kpi.target}</span>
                                {kpi.subtitle && <span>{kpi.subtitle}</span>}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Main Grid ── */}
            <div className="ct-main-grid">
                {/* Left: Health + Signals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Health Score */}
                    <div className="ct-health">
                        <HealthRing score={healthScore} />
                        <span className="ct-health-label">System health</span>
                    </div>

                    {/* Anomaly Alerts */}
                    {activeAlerts.length > 0 && (
                        <AlertsSection alerts={activeAlerts} resolveAlert={resolveAlert} />
                    )}

                    {/* Critical Signals */}
                    <div className="ct-section" style={{ flex: 1 }}>
                        <div className="ct-section-header">
                            <span className="ct-section-title">Latest signals</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>
                                {(activeSignals || []).length} active
                            </span>
                        </div>
                        <div className="ct-section-body">
                            {recentSignals.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                    No signals yet
                                </div>
                            ) : (
                                recentSignals.map(s => (
                                    <div key={s.id} className="ct-signal ct-signal-bar">
                                        <div className="ct-signal-title">{s.title}</div>
                                        <div className="ct-signal-meta">
                                            {s.category} · {s.indicator} · Impact: {s.impact}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Agent Matrix */}
                <div className="ct-section">
                    <div className="ct-section-header">
                        <span className="ct-section-title">Agent network</span>
                        <div className="ct-section-meta">
                            <span style={{ color: 'var(--color-success)' }}>{agentStats?.online || 0} online</span>
                            <span style={{ color: 'var(--accent-primary)' }}>{agentStats?.running || 0} running</span>
                            <span style={{ color: 'var(--color-danger)' }}>{agentStats?.error || 0} error</span>
                        </div>
                    </div>
                    {(agents || []).length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12) 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                            No agents registered
                        </div>
                    ) : (
                        <div className="stagger-children">
                        {agents.map(agent => {
                            const StatusIcon = agent.status === 'error' ? ExclamationTriangleIcon
                                : agent.status === 'online' ? CheckCircleIcon
                                : CpuChipIcon

                            return (
                                <div key={agent.id} className="ct-agent-row">
                                    <div className="ct-agent-status-icon" style={{ background: `color-mix(in srgb, ${agentStatusColor(agent.status)} 12%, transparent)` }}>
                                        <StatusIcon width={18} height={18} style={{ color: agentStatusColor(agent.status) }} />
                                    </div>
                                    <div className="ct-agent-info">
                                        <div className="ct-agent-name">{agent.code_name || agent.name || 'Unknown'}</div>
                                        <div className="ct-agent-desc">{agent.description || agent.role || 'No description'}</div>
                                    </div>
                                    <div className="ct-agent-badges">
                                        <span className="badge badge-default">{agent.total_runs || 0} runs</span>
                                        <span className={`badge ${agent.status === 'error' ? 'badge-danger' : agent.status === 'online' ? 'badge-success' : 'badge-primary'}`}>
                                            {agent.status || 'unknown'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                    )}
                </div>

                {/* Pipeline Runs */}
                {pipelineRuns.length > 0 && (
                    <div className="ct-section">
                        <div className="ct-section-header">
                            <span className="ct-section-title">Pipeline activity</span>
                            <div className="ct-section-meta">
                                <span style={{ color: 'var(--color-success)' }}>{pipelineStats.completed} completed</span>
                                <span style={{ color: 'var(--color-warning)' }}>{pipelineStats.running} running</span>
                                {pipelineStats.failed > 0 && <span style={{ color: 'var(--color-danger)' }}>{pipelineStats.failed} failed</span>}
                            </div>
                        </div>
                        <div className="ct-section-body stagger-children">
                            {pipelineRuns.slice(0, 8).map(run => {
                                const template = run.pipeline_templates
                                const isActive = run.status === 'running'
                                return (
                                    <div key={run.id} className={`ct-agent-row${isActive ? ' ct-pipeline-active' : ''}`}>
                                        <div className="ct-agent-status-icon" style={{
                                            background: isActive
                                                ? 'color-mix(in srgb, var(--color-warning) 12%, transparent)'
                                                : run.status === 'completed'
                                                    ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                                                    : 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
                                        }}>
                                            <RocketLaunchIcon width={18} height={18} style={{
                                                color: isActive ? 'var(--color-warning)'
                                                    : run.status === 'completed' ? 'var(--color-success)'
                                                    : 'var(--color-danger)'
                                            }} />
                                        </div>
                                        <div className="ct-agent-info">
                                            <div className="ct-agent-name">{template?.name || template?.code_name || 'Pipeline'}</div>
                                            <div className="ct-agent-desc">
                                                {run.goal || 'No goal specified'}
                                                {isActive && run.current_step_number > 0 && ` — step ${run.current_step_number}`}
                                            </div>
                                        </div>
                                        <div className="ct-agent-badges">
                                            <span className={`badge ${run.status === 'completed' ? 'badge-success' : run.status === 'running' ? 'badge-primary' : 'badge-danger'}`}>
                                                {run.status}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ControlTower
