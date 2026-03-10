// ===================================================
// ANTIGRAVITY OS — GTM Machine
// Migrated from legacy/js/gtm.js
// ===================================================

import { useState } from 'react'
import { useAppStore, uid } from '../../stores/useAppStore'

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
    { key: 'dm', label: 'DM LinkedIn' },
    { key: 'email', label: 'Cold Email' },
    { key: 'followup', label: 'Follow-up' },
    { key: 'objections', label: 'Objeciones' },
]

const SOURCES = ['LinkedIn', 'Referral', 'Web', 'Evento', 'Cold Research', 'Google Maps', 'Meta', 'TikTok']
const STATUS_BADGE = {
    raw: 'badge-neutral', qualified: 'badge-success', contacted: 'badge-info',
    responded: 'badge-accent', meeting: 'badge-warning'
}

function GTM() {
    const { data, updateData, toast } = useAppStore()
    const icp = data.icp || {}
    const leads = data.leads || []
    const [activeScript, setActiveScript] = useState('dm')
    const [showAddLead, setShowAddLead] = useState(false)
    const [isProspecting, setIsProspecting] = useState(false)
    const [form, setForm] = useState({ name: '', company: '', role: '', email: '', linkedin: '', buySignal: '', source: 'LinkedIn', confidence: 60 })

    const saveICP = (field, value) => {
        updateData(d => ({ ...d, icp: { ...d.icp, [field]: value } }))
    }

    const addLead = () => {
        if (!form.name.trim()) return toast('Nombre requerido', 'warning')
        updateData(d => ({
            ...d,
            leads: [...d.leads, { ...form, id: uid(), status: 'raw', timestamp: new Date().toISOString() }]
        }))
        setForm({ name: '', company: '', role: '', email: '', linkedin: '', buySignal: '', source: 'LinkedIn', confidence: 60 })
        setShowAddLead(false)
        toast('Lead añadido', 'success')
    }

    const removeLead = (id) => {
        updateData(d => ({ ...d, leads: d.leads.filter(l => l.id !== id) }))
    }

    const autoProspect = async () => {
        const target = form.company || form.name;
        if (!target) return toast('ENTER COMPANY OR NAME TO AUTO-PROSPECT', 'warning');

        setIsProspecting(true);
        toast('CORTEX INITIALIZED. SCANNING PUBLIC API NETWORK...', 'info');

        try {
            const url = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/agent-cortex';
            const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({
                    action: 'query_public_data',
                    query: `Find company information, description, or news for the company: "${target}" using a public Wikipedia or Knowledge Graph API.`
                })
            });

            const data = await res.json();

            const summary = data?.output?.summary || data?.summary || '';
            if (summary) {
                setForm(f => ({
                    ...f,
                    buySignal: (f.buySignal ? f.buySignal + ' | ' : '') + 'CORTEX: ' + summary.slice(0, 100).replace(/\n/g, ' ') + '...',
                    confidence: 85
                }));
                toast('LEAD ENRICHED VIA PUBLIC API CATALOG', 'success');
            } else {
                toast('NO PUBLIC SECURE DATA FOUND', 'warning');
            }
        } catch (e) {
            console.error(e);
            toast('PROSPECTING SECURE CONNECTION FAILED', 'error');
        } finally {
            setIsProspecting(false);
        }
    }

    const moveToPipeline = (id) => {
        const lead = leads.find(l => l.id === id)
        if (!lead) return
        updateData(d => ({
            ...d,
            leads: d.leads.map(l => l.id === id ? { ...l, status: 'contacted' } : l),
            pipeline: { ...d.pipeline, lead: [...(d.pipeline?.lead || []), { ...lead, pipelineDate: new Date().toISOString() }] }
        }))
        toast(`${lead.name} movido al pipeline`, 'success')
    }

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto', paddingBottom: '32px' }}>
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
                <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0, textTransform: 'uppercase' }}>GTM Machine</h1>
                <p className="mono text-xs text-tertiary" style={{ marginTop: '8px', letterSpacing: '0.05em' }}>/// GO-TO-MARKET ORCHESTRATION // ICP DEFINITION & QUALIFIED OUTREACH</p>
            </div>

            {/* ICP */}
            <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-default)', padding: '24px' }}>
                <div className="mono text-xs font-bold text-primary" style={{ marginBottom: '20px', letterSpacing: '0.1em' }}>/// IDEAL CUSTOMER PROFILE (ICP)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                    {[
                        { key: 'companySize', label: 'Tamaño empresa' },
                        { key: 'decisionMaker', label: 'Decision Maker' },
                        { key: 'painPoints', label: 'Pain Points' },
                        { key: 'techStack', label: 'Tech Stack' },
                        { key: 'budget', label: 'Presupuesto' },
                        { key: 'buySignals', label: 'Señales de compra' },
                    ].map(f => (
                        <div key={f.key} className="input-group">
                            <label>{f.label}</label>
                            <input className="input" value={icp[f.key] || ''} onChange={e => saveICP(f.key, e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Leads */}
            <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="mono text-xs font-bold text-primary" style={{ letterSpacing: '0.1em' }}>/// HYPER-QUALIFIED LEADS ({leads.length})</div>
                    <button className="btn btn-primary mono" style={{ borderRadius: 0, fontSize: '10px', padding: '6px 12px', letterSpacing: '0.1em' }} onClick={() => setShowAddLead(!showAddLead)}>
                        {showAddLead ? 'CANCEL' : 'ADD MANUAL LEAD'}
                    </button>
                </div>

                {showAddLead && (
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                            <div className="input-group"><label>Nombre</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="input-group"><label>Empresa</label><input className="input" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                            <div className="input-group"><label>Rol</label><input className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
                            <div className="input-group"><label>Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                            <div className="input-group"><label>LinkedIn</label><input className="input" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} /></div>
                            <div className="input-group"><label>Señal de compra</label><input className="input" value={form.buySignal} onChange={e => setForm({ ...form, buySignal: e.target.value })} placeholder="Ej: Acaba de cerrar ronda serie A" /></div>
                            <div className="input-group"><label>Fuente</label>
                                <select className="input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="input-group"><label>Confianza (0-100)</label><input className="input" type="number" value={form.confidence} onChange={e => setForm({ ...form, confidence: parseInt(e.target.value) || 0 })} min="0" max="100" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button className="btn btn-primary mono" style={{ borderRadius: 0, padding: '12px 24px', letterSpacing: '0.1em' }} onClick={addLead}>SAVE LEAD</button>
                            <button
                                className="btn mono"
                                style={{ borderRadius: 0, padding: '12px 24px', letterSpacing: '0.1em', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}
                                onClick={autoProspect}
                                disabled={isProspecting}
                            >
                                {isProspecting ? 'SCANNING...' : 'AUTO-ENRICH [CORTEX]'}
                            </button>
                        </div>
                    </div>
                )}

                {leads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-tertiary)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '16px', opacity: 0.5 }}>🎯</div>
                        <div className="mono text-sm text-secondary" style={{ marginBottom: '8px' }}>NO LEADS IN TARGET LIST</div>
                        <div className="mono text-xs opacity-70">AWAITING INITIAL TARGET INGESTION OR MANUAL ENTRY</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                            <thead>
                                <tr className="mono" style={{ borderBottom: '1px solid var(--border-default)', background: 'rgba(0,0,0,0.2)' }}>
                                    <th style={{ padding: '12px 24px', color: 'var(--color-primary)' }}>NAME</th>
                                    <th style={{ padding: '12px 24px', color: 'var(--color-primary)' }}>COMPANY</th>
                                    <th style={{ padding: '12px 24px', color: 'var(--color-primary)' }}>ROLE</th>
                                    <th style={{ padding: '12px 24px', color: 'var(--color-primary)' }}>BUY_SIGNAL</th>
                                    <th style={{ padding: '12px 24px', color: 'var(--color-primary)' }}>STATUS</th>
                                    <th style={{ padding: '12px 24px', color: 'var(--color-primary)' }}>SCORE</th>
                                    <th style={{ padding: '12px 24px' }}></th>
                                </tr>
                            </thead>
                            <tbody className="mono">
                                {leads.map(l => (
                                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '12px 24px', fontWeight: 600, color: 'var(--color-text)' }}>{l.name}</td>
                                        <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{l.company || '-'}</td>
                                        <td style={{ padding: '12px 24px', color: 'var(--text-tertiary)' }}>{l.role || '-'}</td>
                                        <td style={{ padding: '12px 24px', fontSize: '10px', color: 'var(--text-tertiary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.buySignal || '-'}</td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <span className={`badge ${STATUS_BADGE[l.status] || 'badge-neutral'}`} style={{ borderRadius: 0, padding: '4px 8px', fontSize: '9px', letterSpacing: '0.05em' }}>
                                                {l.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ width: 28, height: 28, border: `1px solid var(--accent-primary)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--accent-primary)' }}>
                                                {l.confidence || 50}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost" style={{ fontSize: '10px', padding: '4px 8px', borderRadius: 0 }} onClick={() => moveToPipeline(l.id)}>→ PIPE</button>
                                            <button className="btn btn-ghost text-danger" style={{ fontSize: '10px', padding: '4px 8px', borderRadius: 0 }} onClick={() => removeLead(l.id)}>DEL</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Outreach Scripts */}
            <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-default)', padding: '24px' }}>
                <div className="mono text-xs font-bold text-primary" style={{ marginBottom: '20px', letterSpacing: '0.1em' }}>/// OUTREACH FRAMEWORKS</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    {SCRIPT_TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`btn ${activeScript === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            onClick={() => setActiveScript(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="mono" style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)',
                    padding: '24px', fontSize: '12px', lineHeight: 1.8,
                    whiteSpace: 'pre-wrap', color: 'var(--text-secondary)'
                }}>
                    {SCRIPTS[activeScript]}
                </div>
            </div>
        </div>
    )
}

export default GTM
