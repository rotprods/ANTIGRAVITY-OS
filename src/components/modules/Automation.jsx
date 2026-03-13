// ═══════════════════════════════════════════════════
// OCULOPS — Automation v11.0
// Event-driven workflows & n8n orchestration
// ═══════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useApiCatalog } from '../../hooks/useApiCatalog'
import { useN8nTemplateCatalog } from '../../hooks/useN8nTemplateCatalog'
import { useAutomation } from '../../hooks/useAutomation'
import { useAgentVault } from '../../hooks/useAgentVault'
import { AGENT_AUTOMATION_PACKS } from '../../data/agentAutomationPacks'
import { toN8nTemplateOption } from '../../lib/n8nTemplateCatalog'
import { CORE_MINI_APPS } from '../miniapps/MiniAppRegistry'
import { PlusIcon } from '@heroicons/react/24/outline'
import ModulePage from '../ui/ModulePage'
import ModuleSkeleton from '../ui/ModuleSkeleton'
import './Automation.css'

const VAULT_AUTOMATION_CAPS = ['orchestration', 'ml-ai', 'api-design']

const TRIGGERS = [
    { key: 'atlas_import', label: 'Atlas lead import', type: 'event' },
    { key: 'manual', label: 'Manual trigger', type: 'manual' },
    { key: 'message_in', label: 'Inbound message', type: 'event' },
    { key: 'schedule', label: 'Scheduled cron', type: 'time' },
    { key: 'webhook', label: 'External webhook', type: 'webhook' },
]

const ACTIONS = [
    { key: 'compose_message', label: 'Draft message' },
    { key: 'create_deal', label: 'Create deal' },
    { key: 'update_contact', label: 'Update contact' },
    { key: 'notify', label: 'Send notification' },
    { key: 'run_connector', label: 'Run connector' },
    { key: 'run_api', label: 'Execute API' },
    { key: 'run_agent', label: 'Dispatch AI agent' },
    { key: 'launch_n8n', label: 'Trigger n8n' },
    { key: 'crm_activity', label: 'Log activity' },
]

const TEMPLATES = [
    { name: 'Atlas Gmail outreach', trigger: 'atlas_import', actions: ['compose_message', 'crm_activity'], desc: 'On Atlas import, prepares draft and logs CRM activity.' },
    { name: 'Social follow-up', trigger: 'manual', actions: ['compose_message', 'notify'], desc: 'Manual trigger for LinkedIn/IG follow-up sequences.' },
    { name: 'Lead to deal conversion', trigger: 'atlas_import', actions: ['create_deal', 'update_contact', 'crm_activity'], desc: 'Converts imported Atlas lead into active deal.' },
]

function getTriggerMeta(key) { return TRIGGERS.find(t => t.key === key) || TRIGGERS[0] }
function getActionMeta(key) { return ACTIONS.find(a => a.key === key) || ACTIONS[0] }

function formatRunDate(value) {
    if (!value) return 'No runs yet'
    return new Date(value).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function unique(values) { return [...new Set(values)] }
function uniqueBy(items, keySelector) {
    const map = new Map()
    items.forEach(item => { const key = keySelector(item); if (!map.has(key)) map.set(key, item) })
    return [...map.values()]
}

function workflowSupportsLiveSend(wf) {
    return (wf.steps || []).some(s => s?.type === 'compose_message' && ['email', 'whatsapp'].includes(s?.config?.channel))
}

function Automation() {
    const { toast } = useAppStore()
    const { installedApps } = useApiCatalog()
    const { workflows, runs, loading, runningWorkflowId, addWorkflow, toggleWorkflow, removeWorkflow, runWorkflow, loadRuns, activeCount, totalRuns } = useAutomation()
    const { agents: vaultAgents, loading: vaultLoading } = useAgentVault()
    const [templateSearch, setTemplateSearch] = useState('')
    const liveConnectorApps = installedApps.filter(app => app.runMode === 'connector_proxy' && app.connectorStatus === 'live')
    const liveApiApps = useMemo(() => CORE_MINI_APPS.filter(app => app.runMode === 'edge_function' && app.status !== 'planned'), [])
    const agentOptions = useMemo(() => unique([...liveApiApps.flatMap(app => app.agentTargets || []), ...AGENT_AUTOMATION_PACKS.map(p => p.agentCodeName)]), [liveApiApps])
    const {
        entries: n8nCatalogEntries,
        loading: n8nCatalogLoading,
        stats: n8nCatalogStats,
        source: n8nCatalogSource,
    } = useN8nTemplateCatalog({
        search: templateSearch,
        installableOnly: true,
        limit: 240,
    })

    const n8nOptions = useMemo(() => uniqueBy([
        ...liveApiApps.flatMap(app => (app.n8nTemplates || []).map(t => ({ value: t, label: t, pageUrl: null, downloadUrl: null, source: 'product_registry' }))),
        ...AGENT_AUTOMATION_PACKS.flatMap(pack => pack.templates.map(t => ({ value: String(t.id), label: `#${t.id} · ${t.name}`, pageUrl: t.pageUrl, downloadUrl: t.downloadUrl, source: pack.agentCodeName }))),
        ...n8nCatalogEntries.map(toN8nTemplateOption).filter(Boolean),
    ], item => item.value), [liveApiApps, n8nCatalogEntries])

    const templateLookup = useMemo(() => Object.fromEntries(n8nOptions.map(o => [o.value, o])), [n8nOptions])
    const defaultForm = { name: '', description: '', trigger: 'atlas_import', actions: [], connectorId: '', apiId: '', agentCodeName: '', workflowTemplate: '' }

    const [showForm, setShowForm] = useState(false)
    const [selectedWorkflowId, setSelectedWorkflowId] = useState(null)
    const [form, setForm] = useState(defaultForm)

    const selectedWorkflow = useMemo(() => workflows.find(w => w.id === selectedWorkflowId) || null, [selectedWorkflowId, workflows])
    const automationVaultAgents = useMemo(() => vaultAgents.filter(a => (a.capabilities || []).some(c => VAULT_AUTOMATION_CAPS.includes(c))).slice(0, 20), [vaultAgents])

    const toggleAction = (key) => {
        setForm(cur => {
            const actions = cur.actions.includes(key) ? cur.actions.filter(a => a !== key) : [...cur.actions, key]
            return { ...cur, actions, connectorId: actions.includes('run_connector') ? cur.connectorId : '', apiId: actions.includes('run_api') ? cur.apiId : '', agentCodeName: actions.includes('run_agent') ? cur.agentCodeName : '', workflowTemplate: actions.includes('launch_n8n') ? cur.workflowTemplate : '' }
        })
    }

    const addNewWorkflow = async () => {
        if (!form.name.trim()) return toast('Name required', 'warning')
        if (form.actions.length === 0) return toast('At least one action required', 'warning')
        if (form.actions.includes('run_connector') && !form.connectorId) return toast('Select a connector', 'warning')
        if (form.actions.includes('run_api') && !form.apiId) return toast('Select an API', 'warning')
        if (form.actions.includes('run_agent') && !form.agentCodeName) return toast('Select an agent', 'warning')
        if (form.actions.includes('launch_n8n') && !form.workflowTemplate) return toast('Select n8n template', 'warning')

        const selectedApi = liveApiApps.find(app => app.id === form.apiId) || null
        const selectedConnector = liveConnectorApps.find(app => app.connectorId === form.connectorId) || null
        const selectedTemplate = templateLookup[form.workflowTemplate] || null
        const trigger = getTriggerMeta(form.trigger)

        const wf = await addWorkflow({
            name: form.name.trim(), description: form.description || null, trigger_type: trigger.type,
            trigger_config: { key: trigger.key, label: trigger.label, connectorId: form.connectorId || null },
            metadata: { agent_code_name: form.agentCodeName || null, n8n_template_id: form.workflowTemplate || null },
            steps: form.actions.map((action, i) => ({
                id: `step-${i + 1}`, type: action,
                config: action === 'run_connector' ? {
                    connectorId: form.connectorId,
                    endpointName: selectedConnector?.endpointName || null,
                    params: selectedConnector?.sampleParams || {},
                    body: {},
                }
                    : action === 'run_api' ? { apiId: form.apiId, endpoint: selectedApi?.endpoint || null, label: selectedApi?.name || null, payload: selectedApi?.healthcheckPayload || {} }
                    : action === 'run_agent' ? { agentCodeName: form.agentCodeName, action: 'cycle' }
                    : action === 'launch_n8n' ? {
                        agentCodeName: form.agentCodeName || null,
                        workflowTemplate: form.workflowTemplate,
                        workflowTemplateLabel: selectedTemplate?.label || form.workflowTemplate,
                        workflowTemplateUrl: selectedTemplate?.pageUrl || null,
                        workflowTemplateDownloadUrl: selectedTemplate?.downloadUrl || null,
                        workflowTemplateSource: selectedTemplate?.source || null,
                        workflowTemplateActions: selectedTemplate?.actionKeys || [],
                        workflowTemplateSkills: selectedTemplate?.skillTags || [],
                        workflowTemplateModules: selectedTemplate?.moduleTargets || [],
                        workflowTemplateInstallTier: selectedTemplate?.installTier || null,
                    }
                    : {},
            })),
            is_active: false,
        })
        if (!wf) return toast('Workflow creation failed', 'warning')
        setForm(defaultForm); setShowForm(false); toast('Workflow created', 'success')
    }

    const selectWorkflow = async (wf) => { setSelectedWorkflowId(wf.id); await loadRuns(wf.id) }

    const openWorkflowDraft = (wf) => {
        const draftStep = (wf.steps || []).find(s => s?.config?.launch_url)
        if (!draftStep?.config?.launch_url) return toast('No linked channel found', 'warning')
        window.open(draftStep.config.launch_url, '_blank', 'noopener,noreferrer')
    }

    const executeWorkflow = async (wf, { sendLive = false } = {}) => {
        if (!wf?.id) return
        const result = await runWorkflow(wf.id, { sendLive, context: { workflow_name: wf.name } })
        if (result?.error) return toast(result.error, 'warning')
        await loadRuns(wf.id)
        toast(`Workflow executed: ${wf.name}`, 'success')
    }

    const seedAgentPack = (pack) => {
        setForm({ ...defaultForm, name: `${pack.label} loop`, description: pack.objective, trigger: pack.defaultTrigger, actions: pack.defaultActions, agentCodeName: pack.agentCodeName, workflowTemplate: pack.templates[0] ? String(pack.templates[0].id) : '' })
        setShowForm(true)
    }

    const statusColor = (status) => status === 'completed' ? 'var(--color-success)' : status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)'
    const selectedTemplateMeta = form.workflowTemplate ? templateLookup[form.workflowTemplate] || null : null

    return (
        <ModulePage
            title="Automation"
            subtitle="Event-driven workflows & n8n orchestration"
            actions={
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    <PlusIcon style={{ width: 16, height: 16 }} />
                    {showForm ? 'Close' : 'New workflow'}
                </button>
            }
        >
            <div className="lab-content">
                {/* KPIs */}
                <div className="kpi-strip kpi-strip-3">
                    <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">Active workflows</span><span className="mono text-lg font-bold" style={{ color: 'var(--color-success)' }}>{activeCount}</span></div>
                    <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">Total runs</span><span className="mono text-lg font-bold" style={{ color: 'var(--color-info)' }}>{totalRuns}</span></div>
                    <div className="kpi-strip-cell"><span className="mono text-xs text-tertiary">Total stored</span><span className="mono text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{workflows.length}</span></div>
                </div>

                {/* Builder */}
                {showForm && (
                    <div className="auto-form-panel">
                        <div className="form-grid">
                            <div className="form-field"><label className="form-label">Workflow name</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="form-field"><label className="form-label">Trigger</label>
                                <select className="form-input" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })}>
                                    {TRIGGERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="form-field" style={{ gridColumn: '1 / -1' }}><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                        </div>

                        <div><label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Actions</label>
                            <div className="auto-action-pills">
                                {ACTIONS.map(a => <button key={a.key} className={`auto-action-pill ${form.actions.includes(a.key) ? 'active' : ''}`} onClick={() => toggleAction(a.key)}>{a.label}</button>)}
                            </div>
                        </div>

                        {form.actions.includes('run_connector') && <div className="form-field"><label className="form-label">Connector</label><select className="form-input" value={form.connectorId} onChange={e => setForm({ ...form, connectorId: e.target.value })}><option value="">Select connector...</option>{liveConnectorApps.map(app => <option key={app.connectorId} value={app.connectorId}>{app.name}</option>)}</select></div>}
                        {form.actions.includes('run_api') && <div className="form-field"><label className="form-label">API</label><select className="form-input" value={form.apiId} onChange={e => setForm({ ...form, apiId: e.target.value })}><option value="">Select API...</option>{liveApiApps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}</select></div>}
                        {form.actions.includes('run_agent') && <div className="form-field"><label className="form-label">AI agent</label><select className="form-input" value={form.agentCodeName} onChange={e => setForm({ ...form, agentCodeName: e.target.value })}><option value="">Select agent...</option>{agentOptions.map(a => <option key={a} value={a}>{a}</option>)}</select></div>}
                        {form.actions.includes('launch_n8n') && (
                            <div className="form-field">
                                <label className="form-label">n8n template</label>
                                <input
                                    className="form-input"
                                    placeholder="Search 8k+ n8n workflows by name, action, skill..."
                                    value={templateSearch}
                                    onChange={e => setTemplateSearch(e.target.value)}
                                    style={{ marginBottom: 'var(--space-2)' }}
                                />
                                <select className="form-input" value={form.workflowTemplate} onChange={e => setForm({ ...form, workflowTemplate: e.target.value })}>
                                    <option value="">Select template...</option>
                                    {n8nOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <div className="mono text-xs text-tertiary" style={{ marginTop: 6 }}>
                                    Catalog source: {n8nCatalogSource} · matches: {n8nOptions.length} · installable: {n8nCatalogStats.installable || 0} {n8nCatalogLoading ? '· loading...' : ''}
                                </div>
                                {selectedTemplateMeta && (
                                    <div className="mono text-xs text-secondary" style={{ marginTop: 6 }}>
                                        Tier: {selectedTemplateMeta.installTier || 'n/a'}
                                        {selectedTemplateMeta?.actionKeys?.length > 0 ? ` · actions: ${selectedTemplateMeta.actionKeys.join(', ')}` : ''}
                                        {selectedTemplateMeta?.skillTags?.length > 0 ? ` · skills: ${selectedTemplateMeta.skillTags.slice(0, 6).join(', ')}` : ''}
                                    </div>
                                )}
                            </div>
                        )}

                        {form.trigger && form.actions.length > 0 && (
                            <div className="auto-sequence-preview">
                                <div className="mono text-xs text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>Sequence preview:</div>
                                <div className="auto-sequence-flow">
                                    <span className="badge" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>{getTriggerMeta(form.trigger).label}</span>
                                    {form.actions.map(a => <><span key={`arrow-${a}`} className="text-tertiary">→</span><span key={a} className="badge">{getActionMeta(a).label}</span></>)}
                                </div>
                            </div>
                        )}
                        <button className="btn btn-primary" onClick={addNewWorkflow}>Create workflow</button>
                    </div>
                )}

                {/* Templates + Agent Packs */}
                {!showForm && (
                    <div className="auto-split">
                        <div className="lab-panel">
                            <div className="lab-panel-header">Quick templates</div>
                            <div className="ct-section-body lab-col-layout">
                                {TEMPLATES.map(t => (
                                    <div key={t.name} className="auto-template-card" onClick={() => { setForm({ name: t.name, description: t.desc, trigger: t.trigger, actions: t.actions, connectorId: '', apiId: '', agentCodeName: '', workflowTemplate: '' }); setShowForm(true) }}>
                                        <div className="mono text-xs font-bold">{t.name}</div>
                                        <div className="mono text-xs text-tertiary" style={{ margin: '4px 0 8px' }}>{t.desc}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <span className="badge" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>{getTriggerMeta(t.trigger).label}</span>
                                            <span className="badge">{t.actions.length} actions</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lab-panel">
                            <div className="lab-panel-header">Agent automation packs</div>
                            <div className="auto-pack-grid">
                                {AGENT_AUTOMATION_PACKS.map(pack => (
                                    <div key={pack.agentCodeName} className="auto-pack-card">
                                        <div className="mono text-xs font-bold" style={{ color: 'var(--color-info)' }}>{pack.label}</div>
                                        <div className="mono text-xs text-tertiary" style={{ margin: '4px 0 12px', flex: 1 }}>{pack.objective}</div>
                                        <div className="auto-pack-tags">
                                            <span className="badge" style={{ color: 'var(--color-primary)' }}>Trigger: {pack.defaultTrigger}</span>
                                            {pack.defaultActions.map(a => <span key={a} className="badge">{a}</span>)}
                                        </div>
                                        <button className="btn btn-sm btn-ghost" onClick={() => seedAgentPack(pack)}>Use template</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Vault agents */}
                {!showForm && (
                    <div className="lab-panel">
                        <div className="lab-panel-header">
                            <span>Vault agents — automation compatible</span>
                            <span className="mono text-xs text-tertiary">{automationVaultAgents.length} agents</span>
                        </div>
                        {vaultLoading ? <ModuleSkeleton variant="table" rows={3} /> :
                            automationVaultAgents.length === 0 ? <div className="lab-panel-empty">No automation-compatible agents in vault</div> :
                            <div>{automationVaultAgents.map((agent, i) => (
                                <div key={agent.name || i} className="lab-log-row">
                                    <span className="mono text-xs font-bold" style={{ minWidth: 180 }}>{agent.name || ''}</span>
                                    <span className="badge" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>{agent.namespace || ''}</span>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                                        {(agent.capabilities || []).map(cap => <span key={cap} className="badge" style={{ color: VAULT_AUTOMATION_CAPS.includes(cap) ? 'var(--color-info)' : 'var(--text-tertiary)' }}>{cap}</span>)}
                                    </div>
                                </div>
                            ))}</div>
                        }
                    </div>
                )}

                {/* Workflows & Detail */}
                <div className="auto-wf-layout">
                    <div className="lab-panel">
                        <div className="lab-panel-header">Workflows</div>
                        {loading ? <ModuleSkeleton variant="table" rows={4} /> :
                            workflows.length === 0 ? <div className="lab-panel-empty">No workflows stored</div> :
                            <div>{workflows.map(wf => {
                                const trigger = getTriggerMeta(wf.trigger_config?.key || wf.trigger_type)
                                const steps = Array.isArray(wf.steps) ? wf.steps : []
                                const hasLaunch = steps.some(s => s?.config?.launch_url)
                                return (
                                    <div key={wf.id} className={`auto-wf-item ${selectedWorkflow?.id === wf.id ? 'selected' : ''}`} onClick={() => selectWorkflow(wf)}>
                                        <div className={`auto-wf-dot ${wf.is_active ? 'auto-wf-dot--active' : 'auto-wf-dot--inactive'}`} />
                                        <div style={{ flex: 1 }}>
                                            <div className="mono text-sm font-bold">{wf.name}</div>
                                            {wf.description && <div className="mono text-xs text-tertiary" style={{ marginTop: 2 }}>{wf.description}</div>}
                                            <div className="auto-wf-tags">
                                                <span className="badge" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>{trigger.label}</span>
                                                {steps.map(s => <span key={s.id || s.type} className="badge">{getActionMeta(s.type).label}</span>)}
                                                {hasLaunch && <span className="badge" style={{ color: 'var(--color-info)', borderColor: 'var(--color-info)' }}>Linked channel</span>}
                                            </div>
                                        </div>
                                        <div className="mono text-xs text-tertiary" style={{ alignSelf: 'flex-start' }}>{wf.run_count || 0} runs</div>
                                        <div className="auto-wf-actions">
                                            <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); executeWorkflow(wf) }} disabled={runningWorkflowId === wf.id}>{runningWorkflowId === wf.id ? 'Running...' : 'Run'}</button>
                                            <button className="btn btn-sm btn-ghost" style={{ color: wf.is_active ? 'var(--color-warning)' : 'var(--color-success)' }} onClick={e => { e.stopPropagation(); toggleWorkflow(wf.id) }}>{wf.is_active ? 'Pause' : 'Enable'}</button>
                                            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={e => { e.stopPropagation(); removeWorkflow(wf.id) }}>Del</button>
                                        </div>
                                    </div>
                                )
                            })}</div>
                        }
                    </div>

                    <div className="auto-detail-panel">
                        {!selectedWorkflow ? (
                            <div className="lab-panel-empty">Select a workflow to view details</div>
                        ) : (
                            <>
                                <div className="lab-panel-header">
                                    <span>Workflow details</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-sm btn-ghost" onClick={() => executeWorkflow(selectedWorkflow)} disabled={runningWorkflowId === selectedWorkflow.id}>Run</button>
                                        {workflowSupportsLiveSend(selectedWorkflow) && <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={() => executeWorkflow(selectedWorkflow, { sendLive: true })} disabled={runningWorkflowId === selectedWorkflow.id}>Send live</button>}
                                        {selectedWorkflow.steps?.some(s => s?.config?.launch_url) && <button className="btn btn-sm btn-ghost" onClick={() => openWorkflowDraft(selectedWorkflow)}>Open link</button>}
                                    </div>
                                </div>
                                <div className="ct-section-body lab-col-layout">
                                    <div>
                                        <div className="mono font-bold text-sm">{selectedWorkflow.name}</div>
                                        <div className="mono text-xs text-tertiary" style={{ marginTop: 4 }}>Last run: {formatRunDate(selectedWorkflow.last_run_at)}</div>
                                        {selectedWorkflow.description && <div className="mono text-xs text-secondary" style={{ marginTop: 'var(--space-2)' }}>{selectedWorkflow.description}</div>}
                                    </div>

                                    <div>
                                        <div className="mono text-xs text-tertiary" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4, marginBottom: 'var(--space-2)' }}>Execution steps</div>
                                        <div className="lab-col-layout">
                                            {(selectedWorkflow.steps || []).map(step => (
                                                <div key={step.id || step.type} className="auto-step-card">
                                                    <div className="mono text-xs font-bold">{getActionMeta(step.type).label}</div>
                                                    {step.config?.launch_url && <div className="mono text-xs" style={{ color: 'var(--color-info)' }}>Linked: secure open</div>}
                                                    {step.config?.connectorId && <div className="mono text-xs text-tertiary">Connector: {step.config.connectorId}</div>}
                                                    {step.config?.endpoint && <div className="mono text-xs text-tertiary">API: {step.config.label || step.config.endpoint}</div>}
                                                    {step.config?.agentCodeName && <div className="mono text-xs text-tertiary">Agent: {step.config.agentCodeName}</div>}
                                                    {step.config?.workflowTemplate && <div className="mono text-xs text-tertiary">Template: {step.config.workflowTemplateLabel || step.config.workflowTemplate}{step.config?.workflowTemplateUrl && <a href={step.config.workflowTemplateUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--color-primary)' }}>Docs</a>}</div>}
                                                    {Array.isArray(step.config?.workflowTemplateActions) && step.config.workflowTemplateActions.length > 0 && (
                                                        <div className="mono text-xs text-tertiary">Actions: {step.config.workflowTemplateActions.join(', ')}</div>
                                                    )}
                                                    {Array.isArray(step.config?.workflowTemplateSkills) && step.config.workflowTemplateSkills.length > 0 && (
                                                        <div className="mono text-xs text-tertiary">Skills: {step.config.workflowTemplateSkills.slice(0, 8).join(', ')}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mono text-xs text-tertiary" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4, marginBottom: 'var(--space-2)' }}>Run history</div>
                                        {runs.length === 0 ? <div className="mono text-xs text-tertiary">No runs yet</div> : (
                                            <div className="lab-col-layout" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                                {runs.map(run => (
                                                    <div key={run.id} className="auto-run-card">
                                                        <div className="auto-run-header">
                                                            <span className="badge" style={{ color: statusColor(run.status), borderColor: statusColor(run.status) }}>{run.status}</span>
                                                            <span className="mono text-xs text-tertiary">{formatRunDate(run.started_at)}</span>
                                                        </div>
                                                        {Array.isArray(run.result?.steps) && run.result.steps.length > 0 && (
                                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                                                {run.result.steps.map(s => <span key={s.id || s.type} className="mono text-xs text-secondary">[{s.type}: {s.status || 'ok'}]</span>)}
                                                            </div>
                                                        )}
                                                        {run.error && <div className="mono text-xs" style={{ color: 'var(--color-danger)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4, marginTop: 4 }}>Error: {run.error}</div>}
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
        </ModulePage>
    )
}

export default Automation
