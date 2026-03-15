// ===================================================
// OCULOPS — GTM Orchestration
// Premium Ivory/Gold theme
// ===================================================

import { useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useLeads } from '../../hooks/useLeads'
import { dispatchGovernedTool } from '../../lib/controlPlane'

const SCRIPTS = {
    dm: `Hola [Nombre],

Vi que [empresa] está [señal de compra: creciendo / contratando / lanzando nuevo producto].

En [mi agencia] ayudamos a empresas como la tuya a [beneficio principal] usando IA y automatización.

Ejemplo: ayudamos a [referencia similar] a [resultado concreto] en [tiempo].

¿Te interesaría una llamada de 15 min para explorar si tiene sentido?

Un saludo,
[Tu nombre]`,

    email: `Asunto: [Nombre], ¿automatizáis [proceso]?

Hola [Nombre],

Soy [tu nombre] de [agencia]. Ayudamos a [tipo de empresa] a [beneficio] con IA.

Vi que [empresa] está [señal]. Normalmente, las empresas en esta fase pierden [X horas/€] en [proceso manual].

Hemos ayudado a [referencia] a resolver esto en [tiempo] con [solución breve].

¿Tiene sentido agendar 15 min esta semana?

PD: Si no eres la persona correcta, ¿podrías redirigirme?

[Firma]`,

    followup: `Follow-up 1 (3 días después):
"Hola [Nombre], quería asegurarme de que viste mi mensaje. ¿Tiene sentido explorar [beneficio]?"

Follow-up 2 (7 días después):
"[Nombre], ¿cuál es vuestra prioridad ahora con [área]? Quizá podamos ayudar."

Follow-up 3 (14 días después - valor):
"Hola [Nombre], acabo de publicar [recurso/caso de estudio] sobre [tema relevante]. Te lo comparto por si es útil: [link]"

Follow-up 4 (30 días después - break-up):
"[Nombre], entiendo que quizá no es el momento. Si en el futuro necesitáis ayuda con [área], aquí estoy. ¡Éxitos!"`,

    objections: `🔴 "Es muy caro"
→ "Entiendo. ¿Cuánto os cuesta actualmente no tener [solución]? Nuestros clientes recuperan la inversión en [X] meses."

🔴 "Ya tenemos alguien interno"
→ "Genial. ¿Están usando IA específicamente para [caso de uso]? Normalmente complementamos al equipo, no lo sustituimos."

🔴 "No es buen momento"
→ "Lo entiendo. ¿Cuándo sería mejor? Mientras tanto, ¿te envío [recurso] que puede serte útil?"

🔴 "No conozco tu empresa"
→ "Normal, somos una boutique especializada. Aquí tienes [caso de estudio] con [empresa similar]. ¿Lo revisamos juntos?"

🔴 "Necesito consultarlo"
→ "Por supuesto. ¿Quién más participa en la decisión? Puedo preparar un documento específico para ellos."`
}

const SCRIPT_TABS = [
    { key: 'dm', label: 'DM LINKEDIN' },
    { key: 'email', label: 'COLD EMAIL' },
    { key: 'followup', label: 'FOLLOW-UP SEQ' },
    { key: 'objections', label: 'OBJECTIONS' },
]

const SOURCES = ['LINKEDIN', 'REFERRAL', 'WEB', 'EVENT', 'COLD OP', 'MAPS', 'META', 'TIKTOK']

function GTM() {
    const { data, updateData, toast } = useAppStore()
    const icp = data.icp || {}
    const { leads, addLead: addDbLead, removeLead: removeDbLead, updateLead: updateDbLead } = useLeads()
    const [activeScript, setActiveScript] = useState('dm')
    const [showAddLead, setShowAddLead] = useState(false)
    const [isProspecting, setIsProspecting] = useState(false)
    const [form, setForm] = useState({ name: '', company: '', role: '', email: '', linkedin: '', buySignal: '', source: 'LINKEDIN', confidence: 60 })

    const saveICP = (field, value) => {
        updateData(d => ({ ...d, icp: { ...d.icp, [field]: value } }))
    }

    const addLead = async () => {
        if (!form.name.trim()) return toast('ERR_NO_NAME', 'warning')
        const created = await addDbLead({
            ...form,
            status: 'raw',
            timestamp: new Date().toISOString(),
        })
        if (!created) return toast('DB_WRITE_FAIL', 'error')
        setForm({ name: '', company: '', role: '', email: '', linkedin: '', buySignal: '', source: 'LINKEDIN', confidence: 60 })
        setShowAddLead(false)
        toast('TARGET COMMITTED', 'success')
    }

    const removeLead = async (id) => {
        const success = await removeDbLead(id)
        if (!success) return toast('DELETE_FAIL', 'error')
    }

    const autoProspect = async () => {
        const target = form.company || form.name;
        if (!target) return toast('AWAITING TARGET ID', 'warning');

        setIsProspecting(true);
        toast('CORTEX SCAN INITIATED...', 'info');

        try {
            const data = await dispatchGovernedTool({
                sourceAgent: 'cortex',
                source: 'gtm_ui',
                targetRef: 'agent-cortex',
                riskClass: 'medium',
                toolCodeName: 'agent-cortex',
                payload: {
                    action: 'query_public_data',
                    query: `Find company information, description, or news for the company: "${target}" using a public Wikipedia or Knowledge Graph API.`
                },
                context: {
                    target,
                    enrichment_type: 'company_public_data',
                },
            });

            const summary = data?.result?.summary || data?.output?.summary || data?.summary || '';
            if (summary) {
                setForm(f => ({
                    ...f,
                    buySignal: (f.buySignal ? f.buySignal + ' | ' : '') + 'CORTEX: ' + summary.slice(0, 100).replace(/\n/g, ' ') + '...',
                    confidence: 85
                }));
                toast('TARGET ENRICHED', 'success');
            } else {
                toast('NULL RESPONSE', 'warning');
            }
        } catch (e) {
            if (import.meta.env.DEV) console.error(e);
            toast('ENRICH_FAIL', 'error');
        } finally {
            setIsProspecting(false);
        }
    }

    const moveToPipeline = async (id) => {
        const lead = leads.find(l => l.id === id)
        if (!lead) return
        await updateDbLead(id, { status: 'contacted' })
        updateData(d => ({
            ...d,
            pipeline: { ...d.pipeline, lead: [...(d.pipeline?.lead || []), { ...lead, pipelineDate: new Date().toISOString() }] }
        }))
        toast(`[${lead.name.toUpperCase()}] > PIPELINE`, 'success')
    }

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-default)', marginBottom: '16px' }}>
                <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--text-primary)', margin: 0, fontSize: '28px' }}>GTM Orchestration</h1>
                <p className="mono text-xs text-tertiary" style={{ marginTop: '8px' }}>Customer profile, outreach scripts, and target pipeline.</p>
            </div>

            {/* ICP */}
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)', padding: '24px' }}>
                <div className="mono text-xs font-bold text-primary" style={{ marginBottom: '20px' }}>Ideal Customer Profile</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {[
                        { key: 'companySize', label: 'Company Size' },
                        { key: 'decisionMaker', label: 'Decision Maker' },
                        { key: 'painPoints', label: 'Pain Points' },
                        { key: 'techStack', label: 'Tech Stack' },
                        { key: 'budget', label: 'Budget' },
                        { key: 'buySignals', label: 'Buy Signals' },
                    ].map(f => (
                        <div key={f.key} className="input-group">
                            <label className="mono text-2xs text-tertiary">{f.label}</label>
                            <input className="input mono text-xs" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 0 }} value={icp[f.key] || ''} onChange={e => saveICP(f.key, e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Scripting */}
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)', padding: '24px' }}>
                <div className="mono text-xs font-bold text-primary" style={{ marginBottom: '20px' }}>Outreach Frameworks</div>
                <div style={{ display: 'flex', gap: '1px', marginBottom: '16px', border: '1px solid var(--border-subtle)', background: 'var(--border-subtle)' }}>
                    {SCRIPT_TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`btn mono text-xs ${activeScript === tab.key ? 'btn-primary' : ''}`}
                            style={{
                                flex: 1,
                                borderRadius: 0,
                                padding: '12px',
                                background: activeScript === tab.key ? 'var(--accent-primary)' : 'var(--surface-elevated)',
                                border: 'none',
                                color: activeScript === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                            onClick={() => setActiveScript(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="mono" style={{
                    background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
                    padding: '24px', fontSize: '11px', lineHeight: 2,
                    whiteSpace: 'pre-wrap', color: 'var(--text-secondary)'
                }}>
                    {SCRIPTS[activeScript]}
                </div>
            </div>

            {/* Leads */}
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-elevated)' }}>
                    <div className="mono text-xs font-bold text-primary">Target Queue ({leads.length})</div>
                    <button className="btn btn-primary mono" style={{ borderRadius: 0, fontSize: '10px', padding: '6px 12px' }} onClick={() => setShowAddLead(!showAddLead)}>
                        {showAddLead ? 'Cancel' : 'Add Target'}
                    </button>
                </div>

                {showAddLead && (
                    <div style={{ background: 'var(--surface-raised)', padding: '24px', borderBottom: '1px solid var(--border-default)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Name</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Company</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Role</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Email</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">LinkedIn</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} /></div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Buy Signal</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} value={form.buySignal} onChange={e => setForm({ ...form, buySignal: e.target.value })} /></div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Source</label>
                                <select className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="input-group"><label className="mono text-2xs text-tertiary">Confidence (0-100)</label><input className="input mono" style={{ borderRadius: 0, background: 'var(--surface-raised)' }} type="number" value={form.confidence} onChange={e => setForm({ ...form, confidence: parseInt(e.target.value) || 0 })} min="0" max="100" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button className="btn btn-primary mono text-xs" style={{ borderRadius: 0, padding: '12px 24px' }} onClick={addLead}>Save to Database</button>
                            <button
                                className="btn btn-ghost mono text-xs"
                                style={{ borderRadius: 0, padding: '12px 24px', border: '1px solid var(--accent-primary)', color: 'var(--text-accent)' }}
                                onClick={autoProspect}
                                disabled={isProspecting}
                            >
                                {isProspecting ? 'Enriching...' : 'Run AI Enrichment'}
                            </button>
                        </div>
                    </div>
                )}

                {leads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-tertiary)' }}>
                        <div className="mono font-bold" style={{ fontSize: '24px', marginBottom: '16px', color: 'var(--text-secondary)' }}>No targets yet</div>
                        <div className="mono text-sm text-secondary" style={{ marginBottom: '8px' }}>Add your first target to start building the pipeline.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', background: 'var(--surface-raised)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr className="mono text-2xs" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)' }}>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Name</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Company</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>Role</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>Signal</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Status</th>
                                    <th style={{ padding: '12px 16px' }}>Confidence</th>
                                    <th style={{ padding: '12px 16px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody className="mono text-xs">
                                {leads.map(l => (
                                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{l.name.toUpperCase()}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{l.company ? l.company.toUpperCase() : '[ UNKNOWN ]'}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)' }}>{l.role ? l.role.toUpperCase() : '[ NULL ]'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: '9px', color: 'var(--accent-primary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.buySignal ? l.buySignal.toUpperCase() : '[ OK ]'}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', padding: '2px 6px', fontSize: '9px' }}>
                                                {l.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ color: l.confidence > 70 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                                {l.confidence || 50}%
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 8px', borderRadius: 0, border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={() => moveToPipeline(l.id)}>[ ADV ]</button>
                                            <button className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 8px', borderRadius: 0, border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => removeLead(l.id)}>[ DEL ]</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default GTM
