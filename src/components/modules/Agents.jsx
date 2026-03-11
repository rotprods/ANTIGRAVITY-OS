// ═══════════════════════════════════════════════════
// OCULOPS — Agents Hub v11.0
// Multi-Agent Orchestration Dashboard
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useAgents } from '../../hooks/useAgents'
import { useAgentStudies } from '../../hooks/useAgentStudies'
import { useAgentVault, ROLE_CAPABILITY_MAP } from '../../hooks/useAgentVault'
import { useAgentState } from '../../hooks/useAgentState'
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
  { id: 'logs', label: 'Logs', icon: DocumentTextIcon },
  { id: 'studies', label: 'Studies', icon: BookOpenIcon },
  { id: 'automation', label: 'Automation', icon: CogIcon },
  { id: 'vault', label: 'Vault', icon: ArchiveBoxIcon },
]

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  if (!ms) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function statusColor(status) {
  if (status === 'online') return 'var(--color-success)'
  if (status === 'running') return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function Agents() {
  const { toast } = useAppStore()
  const { agents, tasks, logs, stats, triggerAgent, runCortexCycle } = useAgents()
  const { studies, telegramTarget, loading: studiesLoading, busy: studiesBusy, postStudy, resendStudy, saveTelegramTarget } = useAgentStudies()
  const { filteredAgents: vaultAgents, namespaces: vaultNamespaces, loading: vaultLoading, error: vaultError, filters: vaultFilters, setNamespace: setVaultNamespace, setSearch: setVaultSearch, setRole: setVaultRole, suggestRole, totalAgents: vaultTotal, canonicalCount: vaultCanonical } = useAgentVault()
  const { agentHealth, runningAgents } = useAgentState()

  const [triggering, setTriggering] = useState(null)
  const [activeTab, setActiveTab] = useState('network')
  const [studyForm, setStudyForm] = useState(INITIAL_STUDY_FORM)
  const [telegramForm, setTelegramForm] = useState(INITIAL_TELEGRAM_FORM)

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

  return (
    <div className="module-page ag fade-in">
      {/* Header */}
      <div className="module-page-header">
        <div>
          <h1 className="module-page-title">Agents</h1>
          <p className="module-page-subtitle">Multi-agent orchestration · {stats.online} online · {runningAgents.length} executing</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleCortexCycle} disabled={triggering === 'cortex'}>
          <PlayIcon width={14} height={14} /> {triggering === 'cortex' ? 'Running...' : 'Run Cortex cycle'}
        </button>
      </div>

      {/* Tabs */}
      <div className="crm-tabs">
        {TAB_CONFIG.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} className={`crm-tab${activeTab === t.id ? ' crm-tab-active' : ''}`} onClick={() => setActiveTab(t.id)}>
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
            {/* Cortex Master */}
            {cortex && (
              <div className="ag-cortex-card">
                <div className="ag-cortex-info">
                  <CpuChipIcon width={24} height={24} style={{ color: 'var(--accent-primary)' }} />
                  <div>
                    <div className="ag-cortex-name">{cortex.name}</div>
                    <div className="ag-cortex-desc">{cortex.description}</div>
                  </div>
                </div>
                <div className="ag-cortex-stats">
                  <span>{cortex.total_runs || 0} runs</span>
                  <span>Last: {formatTime(cortex.last_run_at)}</span>
                </div>
              </div>
            )}

            {/* Agent Grid */}
            <div className="ag-grid">
              {subAgents.map(ag => (
                <div key={ag.id} className="ag-card">
                  <div className="ag-card-header">
                    <div className="ag-card-identity">
                      <div className="ag-card-dot" style={{ background: statusColor(ag.status) }} />
                      <span className="ag-card-codename" style={{ color: AGENT_COLORS[ag.code_name] || 'var(--accent-primary)' }}>{ag.code_name}</span>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={() => handleTrigger(ag.code_name, 'cycle')} disabled={triggering === ag.code_name}>
                      {triggering === ag.code_name ? 'Running...' : 'Trigger'}
                    </button>
                  </div>
                  <div className="ag-card-body">
                    <div className="ag-card-name">{ag.name}</div>
                    <div className="ag-card-desc">{ag.description}</div>
                    <div className="ag-card-caps">
                      {(ag.capabilities || []).slice(0, 3).map(cap => (
                        <span key={cap} className="badge badge-default">{cap.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                    <div className="ag-card-footer">
                      <span>{ag.total_runs || 0} cycles</span>
                      <span>Last: {formatTime(ag.last_run_at)}</span>
                      {agentHealth[ag.code_name] && (
                        <span style={{
                          color: agentHealth[ag.code_name].isRunning ? 'var(--color-warning)'
                            : agentHealth[ag.code_name].healthScore >= 80 ? 'var(--color-success)'
                            : 'var(--color-danger)',
                          fontWeight: 'var(--weight-semibold)',
                        }}>
                          {agentHealth[ag.code_name].isRunning ? '● RUNNING' : `♥ ${agentHealth[ag.code_name].healthScore}%`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
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
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Total agents</span></div><div className="kpi-value">{vaultTotal}</div></div>
              <div className="kpi-strip-cell"><div className="kpi-strip-cell-header"><span className="kpi-label">Canonical</span></div><div className="kpi-value">{vaultCanonical}</div></div>
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
            {vaultLoading ? <div className="crm-table-empty">Loading agent vault...</div> :
              vaultError ? <div className="ag-vault-error">{vaultError}</div> :
                <div className="ag-grid">
                  {vaultAgents.map(va => {
                    const role = suggestRole(va)
                    return (
                      <div key={va.name} className="ag-card">
                        <div className="ag-card-header">
                          <div className="ag-card-identity">
                            <div className="ag-card-dot" style={{ background: role ? (AGENT_COLORS[role] || 'var(--accent-primary)') : 'var(--text-tertiary)' }} />
                            <span className="ag-card-codename">{va.name}</span>
                          </div>
                          <span className="badge badge-default">{va.namespace}</span>
                        </div>
                        <div className="ag-card-body">
                          {va.description && <div className="ag-card-desc">{va.description.length > 100 ? va.description.slice(0, 100) + '...' : va.description}</div>}
                          <div className="ag-card-caps">
                            {(va.capabilities || []).slice(0, 4).map(cap => <span key={cap} className="badge badge-default">{cap}</span>)}
                          </div>
                          {role && (
                            <div className="ag-card-footer">
                              <span style={{ color: AGENT_COLORS[role] || 'var(--accent-primary)', fontWeight: 'var(--weight-semibold)' }}>
                                {role} compatible
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}
      </div>
    </div>
  )
}

export default Agents
