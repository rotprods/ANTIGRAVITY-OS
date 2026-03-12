// ═══════════════════════════════════════════════════
// OCULOPS — Experiments Lab
// Premium Ivory/Gold Design System
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useExperiments } from '../../hooks/useExperiments'
import VaultAgentPanel from '../ui/VaultAgentPanel'
import ModuleSkeleton from '../ui/ModuleSkeleton'
import { supabase } from '../../lib/supabase'

const emptyForm = { name: '', hypothesis: '', metric: '', baseline: '', target_value: '', duration_days: 14 }

// ── EVOLVER section ────────────────────────────────────────────────────────
function EvolverSection() {
    const [exps, setExps]       = useState([])
    const [loading, setLoading] = useState(true)
    const [applying, setApplying] = useState(null)

    const fetchExperiments = useCallback(async () => {
        const { data } = await supabase
            .from('agent_experiments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
        setExps(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchExperiments()
        // Realtime subscription
        const sub = supabase.channel('evolver_experiments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_experiments' }, fetchExperiments)
            .subscribe()
        return () => supabase.removeChannel(sub)
    }, [fetchExperiments])

    const applyMutation = async (exp) => {
        setApplying(exp.id)
        await supabase
            .from('agent_definitions')
            .update({ system_prompt: exp.system_prompt_after, last_evaluated_at: new Date().toISOString(), baseline_score: exp.score_after })
            .eq('agent_id', exp.agent_id)
        await supabase
            .from('agent_experiments')
            .update({ status: 'kept' })
            .eq('id', exp.id)
        await fetchExperiments()
        setApplying(null)
    }

    const rollback = async (agentId) => {
        await supabase.rpc('rollback_agent_prompt', { p_agent_id: agentId, p_steps: 1 })
        await fetchExperiments()
    }

    if (loading) return <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>Loading evolver data...</div>

    const kept   = exps.filter(e => e.status === 'kept')
    const shadow = exps.filter(e => e.status === 'shadow')

    const avgDelta = exps.length
        ? (exps.reduce((s, e) => s + (e.delta || 0), 0) / exps.length * 100).toFixed(1)
        : '0.0'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* KPI strip */}
            <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                <div className="kpi-strip-cell">
                    <div className="kpi-strip-cell-header">
                        <span className="mono text-xs text-tertiary">TOTAL RUNS</span>
                    </div>
                    <span className="mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>{exps.length}</span>
                </div>
                <div className="kpi-strip-cell">
                    <div className="kpi-strip-cell-header">
                        <span className="mono text-xs text-tertiary">KEPT</span>
                    </div>
                    <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{kept.length}</span>
                </div>
                <div className="kpi-strip-cell">
                    <div className="kpi-strip-cell-header">
                        <span className="mono text-xs text-tertiary">PENDING REVIEW</span>
                    </div>
                    <span className="mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{shadow.length}</span>
                </div>
                <div className="kpi-strip-cell">
                    <div className="kpi-strip-cell-header">
                        <span className="mono text-xs text-tertiary">AVG DELTA</span>
                    </div>
                    <span className="mono text-lg font-bold" style={{ color: parseFloat(avgDelta) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {parseFloat(avgDelta) >= 0 ? '+' : ''}{avgDelta}%
                    </span>
                </div>
            </div>

            {/* Shadow — pending review */}
            {shadow.length > 0 && (
                <div className="section-box" style={{ borderLeft: '2px solid var(--color-primary)' }}>
                    <div className="section-header" style={{ color: 'var(--color-primary)' }}>Pending Review -- Shadow Experiments [{shadow.length}]</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {shadow.map((exp, idx) => (
                            <EvolverRow
                                key={exp.id} exp={exp} idx={idx} total={shadow.length}
                                onApply={() => applyMutation(exp)}
                                applying={applying === exp.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Full history table */}
            <div className="section-box">
                <div className="section-header">Experiment History [{exps.length}]</div>
                {exps.length === 0 ? (
                    <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>
                        No experiments yet -- Evolver runs nightly at 02:00 UTC
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>AGENT</th>
                                <th>STATUS</th>
                                <th>BEFORE</th>
                                <th>AFTER</th>
                                <th>DELTA</th>
                                <th>MUTATION</th>
                                <th>DATE</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {exps.map((exp, idx) => {
                                const delta = exp.delta || 0
                                const statusColor = {
                                    kept:      'var(--color-success)',
                                    shadow:    'var(--color-primary)',
                                    discarded: 'var(--color-text-3)',
                                    crashed:   'var(--color-danger)',
                                }[exp.status] || 'var(--color-text-3)'

                                return (
                                    <tr key={exp.id} style={{ borderBottom: idx < exps.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                        <td style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{exp.agent_id?.toUpperCase()}</td>
                                        <td>
                                            <span className="mono" style={{ fontSize: '9px', padding: '2px 6px', border: `1px solid ${statusColor}`, color: statusColor }}>
                                                {exp.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="mono text-xs" style={{ color: 'var(--color-text-2)' }}>
                                            {exp.score_before != null ? (exp.score_before * 100).toFixed(1) + '%' : '—'}
                                        </td>
                                        <td className="mono text-xs" style={{ color: 'var(--color-text-2)' }}>
                                            {exp.score_after != null ? (exp.score_after * 100).toFixed(1) + '%' : '—'}
                                        </td>
                                        <td className="mono text-xs font-bold" style={{ color: delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                        </td>
                                        <td className="mono text-xs text-tertiary" style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {exp.mutation_description || '—'}
                                        </td>
                                        <td className="mono text-xs text-tertiary">
                                            {exp.created_at ? new Date(exp.created_at).toLocaleDateString('es-ES') : '—'}
                                        </td>
                                        <td>
                                            {exp.status === 'kept' && (
                                                <button className="btn btn-ghost mono" style={{ fontSize: '8px', padding: '2px 6px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                                                    onClick={() => rollback(exp.agent_id)}>
                                                    ROLLBACK
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

function EvolverRow({ exp, idx, total, onApply, applying }) {
    const [expanded, setExpanded] = useState(false)
    const delta = exp.delta || 0

    return (
        <div style={{ borderBottom: idx < total - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '16px', cursor: 'pointer' }}
                onClick={() => setExpanded(e => !e)}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <span className="mono font-bold" style={{ color: 'var(--color-text)', fontSize: '13px' }}>
                            {exp.agent_id?.toUpperCase()}
                        </span>
                        <span className="mono font-bold" style={{ color: 'var(--color-primary)', fontSize: '13px' }}>
                            {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                        </span>
                        <span className="mono text-xs text-tertiary">
                            {exp.score_before != null ? (exp.score_before * 100).toFixed(1) : '?'}% → {exp.score_after != null ? (exp.score_after * 100).toFixed(1) : '?'}%
                        </span>
                    </div>
                    <div className="mono text-xs" style={{ color: 'var(--color-text-2)' }}>{exp.mutation_description}</div>
                    {exp.judge_reasoning && (
                        <div className="mono" style={{ fontSize: '10px', color: 'var(--color-text-3)', marginTop: '4px' }}>
                            JUDGE: {exp.judge_reasoning.slice(0, 120)}{exp.judge_reasoning.length > 120 ? '...' : ''}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button className="btn btn-primary mono" style={{ fontSize: '9px', padding: '6px 12px', borderRadius: 0 }}
                        onClick={e => { e.stopPropagation(); onApply() }} disabled={applying}>
                        {applying ? 'APPLYING...' : 'APPLY'}
                    </button>
                    <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '6px 12px' }}
                        onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
                        {expanded ? 'HIDE' : 'DIFF'}
                    </button>
                </div>
            </div>
            {expanded && (
                <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <div className="mono text-xs text-tertiary" style={{ marginBottom: '6px' }}>BEFORE</div>
                        <pre style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '10px', fontSize: '10px', color: 'var(--color-text-3)', overflowX: 'auto', maxHeight: '200px', overflowY: 'auto', margin: 0 }}>
                            {exp.system_prompt_before}
                        </pre>
                    </div>
                    <div>
                        <div className="mono text-xs" style={{ color: 'var(--color-primary)', marginBottom: '6px' }}>AFTER</div>
                        <pre style={{ background: 'var(--color-bg)', border: '1px solid var(--color-primary)', padding: '10px', fontSize: '10px', color: 'var(--color-text-2)', overflowX: 'auto', maxHeight: '200px', overflowY: 'auto', margin: 0 }}>
                            {exp.system_prompt_after}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────
function Experiments() {
    const { loading, addExperiment, updateExperiment, removeExperiment, active, concluded } = useExperiments()
    const [form, setForm]   = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [tab, setTab]     = useState('evolver')  // 'evolver' | 'manual'

    const handleAdd = async () => {
        if (!form.name.trim() || !form.hypothesis.trim()) return
        setSaving(true)
        await addExperiment({ ...form, status: 'active', start_date: new Date().toISOString().split('T')[0], duration_days: parseInt(form.duration_days) })
        setForm(emptyForm)
        setSaving(false)
    }

    const conclude = async (exp, result) => {
        await updateExperiment(exp.id, { status: 'concluded', result, end_date: new Date().toISOString().split('T')[0] })
    }

    if (loading) return <ModuleSkeleton variant="kpi" rows={3} />

    return (
        <div className="fade-in module-wrap">
            {/* ── HEADER ── */}
            <div className="module-header-bar">
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--accent-primary)', margin: 0 }}>R&D Lab</h1>
                    <span className="mono text-xs text-tertiary">Growth experiments & agent self-improvement</span>
                </div>
                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: '0', border: '1px solid var(--color-border)' }}>
                    {[['evolver', 'EVOLVER'], ['manual', 'MANUAL']].map(([key, label]) => (
                        <button key={key} className="mono" onClick={() => setTab(key)} style={{
                            padding: '6px 16px', fontSize: '10px', border: 'none', cursor: 'pointer',
                            background: tab === key ? 'var(--accent-primary)' : 'transparent',
                            color: tab === key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                            fontWeight: tab === key ? 'bold' : 'normal',
                        }}>{label}</button>
                    ))}
                </div>
            </div>

            <div className="module-scroll">

                {tab === 'evolver' && <EvolverSection />}

                {tab === 'manual' && (
                    <>
                        {/* ── KPI STRIP ── */}
                        <div className="kpi-strip kpi-strip-3">
                            <div className="kpi-strip-cell">
                                <div className="kpi-strip-cell-header">
                                    <span className="mono text-xs text-tertiary">ACTIVE EXPERIMENTS</span>
                                </div>
                                <span className="mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>{active.length}</span>
                            </div>
                            <div className="kpi-strip-cell">
                                <div className="kpi-strip-cell-header">
                                    <span className="mono text-xs text-tertiary">PROVEN HYPOTHESES</span>
                                </div>
                                <span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{concluded.filter(e => e.result === 'success').length}</span>
                            </div>
                            <div className="kpi-strip-cell">
                                <div className="kpi-strip-cell-header">
                                    <span className="mono text-xs text-tertiary">REJECTED HYPOTHESES</span>
                                </div>
                                <span className="mono text-lg font-bold" style={{ color: 'var(--color-danger)' }}>{concluded.filter(e => e.result === 'failed').length}</span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* ACTIVE */}
                                <div className="section-box">
                                    <div className="section-header">Live Data Streams [{active.length}]</div>
                                    {active.length === 0 ? (
                                        <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>No experiments in progress.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {active.map((exp, idx) => (
                                                <div key={exp.id} style={{ padding: '16px', borderBottom: idx < active.length - 1 ? '1px solid var(--color-border)' : 'none', borderLeft: '2px solid var(--color-info)' }}>
                                                    <div className="kpi-strip-cell-header">
                                                        <div>
                                                            <div className="mono font-bold" style={{ color: 'var(--color-text)', fontSize: '14px' }}>{exp.name.toUpperCase()}</div>
                                                            <div className="mono text-xs" style={{ color: 'var(--color-info)', marginTop: '4px' }}>HYP: {exp.hypothesis.toUpperCase()}</div>
                                                            <div className="mono" style={{ fontSize: '10px', color: 'var(--color-text-3)', marginTop: '8px' }}>
                                                                METRIC: <span style={{ color: 'var(--color-text)' }}>{(exp.metric || 'N/A').toUpperCase()}</span>
                                                                <span style={{ margin: '0 8px' }}>|</span>
                                                                TARGET: <span style={{ color: 'var(--color-success)' }}>{(exp.target_value || 'N/A').toUpperCase()}</span>
                                                                <span style={{ margin: '0 8px' }}>|</span>
                                                                BASELINE: <span style={{ color: 'var(--color-warning)' }}>{(exp.baseline || 'N/A').toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', borderColor: 'var(--color-success)', color: 'var(--color-success)' }} onClick={() => conclude(exp, 'success')}>SUCCESS</button>
                                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => conclude(exp, 'failed')}>FAILED</button>
                                                            <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => removeExperiment(exp.id)}>DEL</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* CONCLUDED */}
                                {concluded.length > 0 && (
                                    <div className="section-box">
                                        <div className="section-header">Archived Results [{concluded.length}]</div>
                                        <table className="data-table">
                                            <thead>
                                                <tr><th>EXPERIMENT</th><th>VERDICT</th><th>START</th><th>END</th></tr>
                                            </thead>
                                            <tbody>
                                                {concluded.map((exp, idx) => (
                                                    <tr key={exp.id} style={{ borderBottom: idx < concluded.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                                        <td style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{exp.name.toUpperCase()}</td>
                                                        <td>
                                                            <span style={{ fontSize: '9px', padding: '2px 6px', border: `1px solid var(--color-${exp.result === 'success' ? 'success' : 'danger'})`, color: `var(--color-${exp.result === 'success' ? 'success' : 'danger'})` }}>
                                                                {exp.result === 'success' ? 'PROVEN' : 'REJECTED'}
                                                            </span>
                                                        </td>
                                                        <td style={{ color: 'var(--color-text-3)' }}>{exp.start_date || '—'}</td>
                                                        <td style={{ color: 'var(--color-text-3)' }}>{exp.end_date || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* ADD FORM */}
                            <div className="section-box--gold" style={{ height: 'fit-content' }}>
                                <div className="section-header--gold mono text-xs font-bold" style={{ padding: '12px 16px' }}>New Experiment</div>
                                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="input-group">
                                        <label className="mono text-xs">Experiment Name</label>
                                        <input className="input-terminal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="EX: A/B EMAIL TEST" />
                                    </div>
                                    <div className="input-group">
                                        <label className="mono text-xs">Duration (days)</label>
                                        <input className="input-terminal" type="number" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} />
                                    </div>
                                    <div className="input-group">
                                        <label className="mono text-xs">Hypothesis</label>
                                        <textarea className="input-terminal" rows="3" style={{ resize: 'vertical' }} value={form.hypothesis} onChange={e => setForm(f => ({ ...f, hypothesis: e.target.value }))} placeholder="State hypothesis..." />
                                    </div>
                                    <div className="input-group">
                                        <label className="mono text-xs">Metric</label>
                                        <input className="input-terminal" value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))} placeholder="Ex: Reply rate %" />
                                    </div>
                                    <div className="input-group">
                                        <label className="mono text-xs">Baseline</label>
                                        <input className="input-terminal" value={form.baseline} onChange={e => setForm(f => ({ ...f, baseline: e.target.value }))} placeholder="Ex: 1.2%" />
                                    </div>
                                    <div className="input-group">
                                        <label className="mono text-xs">Target</label>
                                        <input className="input-terminal" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} placeholder="Ex: 3.0%" />
                                    </div>
                                    <button className="btn btn-primary mono" style={{ marginTop: '16px', borderRadius: 0, padding: '12px' }} onClick={handleAdd} disabled={saving}>
                                        {saving ? 'Saving...' : 'Launch Experiment'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <VaultAgentPanel title="Experiment Intelligence" namespaces={['data', 'research']} maxAgents={12} capSlice={2} />
                    </>
                )}
            </div>
        </div>
    )
}

export default Experiments
