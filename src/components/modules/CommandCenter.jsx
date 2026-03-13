// ═══════════════════════════════════════════════════
// OCULOPS — Command Center (TouchDesigner Bridge Manager)
// TouchDesigner bridge control surface
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
    N8N_AI_STACK_SERVICES,
    N8N_AIRDROP_INTEL,
    N8N_SUGGESTED_COMBOS,
} from '../../data/n8nAirdropIntel'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

// ── Fetch bridge status via td-api ──
async function fetchBridgeStatus(serviceKey) {
    if (!SUPABASE_URL || !serviceKey) return null
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/td-bridge`, {
            headers: { 'X-TD-Service-Key': serviceKey }
        })
        if (!res.ok) return null
        return await res.json()
    } catch { return null }
}

async function fetchSystemSnapshot(serviceKey, view = 'system') {
    if (!SUPABASE_URL || !serviceKey) return null
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/td-api?view=${view}`, {
            headers: { 'X-TD-Service-Key': serviceKey }
        })
        if (!res.ok) return null
        return await res.json()
    } catch { return null }
}

function normalizeBaseUrl(value) {
    const raw = String(value || '').trim()
    return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function buildEndpoint(baseUrl, healthPath) {
    const path = healthPath.startsWith('/') ? healthPath : `/${healthPath}`
    return `${baseUrl}${path}`
}

async function fetchServiceProbe(endpoint) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    try {
        const response = await fetch(endpoint, { method: 'GET', signal: controller.signal })
        return { online: response.ok, statusCode: response.status }
    } catch {
        return { online: false, statusCode: null }
    } finally {
        clearTimeout(timeout)
    }
}

function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value
}

function extractCorrelationId(eventRow) {
    const payload = asRecord(eventRow?.payload)
    const metadata = asRecord(eventRow?.metadata)
    return (
        eventRow?.correlation_id ||
        payload.correlation_id ||
        payload.correlationId ||
        metadata.correlation_id ||
        metadata.correlationId ||
        null
    )
}

function shortCorrelation(value) {
    if (!value) return '—'
    const normalized = String(value)
    return normalized.length > 12 ? `${normalized.slice(0, 8)}…${normalized.slice(-4)}` : normalized
}

// ── Status Dot Component ──
function StatusDot({ status }) {
    const colors = {
        connected: 'var(--color-success)',
        disconnected: 'var(--color-danger)',
        pending: 'var(--color-warning)',
    }
    return (
        <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: colors[status] || 'var(--text-tertiary)',
            boxShadow: status === 'connected' ? `0 0 8px ${colors.connected}` : 'none',
        }} />
    )
}

export default function CommandCenter() {
    const navigate = useNavigate()
    const [serviceKey, setServiceKey] = useState('')
    const [bridgeStatus, setBridgeStatus] = useState(null)
    const [systemSnapshot, setSystemSnapshot] = useState(null)
    const [commandLog, setCommandLog] = useState([])
    const [eventStream, setEventStream] = useState([])
    const [traceEvents, setTraceEvents] = useState([])
    const [stackStatus, setStackStatus] = useState([])
    const [stackRefreshedAt, setStackRefreshedAt] = useState(null)
    const [_loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')
    const refreshRef = useRef(null)
    const stackRefreshRef = useRef(null)

    // Load service key from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('td_service_key')
        if (saved) setServiceKey(saved)
    }, [])

    // Fetch bridge status & snapshot
    const refresh = useCallback(async () => {
        if (!serviceKey) return
        setLoading(true)
        const [bridge, snapshot] = await Promise.all([
            fetchBridgeStatus(serviceKey),
            fetchSystemSnapshot(serviceKey, 'system'),
        ])
        setBridgeStatus(bridge)
        setSystemSnapshot(snapshot)
        setLoading(false)
    }, [serviceKey])

    useEffect(() => {
        refresh()
        refreshRef.current = setInterval(refresh, 15000) // Poll every 15s
        return () => clearInterval(refreshRef.current)
    }, [refresh])

    const refreshStack = useCallback(async () => {
        const statuses = await Promise.all(
            N8N_AI_STACK_SERVICES.map(async (service) => {
                const baseUrl = normalizeBaseUrl(import.meta.env[service.envKey] || service.defaultBaseUrl)
                const endpoint = buildEndpoint(baseUrl, service.healthPath)
                const probe = await fetchServiceProbe(endpoint)
                return {
                    ...service,
                    baseUrl,
                    endpoint,
                    ...probe,
                }
            })
        )
        setStackStatus(statuses)
        setStackRefreshedAt(new Date().toISOString())
    }, [])

    useEffect(() => {
        refreshStack()
        stackRefreshRef.current = setInterval(refreshStack, 20000)
        return () => clearInterval(stackRefreshRef.current)
    }, [refreshStack])

    // Fetch recent TD commands from event_log
    useEffect(() => {
        if (!supabase) return
        supabase
            .from('event_log')
            .select('*')
            .like('event_type', 'td.command.%')
            .order('created_at', { ascending: false })
            .limit(20)
            .then(({ data }) => setCommandLog(data || []))

        supabase
            .from('event_log')
            .select('*')
            .like('event_type', 'td.%')
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }) => setEventStream(data || []))

        supabase
            .from('event_log')
            .select('*')
            .not('correlation_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(30)
            .then(({ data }) => setTraceEvents(data || []))
    }, [bridgeStatus])

    const saveKey = () => {
        localStorage.setItem('td_service_key', serviceKey)
        refresh()
    }

    const clients = bridgeStatus?.connectedClients || []
    const health = bridgeStatus?.systemHealth || systemSnapshot || {}
    const onlineStackCount = useMemo(() => stackStatus.filter(service => service.online).length, [stackStatus])

    const tabs = [
        { id: 'overview', label: 'OVERVIEW' },
        { id: 'stack', label: 'CORE STACK' },
        { id: 'clients', label: 'CLIENTS' },
        { id: 'events', label: 'EVENT STREAM' },
        { id: 'commands', label: 'COMMAND LOG' },
        { id: 'config', label: 'CONFIGURATION' },
    ]

    const openTrace = (correlationId) => {
        if (!correlationId) return
        navigate(`/control-tower?corr=${encodeURIComponent(correlationId)}`)
    }

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                        <span style={{ fontSize: 24 }}>🖥</span>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontFamily: 'var(--font-editorial)', fontSize: 28, color: 'var(--accent-primary)', lineHeight: 1 }}>Command Center</h1>
                        <span className="mono text-xs text-tertiary">TOUCHDESIGNER BRIDGE // REALTIME VISUAL INTELLIGENCE</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', padding: '8px 16px' }}>
                    <div className="mono text-xs">
                        <span style={{ color: 'var(--text-tertiary)' }}>BRIDGE:</span>
                        <span style={{ color: clients.length > 0 ? 'var(--color-success)' : 'var(--text-tertiary)', fontWeight: 'bold', marginLeft: 8 }}>
                            {clients.length > 0 ? 'LIVE' : 'STANDBY'}
                        </span>
                    </div>
                    <div className="mono text-xs" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>CLIENTS:</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', marginLeft: 8 }}>{clients.length}</span>
                    </div>
                    <div className="mono text-xs" style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>AI STACK:</span>
                        <span style={{ color: onlineStackCount > 0 ? 'var(--color-success)' : 'var(--text-tertiary)', fontWeight: 'bold', marginLeft: 8 }}>
                            {onlineStackCount}/{N8N_AI_STACK_SERVICES.length}
                        </span>
                    </div>
                    <div className={`status-dot ${clients.length > 0 ? 'active' : ''}`}></div>
                </div>
            </div>

            {/* ── TAB BAR ── */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="mono text-xs"
                        style={{
                            padding: '10px 20px',
                            background: activeTab === tab.id ? 'var(--surface-raised)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab.id ? 700 : 400,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CONTENT ── */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border-default)', border: '1px solid var(--border-default)', marginBottom: 16 }}>
                        {[
                            { label: 'TD CLIENTS', value: clients.length, color: clients.length > 0 ? 'var(--color-success)' : 'var(--text-tertiary)' },
                            { label: 'HEALTH SCORE', value: health.healthScore ?? health.agents?.total ?? '—', color: 'var(--accent-primary)' },
                            { label: 'AGENTS ONLINE', value: health.agents?.online ?? '—', color: 'var(--color-success)' },
                            { label: 'ACTIVE SIGNALS', value: health.signals?.active ?? '—', color: 'var(--color-warning)' },
                            { label: 'PIPELINE VALUE', value: health.pipeline?.totalValue ? `€${health.pipeline.totalValue.toLocaleString()}` : '—', color: 'var(--accent-primary)' },
                            { label: 'COMMANDS (24H)', value: commandLog.length, color: 'var(--text-primary)' },
                        ].map((kpi, i) => (
                            <div key={i} style={{ background: 'var(--surface-raised)', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <span className="mono text-xs text-tertiary font-bold">{kpi.label}</span>
                                <span className="mono" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: kpi.color }}>{kpi.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'overview' && (
                    <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)', marginBottom: 16 }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Core AI stack</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                {N8N_AIRDROP_INTEL.stats.uniqueWorkflows} workflows ready · {N8N_AIRDROP_INTEL.stats.expertPacks} expert packs
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, background: 'var(--border-default)' }}>
                            {stackStatus.map((service) => (
                                <div key={service.key} style={{ background: 'var(--surface-raised)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span className="mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{service.label}</span>
                                        <span className="mono text-xs" style={{ color: service.online ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {service.online ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                    <span className="mono text-xs text-tertiary">{service.role}</span>
                                    <span className="mono text-xs text-tertiary">{service.endpoint}</span>
                                    <span className="mono text-xs" style={{ color: 'var(--accent-primary)' }}>
                                        {service.statusCode ? `HTTP ${service.statusCode}` : 'NO RESPONSE'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Architecture diagram */}
                        <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Data flow</div>
                            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[
                                    { from: 'SUPABASE', to: 'TD-BRIDGE', protocol: 'REALTIME', active: true },
                                    { from: 'TD-BRIDGE', to: 'TOUCHDESIGNER', protocol: 'WEBSOCKET', active: clients.length > 0 },
                                    { from: 'TD-API', to: 'TOUCHDESIGNER', protocol: 'REST/JSON', active: true },
                                    { from: 'TOUCHDESIGNER', to: 'TD-COMMAND', protocol: 'HTTP POST', active: true },
                                    { from: 'TD-COMMAND', to: 'EDGE FUNCTIONS', protocol: 'INTERNAL', active: true },
                                ].map((flow, i) => (
                                    <div key={i} className="mono text-xs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <StatusDot status={flow.active ? 'connected' : 'disconnected'} />
                                        <span style={{ color: 'var(--text-primary)', minWidth: 120 }}>{flow.from}</span>
                                        <span style={{ color: 'var(--accent-primary)' }}>→</span>
                                        <span style={{ color: 'var(--text-primary)', minWidth: 120 }}>{flow.to}</span>
                                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', border: '1px solid var(--border-subtle)', padding: '2px 8px' }}>{flow.protocol}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent events */}
                        <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Recent events</div>
                            <div style={{ padding: 8, maxHeight: 280, overflowY: 'auto' }}>
                                {eventStream.slice(0, 10).map((evt, i) => (
                                    <div key={evt.id || i} className="mono" style={{ fontSize: 10, padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
                                        <span style={{ color: 'var(--text-tertiary)', minWidth: 60 }}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                                        <span style={{ color: 'var(--accent-primary)' }}>{evt.event_type}</span>
                                        {extractCorrelationId(evt) && (
                                            <button
                                                className="mono text-xs"
                                                onClick={() => openTrace(extractCorrelationId(evt))}
                                                style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '1px 6px' }}
                                            >
                                                {shortCorrelation(extractCorrelationId(evt))}
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {eventStream.length === 0 && (
                                    <div className="mono text-xs text-tertiary" style={{ padding: 32, textAlign: 'center' }}>NO TD EVENTS YET</div>
                                )}
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Pipeline traces</div>
                            <div style={{ padding: 8, maxHeight: 280, overflowY: 'auto' }}>
                                {traceEvents.slice(0, 10).map((evt, i) => (
                                    <div key={evt.id || i} className="mono" style={{ fontSize: 10, padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-tertiary)', minWidth: 60 }}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                                        <span style={{ color: 'var(--accent-primary)', minWidth: 140 }}>{evt.event_type}</span>
                                        <button
                                            className="mono text-xs"
                                            onClick={() => openTrace(extractCorrelationId(evt))}
                                            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '1px 6px' }}
                                        >
                                            {shortCorrelation(extractCorrelationId(evt))}
                                        </button>
                                    </div>
                                ))}
                                {traceEvents.length === 0 && (
                                    <div className="mono text-xs text-tertiary" style={{ padding: 32, textAlign: 'center' }}>NO CORRELATED EVENTS YET</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CORE STACK TAB */}
                {activeTab === 'stack' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                        <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>
                                Service health
                            </div>
                            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {stackStatus.map((service) => (
                                    <div key={service.key} style={{ border: '1px solid var(--border-subtle)', padding: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <StatusDot status={service.online ? 'connected' : 'disconnected'} />
                                        <div style={{ flex: 1 }}>
                                            <div className="mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{service.label}</div>
                                            <div className="mono text-xs text-tertiary">{service.role}</div>
                                            <div className="mono text-xs text-tertiary">{service.baseUrl}</div>
                                        </div>
                                        <div className="mono text-xs" style={{ color: service.online ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {service.online ? `HTTP ${service.statusCode}` : 'UNREACHABLE'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                                <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>
                                    Airdrop telemetry
                                </div>
                                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div className="mono text-xs text-tertiary">Last refresh: {stackRefreshedAt ? new Date(stackRefreshedAt).toLocaleTimeString() : '—'}</div>
                                    <div className="mono text-xs text-tertiary">Expert packs: {N8N_AIRDROP_INTEL.stats.expertPacks}</div>
                                    <div className="mono text-xs text-tertiary">Unique workflows: {N8N_AIRDROP_INTEL.stats.uniqueWorkflows}</div>
                                    <div className="mono text-xs text-tertiary">Workflow JSONs: {N8N_AIRDROP_INTEL.stats.workflowJsons}</div>
                                </div>
                            </div>

                            <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                                <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>
                                    Suggested combos
                                </div>
                                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {N8N_SUGGESTED_COMBOS.slice(0, 3).map((combo) => (
                                        <div key={combo.task} style={{ border: '1px solid var(--border-subtle)', padding: 8 }}>
                                            <div className="mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{combo.task}</div>
                                            <div className="mono text-xs text-tertiary" style={{ marginTop: 4 }}>{combo.skills.join(' + ')}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CLIENTS TAB */}
                {activeTab === 'clients' && (
                    <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Connected clients</div>
                        {clients.length === 0 ? (
                            <div className="mono text-xs text-tertiary" style={{ padding: 48, textAlign: 'center' }}>
                                NO TOUCHDESIGNER CLIENTS CONNECTED<br />
                                <span style={{ marginTop: 8, display: 'block', color: 'var(--text-tertiary)' }}>Connect via WebSocket: wss://[SUPABASE_URL]/functions/v1/td-bridge</span>
                            </div>
                        ) : (
                            clients.map((client, i) => (
                                <div key={client.id} style={{ padding: '16px 20px', borderBottom: i < clients.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <StatusDot status="connected" />
                                    <div style={{ flex: 1 }}>
                                        <div className="mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{client.id.slice(0, 12).toUpperCase()}</div>
                                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                            SINCE: {new Date(client.connectedAt).toLocaleString()} | LAST: {new Date(client.lastEvent).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div className="mono text-xs" style={{ display: 'flex', gap: 4 }}>
                                        {(client.channels || []).map(ch => (
                                            <span key={ch} style={{ border: '1px solid var(--border-subtle)', padding: '2px 6px', color: 'var(--accent-primary)' }}>{ch.toUpperCase()}</span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* EVENT STREAM TAB */}
                {activeTab === 'events' && (
                    <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Event stream</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>{eventStream.length} EVENTS</span>
                        </div>
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {eventStream.map((evt, i) => (
                                <div key={evt.id || i} className="mono" style={{ fontSize: 11, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12, background: i % 2 === 0 ? 'transparent' : 'var(--surface-elevated)' }}>
                                    <span style={{ color: 'var(--text-tertiary)', minWidth: 80, flexShrink: 0 }}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                                    <span style={{ color: 'var(--accent-primary)', minWidth: 180, flexShrink: 0 }}>{evt.event_type}</span>
                                    <button
                                        className="mono text-xs"
                                        onClick={() => openTrace(extractCorrelationId(evt))}
                                        style={{ color: 'var(--text-tertiary)', minWidth: 90, flexShrink: 0, background: 'transparent', border: '1px solid var(--border-subtle)', cursor: extractCorrelationId(evt) ? 'pointer' : 'default', padding: '1px 6px' }}
                                        disabled={!extractCorrelationId(evt)}
                                    >
                                        {shortCorrelation(extractCorrelationId(evt))}
                                    </button>
                                    <span style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {evt.payload ? JSON.stringify(evt.payload).slice(0, 120) : '—'}
                                    </span>
                                </div>
                            ))}
                            {eventStream.length === 0 && (
                                <div className="mono text-xs text-tertiary" style={{ padding: 48, textAlign: 'center' }}>NO TD EVENTS RECORDED</div>
                            )}
                        </div>
                    </div>
                )}

                {/* COMMAND LOG TAB */}
                {activeTab === 'commands' && (
                    <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Command log</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>{commandLog.length} COMMANDS</span>
                        </div>
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {commandLog.map((cmd, i) => {
                                const payload = cmd.payload || {}
                                return (
                                    <div key={cmd.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-elevated)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                            <span className="mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(cmd.created_at).toLocaleString()}</span>
                                            <span className="mono text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>{payload.command || cmd.event_type}</span>
                                            <span className="mono text-xs" style={{ marginLeft: 'auto', color: payload.result?.ok ? 'var(--color-success)' : 'var(--color-danger)', border: '1px solid currentColor', padding: '1px 6px' }}>
                                                {payload.result?.ok ? 'SUCCESS' : 'FAILED'}
                                            </span>
                                        </div>
                                        {payload.params && (
                                            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                                PARAMS: {JSON.stringify(payload.params).slice(0, 200)}
                                            </div>
                                        )}
                                        {extractCorrelationId(cmd) && (
                                            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                CORRELATION:
                                                <button
                                                    className="mono text-xs"
                                                    onClick={() => openTrace(extractCorrelationId(cmd))}
                                                    style={{ marginLeft: 6, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '1px 6px' }}
                                                >
                                                    {extractCorrelationId(cmd)}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {commandLog.length === 0 && (
                                <div className="mono text-xs text-tertiary" style={{ padding: 48, textAlign: 'center' }}>NO COMMANDS FROM TOUCHDESIGNER YET</div>
                            )}
                        </div>
                    </div>
                )}

                {/* CONFIGURATION TAB */}
                {activeTab === 'config' && (
                    <div style={{ maxWidth: 600 }}>
                        <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Configuration</div>
                            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                    <label className="mono text-xs text-tertiary" style={{ display: 'block', marginBottom: 8 }}>TD SERVICE KEY</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            type="password"
                                            value={serviceKey}
                                            onChange={e => setServiceKey(e.target.value)}
                                            placeholder="Enter your TD_SERVICE_KEY..."
                                            className="mono text-xs"
                                            style={{ flex: 1, background: 'var(--surface-inset)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', padding: '8px 12px', outline: 'none' }}
                                        />
                                        <button
                                            onClick={saveKey}
                                            className="mono text-xs"
                                            style={{ padding: '8px 16px', background: 'var(--accent-primary)', color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            SAVE
                                        </button>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                                    <div className="mono text-xs font-bold" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>ENDPOINTS</div>
                                    {[
                                        { label: 'WebSocket Bridge', url: `${SUPABASE_URL}/functions/v1/td-bridge`, protocol: 'WSS' },
                                        { label: 'REST API', url: `${SUPABASE_URL}/functions/v1/td-api?view=full`, protocol: 'GET' },
                                        { label: 'Command Receiver', url: `${SUPABASE_URL}/functions/v1/td-command`, protocol: 'POST' },
                                    ].map((ep, i) => (
                                        <div key={i} className="mono" style={{ fontSize: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: 'var(--accent-primary)', minWidth: 40 }}>{ep.protocol}</span>
                                            <span style={{ color: 'var(--text-primary)' }}>{ep.label}</span>
                                            <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.url}</span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                                    <div className="mono text-xs font-bold" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>ALLOWED COMMANDS</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {['trigger_agent', 'run_cortex_cycle', 'update_deal_stage', 'dismiss_signal', 'create_alert', 'approve_decision'].map(cmd => (
                                            <span key={cmd} className="mono text-xs" style={{ border: '1px solid var(--border-subtle)', padding: '4px 8px', color: 'var(--accent-primary)' }}>{cmd}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
