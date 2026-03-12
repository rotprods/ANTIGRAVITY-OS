// /////////////////////////////////////////////////////////////////////////////
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// OCULOPS — ProspectorHub Mega-Module
// Bloomberg Terminal / War Room Edition
// /////////////////////////////////////////////////////////////////////////////

import { useState, useMemo } from 'react'
import { useProspector } from '../../hooks/useProspector'
import { useGeoSearch } from '../../hooks/useGeoSearch'
import { useAtlasCRM } from '../../hooks/useAtlasCRM'
import { useEdgeFunction } from '../../hooks/useEdgeFunction'

import FlightDeck from './FlightDeck'
import './ProspectorHub.css'

const GOOGLE_MAPS_EMBED_KEY =
    import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''

function ScoreRing({ score, size = 40 }) {
    const r = (size - 4) / 2
    const circ = 2 * Math.PI * r
    const offset = circ - ((score || 0) / 100) * circ
    const color = score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'
    return (
        <svg width={size} height={size} className="ph-score-ring-svg">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2" strokeDasharray={circ} strokeDashoffset={offset} />
            <text x={size / 2} y={size / 2} fill={color} fontSize="10" className="mono ph-score-ring-text" textAnchor="middle" dominantBaseline="middle">{score || '–'}</text>
        </svg>
    )
}

function MapEmbed({ leads, selectedId, onSelectLead }) {
    const mapLeads = leads.filter(l => l.lat && l.lng)
    const selectedLead = leads.find(lead => lead.id === selectedId) || mapLeads[0] || null
    const bounds = useMemo(() => {
        if (mapLeads.length === 0) return { minLat: 36, maxLat: 43.5, minLng: -9.5, maxLng: 4.5 }
        const lats = mapLeads.map(l => l.lat), lngs = mapLeads.map(l => l.lng), pad = 0.02
        return { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad }
    }, [mapLeads])
    const toXY = (lat, lng) => ({ x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100, y: (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100 })
    const iframeSrc = useMemo(() => {
        if (!GOOGLE_MAPS_EMBED_KEY || !selectedLead) return null

        const url = new URL('https://www.google.com/maps/embed/v1/place')
        url.searchParams.set('key', GOOGLE_MAPS_EMBED_KEY)

        if (selectedLead.place_id) {
            url.searchParams.set('q', `place_id:${selectedLead.place_id}`)
        } else {
            const query = [selectedLead.name, selectedLead.address].filter(Boolean).join(', ')
            url.searchParams.set('q', query || `${selectedLead.lat},${selectedLead.lng}`)
        }

        if (selectedLead.lat && selectedLead.lng) {
            url.searchParams.set('center', `${selectedLead.lat},${selectedLead.lng}`)
            url.searchParams.set('zoom', '15')
        }

        return url.toString()
    }, [selectedLead])

    return (
        <div className="ph-map-embed">
            {iframeSrc ? (
                <>
                    <iframe
                        title={selectedLead ? `${selectedLead.name} on Google Maps` : 'Google Maps'}
                        className="ph-map-iframe"
                        src={iframeSrc}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                    />
                    <div className="ph-map-provider-badge">
                        <span>OCULOPS Business Radar</span>
                        <span>Powered by Google Maps</span>
                    </div>
                </>
            ) : null}
            <svg width="100%" height="100%" className="ph-map-grid-svg">
                {[...Array(11)].map((_, i) => (
                    <g key={i}>
                        <line x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="var(--accent-primary)" strokeWidth="0.5" />
                        <line x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="var(--accent-primary)" strokeWidth="0.5" />
                    </g>
                ))}
            </svg>
            {!iframeSrc && mapLeads.length === 0 ? (
                <div className="ph-map-empty-state">
                    Run a scan to project targets on the map.
                </div>
            ) : null}
            {mapLeads.map(lead => {
                const pos = toXY(lead.lat, lead.lng)
                const isSelected = lead.id === selectedId
                const stateClass = lead.ai_score >= 70 ? 'ph-marker--success' : lead.ai_score >= 40 ? 'ph-marker--warning' : lead.ai_score ? 'ph-marker--danger' : 'ph-marker--primary'
                return (
                    <div
                        key={lead.id}
                        onClick={() => onSelectLead(lead.id)}
                        className={`ph-map-marker-container ${isSelected ? 'ph-map-marker-container--selected' : ''}`}
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                        <div className={`ph-map-marker-box ${stateClass}`}>
                            <div className="ph-map-marker-dot" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

const API_NODES = [
    { id: 'google_places', name: 'Google Places', status: 'active', type: 'GEO' },
    { id: 'pagespeed', name: 'PageSpeed', status: 'active', type: 'WEB' },
    { id: 'tech_detect', name: 'Tech Stack', status: 'active', type: 'WEB' },
    { id: 'social_scan', name: 'Social Scanner', status: 'active', type: 'WEB' },
    { id: 'gemini_ai', name: 'Gemini Qualify', status: 'active', type: 'AI' }
]

const TABS = [
    { id: 'flight', label: 'FLIGHT DECK' },
    { id: 'map', label: 'GEO MAP' },
    { id: 'scanner', label: 'SCAN TRG' },
    { id: 'leads', label: 'LEADS DB' },
    { id: 'pipeline', label: 'PIPELINE' },
    { id: 'outreach', label: 'OUTREACH' },
    { id: 'network', label: 'API NET' }
]

const PIPELINE_STEPS = [
    { key: 'resolve_lead', label: 'Resolve Lead' },
    { key: 'scrape_analyze', label: 'Scrape & Analyze' },
    { key: 'qualify', label: 'AI Qualify' },
    { key: 'score', label: 'Score Deal' },
]

function PipelineTab() {
    const { data, loading, error, execute } = useEdgeFunction('lead-enrichment-pipeline')
    const [form, setForm] = useState({ company: '', url: '', location: '' })

    const steps = data?.steps || []
    const score = data?.score
    const autoPromoted = data?.auto_promoted

    const stepStatus = (key) => {
        const s = steps.find(s => s.step === key)
        return s?.status || 'pending'
    }

    const statusIcon = (status) => {
        if (status === 'ok') return <span style={{ color: 'var(--color-success)' }}>✓</span>
        if (status === 'error') return <span style={{ color: 'var(--color-danger)' }}>✗</span>
        if (loading) return <span style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        return <span style={{ color: 'var(--text-quaternary)' }}>○</span>
    }

    const handleRun = () => {
        if (!form.company && !form.url) return
        execute({ company: form.company, url: form.url, location: form.location })
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', height: '100%' }}>
            {/* Left: Form */}
            <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="mono font-bold text-tertiary ph-history-title">/// ENRICHMENT PARAMETERS</div>
                {[
                    { label: 'COMPANY NAME', key: 'company', placeholder: 'Clínica Dental Madrid' },
                    { label: 'WEBSITE URL', key: 'url', placeholder: 'https://example.com' },
                    { label: 'LOCATION', key: 'location', placeholder: 'Madrid, España' },
                ].map(f => (
                    <div key={f.key} className="input-group">
                        <label className="mono ph-scanner-label">{f.label}</label>
                        <input
                            className="input mono text-xs ph-scanner-input"
                            placeholder={f.placeholder}
                            value={form[f.key]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                    </div>
                ))}
                <button
                    className="btn btn-primary mono text-xs mt-4 ph-scanner-btn"
                    onClick={handleRun}
                    disabled={loading || (!form.company && !form.url)}
                >
                    {loading ? '[ ENRICHING... ]' : '[ RUN PIPELINE ]'}
                </button>
                {error && (
                    <div style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                        ERR: {error}
                    </div>
                )}
            </div>

            {/* Right: Progress + Result */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* Step tracker */}
                <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div className="mono font-bold text-tertiary ph-history-title">/// PIPELINE STATUS</div>
                    {PIPELINE_STEPS.map(step => {
                        const status = stepStatus(step.key)
                        return (
                            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                <span style={{ fontSize: 16, lineHeight: 1, width: 20, textAlign: 'center' }}>{statusIcon(status)}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: status === 'ok' ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                    {step.label}
                                </span>
                                {status === 'ok' && steps.find(s => s.step === step.key)?.data?.score !== undefined && (
                                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent-primary)' }}>
                                        {steps.find(s => s.step === step.key).data.score}/100
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Score result */}
                {data && (
                    <div style={{ background: 'var(--surface-elevated)', border: `1px solid ${score >= 60 ? 'var(--color-success)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <div className="mono font-bold text-tertiary ph-history-title">/// RESULT</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <svg width="56" height="56">
                                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                                <circle cx="28" cy="28" r="24" fill="none" stroke={score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'} strokeWidth="3" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - score / 100)} transform="rotate(-90 28 28)" />
                                <text x="28" y="28" textAnchor="middle" dominantBaseline="middle" fill={score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">{score}</text>
                            </svg>
                            <div style={{ flex: 1 }}>
                                {autoPromoted && (
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)', marginBottom: 4 }}>
                                        ✓ AUTO-PROMOTED TO CRM
                                    </div>
                                )}
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                                    {data.reasoning}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function ProspectorHub() {
    const { leads, scans, loading, byStatus, avgScore, recordScan, promoteLead } = useProspector()
    const { results, scanning, searchPlaces, qualifyLead: aiQualify, qualifying } = useGeoSearch()
    const {
        importLead: syncLeadToCRM,
        importLeads: syncLeadsToCRM,
        stageOutreach,
        importingLeadId,
        bulkImporting,
        stagingKey,
        error: crmError,
    } = useAtlasCRM()

    const [tab, setTab] = useState('flight')
    const [form, setForm] = useState({ query: '', location: 'Madrid, España', radius: 5000 })
    const [selectedLead, setSelectedLead] = useState(null)
    const [flightIntel, setFlightIntel] = useState(null)

    const activeLeads = byStatus.active || []
    const selected = leads.find(l => l.id === selectedLead)

    const resolvePersistedLeadId = (lead) => leads.find(item =>
        (lead?.place_id && item.place_id === lead.place_id) ||
        (lead?.google_maps_id && item.google_maps_id === lead.google_maps_id) ||
        (lead?.name && item.name === lead.name && item.address === lead.address)
    )?.id

    const buildAtlasContext = (overrides = {}, intel = flightIntel) => ({
        source: overrides.source || 'flight_deck',
        query: overrides.query || form.query.trim() || 'business',
        location: overrides.location || intel?.area?.formatted_address || intel?.area?.label || form.location,
        areaLabel: overrides.areaLabel || intel?.area?.label || intel?.search_center?.label || form.location,
    })

    const persistScan = async (params, data) => {
        if (data?.error) return data

        setFlightIntel(data)
        await recordScan({
            query: params.query,
            location: params.location || data?.area?.formatted_address || data?.area?.label || form.location,
            radius: params.radius,
            source: params.source || 'flight_deck',
            area: data?.area || null,
            searchCenter: data?.search_center || null,
            rawPayload: data,
            results: data?.places || [],
        })

        return data
    }

    const handleScanAirspace = async (params = {}) => {
        const query = (params.query || form.query).trim()
        if (!query) return { places: [], error: 'Missing query' }

        const radius = Number(params.radius || form.radius) || 5000
        const payload = typeof params.lat === 'number' && typeof params.lng === 'number'
            ? { query, lat: params.lat, lng: params.lng, radius, source: params.source || 'flight_deck' }
            : { query, location: params.location || form.location, radius, source: params.source || 'flight_deck' }

        const data = await searchPlaces(payload)
        return persistScan(payload, data)
    }

    const handleResolveLocation = async (locationValue = form.location) => {
        const data = await searchPlaces({
            query: form.query.trim() || 'business',
            location: locationValue,
            radius: Number(form.radius) || 5000,
            resolve_only: true,
        })

        if (!data?.error) {
            setFlightIntel(data)
            setForm(prev => ({ ...prev, location: data?.area?.label || locationValue }))
        }

        return data
    }

    const linkImportedLead = async (lead, result) => {
        const persistedLeadId = resolvePersistedLeadId(lead)
        if (!persistedLeadId || result?.error) return
        await promoteLead(persistedLeadId, {
            company_id: result.company?.id || null,
            contact_id: result.contact?.id || null,
            deal_id: result.deal?.id || null,
        })
    }

    const handleImportLead = async (lead) => {
        const result = await syncLeadToCRM(lead, buildAtlasContext({
            source: 'flight_deck',
            location: lead?.address || form.location,
        }))
        await linkImportedLead(lead, result)
        return result
    }

    const handleImportAll = async (leadsToImport) => {
        const result = await syncLeadsToCRM(leadsToImport, buildAtlasContext())
        if (result?.imported?.length) {
            await Promise.all(result.imported.map(item => linkImportedLead(item.lead, item)))
        }
        return result
    }

    const handleStageLeadOutreach = async (lead, channel) => {
        const result = await stageOutreach({
            channel,
            lead,
            context: buildAtlasContext({
                source: 'flight_deck',
                location: lead?.address || form.location,
            }),
        })
        await linkImportedLead(lead, result)
        return result
    }

    const handleScan = async () => {
        await handleScanAirspace({ query: form.query, location: form.location, radius: form.radius, source: 'scanner' })
    }

    const crmSyncState = {
        importingLeadId,
        bulkImporting,
        stagingKey,
        error: crmError,
    }

    return (
        <div className="prospector-hub fade-in">
            {/* ── HEADER ── */}
            <div className="ph-header">
                <div>
                    <h1 className="ph-header-title">PROSPECTOR HUB</h1>
                    <p className="mono font-bold ph-header-subtitle">
                        GLOBAL INTELLIGENCE NETWORK // {activeLeads.length} LOCATIONS VERIFIED
                    </p>
                </div>
                <div className="ph-header-stats">
                    <div className="ph-stat-box mono text-xs">
                        <span className="text-tertiary">LIVE: </span><strong className="text-primary">{results.length || activeLeads.length}</strong>
                    </div>
                    <div className="ph-stat-box mono text-xs">
                        <span className="text-tertiary">QUAL: </span><strong className="text-success">{byStatus.qualified?.length || 0}</strong>
                    </div>
                    <div className="ph-stat-box mono text-xs">
                        <span className="text-tertiary">AVG ID: </span><strong className="text-primary">{avgScore || '-'}</strong>
                    </div>
                </div>
            </div>

            {/* ── TABS ── */}
            <div className="prospector-tabs">
                {TABS.map(t => (
                    <button key={t.id} className={`prospector-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── CONTENT BODY ── */}
            <div className="prospector-content">

                {tab === 'flight' && (
                    <div className="ph-view-container">
                        <FlightDeck
                            form={form}
                            setForm={setForm}
                            scanResults={results}
                            scanning={scanning}
                            lastScan={flightIntel}
                            onScanAirspace={handleScanAirspace}
                            onResolveLocation={handleResolveLocation}
                            onImportLead={handleImportLead}
                            onImportAll={handleImportAll}
                            onStageLeadOutreach={handleStageLeadOutreach}
                            crmSyncState={crmSyncState}
                        />
                    </div>
                )}

                {tab === 'map' && (
                    <div className="map-container">
                        <div className="map-sidebar">
                            <div className="map-sidebar-header">/// MISSION TARGETS</div>
                            <div className="map-sidebar-list">
                                {activeLeads.map(l => (
                                    <div key={l.id} className={`map-lead-item ${selectedLead === l.id ? 'selected' : ''}`} onClick={() => setSelectedLead(l.id)}>
                                        <div className={`map-lead-name ${l.status === 'qualified' ? 'text-success' : 'text-primary'}`}>{l.name}</div>
                                        <div className="map-lead-meta">
                                            <span>{l.ai_score ? `AI:${l.ai_score}` : 'UNRANKED'}</span>
                                            <span>{l.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <MapEmbed leads={activeLeads} selectedId={selectedLead} onSelectLead={setSelectedLead} />
                    </div>
                )}

                {tab === 'scanner' && (
                    <div className="ph-scanner-grid">
                        <div className="ph-scanner-sidebar">
                            <div className="map-sidebar-header">/// MISSION PARAMETERS</div>
                            <div className="ph-scanner-form">
                                <div className="input-group">
                                    <label className="mono ph-scanner-label">TARGET TYPE</label>
                                    <input className="input mono text-xs ph-scanner-input" value={form.query} onChange={e => setForm(f => ({ ...f, query: e.target.value }))} />
                                </div>
                                <div className="input-group">
                                    <label className="mono ph-scanner-label">LOCATION</label>
                                    <input className="input mono text-xs ph-scanner-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                                </div>
                                <div className="input-group">
                                    <label className="mono ph-scanner-label">RADIUS (m)</label>
                                    <input className="input mono text-xs ph-scanner-input" type="number" value={form.radius} onChange={e => setForm(f => ({ ...f, radius: parseInt(e.target.value) }))} />
                                </div>
                                <button className="btn btn-primary mono text-xs mt-4 ph-scanner-btn" onClick={handleScan} disabled={scanning}>
                                    {scanning ? '[ EXECUTING SCAN... ]' : '[ INITIATE SCAN ]'}
                                </button>
                            </div>
                        </div>
                        <div className="ph-history-panel">
                            <div className="mono font-bold text-tertiary mb-6 ph-history-title">/// DEPLOYMENT HISTORY</div>
                            <div className="ph-history-list">
                                {scans.map(s => (
                                    <div key={s.id} className="mono text-xs ph-history-item">
                                        <span className="text-primary font-bold">{s.query.toUpperCase()}</span>
                                        <span className="text-tertiary">{s.location.toUpperCase()} — {s.results_count} LOGS</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'leads' && (
                    <div className="ph-leads-grid">
                        <div className="ph-leads-table-container">
                            <table className="ph-leads-table">
                                <thead>
                                    <tr className="mono ph-leads-tr-head">
                                        <th className="ph-leads-th">TARGET ID</th>
                                        <th className="ph-leads-th">CLASS</th>
                                        <th className="ph-leads-th">AI LEVEL</th>
                                        <th className="ph-leads-th">STATE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeLeads.map(l => (
                                        <tr key={l.id} className={`mono ph-leads-tr-body ${selectedLead === l.id ? 'ph-leads-tr-body--selected' : ''}`} onClick={() => setSelectedLead(l.id)}>
                                            <td className="ph-leads-td ph-leads-td--bold">{l.name.toUpperCase()}</td>
                                            <td className="ph-leads-td text-tertiary">{l.category ? l.category.toUpperCase() : '[ NULL ]'}</td>
                                            <td className="ph-leads-td">
                                                <span className={l.ai_score > 70 ? 'text-success' : 'text-warning'}>{l.ai_score || '[ ? ]'}</span>
                                            </td>
                                            <td className={`ph-leads-td ${l.status === 'qualified' ? 'text-success' : ''}`}>{l.status.toUpperCase()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {selected ? (
                            <div className="ph-lead-detail-panel">
                                <div className="mono text-primary font-bold mb-6 ph-lead-detail-title">{selected.name.toUpperCase()}</div>
                                <div className="mono text-xs mb-3 text-tertiary ph-lead-detail-meta">LOCATION: <span className="text-secondary">{selected.address || '[ UNKNOWN ]'}</span></div>
                                <div className="mono text-xs mb-3 text-tertiary ph-lead-detail-meta">INDEX: <span className="text-secondary">{selected.rating || '[ UNKNOWN ]'}</span></div>
                                <div className="mono text-xs mb-6 text-tertiary ph-lead-detail-meta">WEB LINK: <span className="text-secondary">{selected.website || '[ NULL ]'}</span></div>
                                <button className="btn btn-primary mono text-xs mb-6 ph-lead-detail-btn" onClick={() => aiQualify(selected.id)} disabled={qualifying === selected.id}>
                                    {qualifying === selected.id ? '[ DECRYPTING AI LOGS... ]' : '[ AUTHORIZE AI INFILTRATION ]'}
                                </button>
                                <div className="mono font-bold text-primary mb-3 ph-cortex-title">/// CORTEX INTELLIGENCE RECORD</div>
                                <div className="mono text-secondary ph-cortex-record">
                                    {selected.ai_reasoning || 'AWAITING RECONNAISSANCE PACKET.'}
                                </div>
                            </div>
                        ) : (
                            <div className="ph-empty-detail">
                                <div className="mono ph-empty-detail-text">AWAITING TARGET SELECTION.</div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'network' && (
                    <div className="api-network">
                        {API_NODES.map(app => (
                            <div key={app.id} className="api-node">
                                <div className="api-node-icon">[{app.type[0]}]</div>
                                <div className="api-node-info">
                                    <div className="api-node-name">{app.name}</div>
                                    <div className="api-node-desc">{app.type} PROTOCOL</div>
                                    <div className="api-node-status">{app.status}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'pipeline' && (
                    <div className="ph-view-container" style={{ height: '100%' }}>
                        <PipelineTab />
                    </div>
                )}

                {tab === 'outreach' && (
                    <div className="mono font-bold text-tertiary ph-outreach-msg">
                        OUTREACH MODULE: UI RESTRICTED. FALLBACK TO TERMINAL COMMS.
                    </div>
                )}
            </div>

            {loading && (
                <div className="ph-global-sync">
                    <div className="mono text-primary font-bold ph-global-sync-text">SYNCHRONIZING GLOBAL DEPLOYMENT...</div>
                </div>
            )}
        </div>
    )
}

export default ProspectorHub
