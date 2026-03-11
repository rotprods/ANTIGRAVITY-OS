// ═══════════════════════════════════════════════════
// OCULOPS — Decision Log
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useDecisions } from '../../hooks/useDecisions'
import VaultAgentPanel from '../ui/VaultAgentPanel'
import ModuleSkeleton from '../ui/ModuleSkeleton'

const emptyForm = { title: '', context: '', options: '', rationale: '', expected_outcome: '', review_date: '' }

function Decisions() {
    const { decisions, loading, addDecision, updateDecision, removeDecision, pendingReview } = useDecisions()
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    const handleAdd = async () => {
        if (!form.title.trim()) return
        setSaving(true)
        await addDecision({ ...form, status: 'active', decision_date: new Date().toISOString().split('T')[0] })
        setForm(emptyForm)
        setSaving(false)
    }

    if (loading) return <ModuleSkeleton variant="kpi" rows={3} />

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>DECISION LEDGER</h1>
                    <span className="mono text-xs text-tertiary">STRATEGIC ARCHIVES & RATIONALE TRACKING</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>

                {/* ── KPI STRIP ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
                    <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="mono text-xs text-tertiary">TOTAL DECISIONS</span>
                            <span style={{ fontSize: '14px', color: 'var(--color-primary)' }}>⚖️</span>
                        </div>
                        <span className="mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>{decisions.length}</span>
                    </div>
                    <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="mono text-xs text-tertiary">PENDING REVIEW</span>
                            <span style={{ fontSize: '14px', color: 'var(--color-warning)' }}>⚠️</span>
                        </div>
                        <span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{pendingReview.length}</span>
                    </div>
                    <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="mono text-xs text-tertiary">REVIEWED & SEALED</span>
                            <span style={{ fontSize: '14px', color: 'var(--color-success)' }}>✅</span>
                        </div>
                        <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{decisions.filter(d => d.status === 'reviewed').length}</span>
                    </div>
                </div>

                <div style={{ border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                    <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--color-primary)', color: '#000' }}>
                        /// INITIALIZE NEW DECISION RECORD
                    </div>
                    <div style={{ padding: '16px', background: '#000', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="input-group">
                            <label className="mono text-xs">DECISION VECTOR</label>
                            <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="EX: PIVOT TO ENTERPRISE SAAS" />
                        </div>
                        <div className="input-group">
                            <label className="mono text-xs">TARGET REVIEW DATE</label>
                            <input className="input mono text-xs" type="date" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={form.review_date} onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))} />
                        </div>

                        <div className="input-group" style={{ gridColumn: 'span 2' }}>
                            <label className="mono text-xs">OPERATIONAL CONTEXT</label>
                            <textarea className="input mono text-xs" rows="2" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px', resize: 'vertical' }} value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} placeholder="CURRENT MARKET CONDITIONS OR INTERNAL CATALYSTS..." />
                        </div>

                        <div className="input-group">
                            <label className="mono text-xs">OPTIONS EVALUATED</label>
                            <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))} placeholder="OPTION A VS OPTION B" />
                        </div>
                        <div className="input-group">
                            <label className="mono text-xs">STRATEGIC RATIONALE</label>
                            <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))} placeholder="WHY WAS THIS OPTION SELECTED?" />
                        </div>

                        <div className="input-group" style={{ gridColumn: 'span 2' }}>
                            <label className="mono text-xs">PROJECTED OUTCOME</label>
                            <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '10px' }} value={form.expected_outcome} onChange={e => setForm(f => ({ ...f, expected_outcome: e.target.value }))} placeholder="EXPECTED RESULT IN 30/60/90 DAYS..." />
                        </div>

                        <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                            <button className="btn btn-primary mono" style={{ borderRadius: 0, padding: '12px 24px' }} onClick={handleAdd} disabled={saving}>
                                {saving ? 'ENCRYPTING RECORD...' : 'COMMIT SECURE RECORD'}
                            </button>
                        </div>
                    </div>
                </div>

                {pendingReview.length > 0 && (
                    <div style={{ border: '1px solid var(--color-warning)', background: '#000', display: 'flex', flexDirection: 'column' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--color-warning)', color: '#000' }}>
                            /// CRITICAL: PENDING REVIEW
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {pendingReview.map((d, idx) => (
                                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: idx < pendingReview.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: idx % 2 === 0 ? 'rgba(255,149,0,0.05)' : 'transparent' }}>
                                    <div>
                                        <div className="mono font-bold" style={{ color: 'var(--color-warning)', fontSize: '14px' }}>{d.title.toUpperCase()}</div>
                                        <div className="mono text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            DECISION: {d.decision_date || d.created_at?.split('T')[0]} <span style={{ margin: '0 8px' }}>|</span> DEADLINE: <span style={{ color: '#fff' }}>{d.review_date || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }} onClick={() => updateDecision(d.id, { status: 'reviewed' })}>
                                        MARK REVIEWED
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
                    <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                        /// HISTORICAL LEDGER [{decisions.length}]
                    </div>
                    {decisions.length === 0 ? (
                        <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO DECISIONS SECURED IN LOG.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {decisions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((d, idx) => (
                                <div key={d.id} style={{ padding: '16px', borderBottom: idx < decisions.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: idx % 2 === 0 ? 'transparent' : '#000', borderLeft: `2px solid ${d.status === 'reviewed' ? 'var(--color-success)' : 'var(--color-primary)'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div className="mono font-bold" style={{ fontSize: '14px', color: 'var(--color-text)' }}>{d.title.toUpperCase()}</div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span className="mono text-xs text-tertiary">{d.decision_date || d.created_at?.split('T')[0]}</span>
                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => removeDecision(d.id)}>PURGE</button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {d.context && (
                                            <div className="mono text-xs" style={{ color: 'var(--color-text-2)' }}>
                                                <span style={{ color: 'var(--text-tertiary)' }}>CTX:</span> {d.context.toUpperCase()}
                                            </div>
                                        )}
                                        {d.rationale && (
                                            <div className="mono text-xs" style={{ color: 'var(--color-primary)' }}>
                                                <span style={{ color: 'var(--color-primary)', opacity: 0.7 }}>LOGIC:</span> {d.rationale.toUpperCase()}
                                            </div>
                                        )}
                                        {d.expected_outcome && (
                                            <div className="mono text-xs" style={{ color: 'var(--color-success)' }}>
                                                <span style={{ color: 'var(--color-success)', opacity: 0.7 }}>PROJ:</span> {d.expected_outcome.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

                <VaultAgentPanel title="DECISION INTELLIGENCE" namespaces={['product', 'research', 'orchestration']} />

        </div>
    )
}

export default Decisions
