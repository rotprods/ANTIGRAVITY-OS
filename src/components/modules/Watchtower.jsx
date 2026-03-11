// /////////////////////////////////////////////////////////////////////////////
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// OCULOPS — Watchtower (Alerts)
// Wired to Supabase via useAlerts hook
// /////////////////////////////////////////////////////////////////////////////

import { useState, useMemo } from 'react'
import { useAlerts } from '../../hooks/useAlerts'
import { useAgents } from '../../hooks/useAgents'
import { useApiCatalog } from '../../hooks/useApiCatalog'
import { useConnectorProxy } from '../../hooks/useConnectorProxy'
import { useAgentVault } from '../../hooks/useAgentVault'
import ModuleSkeleton from '../ui/ModuleSkeleton'

const SEVERITY_CONFIG = {
    1: { label: 'CRITICAL', color: 'var(--color-danger)', marker: '[ CRIT ]' },
    2: { label: 'HIGH', color: 'var(--color-warning)', marker: '[ HIGH ]' },
    3: { label: 'MEDIUM', color: 'var(--color-info)', marker: '[ MED ]' },
    4: { label: 'LOW', color: 'var(--text-tertiary)', marker: '[ LOW ]' },
}

const emptyForm = { type: 'risk', severity: 2, description: '', title: '' }

function Watchtower() {
    const { alerts, loading, addAlert, resolveAlert } = useAlerts()
    const { agents: oculopsAgents, stats: agentStats } = useAgents()
    const { totalAgents: vaultTotal, canonicalCount: vaultCanonical, namespaces: vaultNamespaces } = useAgentVault()
    const { installedApps: watchtowerApps } = useApiCatalog({ moduleTarget: 'watchtower' })
    const { execute: executeConnector, data: feedData, loading: feedLoading, error: feedError } = useConnectorProxy({}, { cacheTTL: 30000 })
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('active')
    const liveFeeds = watchtowerApps.filter(app => app.connectorStatus === 'live')

    const handleAdd = async () => {
        if (!form.description.trim()) return
        setSaving(true)
        await addAlert({ ...form, status: 'active' })
        setForm(emptyForm)
        setSaving(false)
    }

    const resolve = async (id) => {
        await resolveAlert(id)
    }

    const runFeed = async (app) => {
        await executeConnector({
            connectorId: app.connectorId,
            endpointName: app.endpointName,
            params: app.sampleParams,
        })
    }

    const filtered = alerts
        .filter(a => filter === 'all' || a.status === filter)
        .sort((a, b) => (a.severity || 4) - (b.severity || 4))

    const activeCount = alerts.filter(a => a.status === 'active').length
    const criticalCount = alerts.filter(a => a.status === 'active' && a.severity === 1).length

    if (loading) return <ModuleSkeleton variant="kpi" rows={4} />

    return (
        <div className="fade-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '24px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-text)', fontSize: '28px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WATCHTOWER RADAR</h1>
                    <p className="mono font-bold" style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px', letterSpacing: '0.1em' }}>
                        /// GLOBAL THREAT AND OPPORTUNITY MONITORING
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ border: '1px solid var(--color-border)', background: '#000', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>[ ACTIVE ALERTS ]</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: activeCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{activeCount}</div>
                </div>
                <div style={{ border: '1px solid var(--color-border)', background: '#000', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>[ CRITICAL SEVERITY ]</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: 'var(--color-danger)' }}>{criticalCount}</div>
                </div>
                <div style={{ border: '1px solid var(--color-border)', background: '#000', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>[ RESOLVED MATTERS ]</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: 'var(--color-success)' }}>{alerts.filter(a => a.status === 'resolved').length}</div>
                </div>
                <div style={{ border: '1px solid var(--color-border)', background: '#000', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>[ TOTAL PROCESSED ]</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: 'var(--color-text-2)' }}>{alerts.length}</div>
                </div>
            </div>

            {/* AGENT MONITORING */}
            <div style={{ border: '1px solid var(--color-border)', background: '#000', marginBottom: '32px' }}>
                <div className="mono font-bold text-tertiary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', letterSpacing: '0.1em' }}>
                    /// AGENT NETWORK MONITORING
                </div>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: '4px' }}>OCULOPS AGENTS</div>
                            <div className="mono font-bold" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>{agentStats.online}/{agentStats.total}</div>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--color-success)', marginTop: '4px' }}>{agentStats.running} RUNNING</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: '4px' }}>VAULT ARSENAL</div>
                            <div className="mono font-bold" style={{ fontSize: '20px', color: 'var(--color-info)' }}>{vaultTotal}</div>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--color-text-3)', marginTop: '4px' }}>{vaultCanonical} CANONICAL / {vaultNamespaces.length} NS</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginBottom: '4px' }}>SYSTEM CYCLES</div>
                            <div className="mono font-bold" style={{ fontSize: '20px', color: 'var(--color-text)' }}>{agentStats.totalRuns}</div>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--color-text-3)', marginTop: '4px' }}>{agentStats.queuedTasks} QUEUED</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {oculopsAgents.map(ag => (
                            <div key={ag.id} className="mono" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', fontSize: '10px' }}>
                                <div style={{ width: 6, height: 6, background: ag.status === 'online' ? 'var(--color-success)' : ag.status === 'running' ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                                <span style={{ width: '100px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{ag.code_name.toUpperCase()}</span>
                                <span style={{ flex: 1, color: 'var(--color-text-2)' }}>{ag.name.toUpperCase()}</span>
                                <span style={{ color: 'var(--text-tertiary)' }}>RUNS: {ag.total_runs || 0}</span>
                                <span style={{ color: ag.status === 'online' ? 'var(--color-success)' : 'var(--color-warning)' }}>[{ag.status.toUpperCase()}]</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {liveFeeds.length > 0 && (
                <div style={{ border: '1px solid var(--color-border)', background: '#000', marginBottom: '32px' }}>
                    <div className="mono font-bold text-tertiary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', letterSpacing: '0.1em' }}>
                        /// LIVE SURVEILLANCE FEEDS
                    </div>
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {liveFeeds.map(app => (
                                <button
                                    key={app.connectorId}
                                    className="mono font-bold"
                                    style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', fontSize: '10px', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
                                    onClick={() => runFeed(app)}
                                    disabled={feedLoading}
                                >
                                    {feedLoading ? '[ INTERCEPTING... ]' : `[ SYNC ${app.name.toUpperCase()} ]`}
                                </button>
                            ))}
                        </div>
                        {(feedData || feedError) && (
                            <pre style={{
                                padding: '16px',
                                background: 'rgba(0,0,0,0.5)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '10px',
                                color: feedError ? 'var(--color-danger)' : 'var(--color-text-2)',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-mono)',
                                margin: 0
                            }}>
                                {feedError ? feedError : JSON.stringify(feedData?.normalized ?? feedData, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            <div style={{ border: '1px solid var(--color-border)', background: '#000', marginBottom: '32px' }}>
                <div className="mono font-bold text-tertiary" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', letterSpacing: '0.1em' }}>
                    <span>/// ACTIVE RADAR BLIPS ({filtered.length})</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['active', 'resolved', 'all'].map(f => (
                            <button
                                key={f}
                                className="mono"
                                style={{ background: filter === f ? 'var(--color-text)' : 'transparent', color: filter === f ? '#000' : 'var(--text-tertiary)', border: 'none', fontSize: '9px', padding: '4px 8px', letterSpacing: '0.1em', cursor: 'pointer', fontWeight: 'bold' }}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'active' ? '[ ACTIVE ]' : f === 'resolved' ? '[ SECURED ]' : '[ ARCHIVE ]'}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '24px' }}>
                    {filtered.length === 0 ? (
                        <div className="mono" style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.1em', padding: '40px 0' }}>
                            {filter === 'active' ? '[ ALL ZONES SECURE ]' : '[ NO DATA TO DISPLAY ]'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filtered.map(alert => {
                                const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG[4]
                                return (
                                    <div key={alert.id} className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${sev.color}`, opacity: alert.status === 'resolved' ? 0.4 : 1 }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--color-text)', fontSize: '12px', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                                <span style={{ color: sev.color, marginRight: '8px' }}>{sev.marker}</span>
                                                {alert.description.toUpperCase()}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                                                TYPE: {alert.type.toUpperCase()} | CLASSIFICATION: {sev.label} | TIMESTAMP: {alert.created_at?.split('T')[0]}
                                            </div>
                                        </div>
                                        <div>
                                            {alert.status === 'active' && (
                                                <button
                                                    style={{ background: 'transparent', border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: '9px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}
                                                    onClick={() => resolve(alert.id)}
                                                >
                                                    [ RESOLVE ]
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

            <div style={{ border: '1px solid var(--color-border)', background: '#000' }}>
                <div className="mono font-bold text-tertiary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', letterSpacing: '0.1em' }}>
                    /// MANUAL OVERRIDE INJECTION
                </div>
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Signal Type</label>
                            <select style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', appearance: 'none', borderRadius: 0 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                <option value="risk">RISK VECTOR</option>
                                <option value="opportunity">STRATEGIC OPPORTUNITY</option>
                                <option value="metric">ANOMALOUS METRIC</option>
                                <option value="deadline">CRITICAL DEADLINE</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Threat Level</label>
                            <select style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', appearance: 'none', borderRadius: 0 }} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: parseInt(e.target.value) }))}>
                                <option value={1}>CRITICAL</option>
                                <option value={2}>HIGH</option>
                                <option value={3}>MEDIUM</option>
                                <option value={4}>LOW</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Designation</label>
                            <input style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. COMPROMISED NODE" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Intel Brief</label>
                            <input style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Provide tactical details..." />
                        </div>
                    </div>
                    <button
                        className="mono font-bold"
                        style={{ marginTop: '24px', background: 'var(--color-primary)', color: '#000', border: 'none', padding: '12px 24px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
                        onClick={handleAdd}
                        disabled={saving || !form.description.trim()}
                    >
                        {saving ? '[ INJECTING... ]' : '[ DISPATCH ALERT ]'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Watchtower
