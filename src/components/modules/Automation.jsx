// ═══════════════════════════════════════════════════
// OCULOPS — Automation Zone
// 100-Year UX: strictly OLED Black, Gold, 1px Primitives
// ═══════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useApiCatalog } from '../../hooks/useApiCatalog'
import { useAutomation } from '../../hooks/useAutomation'
import { useAgentVault } from '../../hooks/useAgentVault'
import { AGENT_AUTOMATION_PACKS } from '../../data/agentAutomationPacks'
import { CORE_MINI_APPS } from '../miniapps/MiniAppRegistry'

const VAULT_AUTOMATION_CAPS = ['orchestration', 'ml-ai', 'api-design']

const TRIGGERS = [
    { key: 'atlas_import', icon: '✈️', label: 'ATLAS LEAD IMPORT', type: 'event' },
    { key: 'manual', icon: '🖱️', label: 'MANUAL OVERRIDE', type: 'manual' },
    { key: 'message_in', icon: '💬', label: 'INBOUND COMMS', type: 'event' },
    { key: 'schedule', icon: '⏰', label: 'SYSTEM CRON', type: 'time' },
    { key: 'webhook', icon: '🔗', label: 'EXTERNAL WEBHOOK', type: 'webhook' },
]

const ACTIONS = [
    { key: 'compose_message', icon: '📤', label: 'DRAFT TRANSMISSION' },
    { key: 'create_deal', icon: '💎', label: 'INITIALIZE DEAL' },
    { key: 'update_contact', icon: '✏️', label: 'MODIFY ENTITY' },
    { key: 'notify', icon: '🔔', label: 'SYSTEM ALERT' },
    { key: 'run_connector', icon: '🕸️', label: 'ENGAGE CONNECTOR' },
    { key: 'run_api', icon: '⚡', label: 'EXECUTE LIVE API' },
    { key: 'run_agent', icon: '🤖', label: 'DISPATCH AI AGENT' },
    { key: 'launch_n8n', icon: '🔁', label: 'TRIGGER N8N RELAY' },
    { key: 'crm_activity', icon: '📋', label: 'LOG ACTIVITY' },
]

const TEMPLATES = [
    {
        name: 'ATLAS GMAIL OUTREACH',
        trigger: 'atlas_import',
        actions: ['compose_message', 'crm_activity'],
        desc: 'UPON ATLAS IMPORT, PREPARES DRAFT AND LOGS CRM ACTIVITY.',
    },
    {
        name: 'SOCIAL FOLLOW-UP',
        trigger: 'manual',
        actions: ['compose_message', 'notify'],
        desc: 'MANUAL TRIGGER FOR LINKEDIN/IG FOLLOW-UP SEQUENCES.',
    },
    {
        name: 'LEAD TO DEAL CONVERSION',
        trigger: 'atlas_import',
        actions: ['create_deal', 'update_contact', 'crm_activity'],
        desc: 'CONVERTS IMPORTED ATLAS LEAD INTO ACTIVE DEAL AND UPDATES ENTITY.',
    },
]

function getTriggerMeta(key) { return TRIGGERS.find(trigger => trigger.key === key) || TRIGGERS[0] }
function getActionMeta(key) { return ACTIONS.find(action => action.key === key) || ACTIONS[0] }

function formatWorkflowRunDate(value) {
    if (!value) return 'NO RUNS ON RECORD'
    return new Date(value).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
}

function unique(values) { return [...new Set(values)] }
function uniqueBy(items, keySelector) {
    const map = new Map()
    items.forEach(item => { const key = keySelector(item); if (!map.has(key)) map.set(key, item) })
    return [...map.values()]
}

function workflowSupportsLiveSend(workflow) {
    return (workflow.steps || []).some(step => step?.type === 'compose_message' && ['email', 'whatsapp'].includes(step?.config?.channel))
}

function Automation() {
    const { toast } = useAppStore()
    const { installedApps } = useApiCatalog()
    const { workflows, runs, loading, runningWorkflowId, addWorkflow, toggleWorkflow, removeWorkflow, runWorkflow, loadRuns, activeCount, totalRuns } = useAutomation()
    const { agents: vaultAgents, loading: vaultLoading } = useAgentVault()
    const liveConnectorApps = installedApps.filter(app => app.runMode === 'connector_proxy' && app.connectorStatus === 'live')
    const liveApiApps = useMemo(() => CORE_MINI_APPS.filter(app => app.runMode === 'edge_function' && app.status !== 'planned'), [])
    const agentOptions = useMemo(() => unique([...liveApiApps.flatMap(app => app.agentTargets || []), ...AGENT_AUTOMATION_PACKS.map(pack => pack.agentCodeName)]), [liveApiApps])

    const n8nOptions = useMemo(() => uniqueBy([
        ...liveApiApps.flatMap(app => (app.n8nTemplates || []).map(template => ({ value: template, label: template, pageUrl: null, downloadUrl: null, source: 'product_registry' }))),
        ...AGENT_AUTOMATION_PACKS.flatMap(pack => pack.templates.map(template => ({ value: String(template.id), label: `#${template.id} · ${template.name}`, pageUrl: template.pageUrl, downloadUrl: template.downloadUrl, source: pack.agentCodeName }))),
    ], item => item.value), [liveApiApps])

    const templateLookup = useMemo(() => Object.fromEntries(n8nOptions.map(option => [option.value, option])), [n8nOptions])
    const defaultForm = { name: '', description: '', trigger: 'atlas_import', actions: [], connectorId: '', apiId: '', agentCodeName: '', workflowTemplate: '' }

    const [showForm, setShowForm] = useState(false)
    const [selectedWorkflowId, setSelectedWorkflowId] = useState(null)
    const [form, setForm] = useState(defaultForm)

    const selectedWorkflow = useMemo(() => workflows.find(workflow => workflow.id === selectedWorkflowId) || null, [selectedWorkflowId, workflows])

    // Vault agents filtered by automation-compatible capabilities
    const automationVaultAgents = useMemo(() => {
        return vaultAgents
            .filter(a => (a.capabilities || []).some(c => VAULT_AUTOMATION_CAPS.includes(c)))
            .slice(0, 20)
    }, [vaultAgents])

    const toggleAction = (key) => {
        setForm(current => {
            const actions = current.actions.includes(key) ? current.actions.filter(action => action !== key) : [...current.actions, key]
            return {
                ...current, actions,
                connectorId: actions.includes('run_connector') ? current.connectorId : '',
                apiId: actions.includes('run_api') ? current.apiId : '',
                agentCodeName: actions.includes('run_agent') ? current.agentCodeName : '',
                workflowTemplate: actions.includes('launch_n8n') ? current.workflowTemplate : '',
            }
        })
    }

    const addNewWorkflow = async () => {
        if (!form.name.trim()) return toast('NAME REQUIRED', 'warning')
        if (form.actions.length === 0) return toast('AT LEAST ONE ACTION REQUIRED', 'warning')
        if (form.actions.includes('run_connector') && !form.connectorId) return toast('SELECT LIVE CONNECTOR', 'warning')
        if (form.actions.includes('run_api') && !form.apiId) return toast('SELECT LIVE API', 'warning')
        if (form.actions.includes('run_agent') && !form.agentCodeName) return toast('SELECT AI AGENT', 'warning')
        if (form.actions.includes('launch_n8n') && !form.workflowTemplate) return toast('SELECT N8N RELAY', 'warning')

        const selectedApi = liveApiApps.find(app => app.id === form.apiId) || null
        const selectedTemplate = templateLookup[form.workflowTemplate] || null
        const trigger = getTriggerMeta(form.trigger)

        const workflow = await addWorkflow({
            name: form.name.trim(), description: form.description || null, trigger_type: trigger.type,
            trigger_config: { key: trigger.key, label: trigger.label, connectorId: form.connectorId || null },
            metadata: { agent_code_name: form.agentCodeName || null, n8n_template_id: form.workflowTemplate || null },
            steps: form.actions.map((action, index) => ({
                id: `step-${index + 1}`, type: action,
                config: action === 'run_connector' ? { connectorId: form.connectorId }
                    : action === 'run_api' ? { apiId: form.apiId, endpoint: selectedApi?.endpoint || null, label: selectedApi?.name || null, payload: selectedApi?.healthcheckPayload || {} }
                        : action === 'run_agent' ? { agentCodeName: form.agentCodeName, action: 'cycle' }
                            : action === 'launch_n8n' ? { agentCodeName: form.agentCodeName || null, workflowTemplate: form.workflowTemplate, workflowTemplateLabel: selectedTemplate?.label || form.workflowTemplate, workflowTemplateUrl: selectedTemplate?.pageUrl || null, workflowTemplateDownloadUrl: selectedTemplate?.downloadUrl || null, workflowTemplateSource: selectedTemplate?.source || null }
                                : {},
            })),
            is_active: false,
        })

        if (!workflow) return toast('WORKFLOW CREATION FAILED', 'warning')
        setForm(defaultForm)
        setShowForm(false)
        toast('WORKFLOW CREATED', 'success')
    }

    const selectWorkflow = async (workflow) => { setSelectedWorkflowId(workflow.id); await loadRuns(workflow.id) }

    const openWorkflowDraft = (workflow) => {
        const draftStep = (workflow.steps || []).find(step => step?.config?.launch_url)
        if (!draftStep?.config?.launch_url) return toast('NO DRAFT CHANNEL LINKED', 'warning')
        window.open(draftStep.config.launch_url, '_blank', 'noopener,noreferrer')
    }

    const executeWorkflow = async (workflow, { sendLive = false } = {}) => {
        if (!workflow?.id) return
        const result = await runWorkflow(workflow.id, { sendLive, context: { workflow_name: workflow.name } })
        if (result?.error) return toast(result.error, 'warning')
        await loadRuns(workflow.id)
        toast(sendLive ? `WORKFLOW EXECUTED (LIVE TX): ${workflow.name}` : `WORKFLOW EXECUTED: ${workflow.name}`, 'success')
    }

    const seedAgentPack = (pack) => {
        setForm({
            ...defaultForm, name: `${pack.label.toUpperCase()} LOOP`, description: pack.objective.toUpperCase(),
            trigger: pack.defaultTrigger, actions: pack.defaultActions, agentCodeName: pack.agentCodeName,
            workflowTemplate: pack.templates[0] ? String(pack.templates[0].id) : '',
        })
        setShowForm(true)
    }

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-editorial)', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>AUTOMATION MATRICES</h1>
                    <span className="mono text-xs text-tertiary">EVENT-DRIVEN DIRECTIVES & N8N ORCHESTRATION</span>
                </div>
                <button className="btn btn-primary mono" style={{ borderRadius: 0, padding: '8px 16px' }} onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'CLOSE MATRIC BUILDER' : 'INITIALIZE NEW MATRIC'}
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* ── KPI STRIP ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
                    <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <span className="mono text-xs text-tertiary">ACTIVE MATRICES</span>
                        <span className="mono text-lg font-bold text-success">{activeCount}</span>
                    </div>
                    <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <span className="mono text-xs text-tertiary">TOTAL CYCLES</span>
                        <span className="mono text-lg font-bold text-info">{totalRuns}</span>
                    </div>
                    <div style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <span className="mono text-xs text-tertiary">TOTAL STORED</span>
                        <span className="mono text-lg font-bold text-warning">{workflows.length}</span>
                    </div>
                </div>

                {showForm && (
                    <div style={{ border: '1px solid var(--color-primary)', background: '#000', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="mono text-xs font-bold" style={{ color: '#000', background: 'var(--color-primary)', padding: '4px 8px', alignSelf: 'flex-start' }}>/// NEW AUTOMATION MATRIC</div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="input-group">
                                <label className="mono text-xs">DESIGNATION TITLE</label>
                                <input className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label className="mono text-xs">PRIMARY TRIGGER</label>
                                <select className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })}>
                                    {TRIGGERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="mono text-xs">EXECUTIVE DIRECTIVE</label>
                            <textarea className="input mono text-xs" rows={2} style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>

                        <div>
                            <label className="mono text-xs" style={{ display: 'block', marginBottom: '8px' }}>EXECUTION SEQUENCE</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {ACTIONS.map(action => (
                                    <button key={action.key} className="mono" style={{ fontSize: '10px', padding: '6px 12px', border: form.actions.includes(action.key) ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)', background: form.actions.includes(action.key) ? 'var(--color-primary)' : '#000', color: form.actions.includes(action.key) ? '#000' : 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => toggleAction(action.key)}>
                                        {action.icon} {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.actions.includes('run_connector') && (
                            <div className="input-group">
                                <label className="mono text-xs">LIVE CONNECTOR PORT</label>
                                <select className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.connectorId} onChange={e => setForm({ ...form, connectorId: e.target.value })}>
                                    <option value="">SELECT CONNECTOR...</option>
                                    {liveConnectorApps.map(app => <option key={app.connectorId} value={app.connectorId}>{app.name.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}

                        {form.actions.includes('run_api') && (
                            <div className="input-group">
                                <label className="mono text-xs">LIVE API PORT</label>
                                <select className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.apiId} onChange={e => setForm({ ...form, apiId: e.target.value })}>
                                    <option value="">SELECT API...</option>
                                    {liveApiApps.map(app => <option key={app.id} value={app.id}>{app.name.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}

                        {form.actions.includes('run_agent') && (
                            <div className="input-group">
                                <label className="mono text-xs">AI OPERATIVE</label>
                                <select className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.agentCodeName} onChange={e => setForm({ ...form, agentCodeName: e.target.value })}>
                                    <option value="">SELECT OPERATIVE...</option>
                                    {agentOptions.map(agent => <option key={agent} value={agent}>{agent.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}

                        {form.actions.includes('launch_n8n') && (
                            <div className="input-group">
                                <label className="mono text-xs">N8N RELAY TEMPLATE</label>
                                <select className="input mono text-xs" style={{ border: '1px solid var(--border-subtle)', borderRadius: 0, padding: '8px' }} value={form.workflowTemplate} onChange={e => setForm({ ...form, workflowTemplate: e.target.value })}>
                                    <option value="">SELECT RELAY...</option>
                                    {n8nOptions.map(t => <option key={t.value} value={t.value}>{t.label.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}

                        {form.trigger && form.actions.length > 0 && (
                            <div style={{ background: 'var(--color-bg-2)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                                <div className="mono text-xs text-tertiary" style={{ marginBottom: '8px' }}>SEQUENCE VERIFICATION:</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className="mono text-xs" style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '2px 8px' }}>{getTriggerMeta(form.trigger).label}</span>
                                    {form.actions.map(action => (
                                        <span key={action} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="text-tertiary mono">→</span><span className="mono text-xs" style={{ border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)', padding: '2px 8px' }}>{getActionMeta(action).label}</span></span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button className="btn btn-primary mono" style={{ borderRadius: 0, padding: '12px' }} onClick={addNewWorkflow}>INITIALIZE WORKFLOW</button>
                    </div>
                )}

                {/* ── AGENT AUTOMATION PACKAGES & TEMPLATES ── */}
                {!showForm && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '16px' }}>
                        <div style={{ border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// RAPID DEPLOYMENT PROTOCOLS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px', background: 'var(--color-bg-2)', flex: 1 }}>
                                {TEMPLATES.map(t => (
                                    <div key={t.name} style={{ border: '1px solid var(--border-subtle)', background: '#000', padding: '12px', cursor: 'pointer' }} onClick={() => { setForm({ name: t.name, description: t.desc, trigger: t.trigger, actions: t.actions, connectorId: '', apiId: '', agentCodeName: '', workflowTemplate: '' }); setShowForm(true) }}>
                                        <div className="mono text-xs font-bold" style={{ color: 'var(--color-text)' }}>{t.name}</div>
                                        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', marginBottom: '8px' }}>{t.desc}</div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <span style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }} className="mono">{getTriggerMeta(t.trigger).label}</span>
                                            <span style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }} className="mono">{t.actions.length} ACTIONS</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                            <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// AGENTIC OPERATIONAL MATRICES</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', padding: '16px', background: 'var(--color-bg-2)', flex: 1, alignContent: 'start' }}>
                                {AGENT_AUTOMATION_PACKS.map(pack => (
                                    <div key={pack.agentCodeName} style={{ border: '1px solid var(--border-subtle)', background: '#000', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                                        <div className="mono text-xs font-bold" style={{ color: 'var(--color-info)' }}>{pack.label.toUpperCase()}</div>
                                        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', marginBottom: '12px', flex: 1 }}>{pack.objective.toUpperCase()}</div>

                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                            <span style={{ fontSize: '9px', padding: '2px 4px', border: '1px solid var(--border-subtle)', color: 'var(--color-primary)' }} className="mono">TRG: {pack.defaultTrigger.toUpperCase()}</span>
                                            {pack.defaultActions.map(a => <span key={a} style={{ fontSize: '9px', padding: '2px 4px', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)' }} className="mono">ACT: {a.toUpperCase()}</span>)}
                                        </div>

                                        <button className="btn mono btn-sm" style={{ border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)' }} onClick={() => seedAgentPack(pack)}>DEPLOY MATRIC</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── VAULT AGENT ARSENAL — AUTOMATION COMPATIBLE ── */}
                {!showForm && (
                    <div style={{ border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>/// VAULT AGENT ARSENAL — AUTOMATION COMPATIBLE</span>
                            <span className="mono text-xs" style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>{automationVaultAgents.length} AGENTS</span>
                        </div>
                        <div style={{ background: 'var(--color-bg-2)', display: 'flex', flexDirection: 'column' }}>
                            {vaultLoading ? (
                                <div className="mono text-xs text-tertiary" style={{ padding: '24px', textAlign: 'center' }}>LOADING VAULT MANIFEST...</div>
                            ) : automationVaultAgents.length === 0 ? (
                                <div className="mono text-xs text-tertiary" style={{ padding: '24px', textAlign: 'center' }}>NO AUTOMATION-COMPATIBLE AGENTS IN VAULT</div>
                            ) : (
                                automationVaultAgents.map((agent, i) => (
                                    <div key={agent.name || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <span className="mono text-xs font-bold" style={{ color: 'var(--color-text)', minWidth: '180px' }}>{(agent.name || '').toUpperCase()}</span>
                                        <span className="mono" style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', flexShrink: 0 }}>{(agent.namespace || '').toUpperCase()}</span>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                                            {(agent.capabilities || []).map(cap => (
                                                <span key={cap} className="mono" style={{ fontSize: '9px', padding: '1px 4px', border: '1px solid var(--border-subtle)', color: VAULT_AUTOMATION_CAPS.includes(cap) ? 'var(--color-info)' : 'var(--text-tertiary)' }}>{cap.toUpperCase()}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ── WORKFLOWS & EXECUTION ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '16px' }}>
                    <div style={{ border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                        <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--border-subtle)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>/// STORED DIRECTIVES</div>
                        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-2)', flex: 1 }}>
                            {loading ? <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>ACCESSING STORAGE...</div> :
                                workflows.length === 0 ? <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>NO DIRECTIVES STORED.</div> :
                                    workflows.map(wf => {
                                        const trigger = getTriggerMeta(wf.trigger_config?.key || wf.trigger_type)
                                        const steps = Array.isArray(wf.steps) ? wf.steps : []
                                        const hasLaunch = steps.some(s => s?.config?.launch_url)
                                        const isSelected = selectedWorkflow?.id === wf.id

                                        return (
                                            <div key={wf.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: isSelected ? 'var(--color-bg-3)' : 'transparent', cursor: 'pointer' }} onClick={() => selectWorkflow(wf)}>
                                                <div style={{ width: 8, height: 8, background: wf.is_active ? 'var(--color-success)' : 'var(--text-tertiary)' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div className="mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>{wf.name.toUpperCase()}</div>
                                                    {wf.description && <div className="mono text-xs text-tertiary" style={{ marginTop: '2px' }}>{wf.description.toUpperCase()}</div>}
                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                        <span className="mono" style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>{trigger.label}</span>
                                                        {steps.map(s => <span key={s.id || s.type} className="mono" style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)' }}>{getActionMeta(s.type).label}</span>)}
                                                        {hasLaunch && <span className="mono" style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--color-info)', color: 'var(--color-info)' }}>LINKED CHANNEL</span>}
                                                    </div>
                                                </div>
                                                <div className="mono text-xs text-tertiary" style={{ alignSelf: 'flex-start' }}>{wf.run_count || 0} CYCLES</div>
                                                <div style={{ display: 'flex', gap: '4px', alignSelf: 'flex-start' }}>
                                                    <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--border-subtle)' }} onClick={e => { e.stopPropagation(); executeWorkflow(wf) }} disabled={runningWorkflowId === wf.id}>{runningWorkflowId === wf.id ? 'EXE...' : 'ENGAGE'}</button>
                                                    <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--border-subtle)', color: wf.is_active ? 'var(--color-warning)' : 'var(--color-success)' }} onClick={e => { e.stopPropagation(); toggleWorkflow(wf.id) }}>{wf.is_active ? 'HALT' : 'ACTIVATE'}</button>
                                                    <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '4px 8px', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }} onClick={e => { e.stopPropagation(); removeWorkflow(wf.id) }}>DEL</button>
                                                </div>
                                            </div>
                                        )
                                    })
                            }
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: '#000' }}>
                        {!selectedWorkflow ? (
                            <div className="mono text-xs text-tertiary" style={{ padding: '32px', textAlign: 'center' }}>SELECT DIRECTIVE FOR TELEMETRY</div>
                        ) : (
                            <>
                                <div className="mono text-xs font-bold" style={{ padding: '12px 16px', background: 'var(--color-bg-2)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>/// ORBITAL TELEMETRY</span>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }} onClick={() => executeWorkflow(selectedWorkflow)} disabled={runningWorkflowId === selectedWorkflow.id}>FORCE CYCLE</button>
                                        {workflowSupportsLiveSend(selectedWorkflow) && <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }} onClick={() => executeWorkflow(selectedWorkflow, { sendLive: true })} disabled={runningWorkflowId === selectedWorkflow.id}>HOT TX CYCLE</button>}
                                        {selectedWorkflow.steps?.some(s => s?.config?.launch_url) && <button className="btn btn-ghost mono" style={{ fontSize: '9px', padding: '2px 8px', border: '1px solid var(--border-subtle)' }} onClick={() => openWorkflowDraft(selectedWorkflow)}>OPEN COMMS</button>}
                                    </div>
                                </div>
                                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <div className="mono font-bold" style={{ fontSize: '14px', color: 'var(--color-text)' }}>{selectedWorkflow.name.toUpperCase()}</div>
                                        <div className="mono text-xs text-tertiary" style={{ marginTop: '4px' }}>L.C.: {formatWorkflowRunDate(selectedWorkflow.last_run_at)}</div>
                                        {selectedWorkflow.description && <div className="mono text-xs text-secondary" style={{ marginTop: '8px' }}>{selectedWorkflow.description.toUpperCase()}</div>}
                                    </div>

                                    <div>
                                        <div className="mono text-xs" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginBottom: '8px' }}>EXECUTION CHAIN</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {(selectedWorkflow.steps || []).map(step => (
                                                <div key={step.id || step.type} style={{ border: '1px solid var(--border-subtle)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div className="mono text-xs font-bold" style={{ color: 'var(--color-text)' }}>{getActionMeta(step.type).label}</div>
                                                    {step.config?.launch_url && <div className="mono" style={{ fontSize: '9px', color: 'var(--color-info)' }}>LINK: SECURE OPEN</div>}
                                                    {step.config?.connectorId && <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>PORT: {step.config.connectorId}</div>}
                                                    {step.config?.endpoint && <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>API: {step.config.label || step.config.endpoint}</div>}
                                                    {step.config?.agentCodeName && <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>AGENT: {step.config.agentCodeName}</div>}
                                                    {step.config?.workflowTemplate && (
                                                        <div className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                                                            RELAY: {step.config.workflowTemplateLabel || step.config.workflowTemplate}
                                                            {step.config?.workflowTemplateUrl && <a href={step.config.workflowTemplateUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: 'var(--color-primary)' }}>[DOCS]</a>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mono text-xs" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginBottom: '8px' }}>SYS LOGGING</div>
                                        {runs.length === 0 ? <div className="mono text-xs text-tertiary">NO LOGS AVAILABLE</div> : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                                                {runs.map(run => (
                                                    <div key={run.id} style={{ border: '1px solid var(--border-subtle)', padding: '8px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <span className="mono" style={{ fontSize: '9px', padding: '2px 4px', border: `1px solid var(--color-${run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'})`, color: `var(--color-${run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'})` }}>{run.status.toUpperCase()}</span>
                                                            <span className="mono" style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{formatWorkflowRunDate(run.started_at)}</span>
                                                        </div>
                                                        {Array.isArray(run.result?.steps) && run.result.steps.length > 0 && (
                                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                                                {run.result.steps.map(step => (
                                                                    <span key={step.id || step.type} className="mono" style={{ fontSize: '9px', color: 'var(--color-text-2)' }}>
                                                                        [{step.type.toUpperCase()}: {step.status ? step.status.toUpperCase() : 'OK'}]
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {run.error && <div className="mono text-xs" style={{ color: 'var(--color-danger)', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px', marginTop: '4px' }}>FATAL: {run.error.toUpperCase()}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}

export default Automation
