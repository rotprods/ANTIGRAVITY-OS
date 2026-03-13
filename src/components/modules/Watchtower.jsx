// ═══════════════════════════════════════════════════
// OCULOPS — Watchtower (Alerts)
// Wired to Supabase via useAlerts hook
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useAlerts } from '../../hooks/useAlerts'
import { useAgents } from '../../hooks/useAgents'
import { useConnectorInfrastructure } from '../../hooks/useConnectorInfrastructure'
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
    const {
        liveConnectors: watchtowerApps,
        runConnector,
        runningConnectorId,
        latestByConnector,
        errorByConnector,
        toggleSavedFeed,
        isSavedFeed,
    } = useConnectorInfrastructure({ moduleTarget: 'watchtower' })
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('active')
    const [activeFeedId, setActiveFeedId] = useState(null)
    const liveFeeds = watchtowerApps

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
        setActiveFeedId(app.connectorId)
        await runConnector(app, {
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '24px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--text-primary)', fontSize: '28px', margin: 0 }}>Watchtower</h1>
                    <p className="mono font-bold" style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                        Global threat and opportunity monitoring
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Active alerts</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: activeCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{activeCount}</div>
                </div>
                <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Critical</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: 'var(--color-danger)' }}>{criticalCount}</div>
                </div>
                <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Resolved</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: 'var(--color-success)' }}>{alerts.filter(a => a.status === 'resolved').length}</div>
                </div>
                <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', padding: '20px' }}>
                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Total</div>
                    <div className="mono font-bold" style={{ fontSize: '24px', color: 'var(--text-secondary)' }}>{alerts.length}</div>
                </div>
            </div>

            {/* AGENT MONITORING */}
            <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', marginBottom: '32px' }}>
                <div className="mono font-bold text-tertiary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', fontSize: '11px' }}>
                    Agent network
                </div>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>OCULOPS AGENTS</div>
                            <div className="mono font-bold" style={{ fontSize: '20px', color: 'var(--accent-primary)' }}>{agentStats.online}/{agentStats.total}</div>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--color-success)', marginTop: '4px' }}>{agentStats.running} RUNNING</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>VAULT ARSENAL</div>
                            <div className="mono font-bold" style={{ fontSize: '20px', color: 'var(--color-info)' }}>{vaultTotal}</div>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{vaultCanonical} CANONICAL / {vaultNamespaces.length} NS</div>
                        </div>
                        <div style={{ border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>SYSTEM CYCLES</div>
                            <div className="mono font-bold" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{agentStats.totalRuns}</div>
                            <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{agentStats.queuedTasks} QUEUED</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {oculopsAgents.map(ag => (
                            <div key={ag.id} className="mono" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', fontSize: '10px' }}>
                                <div style={{ width: 6, height: 6, background: ag.status === 'online' ? 'var(--color-success)' : ag.status === 'running' ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                                <span style={{ width: '100px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{ag.code_name.toUpperCase()}</span>
                                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{ag.name.toUpperCase()}</span>
                                <span style={{ color: 'var(--text-tertiary)' }}>RUNS: {ag.total_runs || 0}</span>
                                <span style={{ color: ag.status === 'online' ? 'var(--color-success)' : 'var(--color-warning)' }}>[{ag.status.toUpperCase()}]</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {liveFeeds.length > 0 && (
                <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', marginBottom: '32px' }}>
                    <div className="mono font-bold text-tertiary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', fontSize: '11px' }}>
                        Live data feeds
                    </div>
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {liveFeeds.map(app => (
                                <button
                                    key={app.connectorId}
                                    className="mono font-bold"
                                    style={{ background: isSavedFeed(app.connectorId) ? 'var(--surface-inset)' : 'var(--surface-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '10px', padding: '10px 16px', cursor: 'pointer' }}
                                    onClick={() => runFeed(app)}
                                    disabled={runningConnectorId === app.connectorId}
                                >
                                    {runningConnectorId === app.connectorId ? 'Syncing...' : `Sync ${app.name}`}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {liveFeeds.map(app => (
                                <button
                                    key={`save-${app.connectorId}`}
                                    className="mono"
                                    style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: isSavedFeed(app.connectorId) ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: '9px', padding: '4px 8px', cursor: 'pointer' }}
                                    onClick={() => toggleSavedFeed(app.connectorId)}
                                >
                                    {isSavedFeed(app.connectorId) ? '[SAVED]' : '[SAVE]'} {app.name.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        {(activeFeedId && (latestByConnector[activeFeedId] || errorByConnector[activeFeedId])) && (
                            <pre style={{
                                padding: '16px',
                                background: 'var(--surface-inset)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '10px',
                                color: errorByConnector[activeFeedId] ? 'var(--color-danger)' : 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-mono)',
                                margin: 0
                            }}>
                                {errorByConnector[activeFeedId]
                                    ? errorByConnector[activeFeedId]
                                    : JSON.stringify(latestByConnector[activeFeedId]?.normalized ?? latestByConnector[activeFeedId], null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', marginBottom: '32px' }}>
                <div className="mono font-bold text-tertiary" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-default)', fontSize: '11px' }}>
                    <span>Active alerts ({filtered.length})</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['active', 'resolved', 'all'].map(f => (
                            <button
                                key={f}
                                className="mono"
                                style={{ background: filter === f ? 'var(--text-primary)' : 'transparent', color: filter === f ? 'var(--text-inverse)' : 'var(--text-tertiary)', border: 'none', fontSize: '9px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'active' ? 'Active' : f === 'resolved' ? 'Resolved' : 'All'}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '24px' }}>
                    {filtered.length === 0 ? (
                        <div className="mono" style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '10px', padding: '40px 0' }}>
                            {filter === 'active' ? 'No active alerts' : 'No data to display'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filtered.map(alert => {
                                const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG[4]
                                return (
                                    <div key={alert.id} className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${sev.color}`, opacity: alert.status === 'resolved' ? 0.4 : 1 }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '12px', marginBottom: '6px' }}>
                                                <span style={{ color: sev.color, marginRight: '8px' }}>{sev.marker}</span>
                                                {alert.description.toUpperCase()}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                                TYPE: {alert.type.toUpperCase()} | CLASSIFICATION: {sev.label} | TIMESTAMP: {alert.created_at?.split('T')[0]}
                                            </div>
                                        </div>
                                        <div>
                                            {alert.status === 'active' && (
                                                <button
                                                    style={{ background: 'transparent', border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: '9px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
                                                    onClick={() => resolve(alert.id)}
                                                >
                                                    Resolve
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

            <div style={{ border: '1px solid var(--border-default)', background: 'var(--surface-elevated)' }}>
                <div className="mono font-bold text-tertiary" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', fontSize: '11px' }}>
                    Create alert
                </div>
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px' }}>Type</label>
                            <select style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', appearance: 'none', borderRadius: 0 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                <option value="risk">Risk</option>
                                <option value="opportunity">Opportunity</option>
                                <option value="metric">Metric anomaly</option>
                                <option value="deadline">Deadline</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px' }}>Severity</label>
                            <select style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', appearance: 'none', borderRadius: 0 }} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: parseInt(e.target.value) }))}>
                                <option value={1}>CRITICAL</option>
                                <option value={2}>HIGH</option>
                                <option value={3}>MEDIUM</option>
                                <option value={4}>LOW</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px' }}>Title</label>
                            <input style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Server health warning" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                            <label className="mono text-tertiary" style={{ fontSize: '9px' }}>Description</label>
                            <input style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the alert..." />
                        </div>
                    </div>
                    <button
                        className="mono font-bold"
                        style={{ marginTop: '24px', background: 'var(--accent-primary)', color: 'var(--surface-base)', border: 'none', padding: '12px 24px', fontSize: '10px', cursor: 'pointer' }}
                        onClick={handleAdd}
                        disabled={saving || !form.description.trim()}
                    >
                        {saving ? 'Saving...' : 'Create alert'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Watchtower
