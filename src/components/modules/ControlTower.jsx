// ═══════════════════════════════════════════════════
// OCULOPS — Control Tower v12.0
// Main Dashboard — Autonomous Intelligence OS
// AG1-P0: Simulation gate states + run-inspection
// V3 HIGGSFIELD PREMIUM EDITION REWRITE
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
import { useEcosystemReadiness } from '../../hooks/useEcosystemReadiness'
import { supabase } from '../../lib/supabase'
import {
    CurrencyEuroIcon,
    ArrowTrendingUpIcon,
    SignalIcon,
    CpuChipIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    RocketLaunchIcon,
    BellAlertIcon,
    XMarkIcon,
    ShieldExclamationIcon,
    EyeIcon,
    ChevronRightIcon,
    BoltIcon,
} from '@heroicons/react/24/outline'
import './ControlTower.css'

// ── Health Ring ──
function HealthRing({ score, size = 80, strokeWidth = 3 }) {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const color = score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--gold)' : 'var(--color-danger)'

    return (
        <div className="hf-health-ring-wrap" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle className="hf-health-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
                <circle
                    className="hf-health-ring-fill"
                    cx={size / 2} cy={size / 2} r={radius}
                    stroke={color}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="hf-health-score" style={{ color }}>{score}%</div>
        </div>
    )
}

function formatDateTime(value) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
}

export default function ControlTower() {
    const location = useLocation()
    const navigate = useNavigate()
    const { loading: contactsLoading } = useContacts()
    const { loading: companiesLoading } = useCompanies()
    const { loading: dealsLoading, totalValue } = useDeals()
    const { loading: activitiesLoading } = useActivities()
    const { signals, activeSignals, loading: signalsLoading } = useSignals()
    const { stats: agentStats } = useAgents()
    const { runs: pipelineRuns } = usePipelineRuns()
    const { goals } = useGoals()
    const { active: activeAlerts } = useAlerts()
    const {
        readiness,
        loading: readinessLoading,
        refresh: refreshReadiness,
        runTrace,
        getRunTrace,
        clearRunTrace,
    } = useEcosystemReadiness({ windowHours: 24 })
    
    const [traceEvents, setTraceEvents] = useState([])
    // Bridge Status (Mac Mini tunnel)
    const [bridgeStatus, setBridgeStatus] = useState('checking') // checking, online, offline

    useEffect(() => {
        let isSubscribed = true
        let retryCount = 0
        const MAX_RETRIES = 5

        async function checkBridge() {
            try {
                // Call local dashboard api endpoint
                const res = await fetch('http://127.0.0.1:38791/health')
                
                if (!isSubscribed) return

                if (!res.ok) {
                    throw new Error('Health probe failed')
                }
                
                const data = await res.json()
                
                if (data && data.status === 'ok') {
                    setBridgeStatus('online')
                    retryCount = 0
                } else {
                    setBridgeStatus('offline')
                }
            } catch (err) {
                if (!isSubscribed) return
                
                console.warn('Bridge check failed:', err)
                setBridgeStatus('offline')
                
                // Retry with exponential backoff if offline
                if (retryCount < MAX_RETRIES) {
                    retryCount++
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
                    setTimeout(checkBridge, delay)
                }
            }
        }

        checkBridge()
        // Poll every 60 seconds
        const interval = setInterval(checkBridge, 60000)
        
        return () => {
            isSubscribed = false
            clearInterval(interval)
        }
    }, [])
    const correlationFilter = useMemo(() => {
        const params = new URLSearchParams(location.search)
        const value = (params.get('corr') || '').trim()
        return value || null
    }, [location.search])

    const loading = contactsLoading || companiesLoading || dealsLoading || activitiesLoading || signalsLoading

    const healthScore = useMemo(() => {
        const pipelineScore = Math.min(totalValue / 500, 100)
        const agentUptime = agentStats?.total > 0 ? (agentStats.online / agentStats.total) * 100 : 0
        const signalScore = Math.min((activeSignals || []).length * 10, 100)
        return Math.round((pipelineScore * 0.5) + (agentUptime * 0.3) + (signalScore * 0.2))
    }, [totalValue, agentStats, activeSignals])

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

    const recentSignals = useMemo(() => {
        return (signals || []).slice(0, 5)
    }, [signals])

    const visiblePipelineRuns = useMemo(() => {
        if (!correlationFilter) return pipelineRuns
        return (pipelineRuns || []).filter(run => run.correlation_id === correlationFilter)
    }, [pipelineRuns, correlationFilter])
    const variableReadiness = useMemo(
        () => (readiness?.records || []).find(record => record.module_key === 'variable_control_plane_v2') || null,
        [readiness],
    )

    useEffect(() => {
        let cancelled = false
        const loadTraceEvents = async () => {
            if (!correlationFilter) {
                setTraceEvents([])
                return
            }
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
            } catch {
                if (!cancelled) setTraceEvents([])
            }
        }
        loadTraceEvents()
        return () => { cancelled = true }
    }, [correlationFilter])

    useEffect(() => {
        if (!correlationFilter) {
            clearRunTrace()
            return
        }
        getRunTrace(correlationFilter)
    }, [correlationFilter, clearRunTrace, getRunTrace])

    const openApprovals = (approvalId = null) => {
        const params = new URLSearchParams()
        params.set('tab', 'approvals')
        if (approvalId) params.set('approval', approvalId)
        navigate(`/agents?${params.toString()}`)
    }

    const clearTrace = () => navigate('/control-tower')

    return (
        <div className="v3-theme ct-higgsfield fade-in p-4">
            
            {/* ── Top Header ── */}
            <header className="hf-header hf-glass-panel">
                <div className="hf-header-left">
                    <div className="hf-logo-box">
                        <RocketLaunchIcon width={20} height={20} />
                    </div>
                    <div className="hf-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <h1>ANTIGRAVITY OS</h1>
                            <div className={`badge ${bridgeStatus === 'online' ? 'badge-success' : bridgeStatus === 'checking' ? 'badge-primary' : 'badge-danger'}`} style={{ fontSize: 'var(--text-xs)' }}>
                                {bridgeStatus === 'online' ? 'Bridge Online' : bridgeStatus === 'checking' ? 'Checking Bridge...' : 'Bridge Offline'}
                            </div>
                        </div>
                        <p>Higgsfield Edition</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="text-gray-400 hover:text-white transition-colors">
                        <span className="v3-intel-label">SYNCING: {loading ? 'ON' : 'OFF'}</span>
                    </button>
                    <div className="w-8 h-8 rounded-full border border-[var(--gold-border)] p-[2px] overflow-hidden">
                        <div className="w-full h-full rounded-full bg-[var(--gold)] opacity-50" />
                    </div>
                </div>
            </header>

            {/* ── KPI Row ── */}
            <section className="hf-kpi-grid">
                
                {/* Health Score */}
                <div className="hf-glass-panel hf-kpi-card hf-kpi-health-card">
                    <p className="hf-kpi-label">Health Score</p>
                    <HealthRing score={healthScore} size={64} />
                    <p className="hf-kpi-meta positive">+ {agentStats?.online || 0} nodes live</p>
                </div>

                {/* Pipeline Value */}
                <div className="hf-glass-panel hf-kpi-card">
                    <p className="hf-kpi-label">Pipeline Value</p>
                    <h2 className="hf-kpi-value">€{(totalValue / 1000).toFixed(1)}k</h2>
                    <div className="hf-kpi-meta positive">
                        <ArrowTrendingUpIcon width={14} height={14} />
                        <span>Aggregated Forecast</span>
                    </div>
                </div>

                {/* Active Agents */}
                <div className="hf-glass-panel hf-kpi-card">
                    <p className="hf-kpi-label">Active Agents</p>
                    <h2 className="hf-kpi-value gold">{agentStats?.online || 0}</h2>
                    <p className="hf-kpi-meta">/ {agentStats?.total || 0} System Agents</p>
                </div>

                {/* Active Signals / Blocked */}
                <div className="hf-glass-panel hf-kpi-card" style={{ borderLeft: blockedSteps.length > 0 ? '4px solid var(--color-danger)' : '4px solid var(--gold)' }}>
                    <p className="hf-kpi-label">Action Center</p>
                    <h2 className="hf-kpi-value">{blockedSteps.length > 0 ? blockedSteps.length : (activeSignals || []).length}</h2>
                    <p className="hf-kpi-meta">{blockedSteps.length > 0 ? 'Blocked simulations' : 'Active Intelligence Signals'}</p>
                </div>

            </section>

            {/* ── Main Layout ── */}
            <section className="hf-main-layout">
                
                {/* LEFT COLUMN */}
                <div className="hf-system-panel">
                    
                    {/* Strategy Advisor / Simulator Blocked Steps */}
                    <div className="hf-section-header">
                        <h2 className="hf-section-title">
                            <BoltIcon />
                            Strategy Advisor & Gates
                        </h2>
                        {blockedSteps.length > 0 ? (
                            <span className="hf-live-badge" style={{ color: '#fff', background: 'var(--color-danger-muted)' }}>{blockedSteps.length} Blocks</span>
                        ) : (
                            <span className="hf-live-badge">Live</span>
                        )}
                    </div>

                    {blockedSteps.length > 0 ? (
                        <div className="hf-glass-panel hf-advisor-card" style={{ borderColor: 'var(--color-danger)' }}>
                            <div className="hf-advisor-content">
                                <div>
                                    <h3 className="hf-advisor-title text-[#FFB4A4]">Simulation Gateway Blocked</h3>
                                    <p className="hf-advisor-desc">
                                        Agent {blockedSteps[0].agent_code_name} requires manual approval for step: 
                                        <strong> {blockedSteps[0].title}</strong>.
                                    </p>
                                </div>
                                <div className="hf-advisor-actions">
                                    <button className="hf-btn-primary" style={{ background: 'var(--color-danger)', color: '#fff' }} onClick={() => openApprovals()}>
                                        REVIEW APPROVALS
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="hf-glass-panel hf-advisor-card">
                            <BoltIcon className="hf-advisor-card-bg-icon" />
                            <div className="hf-advisor-content">
                                <div>
                                    <h3 className="hf-advisor-title text-white">Optimize Execution Velocity</h3>
                                    <p className="hf-advisor-desc">
                                        Predicted 15% efficiency gain by reallocating idle nodes in the pipeline cluster. All agents are currently operating within optimal parameters.
                                    </p>
                                </div>
                                <div className="hf-advisor-actions">
                                    <button className="hf-btn-primary">APPLY NOW</button>
                                    <button className="hf-btn-secondary" onClick={() => navigate('/agents')}>DETAILS</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trace Filter & Analysis */}
                    {correlationFilter && (
                        <div className="hf-glass-panel p-4 mt-4" style={{ borderColor: 'var(--gold-border)' }}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="hf-section-title text-sm"><RocketLaunchIcon className="w-4 h-4 mr-2"/> Trace Analysis</h3>
                                <button className="hf-btn-secondary text-[10px] py-1 px-3" onClick={clearTrace}>CLEAR</button>
                            </div>
                            <div className="flex flex-col gap-2">
                                <p className="text-xs text-[var(--text-tertiary)] break-all font-mono">{correlationFilter}</p>
                                <p className="text-xs text-white uppercase tracking-wider">{visiblePipelineRuns.length} runs • {traceEvents.length} events {runTrace?.final_status && `• ${runTrace.final_status}`}</p>
                            </div>
                        </div>
                    )}

                    {/* Active Warnings & Anomalies */}
                    {activeAlerts.length > 0 && (
                        <div className="mt-4">
                            <h2 className="hf-section-title text-sm mb-3 text-[var(--color-warning)]"><ExclamationTriangleIcon width={16}/> Anomaly Alerts</h2>
                            <div className="hf-feed-list">
                                {activeAlerts.slice(0, 3).map(alert => (
                                    <div key={alert.id} className="hf-feed-item" style={{ borderColor: 'var(--color-warning-muted)' }}>
                                        <div className="hf-feed-dot-wrap"><div className="hf-feed-dot" style={{ background: 'var(--color-warning)' }}/></div>
                                        <div className="hf-feed-content">
                                            <p className="hf-feed-title text-white">{alert.title}</p>
                                            <p className="hf-feed-meta text-[var(--color-warning)]">{alert.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* RIGHT COLUMN */}
                <div className="hf-system-panel">
                    
                    <h2 className="hf-section-title">
                        <SignalIcon />
                        Intel Feed
                    </h2>
                    
                    <div className="hf-feed-list">
                        {/* Feed items populated from Recent Signals */}
                        {recentSignals.map((signal, idx) => (
                            <div key={signal.id} className="hf-feed-item">
                                <div className="hf-feed-dot-wrap">
                                    {idx === 0 ? (
                                        <>
                                            <div className="hf-feed-dot gold" />
                                            <div className="hf-feed-dot-ping" />
                                        </>
                                    ) : (
                                        <div className="hf-feed-dot" />
                                    )}
                                </div>
                                <div className="hf-feed-content">
                                    <p className="hf-feed-title text-slate-200">{signal.title}</p>
                                    <p className="hf-feed-meta">
                                        {formatDateTime(signal.created_at)} • {signal.type || 'Signal'}
                                    </p>
                                </div>
                                <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                            </div>
                        ))}
                    </div>

                    <h2 className="hf-section-title mt-6 text-sm">
                        <CpuChipIcon width={16} />
                        Readiness State
                    </h2>
                    <div className="hf-glass-panel p-4 mt-2">
                        {readinessLoading ? (
                            <p className="text-xs text-[var(--text-tertiary)]">Syncing readiness configuration...</p>
                        ) : readiness?.records ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                                    <span className="text-sm font-medium">{readiness.records.length} Modules Tracked</span>
                                </div>
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    Last validation: {formatDateTime(readiness.generated_at)}
                                </p>
                                {variableReadiness && (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[var(--text-tertiary)]">V2 Variables:</span>
                                            <span className={`badge ${
                                                variableReadiness.state === 'connected'
                                                    ? 'badge-success'
                                                    : variableReadiness.state === 'simulated'
                                                        ? 'badge-primary'
                                                        : variableReadiness.state === 'planned'
                                                            ? 'badge-default'
                                                            : variableReadiness.state === 'degraded'
                                                                ? 'badge-warning'
                                                                : 'badge-danger'
                                            }`}>
                                                {variableReadiness.state}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--text-tertiary)]">
                                            {variableReadiness.state_reason_text}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-[var(--text-tertiary)]">Readiness offline.</p>
                        )}
                        <button className="hf-btn-secondary w-full mt-4" onClick={() => refreshReadiness()}>
                            FORCE REFRESH
                        </button>
                    </div>

                </div>

            </section>
        </div>
    )
}
