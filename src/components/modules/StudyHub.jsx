// ═══════════════════════════════════════════════════
// OCULOPS — Study Hub
// 100-Year UX: rigorous documentation reader
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { studies, STUDY_CATEGORIES } from '../../data/studies'
import { supabase, getCurrentUserId } from '../../lib/supabase'
import './StudyHub.css'

function useAgentStudies() {
    const [agentStudies, setAgentStudies] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        if (!supabase) { setLoading(false); return }
        const userId = await getCurrentUserId()
        let query = supabase
            .from('agent_studies')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
        if (userId) query = query.eq('user_id', userId)
        const { data } = await query
        setAgentStudies(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    return { agentStudies, loading, reload: load }
}

function StudyHub() {
    const [activeStudy, setActiveStudy] = useState(null)
    const [viewMode, setViewMode] = useState('docs') // 'docs' | 'agent'
    const [selectedAgentStudy, setSelectedAgentStudy] = useState(null)
    const { agentStudies, loading: agentLoading, reload: reloadAgentStudies } = useAgentStudies()
    const [completed, setCompleted] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('oculops_studies_completed') || '[]')
        } catch { return [] }
    })

    useEffect(() => {
        localStorage.setItem('oculops_studies_completed', JSON.stringify(completed))
    }, [completed])

    const toggleCompleted = (id) => {
        setCompleted(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    // ── INDEX VIEW ──
    if (activeStudy === null) {
        return (
            <div className="study-hub fade-in">
                <div className="study-hero">
                    <div className="study-hero-badge">TELEMETRY ARCHIVE</div>
                    <h1 className="study-hero-title">INTELLIGENCE DOSSIER</h1>
                    <p className="study-hero-subtitle">MASTER BUSINESS PLAN 2026 // RESTRICTED ACCESS</p>
                    <p className="study-hero-meta">
                        {studies.length} DOCUMENTS · STRATEGY · PRICING · GTM · KPIs
                    </p>
                    <div className="study-hero-kpis">
                        <div className="study-hero-kpi">
                            <div className="study-hero-kpi-value">$20K</div>
                            <div className="study-hero-kpi-label">MRR TARGET Q4</div>
                        </div>
                        <div className="study-hero-kpi">
                            <div className="study-hero-kpi-value">92,458</div>
                            <div className="study-hero-kpi-label">COMPANIES RECORDED</div>
                        </div>
                        <div className="study-hero-kpi">
                            <div className="study-hero-kpi-value">25</div>
                            <div className="study-hero-kpi-label">TARGET CLIENTS</div>
                        </div>
                        <div className="study-hero-kpi">
                            <div className="study-hero-kpi-value">$500</div>
                            <div className="study-hero-kpi-label">STARTER TIER</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
                    <button className="mono" style={{ padding: '8px 16px', fontSize: '10px', background: viewMode === 'docs' ? 'var(--color-primary)' : 'transparent', color: viewMode === 'docs' ? '#000' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setViewMode('docs')}>
                        01. DOSSIER ARCHIVE
                    </button>
                    <button className="mono" style={{ padding: '8px 16px', fontSize: '10px', background: viewMode === 'agent' ? 'var(--color-primary)' : 'transparent', color: viewMode === 'agent' ? '#000' : 'var(--color-text)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { setViewMode('agent'); reloadAgentStudies() }}>
                        02. AGENT INTELLIGENCE ({agentStudies.length})
                    </button>
                </div>

                {viewMode === 'agent' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                        {agentLoading ? (
                            <div className="mono" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>[ LOADING AGENT STUDIES... ]</div>
                        ) : agentStudies.length === 0 ? (
                            <div className="mono" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>[ NO AGENT STUDIES YET — RUN AGENTS TO GENERATE ]</div>
                        ) : agentStudies.map(s => (
                            <div key={s.id} onClick={() => setSelectedAgentStudy(selectedAgentStudy?.id === s.id ? null : s)} style={{ border: '1px solid var(--border-subtle)', padding: '12px 16px', cursor: 'pointer', background: selectedAgentStudy?.id === s.id ? 'var(--color-bg-2)' : '#000' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="mono" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text)', textTransform: 'uppercase' }}>{s.title}</div>
                                    <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{s.agent_code_name?.toUpperCase()} | {new Date(s.created_at).toLocaleDateString()}</div>
                                </div>
                                {s.summary && <div className="mono" style={{ fontSize: '10px', color: 'var(--color-text-2)', marginTop: '6px' }}>{s.summary}</div>}
                                {s.highlights?.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {s.highlights.slice(0, 4).map((h, i) => <span key={i} className="mono" style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>{h}</span>)}
                                    </div>
                                )}
                                {selectedAgentStudy?.id === s.id && s.content_markdown && (
                                    <div className="mono" style={{ fontSize: '11px', color: 'var(--color-text-2)', marginTop: '12px', padding: '12px', border: '1px solid var(--border-subtle)', background: '#000', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                                        {s.content_markdown}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="study-index-header">
                    <h2>/// KNOWLEDGE MODULES</h2>
                    <div className="study-progress-badge">
                        [{completed.length} / {studies.length} EXTRACTED]
                    </div>
                </div>

                <div className="study-progress-bar">
                    <div
                        className="study-progress-fill"
                        style={{ width: `${(completed.length / studies.length) * 100}%` }}
                    />
                </div>

                <div className="study-grid">
                    {studies.map(study => (
                        <button
                            key={study.id}
                            className={`study-card ${completed.includes(study.id) ? 'study-card-completed' : ''}`}
                            onClick={() => setActiveStudy(study.id)}
                        >
                            <div className="study-card-header">
                                <span className="study-card-number">{String(study.id).padStart(2, '0')}</span>
                                <div className={`study-card-check ${completed.includes(study.id) ? 'checked' : ''}`}>
                                    {completed.includes(study.id) ? '[ OK ]' : '[ -- ]'}
                                </div>
                            </div>
                            <div className="study-card-icon">{study.icon}</div>
                            <h3 className="study-card-title">{study.title}</h3>
                            <p className="study-card-desc">{study.subtitle}</p>
                            <div className="study-card-footer">
                                <div className="study-card-tags">
                                    {study.categories.map(cat => (
                                        <span
                                            key={cat}
                                            className="study-card-tag"
                                            style={{ color: STUDY_CATEGORIES[cat]?.color }}
                                        >
                                            {STUDY_CATEGORIES[cat]?.label}
                                        </span>
                                    ))}
                                </div>
                                <span className="study-card-time">⏱ {study.readTime} MIN RUN</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // ── READER VIEW ──
    const study = studies.find(s => s.id === activeStudy)
    if (!study) return null

    return (
        <div className="study-reader fade-in">
            {/* Sidebar nav */}
            <nav className="study-sidebar">
                <button className="study-sidebar-back" onClick={() => setActiveStudy(null)}>
                    {'< TERMINATE SESSION'}
                </button>
                <div className="study-sidebar-list">
                    {studies.map(s => (
                        <button
                            key={s.id}
                            className={`study-sidebar-item ${s.id === activeStudy ? 'active' : ''} ${completed.includes(s.id) ? 'completed' : ''}`}
                            onClick={() => setActiveStudy(s.id)}
                        >
                            <span className="study-sidebar-num">{String(s.id).padStart(2, '0')}</span>
                            <span className="study-sidebar-icon">{s.icon}</span>
                            <span className="study-sidebar-label">{s.title}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Main content */}
            <main className="study-main">
                <div className="study-breadcrumb">
                    <button onClick={() => setActiveStudy(null)}>ARCHIVE</button>
                    <span>/</span>
                    <span style={{ color: 'var(--color-primary)' }}>{String(study.id).padStart(2, '0')} — {study.title}</span>
                </div>

                <div className="study-main-header">
                    <div className="study-main-tags">
                        {study.categories.map(cat => (
                            <span key={cat} className="study-tag" style={{ color: STUDY_CATEGORIES[cat]?.color, borderColor: STUDY_CATEGORIES[cat]?.color }}>
                                {STUDY_CATEGORIES[cat]?.label}
                            </span>
                        ))}
                        <span className="study-read-time">⏱ {study.readTime} MIN RUN</span>
                    </div>
                    <button
                        className={`study-mark-btn ${completed.includes(study.id) ? 'marked' : ''}`}
                        onClick={() => toggleCompleted(study.id)}
                    >
                        {completed.includes(study.id) ? '[ STATUS: LOGGED ]' : '[ MARK COMPLETE ]'}
                    </button>
                </div>

                <h1 className="study-title">{study.icon} {study.title}</h1>
                <div className="study-title-bar" />

                {study.subtitle && (
                    <div className="study-meta-box">
                        <div><strong>SCOPE:</strong> GLOBAL / AI OPERATIONS / 2026</div>
                        <div><strong>METHOD:</strong> DIRECT INTEL, SECURE DATASETS, FORECASTING</div>
                        <div><strong>TIMESTAMP:</strong> MARCH 2026</div>
                    </div>
                )}

                {study.sections.map((section, i) => (
                    <div key={i} className="study-section">
                        <h2 className="study-section-title">/// {section.title}</h2>
                        {section.content && (
                            <div
                                className="study-section-content"
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdown(section.content)
                                }}
                            />
                        )}
                        {section.table && (
                            <div className="study-table-wrap">
                                <table className="study-table">
                                    <thead>
                                        <tr>
                                            {section.table.headers.map((h, j) => (
                                                <th key={j}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {section.table.rows.map((row, j) => (
                                            <tr key={j}>
                                                {row.map((cell, k) => (
                                                    <td key={k} dangerouslySetInnerHTML={{ __html: renderMarkdown(cell) }} />
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}

                <div className="study-nav-buttons">
                    {study.id > 0 ? (
                        <button className="btn btn-ghost mono" style={{ padding: '8px 16px', fontSize: '11px', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)' }} onClick={() => setActiveStudy(study.id - 1)}>
                            &lt; PREV: {studies[study.id - 1]?.title.substring(0, 20).toUpperCase()}...
                        </button>
                    ) : <div></div>}

                    {study.id < studies.length - 1 && (
                        <button className="btn btn-ghost mono" style={{ padding: '8px 16px', fontSize: '11px', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#000' }} onClick={() => setActiveStudy(study.id + 1)}>
                            NEXT MODULE &gt;
                        </button>
                    )}
                </div>
            </main>
        </div>
    )
}

// ── Simple markdown renderer ──
function renderMarkdown(text) {
    if (!text) return ''
    return text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers within content
        .replace(/^### (.*$)/gm, '<h4>$1</h4>')
        .replace(/^## (.*$)/gm, '<h3>/// $1</h3>')
        // Tables (simple markdown tables)
        .replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.split('|').filter(c => c.trim())
            if (cells.every(c => /^[\s-:]+$/.test(c))) return '' // separator row
            const isHeader = false
            const tag = isHeader ? 'th' : 'td'
            return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`
        })
        // Wrap consecutive table rows
        .replace(/((<tr>.*<\/tr>\n?)+)/g, '<table class="study-inline-table">$1</table>')
        // Lists
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
        // Numbered lists
        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
        // Paragraphs (double newline)
        .replace(/\n\n/g, '</p><p>')
        // Single newlines
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(.+)/, '<p>$1</p>')
}

export default StudyHub
