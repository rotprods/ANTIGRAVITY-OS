// ═══════════════════════════════════════════════════
// OCULOPS — Command Center (TouchDesigner Bridge Manager)
// Military-grade control surface for TD ↔ SaaS connectivity
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'

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
    const [serviceKey, setServiceKey] = useState('')
    const [bridgeStatus, setBridgeStatus] = useState(null)
    const [systemSnapshot, setSystemSnapshot] = useState(null)
    const [commandLog, setCommandLog] = useState([])
    const [eventStream, setEventStream] = useState([])
    const [_loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')
    const refreshRef = useRef(null)

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
    }, [bridgeStatus])

    const saveKey = () => {
        localStorage.setItem('td_service_key', serviceKey)
        refresh()
    }

    const clients = bridgeStatus?.connectedClients || []
    const health = bridgeStatus?.systemHealth || systemSnapshot || {}

    const tabs = [
        { id: 'overview', label: 'OVERVIEW' },
        { id: 'clients', label: 'CLIENTS' },
        { id: 'events', label: 'EVENT STREAM' },
        { id: 'commands', label: 'COMMAND LOG' },
        { id: 'config', label: 'CONFIGURATION' },
    ]

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--border-default)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                        <span style={{ fontSize: 24 }}>🖥</span>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontFamily: 'var(--font-editorial)', fontSize: 28, color: 'var(--accent-primary)', letterSpacing: '0.05em', lineHeight: 1 }}>COMMAND CENTER</h1>
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
                            letterSpacing: '0.1em',
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Architecture diagram */}
                        <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>/// DATA FLOW</div>
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
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>/// RECENT TD EVENTS</div>
                            <div style={{ padding: 8, maxHeight: 280, overflowY: 'auto' }}>
                                {eventStream.slice(0, 10).map((evt, i) => (
                                    <div key={evt.id || i} className="mono" style={{ fontSize: 10, padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
                                        <span style={{ color: 'var(--text-tertiary)', minWidth: 60 }}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                                        <span style={{ color: 'var(--accent-primary)' }}>{evt.event_type}</span>
                                    </div>
                                ))}
                                {eventStream.length === 0 && (
                                    <div className="mono text-xs text-tertiary" style={{ padding: 32, textAlign: 'center' }}>NO TD EVENTS YET</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CLIENTS TAB */}
                {activeTab === 'clients' && (
                    <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>/// CONNECTED TD CLIENTS</div>
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
                            <span>/// EVENT STREAM</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>{eventStream.length} EVENTS</span>
                        </div>
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {eventStream.map((evt, i) => (
                                <div key={evt.id || i} className="mono" style={{ fontSize: 11, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12, background: i % 2 === 0 ? 'transparent' : '#000' }}>
                                    <span style={{ color: 'var(--text-tertiary)', minWidth: 80, flexShrink: 0 }}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                                    <span style={{ color: 'var(--accent-primary)', minWidth: 180, flexShrink: 0 }}>{evt.event_type}</span>
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
                            <span>/// COMMAND LOG (TD → SAAS)</span>
                            <span style={{ color: 'var(--text-tertiary)' }}>{commandLog.length} COMMANDS</span>
                        </div>
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {commandLog.map((cmd, i) => {
                                const payload = cmd.payload || {}
                                return (
                                    <div key={cmd.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : '#000' }}>
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
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>/// BRIDGE CONFIGURATION</div>
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
                                            style={{ flex: 1, background: '#000', border: '1px solid var(--border-default)', color: 'var(--text-primary)', padding: '8px 12px', outline: 'none' }}
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
