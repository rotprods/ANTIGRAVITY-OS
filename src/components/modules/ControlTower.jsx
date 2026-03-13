// ═══════════════════════════════════════════════════
// OCULOPS — Control Tower v12.0
// Main Dashboard — Autonomous Intelligence OS
// AG1-P0: Simulation gate states + run-inspection
// ═══════════════════════════════════════════════════

import { useMemo, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { useCompanies } from '../../hooks/useCompanies'
import { useDeals } from '../../hooks/useDeals'
import { useActivities } from '../../hooks/useActivities'
import { useSignals } from '../../hooks/useSignals'
import useAgents from '../../hooks/useAgents'
import { usePipelineRuns } from '../../hooks/usePipelineRuns'
import { useGoals } from '../../hooks/useGoals'
import { useAlerts } from '../../hooks/useAlerts'
import { supabase } from '../../lib/supabase'
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
    ShieldExclamationIcon,
    EyeIcon,
} from '@heroicons/react/24/outline'
import './ControlTower.css'

// ── Simulation Gate Step Status Config ──
const STEP_STATUS_CONFIG = {
    waiting_approval: { label: 'Simulation blocked', color: 'var(--color-warning)', bg: 'var(--color-warning-muted)' },
    pending:          { label: 'Pending',            color: 'var(--text-tertiary)',   bg: 'var(--surface-elevated)' },
    running:          { label: 'Running',            color: 'var(--color-info)',      bg: 'var(--color-info-muted)' },
    completed:        { label: 'Completed',          color: 'var(--color-success)',   bg: 'var(--color-success-muted)' },
    failed:           { label: 'Failed',             color: 'var(--color-danger)',    bg: 'var(--color-danger-muted)' },
    skipped:          { label: 'Skipped',            color: 'var(--text-quaternary)', bg: 'var(--surface-elevated)' },
}

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

function sortByCreatedAtDesc(rows = []) {
    return [...rows].sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
    })
}

function sortByDateFieldDesc(rows = [], fieldName) {
    return [...rows].sort((a, b) => {
        const aValue = a?.[fieldName] ? new Date(a[fieldName]).getTime() : 0
        const bValue = b?.[fieldName] ? new Date(b[fieldName]).getTime() : 0
        return bValue - aValue
    })
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
    const location = useLocation()
    const navigate = useNavigate()
    const { contacts, loading: contactsLoading } = useContacts()
    const { companies, loading: companiesLoading } = useCompanies()
    const { deals, loading: dealsLoading, totalValue, weightedValue } = useDeals()
    const { activities, loading: activitiesLoading } = useActivities()
    const { signals, activeSignals, loading: signalsLoading } = useSignals()
    const { agents, stats: agentStats } = useAgents()
    const { runs: pipelineRuns, stats: pipelineStats } = usePipelineRuns()
    const { goals } = useGoals()
    const { active: activeAlerts, resolveAlert } = useAlerts()
    const [traceEvents, setTraceEvents] = useState([])
    const [traceLoading, setTraceLoading] = useState(false)
    const [traceError, setTraceError] = useState(null)
    const [traceApprovals, setTraceApprovals] = useState([])
    const [traceMessages, setTraceMessages] = useState([])
    const [traceConversations, setTraceConversations] = useState([])
    const [traceLinksLoading, setTraceLinksLoading] = useState(false)
    const [traceLinksError, setTraceLinksError] = useState(null)

    const correlationFilter = useMemo(() => {
        const params = new URLSearchParams(location.search)
        const value = (params.get('corr') || '').trim()
        return value || null
    }, [location.search])

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

    // AG1-P0: Blocked goal steps (waiting_approval = simulation gate)
    const blockedSteps = useMemo(() => {
        const blocked = []
        ;(goals || []).forEach(goal => {
            ;(goal.goal_steps || []).forEach(step => {
                if (step.status === 'waiting_approval' || step.status === 'failed') {
                    blocked.push({ ...step, goalTitle: goal.title, goalId: goal.id })
                }
            })
        })
        return blocked.sort((a, b) => {
            if (a.status === 'waiting_approval' && b.status !== 'waiting_approval') return -1
            if (b.status === 'waiting_approval' && a.status !== 'waiting_approval') return 1
            return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
        })
    }, [goals])

    const recentSignals = (signals || []).slice(-5).reverse()
    const visiblePipelineRuns = useMemo(() => {
        if (!correlationFilter) return pipelineRuns
        return (pipelineRuns || []).filter(run => run.correlation_id === correlationFilter)
    }, [pipelineRuns, correlationFilter])

    useEffect(() => {
        let cancelled = false

        const loadTraceEvents = async () => {
            if (!correlationFilter) {
                setTraceEvents([])
                setTraceError(null)
                return
            }

            setTraceLoading(true)
            setTraceError(null)

            try {
                const { data, error } = await supabase
                    .from('event_log')
                    .select('*')
                    .eq('correlation_id', correlationFilter)
                    .order('created_at', { ascending: true })
                    .limit(120)

                if (cancelled) return
                if (error) throw error
                setTraceEvents(data || [])
            } catch (err) {
                if (!cancelled) {
                    setTraceEvents([])
                    setTraceError(err.message)
                }
            } finally {
                if (!cancelled) setTraceLoading(false)
            }
        }

        loadTraceEvents()
        return () => { cancelled = true }
    }, [correlationFilter])

    useEffect(() => {
        let cancelled = false

        const loadTraceLinks = async () => {
            if (!correlationFilter || !supabase) {
                setTraceApprovals([])
                setTraceMessages([])
                setTraceConversations([])
                setTraceLinksError(null)
                return
            }

            setTraceLinksLoading(true)
            setTraceLinksError(null)

            try {
                const [approvalSnake, approvalCamel, messageSnake, messageCamel] = await Promise.all([
                    supabase
                        .from('approval_requests')
                        .select('id, status, created_at, approved_by, user_comment, payload')
                        .contains('payload', { correlation_id: correlationFilter })
                        .order('created_at', { ascending: false })
                        .limit(20),
                    supabase
                        .from('approval_requests')
                        .select('id, status, created_at, approved_by, user_comment, payload')
                        .contains('payload', { correlationId: correlationFilter })
                        .order('created_at', { ascending: false })
                        .limit(20),
                    supabase
                        .from('messages')
                        .select('id, conversation_id, direction, status, provider_message_id, error_message, created_at, metadata')
                        .contains('metadata', { correlation_id: correlationFilter })
                        .order('created_at', { ascending: false })
                        .limit(30),
                    supabase
                        .from('messages')
                        .select('id, conversation_id, direction, status, provider_message_id, error_message, created_at, metadata')
                        .contains('metadata', { correlationId: correlationFilter })
                        .order('created_at', { ascending: false })
                        .limit(30),
                ])

                if (cancelled) return
                if (approvalSnake.error) throw approvalSnake.error
                if (approvalCamel.error) throw approvalCamel.error
                if (messageSnake.error) throw messageSnake.error
                if (messageCamel.error) throw messageCamel.error

                const approvalById = new Map()
                ;[...(approvalSnake.data || []), ...(approvalCamel.data || [])].forEach((row) => approvalById.set(row.id, row))
                const mergedApprovals = sortByCreatedAtDesc([...approvalById.values()])
                setTraceApprovals(mergedApprovals)

                const messageById = new Map()
                ;[...(messageSnake.data || []), ...(messageCamel.data || [])].forEach((row) => messageById.set(row.id, row))
                const mergedMessages = sortByCreatedAtDesc([...messageById.values()])
                setTraceMessages(mergedMessages)

                const conversationIds = [...new Set(mergedMessages.map(msg => msg.conversation_id).filter(Boolean))]
                if (conversationIds.length === 0) {
                    setTraceConversations([])
                    return
                }

                const { data: conversationRows, error: conversationError } = await supabase
                    .from('conversations')
                    .select('id, status, last_message_at, contact:contacts(id, name, email)')
                    .in('id', conversationIds)

                if (cancelled) return
                if (conversationError) throw conversationError
                setTraceConversations(sortByDateFieldDesc(conversationRows || [], 'last_message_at'))
            } catch (err) {
                if (!cancelled) {
                    setTraceApprovals([])
                    setTraceMessages([])
                    setTraceConversations([])
                    setTraceLinksError(err.message)
                }
            } finally {
                if (!cancelled) setTraceLinksLoading(false)
            }
        }

        loadTraceLinks()
        return () => { cancelled = true }
    }, [correlationFilter])

    const openTrace = (correlationId) => {
        if (!correlationId) return
        navigate(`/control-tower?corr=${encodeURIComponent(correlationId)}`)
    }

    const openApprovals = (approvalId = null) => {
        const params = new URLSearchParams()
        params.set('tab', 'approvals')
        if (approvalId) params.set('approval', approvalId)
        navigate(`/agents?${params.toString()}`)
    }

    const openConversation = (conversationId) => {
        if (!conversationId) return
        navigate(`/messaging?conversation=${encodeURIComponent(conversationId)}`)
    }

    const clearTrace = () => {
        navigate('/control-tower')
    }

    const shortCorr = (value) => {
        if (!value) return '—'
        return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
    }

    const pendingTraceApprovals = useMemo(
        () => traceApprovals.filter(approval => approval.status === 'pending'),
        [traceApprovals],
    )
    const failedTraceMessages = useMemo(
        () => traceMessages.filter(message => message.status === 'failed'),
        [traceMessages],
    )
    const traceConversationById = useMemo(
        () => new Map(traceConversations.map(conversation => [conversation.id, conversation])),
        [traceConversations],
    )
    const latestTraceMessage = traceMessages[0] || null
    const latestTraceConversation = latestTraceMessage?.conversation_id
        ? traceConversationById.get(latestTraceMessage.conversation_id) || null
        : traceConversations[0] || null
    const latestConversationLabel = latestTraceConversation?.contact?.name
        || latestTraceConversation?.contact?.email
        || latestTraceConversation?.id
        || 'No conversation linked'

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
                {blockedSteps.length > 0 && (
                    <span className="ct-agents-bar-summary" style={{ color: 'var(--color-danger)' }}>
                        <ShieldExclamationIcon width={12} height={12} style={{ display: 'inline', verticalAlign: 'middle'}} /> {blockedSteps.length} blocked
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
                {correlationFilter && (
                    <div className="ct-section" style={{ gridColumn: '1 / -1' }}>
                        <div className="ct-section-header">
                            <span className="ct-section-title">Trace filter</span>
                            <button className="btn btn-ghost btn-sm" onClick={clearTrace}>Clear</button>
                        </div>
                        <div className="ct-section-body">
                            <div className="ct-agent-row">
                                <div className="ct-agent-status-icon" style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' }}>
                                    <RocketLaunchIcon width={18} height={18} style={{ color: 'var(--accent-primary)' }} />
                                </div>
                                <div className="ct-agent-info">
                                    <div className="ct-agent-name">{correlationFilter}</div>
                                    <div className="ct-agent-desc">
                                        {visiblePipelineRuns.length} pipeline run(s) · {traceEvents.length} event(s)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {correlationFilter && (
                    <div className="ct-section" style={{ gridColumn: '1 / -1' }}>
                        <div className="ct-section-header">
                            <span className="ct-section-title">Trace actions</span>
                            <div className="ct-section-meta">
                                <span style={{ color: pendingTraceApprovals.length > 0 ? 'var(--color-warning)' : 'var(--text-tertiary)' }}>
                                    {pendingTraceApprovals.length} pending approvals
                                </span>
                                <span style={{ color: failedTraceMessages.length > 0 ? 'var(--color-danger)' : 'var(--text-tertiary)' }}>
                                    {failedTraceMessages.length} failed messages
                                </span>
                            </div>
                        </div>
                        <div className="ct-section-body">
                            {traceLinksError && (
                                <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                                    Failed loading trace links: {traceLinksError}
                                </div>
                            )}
                            {!traceLinksError && traceLinksLoading && (
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                                    Loading linked approvals and conversations...
                                </div>
                            )}
                            {!traceLinksError && !traceLinksLoading && (
                                <>
                                    <div className="ct-agent-row">
                                        <div className="ct-agent-status-icon" style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)' }}>
                                            <CheckCircleIcon width={16} height={16} style={{ color: 'var(--color-warning)' }} />
                                        </div>
                                        <div className="ct-agent-info">
                                            <div className="ct-agent-name">Approval queue</div>
                                            <div className="ct-agent-desc">
                                                {traceApprovals.length} linked request(s) · {pendingTraceApprovals.length} pending
                                            </div>
                                        </div>
                                        <div className="ct-agent-badges">
                                            <button className="btn btn-ghost btn-xs" onClick={() => openApprovals(pendingTraceApprovals[0]?.id || traceApprovals[0]?.id || null)}>
                                                Open approvals
                                            </button>
                                        </div>
                                    </div>

                                    <div className="ct-agent-row">
                                        <div className="ct-agent-status-icon" style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' }}>
                                            <ClockIcon width={16} height={16} style={{ color: 'var(--accent-primary)' }} />
                                        </div>
                                        <div className="ct-agent-info">
                                            <div className="ct-agent-name">Conversation</div>
                                            <div className="ct-agent-desc">
                                                {latestConversationLabel} · {latestTraceMessage?.status || 'no message status'}
                                            </div>
                                        </div>
                                        <div className="ct-agent-badges">
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => openConversation(latestTraceConversation?.id || latestTraceMessage?.conversation_id || null)}
                                                disabled={!latestTraceConversation?.id && !latestTraceMessage?.conversation_id}
                                            >
                                                Open conversation
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

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

                    {/* AG1-P0: Blocked Steps — Simulation Gates */}
                    {blockedSteps.length > 0 && (
                        <div className="ct-section">
                            <div className="ct-section-header">
                                <span className="ct-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ShieldExclamationIcon width={14} height={14} style={{ color: 'var(--color-warning)' }} />
                                    Blocked steps
                                </span>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>
                                    {blockedSteps.length} action{blockedSteps.length !== 1 ? 's' : ''} needed
                                </span>
                            </div>
                            <div className="ct-section-body stagger-children">
                                {blockedSteps.slice(0, 8).map(step => {
                                    const cfg = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending
                                    const simId = step.input?.pre_execution_simulation_id || step.output?.pre_execution_simulation_id
                                    const simStatus = step.input?.pre_execution_simulation_status || step.output?.pre_execution_simulation_status
                                    const recommended = step.input?.recommended_action || step.output?.recommended_action
                                    return (
                                        <div key={step.id} className="ct-agent-row" style={{ borderLeft: `2px solid ${cfg.color}` }}>
                                            <div className="ct-agent-status-icon" style={{ background: cfg.bg }}>
                                                {step.status === 'waiting_approval'
                                                    ? <ShieldExclamationIcon width={18} height={18} style={{ color: cfg.color }} />
                                                    : <ExclamationTriangleIcon width={18} height={18} style={{ color: cfg.color }} />}
                                            </div>
                                            <div className="ct-agent-info">
                                                <div className="ct-agent-name">
                                                    {step.title}
                                                    <span className="badge" style={{ marginLeft: 6, color: cfg.color, borderColor: cfg.color, background: cfg.bg }}>
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <div className="ct-agent-desc">
                                                    {step.goalTitle} · Step {step.step_number} · {step.agent_code_name || step.step_type}
                                                    {step.error && <span style={{ color: 'var(--color-danger)' }}> — {step.error}</span>}
                                                </div>
                                                {/* Simulation metadata */}
                                                {(simId || simStatus || recommended) && (
                                                    <div style={{ fontSize: 'var(--text-xs)', marginTop: 4, display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', color: 'var(--text-tertiary)' }}>
                                                        {simId && <span>Sim: {String(simId).slice(0, 12)}...</span>}
                                                        {simStatus && <span className="badge badge-default">sim: {simStatus}</span>}
                                                        {recommended && <span style={{ color: 'var(--color-info)' }}>Recommended: {recommended}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ct-agent-badges" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                {step.status === 'waiting_approval' && (
                                                    <button className="btn btn-ghost btn-xs" onClick={() => openApprovals()}>
                                                        Open approval
                                                    </button>
                                                )}
                                                {step.pipeline_run_id && (
                                                    <button className="btn btn-ghost btn-xs" onClick={() => openTrace(step.pipeline_run_id)}>
                                                        Open run
                                                    </button>
                                                )}
                                                <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/agents?tab=queue`)}>
                                                    Queue
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
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
                            {(correlationFilter ? visiblePipelineRuns : pipelineRuns).slice(0, correlationFilter ? 16 : 8).map(run => {
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
                                            {run.correlation_id && (
                                                <button className="btn btn-ghost btn-xs" onClick={() => openTrace(run.correlation_id)}>
                                                    corr {shortCorr(run.correlation_id)}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                            {(correlationFilter && visiblePipelineRuns.length === 0) && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                    No pipeline runs found for this correlation id.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {correlationFilter && (
                    <div className="ct-section" style={{ gridColumn: '1 / -1' }}>
                        <div className="ct-section-header">
                            <span className="ct-section-title">Trace timeline</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>
                                {traceLoading ? 'Loading...' : `${traceEvents.length} events`}
                            </span>
                        </div>
                        <div className="ct-section-body">
                            {traceError && (
                                <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
                                    Failed loading trace: {traceError}
                                </div>
                            )}
                            {!traceError && traceEvents.length === 0 && !traceLoading && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                    No events recorded for this correlation id.
                                </div>
                            )}
                            {!traceError && traceEvents.length > 0 && (
                                <div className="stagger-children">
                                    {traceEvents.map(event => {
                                        const isApproval = event.event_type?.includes('approval')
                                        const isMessage = event.event_type?.includes('message') || event.event_type?.includes('send')
                                        const isAgent = event.event_type?.includes('agent')
                                        return (
                                            <div key={event.id} className="ct-agent-row">
                                                <div className="ct-agent-status-icon" style={{ background: `color-mix(in srgb, ${isApproval ? 'var(--color-warning)' : isMessage ? 'var(--color-info)' : 'var(--accent-primary)'} 12%, transparent)` }}>
                                                    {isApproval ? <CheckCircleIcon width={16} height={16} style={{ color: 'var(--color-warning)' }} />
                                                    : <ClockIcon width={16} height={16} style={{ color: isMessage ? 'var(--color-info)' : 'var(--accent-primary)' }} />}
                                                </div>
                                                <div className="ct-agent-info">
                                                    <div className="ct-agent-name">{event.event_type}</div>
                                                    <div className="ct-agent-desc">
                                                        {event.source_agent || 'system'} · {new Date(event.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="ct-agent-badges">
                                                    {isApproval && (
                                                        <button className="btn btn-ghost btn-xs" onClick={() => openApprovals()}>
                                                            Open approval
                                                        </button>
                                                    )}
                                                    {isMessage && latestTraceConversation?.id && (
                                                        <button className="btn btn-ghost btn-xs" onClick={() => openConversation(latestTraceConversation.id)}>
                                                            Open conversation
                                                        </button>
                                                    )}
                                                    {isAgent && event.source_agent && (
                                                        <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/agents?tab=logs`)}>
                                                            Agent logs
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ControlTower
