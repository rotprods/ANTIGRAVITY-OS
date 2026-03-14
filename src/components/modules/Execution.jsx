// ═══════════════════════════════════════════════════
// OCULOPS — Execution v12.0 (STITCH V2 IVORY)
// Task Execution Hub — Aligned w/ Stitch Final
// ═══════════════════════════════════════════════════

import { useState } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { useAppStore } from '../../stores/useAppStore'
import { useTaskStore } from '../../stores/useTaskStore'
import VaultAgentPanel from '../ui/VaultAgentPanel'
import ModuleSkeleton from '../ui/ModuleSkeleton'
import './Execution.css'

function Execution() {
  const { tasks, loading, addTask, updateTask, completionRate, currentDay } = useTasks()
  const defaultTasks = useAppStore(s => s.data.execution.tasks)
  const { filter: filterStatus, setFilter: setFilterStatus } = useTaskStore()
  const [seeding, setSeeding] = useState(false)

  const seedDefaultPlan = async () => {
    setSeeding(true)
    for (const t of defaultTasks) {
      await addTask({ day: t.day, task: t.task, status: t.status || 'pending', gate: t.gate || null })
    }
    setSeeding(false)
  }

  const toggleStatus = async (task) => {
    const next = task.status === 'done' ? 'pending' : task.status === 'pending' ? 'in_progress' : 'done'
    await updateTask(task.id, { status: next })
  }

  const filtered = tasks
    .filter(t => filterStatus === 'all' || t.status === filterStatus)
    .sort((a, b) => (a.day || 0) - (b.day || 0))

  const statusConfig = {
    'done': { color: '#34C759', label: 'Completed', bg: 'rgba(52, 199, 89, 0.08)', borderColor: 'rgba(52, 199, 89, 0.2)' },
    'in_progress': { color: '#FF9500', label: 'In Progress', bg: 'rgba(255, 149, 0, 0.08)', borderColor: 'rgba(255, 149, 0, 0.2)' },
    'pending': { color: '#8A8A8E', label: 'Pending', bg: 'rgba(138, 138, 142, 0.08)', borderColor: 'rgba(138, 138, 142, 0.2)' }
  }

  const totalDone = tasks.filter(t => t.status === 'done').length
  const totalInProgress = tasks.filter(t => t.status === 'in_progress').length
  const totalPending = tasks.filter(t => t.status === 'pending').length

  if (loading) return <ModuleSkeleton variant="table" rows={5} />

  return (
    <div className="module-page exec fade-in">
      {/* ── Hero Banner (Stitch V2) ── */}
      <div className="exec-hero">
        <div>
          <h1 className="exec-hero-title">Task Execution Hub</h1>
          <p className="exec-hero-subtitle">30-day operational plan and task management.</p>
        </div>
        <div className="exec-live-pill">
          <span className="exec-live-dot" />
          <span>Day {currentDay}</span>
        </div>
      </div>

      {/* ── KPI Grid (4 cards) ── */}
      <div className="exec-kpi-grid">
        <div className="exec-kpi exec-kpi--accent">
          <div className="exec-kpi-label">Total Tasks</div>
          <div className="exec-kpi-value">{tasks.length}</div>
          <div className="exec-kpi-bar">
            <div className="exec-kpi-bar-fill" style={{ width: '100%' }} />
          </div>
        </div>
        <div className="exec-kpi">
          <div className="exec-kpi-label">Completed</div>
          <div className="exec-kpi-value" style={{ color: '#34C759' }}>{totalDone}</div>
          <div className="exec-kpi-bar">
            <div className="exec-kpi-bar-fill" style={{ width: `${completionRate}%`, background: '#34C759' }} />
          </div>
        </div>
        <div className="exec-kpi">
          <div className="exec-kpi-label">In Progress</div>
          <div className="exec-kpi-value" style={{ color: '#FF9500' }}>{totalInProgress}</div>
          <div className="exec-kpi-bar">
            <div className="exec-kpi-bar-fill" style={{ width: tasks.length > 0 ? `${Math.round((totalInProgress / tasks.length) * 100)}%` : '0%', background: '#FF9500' }} />
          </div>
        </div>
        <div className="exec-kpi">
          <div className="exec-kpi-label">Completion Rate</div>
          <div className="exec-kpi-value">{completionRate}%</div>
          <div className="exec-kpi-bar">
            <div className="exec-kpi-bar-fill" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      </div>

      {/* ── Task Table Card ── */}
      <div className="exec-card">
        <div className="exec-card-header">
          <span className="exec-card-title">Active Deployment Queue</span>
          <div className="exec-filter-group">
            {['all', 'pending', 'in_progress', 'done'].map(f => (
              <button key={f} className={`exec-filter-btn ${filterStatus === f ? 'exec-filter-active' : ''}`} onClick={() => setFilterStatus(f)}>
                {f === 'all' ? 'All' : statusConfig[f]?.label || f}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="exec-progress-track">
          <div className="exec-progress-fill" style={{ width: `${completionRate}%` }} />
        </div>

        {tasks.length === 0 && !loading ? (
          <div className="exec-empty">
            <div className="exec-empty-title">No tasks initialized</div>
            <p className="exec-empty-desc">Initialize the 30-day execution plan to get started.</p>
            <button className="exec-seed-btn" onClick={seedDefaultPlan} disabled={seeding}>
              {seeding ? 'Initializing...' : 'Initialize Plan'}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="exec-empty">
            <div className="exec-empty-desc">No tasks match current filter.</div>
          </div>
        ) : (
          <table className="exec-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th style={{ width: '60px' }}>Day</th>
                <th>Task</th>
                <th style={{ width: '100px' }}>Gate</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ width: '80px' }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task, index) => {
                const sc = statusConfig[task.status] || statusConfig['pending']
                return (
                  <tr key={task.id} onClick={() => toggleStatus(task)} className="exec-task-row" style={{ cursor: 'pointer' }}>
                    <td className="exec-td-muted">{(index + 1).toString().padStart(3, '0')}</td>
                    <td className="exec-td-day">D{String(task.day).padStart(2, '0')}</td>
                    <td className="exec-td-task" style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
                      {task.task || task.title}
                    </td>
                    <td>
                      {task.gate && (
                        <span className="exec-gate-pill">{task.gate}</span>
                      )}
                    </td>
                    <td>
                      <span className="exec-status-pill" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.borderColor}` }}>
                        {sc.label}
                      </span>
                    </td>
                    <td>
                      <div className="exec-mini-progress">
                        <div className="exec-mini-progress-fill" style={{
                          width: task.status === 'done' ? '100%' : task.status === 'in_progress' ? '50%' : '0%',
                          background: sc.color
                        }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <VaultAgentPanel title="EXECUTION INTELLIGENCE" namespaces={['orchestration', 'product']} />
      </div>
    </div>
  )
}

export default Execution
