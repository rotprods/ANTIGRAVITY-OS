// ═══════════════════════════════════════════════════
// OCULOPS — Niches Analysis
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useNiches } from '../../hooks/useNiches'
import { Charts } from '../../lib/charts'
import VaultAgentPanel from '../ui/VaultAgentPanel'
import ModuleSkeleton from '../ui/ModuleSkeleton'

const emptyForm = { name: '', impact: 70, velocity: 70, scalability: 70, confidence: 70, risk: 30, resource_cost: 40 }

function Niches() {
    const { loading, addNiche, removeNiche, scored } = useNiches()
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    const handleAdd = async () => {
        if (!form.name.trim()) return
        setSaving(true)
        await addNiche({
            ...form,
            status: 'active',
            impact: parseInt(form.impact),
            velocity: parseInt(form.velocity),
            scalability: parseInt(form.scalability),
            confidence: parseInt(form.confidence),
            risk: parseInt(form.risk),
            resource_cost: parseInt(form.resource_cost)
        })
        setForm(emptyForm)
        setSaving(false)
    }

    if (loading) return <ModuleSkeleton variant="table" rows={5} />

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>NICHE ANALYSIS MODULE</h1>
                    <span className="mono text-xs text-tertiary">CEO SCORE ALGORITHM V2.0 ACTIVE</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>

                {/* ── RANKING MATRIX ── */}
                <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
                    <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                        /// CEO SCORE RANKING [{scored.length} ENTITIES]
                    </div>
                    {scored.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                            AWAITING NICHE DATA INPUT
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'var(--font-mono)', textAlign: 'left' }}>
                            <thead style={{ background: '#000', borderBottom: '1px solid var(--border-subtle)' }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-primary)' }}>#</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>NICHE IDENTIFIER</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>SCORE</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>IMP</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>VEL</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>SCL</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>CNF</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>RSK</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--color-text-2)' }}>CST</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--color-danger)' }}>CMD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scored.map((n, i) => (
                                    <tr key={n.id} style={{ borderBottom: i < scored.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: i % 2 === 0 ? 'transparent' : '#000' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: i === 0 ? 'var(--color-primary)' : 'var(--text-tertiary)' }}>
                                            {String(i + 1).padStart(2, '0')}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                                            {n.name.toUpperCase()}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '12px', color: n.ceoScore > 60 ? 'var(--color-success)' : n.ceoScore > 30 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                {n.ceoScore.toFixed(1)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>{n.impact}</td>
                                        <td style={{ padding: '12px 16px' }}>{n.velocity}</td>
                                        <td style={{ padding: '12px 16px' }}>{n.scalability}</td>
                                        <td style={{ padding: '12px 16px' }}>{n.confidence}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--color-danger)' }}>{n.risk}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--color-warning)' }}>{n.resource_cost}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => removeNiche(n.id)}>DEL</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── INPUT MATRIX ── */}
                <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
                    <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                        /// LOG NEW NICHE PARAMETERS
                    </div>
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>NICHE IDENTIFIER</label>
                                <input className="mono" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-text)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="E.G: HIGH-TICKET INFO-PRODUCTS" />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                            {['impact', 'velocity', 'scalability', 'confidence', 'risk', 'resource_cost'].map((field) => (
                                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label className="mono text-2xs" style={{ color: 'var(--text-tertiary)' }}>
                                        {field.replace('_', ' ').toUpperCase()} [0-100]
                                    </label>
                                    <input className="mono" type="number" min="0" max="100" style={{ background: '#000', border: '1px solid var(--border-subtle)', color: 'var(--color-primary)', padding: '10px 12px', fontSize: '11px', outline: 'none', width: '100%' }} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button className="btn btn-ghost mono" style={{ fontSize: '10px', padding: '10px 24px', border: '1px solid var(--color-primary)', color: 'var(--color-bg)', background: 'var(--color-primary)' }} onClick={handleAdd} disabled={saving}>
                                {saving ? 'CALCULATING...' : 'INJECT ENTRY'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>

                <VaultAgentPanel title="NICHE INTELLIGENCE" namespaces={['research', 'product']} />
        </div>
    )
}

export default Niches
