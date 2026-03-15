// ═══════════════════════════════════════════════════
// OCULOPS — Agents Hub v11.0
// Multi-Agent Orchestration Dashboard
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'
import { useAgents } from '../../hooks/useAgents'
import { useAgentStudies } from '../../hooks/useAgentStudies'
import { useAgentVault, ROLE_CAPABILITY_MAP } from '../../hooks/useAgentVault'
import { useAgentState } from '../../hooks/useAgentState'
import { useGoals } from '../../hooks/useGoals'
import { useOutreachQueue } from '../../hooks/useOutreachQueue'
import { useApprovals } from '../../hooks/useApprovals'
import { AGENT_AUTOMATION_PACKS } from '../../data/agentAutomationPacks'
import {
  CpuChipIcon,
  PlayIcon,
  QueueListIcon,
  DocumentTextIcon,
  BookOpenIcon,
  CogIcon,
  ArchiveBoxIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import './Agents.css'

const AGENT_COLORS = { cortex: '#6366f1', atlas: '#6366f1', hunter: '#f59e0b', oracle: '#8b5cf6', sentinel: '#ef4444', forge: '#10b981', strategist: '#3b82f6', scribe: '#ec4899', herald: '#facc15' }
const INITIAL_STUDY_FORM = { agentCodeName: 'cortex', title: '', summary: '', contentMarkdown: '', sendTelegram: true }
const INITIAL_TELEGRAM_FORM = { label: 'Primary Telegram', chat_id: '', thread_id: '', notify_manual: true, notify_automated: true }

const TAB_CONFIG = [
  { id: 'network', label: 'Network', icon: CpuChipIcon },
  { id: 'queue', label: 'Queue', icon: QueueListIcon },
  { id: 'outreach', label: 'Outreach', icon: PaperAirplaneIcon },
  { id: 'approvals', label: 'Approvals', icon: CheckCircleIcon },
  { id: 'logs', label: 'Logs', icon: DocumentTextIcon },
  { id: 'studies', label: 'Studies', icon: BookOpenIcon },
  { id: 'automation', label: 'Automation', icon: CogIcon },
  { id: 'vault', label: 'Vault', icon: ArchiveBoxIcon },
]
const TAB_IDS = new Set(TAB_CONFIG.map(tab => tab.id))

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  if (!ms) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function outreachBadge(status) {
  if (status === 'approved' || status === 'sent') return 'success'
  if (status === 'skipped') return 'danger'
  return 'warning'
}

function approvalBadge(status) {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'expired') return 'danger'
  return 'warning'
}

function Agents() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useAppStore()
  const { agents, tasks, logs, stats, triggerAgent, runCortexCycle } = useAgents()
  const { studies, telegramTarget, loading: studiesLoading, busy: studiesBusy, postStudy, resendStudy, saveTelegramTarget } = useAgentStudies()
  const { items: outreachItems, stats: outreachStats, statusFilter: outreachFilter, setStatusFilter: setOutreachFilter, loading: outreachLoading, error: outreachError, busyKey: outreachBusyKey, approveItem, sendItem, skipItem, batchApprove, reload: reloadOutreach } = useOutreachQueue()
  const { items: approvalItems, stats: approvalStats, statusFilter: approvalFilter, setStatusFilter: setApprovalFilter, loading: approvalLoading, error: approvalError, busyKey: approvalBusyKey, approveRequest, rejectRequest, reload: reloadApprovals } = useApprovals()
  const { filteredAgents: vaultAgents, namespaces: vaultNamespaces, loading: vaultLoading, error: vaultError, filters: vaultFilters, setNamespace: setVaultNamespace, setSearch: setVaultSearch, setRole: setVaultRole, suggestRole, toggleActive: toggleVaultAgent, runAgent: runVaultAgent, runningAgent: vaultRunning, totalAgents: vaultTotal, activeCount: vaultActive, } = useAgentVault()
  const { runningAgents } = useAgentState()
  const { goals } = useGoals()

  const [triggering, setTriggering] = useState(null)
  const tabFromSearch = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const requestedTab = (params.get('tab') || '').trim().toLowerCase()
    return TAB_IDS.has(requestedTab) ? requestedTab : null
  }, [location.search])
  const approvalFocusId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const requestedApproval = (params.get('approval') || '').trim()
    return requestedApproval || null
  }, [location.search])
  const [activeTab, setActiveTab] = useState(tabFromSearch || 'network')
  const [vaultRunModal, setVaultRunModal] = useState(null) // { code_name, display_name }
  const [vaultGoal, setVaultGoal] = useState('')
  const [vaultResult, setVaultResult] = useState(null)
  const [studyForm, setStudyForm] = useState(INITIAL_STUDY_FORM)
  const [telegramForm, setTelegramForm] = useState(INITIAL_TELEGRAM_FORM)

  useEffect(() => {
    if (!tabFromSearch || tabFromSearch === activeTab) return
    setActiveTab(tabFromSearch)
  }, [tabFromSearch, activeTab])

  useEffect(() => {
    if (!telegramTarget) return
    setTelegramForm({
      label: telegramTarget.label || 'Primary Telegram', chat_id: telegramTarget.chat_id || '',
      thread_id: telegramTarget.thread_id || '', notify_manual: telegramTarget.notify_manual !== false,
      notify_automated: telegramTarget.notify_automated !== false,
    })
  }, [telegramTarget])

  const handleTrigger = useCallback(async (codeName, action) => {
    setTriggering(codeName)
    const result = await triggerAgent(codeName, action)
    setTriggering(null)
    if (result?.error) toast(result.error, 'warning')
    else toast(`${codeName} triggered`, 'success')
  }, [toast, triggerAgent])

  const handleCortexCycle = useCallback(async () => {
    setTriggering('cortex')
    const result = await runCortexCycle()
    setTriggering(null)
    if (result?.error) toast(result.error, 'warning')
    else toast('Cortex orchestration started', 'success')
  }, [runCortexCycle, toast])

  const handlePostStudy = useCallback(async () => {
    if (!studyForm.title.trim()) { toast('Study title is required', 'warning'); return }
    const summary = studyForm.summary.trim() || studyForm.contentMarkdown.trim()
    if (!summary) { toast('Add a summary or body before posting', 'warning'); return }
    const highlights = summary.split(/\n|\./).map(i => i.trim()).filter(Boolean).slice(0, 4)
    try {
      const result = await postStudy({ agent_code_name: studyForm.agentCodeName, title: studyForm.title.trim(), summary, content_markdown: studyForm.contentMarkdown.trim() || summary, highlights, study_type: 'manual', send_telegram: studyForm.sendTelegram })
      setStudyForm(cur => ({ ...INITIAL_STUDY_FORM, agentCodeName: cur.agentCodeName }))
      toast(result?.delivery?.delivered ? 'Study posted and sent to Telegram' : 'Study created', 'success')
    } catch (e) { toast(e.message, 'warning') }
  }, [postStudy, studyForm, toast])

  const handleSaveTelegram = useCallback(async () => {
    if (!telegramForm.chat_id.trim()) { toast('Telegram chat_id is required', 'warning'); return }
    await saveTelegramTarget({ label: telegramForm.label.trim() || 'Primary Telegram', chat_id: telegramForm.chat_id.trim(), thread_id: telegramForm.thread_id.trim() || null, notify_manual: telegramForm.notify_manual, notify_automated: telegramForm.notify_automated, is_active: true, type: 'telegram' })
    toast('Telegram link saved', 'success')
  }, [saveTelegramTarget, telegramForm, toast])

  const handleResendStudy = useCallback(async (studyId) => {
    try {
      const result = await resendStudy(studyId)
      toast(result?.delivery?.delivered ? 'Delivered' : 'Delivery blocked', result?.delivery?.delivered ? 'success' : 'warning')
    } catch (e) { toast(e.message, 'warning') }
  }, [resendStudy, toast])

  const handleApproveOutreach = useCallback(async (id) => {
    const result = await approveItem(id)
    if (result?.error) toast(result.error, 'warning')
    else if (result?.approval_required) toast('Outreach approved. Approval request created.', 'warning')
    else toast('Outreach approved', 'success')
  }, [approveItem, toast])

  const handleSendOutreach = useCallback(async (id) => {
    const result = await sendItem(id)
    if (result?.error) toast(result.error, 'warning')
    else if (result?.requires_approval) toast('Approval required before send. Check Approvals tab.', 'warning')
    else if (result?.sent) toast('Outreach sent', 'success')
    else toast('Outreach queued for approval', 'warning')
  }, [sendItem, toast])

  const handleSkipOutreach = useCallback(async (id) => {
    const result = await skipItem(id)
    if (result?.error) toast(result.error, 'warning')
    else toast('Outreach skipped', 'success')
  }, [skipItem, toast])

  const handleBatchApprove = useCallback(async () => {
    const result = await batchApprove()
    if (result?.error) toast(result.error, 'warning')
    else toast(`Approved ${result?.approved_count || 0} outreach items`, 'success')
  }, [batchApprove, toast])

  const handleApproveRequest = useCallback(async (id) => {
    const result = await approveRequest(id)
    if (result?.error) toast(result.error, 'warning')
    else if (result?.sent) toast('Approval accepted and outreach sent', 'success')
    else toast('Approval accepted', 'success')
  }, [approveRequest, toast])

  const handleRejectRequest = useCallback(async (id) => {
    const result = await rejectRequest(id)
    if (result?.error) toast(result.error, 'warning')
    else toast('Approval rejected', 'warning')
  }, [rejectRequest, toast])

  const setTabAndSearch = useCallback((nextTab) => {
    setActiveTab(nextTab)
    const params = new URLSearchParams(location.search)
    params.set('tab', nextTab)
    navigate(`/agents?${params.toString()}`, { replace: true })
  }, [location.search, navigate])

  const cortex = agents.find(a => a.code_name === 'cortex')
  const subAgents = agents.filter(a => a.code_name !== 'cortex').sort((a, b) => a.code_name.localeCompare(b.code_name))
  const agentOptions = useMemo(() => {
    const m = new Map()
    AGENT_AUTOMATION_PACKS.forEach(p => m.set(p.agentCodeName, { value: p.agentCodeName, label: p.label }))
    agents.forEach(a => { if (!m.has(a.code_name)) m.set(a.code_name, { value: a.code_name, label: a.name }) })
    return [...m.values()]
  }, [agents])

  const recentStudies = studies.slice(0, 24)
  const deliveryStats = useMemo(() => ({ total: studies.length, sent: studies.filter(s => s.delivery_status === 'sent').length, failed: studies.filter(s => s.delivery_status === 'failed').length }), [studies])
  const visibleApprovalItems = useMemo(() => {
    if (!approvalFocusId) return approvalItems
    const highlighted = approvalItems.find(item => item.id === approvalFocusId)
    if (!highlighted) return approvalItems
    return [highlighted, ...approvalItems.filter(item => item.id !== approvalFocusId)]
  }, [approvalItems, approvalFocusId])

  return (
    <div className="module-page ag fade-in">
      {/* Header — Stitch V2 */}
      <div className="module-page-header">
        <div>
          <h1 className="module-page-title">AI Agents</h1>
          <p className="module-page-subtitle">Sophisticated multi-agent orchestration center.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleCortexCycle} disabled={triggering === 'cortex'}>
          <PlayIcon width={14} height={14} /> {triggering === 'cortex' ? 'Running...' : 'Run Cortex Cycle'}
        </button>
      </div>

      {/* Tabs — Stitch V2 style */}
      <div className="crm-tabs">
        {TAB_CONFIG.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} className={`crm-tab${activeTab === t.id ? ' crm-tab-active' : ''}`} onClick={() => setTabAndSearch(t.id)}>
              <Icon width={16} height={16} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip kpi-strip-4" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Agents</span></div><div className="kpi-value">{stats.total}</div></div>
        <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Running now</span></div><div className="kpi-value" style={{ color: runningAgents.length > 0 ? 'var(--color-warning)' : 'var(--text-tertiary)' }}>{runningAgents.length}</div></div>
        <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Total cycles</span></div><div className="kpi-value">{stats.totalRuns}</div></div>
        <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Studies sent</span></div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{deliveryStats.sent}</div></div>
      </div>

      {/* Tab Content */}
      <div className="ag-content">
        {activeTab === 'network' && (
          <div className="ag-network">
            {/* Cortex Master — Stitch V2 Premium Card */}
            {cortex && (
              <div className="ag-cortex-card">
                <div className="ag-cortex-top">
                  <div className="ag-cortex-info">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span className="ag-cortex-name">CORTEX</span>
                        <span className={`ag-status-pill ${cortex.status === 'online' ? 'online' : cortex.status === 'running' ? 'running' : 'idle'}`}>
                          <span className="pulse-dot" />
                          {cortex.status === 'online' ? 'Online' : cortex.status === 'running' ? 'Running' : 'Idle'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCortexCycle} disabled={triggering === 'cortex'}>
                    <span>{triggering === 'cortex' ? 'Running...' : 'Ver Mensajes'}</span>
                    <span style={{ fontSize: 14 }}>→</span>
                  </button>
                </div>
                <div className="ag-cortex-stats">
                  <span>
                    <span className="ag-cortex-stat-label">Total Runs</span>
                    <span className="ag-cortex-stat-value">{(cortex.total_runs || 0).toLocaleString()}</span>
                  </span>
                  <span className="ag-cortex-divider" />
                  <span>
                    <span className="ag-cortex-stat-label">Avg Time</span>
                    <span className="ag-cortex-stat-value">{stats.avgDuration ? `${(stats.avgDuration / 1000).toFixed(1)}s` : '—'}</span>
                  </span>
                  <span className="ag-cortex-divider" />
                  <span>
                    <span className="ag-cortex-stat-label">Last Run</span>
                    <span className="ag-cortex-stat-value">{cortex.last_run_at ? formatTime(cortex.last_run_at) : '—'}</span>
                  </span>
                </div>
                <div className="ag-cortex-actions">
                  {['System Analytics', 'Routing Diagnostics', 'Network Logs', 'Thread Tracing', 'Task Management', 'Security Audit'].map(label => (
                    <button key={label} className="ag-cortex-action-btn" onClick={() => setTabAndSearch(label === 'Network Logs' ? 'logs' : label === 'Task Management' ? 'queue' : 'network')}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="ag-cortex-progress">
                  <div className="ag-cortex-progress-fill" style={{ width: `${Math.min(100, (stats.online / Math.max(stats.total, 1)) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Agent Grid — Stitch V2 Premium Cards */}
            <div className="ag-grid">
              {subAgents.map(ag => {
                const statusClass = ag.status === 'online' ? 'online' : ag.status === 'running' ? 'running' : 'idle'
                const statusLabel = ag.status === 'online' ? 'Online' : ag.status === 'running' ? 'Running' : 'Idle'
                return (
                  <div key={ag.id} className="ag-card">
                    <div className="ag-card-header">
                      <span className="ag-card-codename">{ag.code_name}</span>
                      <span className={`ag-status-pill ${statusClass}`}>
                        {statusClass === 'online' && <span className="pulse-dot" />}
                        {statusLabel}
                      </span>
                    </div>
                    <div className="ag-card-body">
                      <div className="ag-card-caps">
                        {(ag.capabilities || []).slice(0, 3).map(cap => (
                          <span key={cap} className="badge badge-default">{cap.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                      <div className="ag-card-desc">{ag.description}</div>
                      <button
                        className="ag-card-action-link"
                        onClick={() => handleTrigger(ag.code_name, 'cycle')}
                        disabled={triggering === ag.code_name}
                      >
                        {triggering === ag.code_name ? 'RUNNING...' : 'OPERATIONAL LOGIC'}
                        <span style={{ fontSize: 14 }}>→</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Blocked goal steps — simulation gates */}
            {(() => {
              const blocked = (goals || []).flatMap(g =>
                (g.goal_steps || []).filter(s => s.status === 'waiting_approval' || s.status === 'failed')
                  .map(s => ({ ...s, goalTitle: g.title }))
              )
              if (blocked.length === 0) return null
              return (
                <div className="ct-section" style={{ borderColor: 'var(--color-warning)' }}>
                  <div className="ct-section-header">
                    <span className="ct-section-title" style={{ color: 'var(--color-warning)' }}>Blocked steps</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{blocked.length} need attention</span>
                  </div>
                  <div className="ct-section-body">
                    {blocked.map(step => {
                      const simStatus = step.input?.pre_execution_simulation_status || step.output?.pre_execution_simulation_status
                      const recommended = step.input?.recommended_action || step.output?.recommended_action
                      return (
                        <div key={step.id} className="ag-log-row" style={{ borderLeft: `2px solid ${step.status === 'waiting_approval' ? 'var(--color-warning)' : 'var(--color-danger)'}` }}>
                          <span className="ag-log-agent" style={{ color: AGENT_COLORS[step.agent_code_name] || 'var(--accent-primary)' }}>{step.agent_code_name || step.step_type}</span>
                          <span className="ag-log-text">
                            {step.title}
                            {simStatus && <span className="badge badge-default" style={{ marginLeft: 6 }}>sim: {simStatus}</span>}
                            {recommended && <span style={{ marginLeft: 6, color: 'var(--color-info)', fontSize: 'var(--text-xs)' }}>{recommended}</span>}
                          </span>
                          <span className={`badge badge-${step.status === 'waiting_approval' ? 'warning' : 'danger'}`}>
                            {step.status === 'waiting_approval' ? 'Simulation blocked' : step.status}
                          </span>
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            {step.status === 'waiting_approval' && (
                              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/agents?tab=approvals')}>Approve</button>
                            )}
                            {step.pipeline_run_id && (
                              <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/control-tower?corr=${step.pipeline_run_id}`)}>Trace</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            <div className="ct-section">
              <div className="ct-section-header"><span className="ct-section-title">Task queue</span><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{tasks.length} tasks</span></div>
              <div className="ct-section-body">
                {tasks.slice(0, 50).map(t => (
                  <div key={t.id} className="ag-log-row">
                    <span className="ag-log-agent" style={{ color: AGENT_COLORS[t.agent_code_name] || 'var(--accent-primary)' }}>{t.agent_code_name}</span>
                    <span className="ag-log-text">{t.title || t.type}</span>
                    <span className={`badge badge-${t.status === 'completed' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}`}>{t.status}</span>
                  </div>
                ))}
                {tasks.length === 0 && <div className="crm-table-empty">No tasks in queue</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outreach' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="kpi-strip kpi-strip-4">
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Staged</span></div><div className="kpi-value">{outreachStats.staged || 0}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Approved</span></div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{outreachStats.approved || 0}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Sent</span></div><div className="kpi-value">{outreachStats.sent || 0}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Replied</span></div><div className="kpi-value">{outreachStats.replied || 0}</div></div>
            </div>

            <div className="ag-status-tabs">
              {['staged', 'approved', 'sent', 'replied', 'all'].map((status) => (
                <button
                  key={status}
                  className={`crm-tab${outreachFilter === status ? ' crm-tab-active' : ''}`}
                  onClick={() => setOutreachFilter(status)}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="ct-section">
              <div className="ct-section-header">
                <span className="ct-section-title">Outreach queue</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={reloadOutreach} disabled={outreachLoading}>Refresh</button>
                  <button className="btn btn-primary btn-sm" onClick={handleBatchApprove} disabled={outreachBusyKey === 'batch' || !outreachStats.staged}>
                    {outreachBusyKey === 'batch' ? 'Approving...' : 'Approve staged'}
                  </button>
                </div>
              </div>
              <div className="ct-section-body">
                {outreachError && <div className="ag-vault-error" style={{ marginBottom: 'var(--space-3)' }}>{outreachError}</div>}
                {outreachLoading ? <div className="crm-table-empty">Loading outreach queue...</div> :
                  outreachItems.length === 0 ? <div className="crm-table-empty">No outreach items for {outreachFilter}</div> :
                    <div className="ag-outreach-list">
                      {outreachItems.map((item) => {
                        const preview = stripHtml(item.html_body).slice(0, 220)
                        const score = item.prospector_leads?.ai_score
                        const dealValue = item.prospector_leads?.estimated_deal_value
                        return (
                          <div key={item.id} className="ag-outreach-card">
                            <div className="ag-outreach-header">
                              <div>
                                <div className="ag-outreach-recipient">{item.recipient_name || 'Unknown recipient'}</div>
                                <div className="ag-outreach-email">{item.recipient_email}</div>
                              </div>
                              <span className={`badge badge-${outreachBadge(item.status)}`}>{item.status}</span>
                            </div>

                            <div className="ag-outreach-subject">{item.subject}</div>
                            <div className="ag-outreach-preview">{preview}{preview.length >= 220 ? '…' : ''}</div>

                            <div className="ag-outreach-meta">
                              <span className="badge badge-default">{item.niche || item.prospector_leads?.category || 'general'}</span>
                              <span className="badge badge-default">Score: {score ?? '—'}</span>
                              <span className="badge badge-default">Deal: {formatCurrency(dealValue)}</span>
                              <span className="badge badge-default">Created: {formatTime(item.created_at)}</span>
                            </div>

                            <div className="ag-outreach-actions">
                              {item.status === 'staged' && (
                                <>
                                  <button className="btn btn-primary btn-sm" onClick={() => handleApproveOutreach(item.id)} disabled={outreachBusyKey === `approve:${item.id}`}>
                                    {outreachBusyKey === `approve:${item.id}` ? 'Approving...' : 'Approve'}
                                  </button>
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleSkipOutreach(item.id)} disabled={outreachBusyKey === `skip:${item.id}`}>
                                    {outreachBusyKey === `skip:${item.id}` ? 'Skipping...' : 'Skip'}
                                  </button>
                                </>
                              )}
                              {item.status === 'approved' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleSendOutreach(item.id)} disabled={outreachBusyKey === `send:${item.id}`}>
                                  {outreachBusyKey === `send:${item.id}` ? 'Sending...' : 'Send now'}
                                </button>
                              )}
                              {/* AG1-P0.4: One-click inspect from outreach */}
                              {item.correlation_id && (
                                <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/control-tower?corr=${encodeURIComponent(item.correlation_id)}`)}>
                                  Trace
                                </button>
                              )}
                              {item.sent_at && <span className="ag-outreach-timestamp">Sent {formatTime(item.sent_at)}</span>}
                              {item.replied_at && <span className="ag-outreach-timestamp">Reply {formatTime(item.replied_at)}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                }
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="kpi-strip kpi-strip-4">
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Pending</span></div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{approvalStats.pending || 0}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Approved</span></div><div className="kpi-value" style={{ color: 'var(--color-success)' }}>{approvalStats.approved || 0}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Rejected</span></div><div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{approvalStats.rejected || 0}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Expired</span></div><div className="kpi-value">{approvalStats.expired || 0}</div></div>
            </div>

            <div className="ag-status-tabs">
              {['pending', 'approved', 'rejected', 'expired', 'all'].map((status) => (
                <button
                  key={status}
                  className={`crm-tab${approvalFilter === status ? ' crm-tab-active' : ''}`}
                  onClick={() => setApprovalFilter(status)}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="ct-section">
              <div className="ct-section-header">
                <span className="ct-section-title">Approval requests</span>
                <button className="btn btn-ghost btn-sm" onClick={reloadApprovals} disabled={approvalLoading}>Refresh</button>
              </div>
              <div className="ct-section-body">
                {approvalError && <div className="ag-vault-error" style={{ marginBottom: 'var(--space-3)' }}>{approvalError}</div>}
                {approvalLoading ? <div className="crm-table-empty">Loading approvals...</div> :
                  approvalItems.length === 0 ? <div className="crm-table-empty">No approval requests for {approvalFilter}</div> :
                    <div className="ag-outreach-list">
                      {visibleApprovalItems.map((item) => {
                        const payload = item.payload || {}
                        const preview = String(payload.preview || '').trim()
                        const recipient = payload.recipient_name || payload.recipient_email || 'Unknown recipient'
                        const channel = payload.channel || 'email'
                        return (
                          <div
                            key={item.id}
                            className="ag-outreach-card"
                            style={item.id === approvalFocusId
                              ? { borderColor: 'var(--accent-primary)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent-primary) 35%, transparent)' }
                              : undefined}
                          >
                            <div className="ag-outreach-header">
                              <div>
                                <div className="ag-outreach-recipient">{recipient}</div>
                                <div className="ag-outreach-email">{payload.recipient_email || '—'}</div>
                              </div>
                              <span className={`badge badge-${approvalBadge(item.status)}`}>{item.status}</span>
                            </div>

                            <div className="ag-outreach-subject">{payload.subject || 'No subject'}</div>
                            {preview && <div className="ag-outreach-preview">{preview}{preview.length >= 300 ? '…' : ''}</div>}

                            <div className="ag-outreach-meta">
                              <span className="badge badge-default">Skill: {item.skill}</span>
                              <span className="badge badge-default">Channel: {channel}</span>
                              <span className="badge badge-default">Urgency: {item.urgency || 'medium'}</span>
                              {payload.outreach_queue_id && <span className="badge badge-default">Queue: {payload.outreach_queue_id}</span>}
                            </div>

                            {/* AG1-P0.3/P0.4: Run-inspection quick actions */}
                            <div className="ag-outreach-actions">
                              {item.status === 'pending' && (
                                <>
                                  <button className="btn btn-primary btn-sm" onClick={() => handleApproveRequest(item.id)} disabled={approvalBusyKey === `approve:${item.id}`}>
                                    {approvalBusyKey === `approve:${item.id}` ? 'Approving...' : 'Approve & Send'}
                                  </button>
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleRejectRequest(item.id)} disabled={approvalBusyKey === `reject:${item.id}`}>
                                    {approvalBusyKey === `reject:${item.id}` ? 'Rejecting...' : 'Reject'}
                                  </button>
                                </>
                              )}
                              {(payload.correlation_id || payload.correlationId) && (
                                <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/control-tower?corr=${encodeURIComponent(payload.correlation_id || payload.correlationId)}`)}>
                                  Trace
                                </button>
                              )}
                              {(payload.correlation_id || payload.correlationId) && (
                                <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/messaging?correlation=${encodeURIComponent(payload.correlation_id || payload.correlationId)}`)}>
                                  Conversation
                                </button>
                              )}
                              {item.user_comment && <span className="ag-outreach-timestamp">Comment: {item.user_comment}</span>}
                              {item.approved_by && <span className="ag-outreach-timestamp">By {item.approved_by}</span>}
                              <span className="ag-outreach-timestamp">Created {formatTime(item.created_at)}</span>
                              <span className="ag-outreach-timestamp">Expires {formatTime(item.expires_at)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                }
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="ct-section">
            <div className="ct-section-header"><span className="ct-section-title">Activity logs</span></div>
            <div className="ct-section-body">
              {logs.slice(0, 50).map(log => (
                <div key={log.id} className="ag-log-row">
                  <span className="ag-log-time">{formatTime(log.created_at)}</span>
                  <span className="ag-log-agent" style={{ color: AGENT_COLORS[log.agent_code_name] || 'var(--accent-primary)' }}>{log.agent_code_name}</span>
                  <span className={`ag-log-text${log.error ? ' ag-log-error' : ''}`}>{log.action}{log.error ? ` — ${log.error}` : ''}</span>
                  <span className="ag-log-duration">{formatDuration(log.duration_ms)}</span>
                  {log.correlation_id && (
                    <button className="btn btn-ghost btn-xs" style={{ flexShrink: 0 }} onClick={() => navigate(`/control-tower?corr=${encodeURIComponent(log.correlation_id)}`)}>
                      Trace
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'studies' && (
          <div className="ag-studies-layout">
            {/* Left: Compose */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="ct-section">
                <div className="ct-section-header"><span className="ct-section-title">Compose study</span></div>
                <div className="ct-section-body">
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-field">
                      <label className="form-label">Agent</label>
                      <select className="form-input" value={studyForm.agentCodeName} onChange={e => setStudyForm({ ...studyForm, agentCodeName: e.target.value })}>
                        {agentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Title</label>
                      <input className="form-input" value={studyForm.title} onChange={e => setStudyForm({ ...studyForm, title: e.target.value })} placeholder="Study title..." />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Summary</label>
                      <textarea className="form-input" rows={2} value={studyForm.summary} onChange={e => setStudyForm({ ...studyForm, summary: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Content (markdown)</label>
                      <textarea className="form-input" rows={4} value={studyForm.contentMarkdown} onChange={e => setStudyForm({ ...studyForm, contentMarkdown: e.target.value })} />
                    </div>
                    <label className="ag-checkbox">
                      <input type="checkbox" checked={studyForm.sendTelegram} onChange={e => setStudyForm({ ...studyForm, sendTelegram: e.target.checked })} />
                      Send to Telegram
                    </label>
                    <button className="btn btn-primary btn-sm" onClick={handlePostStudy} disabled={studiesBusy === 'study'}>
                      <PaperAirplaneIcon width={14} height={14} /> {studiesBusy === 'study' ? 'Sending...' : 'Post study'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="ct-section">
                <div className="ct-section-header"><span className="ct-section-title">Telegram relay</span></div>
                <div className="ct-section-body">
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-field"><label className="form-label">Label</label><input className="form-input" value={telegramForm.label} onChange={e => setTelegramForm({ ...telegramForm, label: e.target.value })} /></div>
                    <div className="form-field"><label className="form-label">Chat ID</label><input className="form-input" value={telegramForm.chat_id} onChange={e => setTelegramForm({ ...telegramForm, chat_id: e.target.value })} /></div>
                    <div className="form-field"><label className="form-label">Thread ID (optional)</label><input className="form-input" value={telegramForm.thread_id} onChange={e => setTelegramForm({ ...telegramForm, thread_id: e.target.value })} /></div>
                    <label className="ag-checkbox"><input type="checkbox" checked={telegramForm.notify_manual} onChange={e => setTelegramForm({ ...telegramForm, notify_manual: e.target.checked })} /> Manual notifications</label>
                    <label className="ag-checkbox"><input type="checkbox" checked={telegramForm.notify_automated} onChange={e => setTelegramForm({ ...telegramForm, notify_automated: e.target.checked })} /> Automated notifications</label>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveTelegram} disabled={studiesBusy === 'target'}>{studiesBusy === 'target' ? 'Saving...' : 'Save relay'}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Recent Studies */}
            <div className="ct-section" style={{ minHeight: 0 }}>
              <div className="ct-section-header"><span className="ct-section-title">Recent studies</span><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{recentStudies.length} archived</span></div>
              <div className="ag-studies-list">
                {studiesLoading ? <div className="crm-table-empty">Loading...</div> :
                  recentStudies.length === 0 ? <div className="crm-table-empty">No studies yet</div> :
                    recentStudies.map(s => (
                      <div key={s.id} className="ag-study-card">
                        <div className="ag-study-header">
                          <div>
                            <div className="ag-study-title">
                              <span style={{ color: AGENT_COLORS[s.agent_code_name] || 'var(--accent-primary)' }}>[{s.agent_code_name}]</span> {s.title}
                            </div>
                            <div className="ag-study-meta">{s.source} · {formatTime(s.created_at)}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {s.delivery_status === 'sent' ? <CheckCircleIcon width={16} height={16} style={{ color: 'var(--color-success)' }} /> :
                              s.delivery_status === 'failed' ? <ExclamationTriangleIcon width={16} height={16} style={{ color: 'var(--color-danger)' }} /> :
                                <ClockIcon width={16} height={16} style={{ color: 'var(--text-tertiary)' }} />}
                            {s.delivery_status !== 'sent' && (
                              <button className="btn btn-ghost btn-xs" onClick={() => handleResendStudy(s.id)} disabled={studiesBusy === `resend:${s.id}`}>
                                <ArrowPathIcon width={12} height={12} /> Resend
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="ag-study-summary">{s.summary}</div>
                        {Array.isArray(s.highlights) && s.highlights.length > 0 && (
                          <div className="ag-study-highlights">
                            {s.highlights.slice(0, 3).map(h => <span key={h} className="badge badge-default">{h.slice(0, 40)}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="ag-grid">
            {AGENT_AUTOMATION_PACKS.map(pack => (
              <div key={pack.agentCodeName} className="ag-card">
                <div className="ag-card-header">
                  <span className="ag-card-codename" style={{ color: AGENT_COLORS[pack.agentCodeName] || 'var(--accent-primary)' }}>{pack.label}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>{pack.templates.length} templates</span>
                </div>
                <div className="ag-card-body">
                  <div className="ag-card-desc">{pack.objective}</div>
                  <div className="ag-automation-templates">
                    {pack.templates.map(tmp => (
                      <div key={tmp.id} className="ag-template-row">
                        <div><div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)' }}>{tmp.name}</div></div>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <a href={tmp.pageUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs">Docs</a>
                          <a href={tmp.downloadUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs" style={{ color: 'var(--accent-primary)' }}>JSON</a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={() => handleTrigger(pack.agentCodeName, 'cycle')} disabled={triggering === pack.agentCodeName}>
                    {triggering === pack.agentCodeName ? 'Running...' : `Run ${pack.agentCodeName}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vault' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Vault KPIs */}
            <div className="kpi-strip kpi-strip-4">
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Total</span></div><div className="kpi-value">{vaultTotal}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Active</span></div><div className="kpi-value">{vaultActive}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Namespaces</span></div><div className="kpi-value">{vaultNamespaces.length}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Filtered</span></div><div className="kpi-value">{vaultAgents.length}</div></div>
            </div>

            {/* Vault Filters */}
            <div className="ag-vault-filters">
              <div className="crm-search-field" style={{ maxWidth: 240 }}>
                <MagnifyingGlassIcon width={16} height={16} />
                <input className="crm-search-input" placeholder="Search agents..." value={vaultFilters.search} onChange={e => setVaultSearch(e.target.value)} />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={vaultFilters.namespace} onChange={e => setVaultNamespace(e.target.value)}>
                <option value="all">All namespaces</option>
                {vaultNamespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={vaultFilters.role} onChange={e => setVaultRole(e.target.value)}>
                <option value="all">All roles</option>
                {Object.keys(ROLE_CAPABILITY_MAP).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Vault Grid */}
            {vaultLoading ? <div className="crm-table-empty">Loading vault agents from Supabase...</div> :
              vaultError ? <div className="ag-vault-error">{vaultError}</div> :
                <div className="ag-grid">
                  {vaultAgents.map(va => {
                    const role = suggestRole(va)
                    const isRunning = vaultRunning === va.code_name
                    return (
                      <div key={va.code_name} className="ag-card" style={{ opacity: va.is_active ? 1 : 0.5 }}>
                        <div className="ag-card-header">
                          <div className="ag-card-identity">
                            <div className="ag-card-dot" style={{ background: va.is_active ? (role ? (AGENT_COLORS[role] || 'var(--color-primary)') : 'var(--color-success)') : 'var(--color-text-3)' }} />
                            <span className="ag-card-codename">{va.code_name}</span>
                          </div>
                          <span className="badge badge-default">{va.namespace}</span>
                        </div>
                        <div className="ag-card-body">
                          {va.description && <div className="ag-card-desc">{va.description.length > 100 ? va.description.slice(0, 100) + '...' : va.description}</div>}
                          <div className="ag-card-caps">
                            {(va.tags || []).slice(0, 4).map(tag => <span key={tag} className="badge badge-default">{tag}</span>)}
                          </div>
                          {va.total_runs > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: 'var(--space-1)' }}>
                              {va.total_runs} runs | avg {va.avg_duration_ms ? `${(va.avg_duration_ms / 1000).toFixed(1)}s` : '—'}
                            </div>
                          )}
                          <div className="ag-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={!va.is_active || isRunning}
                                onClick={() => { setVaultRunModal(va); setVaultGoal(''); setVaultResult(null) }}
                              >
                                {isRunning ? 'Running...' : 'Run'}
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', cursor: 'pointer' }}
                                onClick={() => toggleVaultAgent(va.id, va.is_active)}
                              >
                                {va.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                            {role && (
                              <span style={{ color: AGENT_COLORS[role] || 'var(--color-primary)', fontWeight: 'var(--weight-semibold)', fontSize: '11px' }}>
                                {role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }

            {/* Run Agent Modal */}
            {vaultRunModal && (
              <div className="modal-overlay" onClick={() => setVaultRunModal(null)}>
                <div className="modal-panel" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Run {vaultRunModal.code_name}</h3>
                    <button className="modal-close" onClick={() => setVaultRunModal(null)}>&times;</button>
                  </div>
                  <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div>
                      <label className="form-label">Goal</label>
                      <textarea
                        className="form-input"
                        rows={3}
                        placeholder={vaultRunModal.goal_template || `What should ${vaultRunModal.code_name} do?`}
                        value={vaultGoal}
                        onChange={e => setVaultGoal(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn-primary"
                        disabled={!vaultGoal.trim() || vaultRunning === vaultRunModal.code_name}
                        onClick={async () => {
                          const res = await runVaultAgent(vaultRunModal.code_name, vaultGoal)
                          setVaultResult(res)
                          if (res?.success) toast(`${vaultRunModal.code_name} completed`, 'success')
                          else toast(res?.error || 'Agent failed', 'warning')
                        }}
                      >
                        {vaultRunning === vaultRunModal.code_name ? 'Running...' : 'Execute'}
                      </button>
                      <button className="btn" style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }} onClick={() => setVaultRunModal(null)}>Close</button>
                    </div>
                    {vaultResult && (
                      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-3)', maxHeight: 300, overflow: 'auto' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginBottom: 'var(--space-2)' }}>
                          Status: {vaultResult.status || '—'} | Rounds: {vaultResult.rounds || 0} | Skills: {vaultResult.skills_used?.length || 0} | {vaultResult.duration_ms ? `${(vaultResult.duration_ms / 1000).toFixed(1)}s` : ''}
                        </div>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                          {vaultResult.answer || vaultResult.error || JSON.stringify(vaultResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Agents
