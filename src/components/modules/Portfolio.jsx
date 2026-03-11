// ═══════════════════════════════════════════════════
// OCULOPS — Portfolio (Strategic Bets)
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useBets } from '../../hooks/useBets'
import VaultAgentPanel from '../ui/VaultAgentPanel'
import ModuleSkeleton from '../ui/ModuleSkeleton'

const emptyForm = { name: '', type: 'core', hypothesis: '', kpi: '', kill_criteria: '', pivot_path: '', resources: '' }

function Portfolio() {
    const { bets, loading, addBet, updateBet, removeBet, byType, active } = useBets()
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [view, setView] = useState('all')

    const handleAdd = async () => {
        if (!form.name.trim() || !form.hypothesis.trim()) return
        setSaving(true)
        await addBet({ ...form, status: 'active' })
        setForm(emptyForm)
        setSaving(false)
    }

    const toggleStatus = async (bet) => {
        const next = bet.status === 'active' ? 'paused' : bet.status === 'paused' ? 'killed' : 'active'
        await updateBet(bet.id, { status: next })
    }

    const filtered = view === 'all' ? bets : bets.filter(b => b.type === view)
    const statusColor = s => s === 'active' ? 'var(--color-success)' : s === 'paused' ? 'var(--color-warning)' : 'var(--color-danger)'
    const statusSymbol = s => s === 'active' ? '[+]' : s === 'paused' ? '[~]' : '[-]'

    if (loading) return <ModuleSkeleton variant="cards" rows={4} />

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>PORTFOLIO OF BETS</h1>
                    <span className="mono text-xs text-tertiary">STRATEGIC ALLOCATIONS (CORE 70% / EXPLORE 30%)</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>

                {/* ── KPI STRIP ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--color-border)' }}>
                    <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>ACTIVE ALLOCATIONS</div>
                        <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-success)' }}>
                            {active.length}
                        </div>
                    </div>
                    <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>CORE BETS</div>
                        <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                            {(byType.core || []).length}
                        </div>
                    </div>
                    <div style={{ background: '#000', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>EXPLORE BETS</div>
                        <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-info)' }}>
                            {(byType.explore || []).length}
                        </div>
                    </div>
                </div>

                {/* ── BET LIST ── */}
                <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                        <div className="mono text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
                            /// STRATEGIC PORTFOLIO [{filtered.length}]
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['all', 'core', 'explore'].map(f => (
                                <button key={f} className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', border: view === f ? '1px solid var(--color-primary)' : '1px solid transparent', color: view === f ? 'var(--color-primary)' : 'var(--text-tertiary)' }} onClick={() => setView(f)}>
                                    {f === 'all' ? 'ALL' : f.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                            AWAITING NEW BET CONFIGURATION
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filtered.map((bet, idx) => (
                                <div key={bet.id} style={{ padding: '16px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: idx % 2 === 0 ? 'transparent' : '#000', borderLeft: `3px solid ${statusColor(bet.status)}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{bet.name.toUpperCase()}</div>
                                            <div style={{ color: 'var(--color-text-2)', fontSize: '10px', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>HYP: {bet.hypothesis.toUpperCase()}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', border: `1px solid ${statusColor(bet.status)}`, color: statusColor(bet.status), background: 'transparent' }} onClick={() => toggleStatus(bet)}>
                                                {statusSymbol(bet.status)} {bet.status.toUpperCase()}
                                            </button>
                                            <span style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--color-info)', color: 'var(--color-info)', fontFamily: 'var(--font-mono)' }}>{bet.type.toUpperCase()}</span>
                                            {bet.resources && <span style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--text-tertiary)', color: 'var(--color-text-2)', fontFamily: 'var(--font-mono)' }}>{bet.resources.toUpperCase()}</span>}
                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => removeBet(bet.id)}>DEL</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', marginTop: '16px' }}>
                                        <div style={{ background: 'var(--color-bg-2)', padding: '8px' }}>
                                            <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}>KPI TARGET</div>
                                            <div className="mono text-xs" style={{ color: 'var(--color-success)' }}>{bet.kpi ? bet.kpi.toUpperCase() : '—'}</div>
                                        </div>
                                        <div style={{ background: 'var(--color-bg-2)', padding: '8px' }}>
                                            <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}>KILL CRITERIA</div>
                                            <div className="mono text-xs" style={{ color: 'var(--color-danger)' }}>{bet.kill_criteria ? bet.kill_criteria.toUpperCase() : '—'}</div>
                                        </div>
                                        <div style={{ background: 'var(--color-bg-2)', padding: '8px' }}>
                                            <div className="mono text-2xs" style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}>PIVOT PATH</div>
                                            <div className="mono text-xs" style={{ color: 'var(--color-warning)' }}>{bet.pivot_path ? bet.pivot_path.toUpperCase() : '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── INPUT MATRIX ── */}
                <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
                    <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                        /// NEW STRATEGIC BET ALLOCATION
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>BET DESIGNATION</label>
                                <input className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="AUTOMATION V3" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>TYPE</label>
                                <select className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-primary)', padding: '9px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                    <option value="core">CORE</option>
                                    <option value="explore">EXPLORE</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>HYPOTHESIS</label>
                            <textarea className="mono" rows="2" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%', resize: 'vertical' }} value={form.hypothesis} onChange={e => setForm(f => ({ ...f, hypothesis: e.target.value }))} placeholder="THEORY OF IMPACT..." />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>SUCCESS KPI</label>
                                <input className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-success)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.kpi} onChange={e => setForm(f => ({ ...f, kpi: e.target.value }))} placeholder="3 DEALS Y1" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>KILL CRITERIA</label>
                                <input className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-danger)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.kill_criteria} onChange={e => setForm(f => ({ ...f, kill_criteria: e.target.value }))} placeholder="FAIL CONDITION" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>PIVOT PATH</label>
                                <input className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-warning)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.pivot_path} onChange={e => setForm(f => ({ ...f, pivot_path: e.target.value }))} placeholder="BACKUP PLAN" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>RESOURCES</label>
                                <input className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-info)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.resources} onChange={e => setForm(f => ({ ...f, resources: e.target.value }))} placeholder="30% COMPUTE" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button className="btn btn-ghost mono" style={{ fontSize: '10px', padding: '10px 24px', border: '1px solid var(--color-primary)', color: 'var(--color-bg)', background: 'var(--color-primary)' }} onClick={handleAdd} disabled={saving}>
                                {saving ? 'TRANSMITTING...' : 'REGISTER BET'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>

                <VaultAgentPanel title="PORTFOLIO INTELLIGENCE" namespaces={['data', 'product', 'research']} />

        </div>
    )
}

export default Portfolio
