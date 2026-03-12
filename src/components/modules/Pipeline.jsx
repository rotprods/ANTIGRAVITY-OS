// ═══════════════════════════════════════════════════
// OCULOPS — Sales Pipeline v11.0 (Kanban DnD)
// ═══════════════════════════════════════════════════

import { useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDeals } from '../../hooks/useDeals'
import { usePipelineStore } from '../../stores/usePipelineStore'
import { useAppStore } from '../../stores/useAppStore'
import { useCalendar } from '../../hooks/useGoogleWorkspace'
import { Charts } from '../../lib/charts'
import Modal from '../ui/Modal'
import {
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  RectangleStackIcon,
  CurrencyEuroIcon,
  ScaleIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import './Pipeline.css'
const STAGES = [
  { id: 'lead', label: 'Lead', color: 'var(--text-tertiary)' },
  { id: 'contacted', label: 'Contacted', color: 'var(--color-info)' },
  { id: 'meeting', label: 'Meeting', color: 'var(--accent-primary)' },
  { id: 'proposal', label: 'Proposal', color: 'var(--color-warning)' },
  { id: 'closed_won', label: 'Closed won', color: 'var(--color-success)' },
  { id: 'closed_lost', label: 'Closed lost', color: 'var(--color-danger)' },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))
const emptyDeal = { title: '', company: '', value: '', probability: '20', contact_person: '' }

// ── Deal Detail Modal ─────────────────────────────────────
function DealDetailModal({ deal, stages, onSave, onDelete, onClose, onFollowUp }) {
  const [form, setForm] = useState({
    title: deal.title || '',
    company: typeof deal.company === 'object' ? deal.company?.name || '' : deal.company || '',
    value: deal.value || 0,
    stage: deal.stage || 'lead',
    probability: deal.probability || 20,
    expected_close_date: deal.expected_close_date || '',
    contact_person: deal.contact_person || '',
    notes: deal.notes || '',
    loss_reason: deal.loss_reason || '',
  })
  const [saving, setSaving] = useState(false)
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(deal.id, {
      title: form.title,
      company: form.company,
      value: parseFloat(form.value) || 0,
      stage: form.stage,
      probability: parseInt(form.probability) || 20,
      expected_close_date: form.expected_close_date || null,
      contact_person: form.contact_person,
      notes: form.notes,
    })
    setSaving(false)
  }

  const handleFollowUp = async () => {
    setSchedulingFollowUp(true)
    await onFollowUp(deal.id)
    setSchedulingFollowUp(false)
  }

  return (
    <Modal open title="Deal details" onClose={onClose} size="md" footer={
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => onDelete(deal.id)}>
          <TrashIcon width={14} height={14} /> Delete
        </button>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleFollowUp} disabled={schedulingFollowUp} title="Schedule follow-up in Google Calendar">
            <CalendarIcon width={14} height={14} /> {schedulingFollowUp ? 'Scheduling...' : 'Follow-up'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    }>
      <div className="form-grid">
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-field">
          <label className="form-label">Company</label>
          <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
        </div>
        <div className="form-field">
          <label className="form-label">Contact</label>
          <input className="form-input" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
        </div>
        <div className="form-field">
          <label className="form-label">Value (EUR)</label>
          <input className="form-input" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
        </div>
        <div className="form-field">
          <label className="form-label">Probability (%)</label>
          <input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
        </div>
        <div className="form-field">
          <label className="form-label">Stage</label>
          <select className="form-input" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
            {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Expected close</label>
          <input className="form-input" type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
        </div>
        {form.stage === 'closed_lost' && (
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ color: 'var(--color-danger)' }}>Loss reason</label>
            <input className="form-input" value={form.loss_reason} onChange={e => setForm(f => ({ ...f, loss_reason: e.target.value }))} placeholder="e.g. Budget, timing, competitor..." />
          </div>
        )}
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Notes</label>
          <textarea className="form-input" style={{ minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)', marginTop: 'var(--space-3)' }}>
        Created {new Date(deal.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
    </Modal>
  )
}

// ── Draggable Deal Card ───────────────────────────────────
function DealCard({ deal, stage, onRemove, onSelect, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id })

  return (
    <div
      ref={setNodeRef}
      className="pl-deal-card"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        borderLeftColor: stage?.color || 'var(--border-default)',
      }}
      {...listeners}
      {...attributes}
      onClick={() => onSelect && onSelect(deal)}
    >
      <div className="pl-deal-title">{deal.title || deal.name || 'Untitled'}</div>
      {deal.company && (
        <div className="pl-deal-company">{deal.company?.name || deal.company}</div>
      )}
      <div className="pl-deal-value-row">
        <span className="pl-deal-value">€{(parseFloat(deal.value) || 0).toLocaleString()}</span>
        {deal.probability > 0 && (
          <span className="pl-deal-prob">{deal.probability}%</span>
        )}
        {deal.ai_score != null && (
          <span className={`badge ${deal.ai_score >= 70 ? 'badge-primary' : 'badge-default'}`} style={{ fontSize: 9 }}>
            AI: {deal.ai_score}
          </span>
        )}
      </div>
      {deal.contact_person && (
        <div className="pl-deal-contact">{deal.contact_person}</div>
      )}
      <div style={{ marginTop: 'var(--space-2)', textAlign: 'right' }}>
        <button
          className="btn btn-ghost btn-xs"
          style={{ color: 'var(--color-danger)', fontSize: 10 }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(deal.id) }}
        >
          <TrashIcon width={12} height={12} /> Delete
        </button>
      </div>
    </div>
  )
}

// ── DragOverlay ───────────────────────────────────
function DragOverlayCard({ deal }) {
  if (!deal) return null
  const stage = STAGE_MAP[deal.stage]
  return (
    <div className="pl-deal-card pl-deal-dragging" style={{ borderLeftColor: stage?.color || 'var(--accent-primary)' }}>
      <div className="pl-deal-title">{deal.title || 'Deal'}</div>
      <div className="pl-deal-value">€{(parseFloat(deal.value) || 0).toLocaleString()}</div>
    </div>
  )
}

// ── Droppable Column ──────────────────────────────────────
function KanbanColumn({ stage, deals, onRemove, onSelect, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const stageTotal = deals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0)

  return (
    <div className="pl-column">
      <div className="pl-column-header" style={{ borderTopColor: stage.color }}>
        <span style={{ color: stage.color }}>{stage.label}</span>
        <span className="pl-column-count">{deals.length}</span>
        {stageTotal > 0 && (
          <div className="pl-column-total">€{stageTotal.toLocaleString()}</div>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`pl-column-body${isOver ? ' pl-column-over' : ''}`}
      >
        {deals.map(deal => (
          <DealCard key={deal.id} deal={deal} stage={stage} onRemove={onRemove} onSelect={onSelect} isDragging={deal.id === activeId} />
        ))}
        {deals.length === 0 && (
          <div className="pl-column-empty">Drop deals here</div>
        )}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────
function Pipeline() {
  const { deals, loading, addDeal, updateDeal, removeDeal, pipelineView, totalValue, weightedValue } = useDeals()
  const toast = useAppStore(s => s.toast)
  const { createFollowUp } = useCalendar()
  const showClosedLost = usePipelineStore(s => s.showClosedLost)
  const toggleClosedLost = usePipelineStore(s => s.toggleClosedLost)
  const selectedDeal = usePipelineStore(s => s.selectedDeal)
  const setSelectedDeal = usePipelineStore(s => s.setSelectedDeal)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyDeal)
  const [saving, setSaving] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeDeal = useMemo(() => deals.find(d => d.id === activeId), [deals, activeId])

  const handleDragStart = useCallback(({ active }) => setActiveId(active.id), [])
  const handleSelectDeal = useCallback((deal) => setSelectedDeal(deal), [setSelectedDeal])
  const handleCloseModal = useCallback(() => setSelectedDeal(null), [setSelectedDeal])

  const handleModalSave = useCallback(async (id, changes) => {
    await updateDeal(id, changes)
    setSelectedDeal(null)
    toast('Deal updated', 'success')
  }, [updateDeal, setSelectedDeal, toast])

  const handleModalDelete = useCallback(async (id) => {
    await removeDeal(id)
    setSelectedDeal(null)
    toast('Deal removed', 'success')
  }, [removeDeal, setSelectedDeal, toast])

  const handleFollowUp = useCallback(async (dealId) => {
    try {
      const result = await createFollowUp(dealId, { daysFromNow: 3 })
      if (result?.event?.htmlLink) {
        toast('Follow-up scheduled in Google Calendar', 'success')
        window.open(result.event.htmlLink, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      toast(err.message || 'Calendar error — is Gmail connected?', 'error')
    }
  }, [createFollowUp, toast])

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const deal = deals.find(d => d.id === active.id)
    if (!deal || deal.stage === over.id) return
    await updateDeal(active.id, { stage: over.id })
  }, [deals, updateDeal])

  const handleAdd = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await addDeal({
      title: form.title,
      company: form.company,
      value: parseFloat(form.value) || 0,
      probability: parseInt(form.probability) || 20,
      contact_person: form.contact_person,
      stage: 'lead',
    })
    setForm(emptyDeal)
    setShowForm(false)
    setSaving(false)
  }

  const visibleStages = useMemo(() => STAGES.filter(s => showClosedLost || s.id !== 'closed_lost'), [showClosedLost])
  const funnelData = useMemo(() =>
    STAGES.filter(s => s.id !== 'closed_lost').map(s => ({ label: s.label, value: (pipelineView[s.id] || []).length })),
    [pipelineView]
  )
  const closedWon = (pipelineView['closed_won'] || []).length

  if (loading) return (
    <div className="module-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading pipeline...</div>
    </div>
  )

  return (
    <div className="module-page pl fade-in">
      {/* Header */}
      <div className="module-page-header">
        <div>
          <h1 className="module-page-title">Pipeline</h1>
          <p className="module-page-subtitle">{deals.length} deals · {closedWon} won · €{(totalValue || 0).toLocaleString()} total</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleClosedLost}>
            {showClosedLost ? <><EyeSlashIcon width={14} height={14} /> Hide lost</> : <><EyeIcon width={14} height={14} /> Show lost</>}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : <><PlusIcon width={14} height={14} /> New deal</>}
          </button>
        </div>
      </div>

      {/* Quick add */}
      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>New deal</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Deal name" />
            </div>
            <div className="form-field">
              <label className="form-label">Company</label>
              <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
            </div>
            <div className="form-field">
              <label className="form-label">Value (EUR)</label>
              <input className="form-input" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-field">
              <label className="form-label">Probability (%)</label>
              <input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Contact person</label>
              <input className="form-input" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="Name" />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={handleAdd} disabled={saving}>
            {saving ? 'Creating...' : 'Create deal'}
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid kpi-grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="kpi-card">
          <div className="kpi-header"><span className="kpi-label">Total deals</span><RectangleStackIcon className="kpi-icon" /></div>
          <div className="kpi-value">{deals.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-header"><span className="kpi-label">Pipeline value</span><CurrencyEuroIcon className="kpi-icon" /></div>
          <div className="kpi-value">€{(totalValue || 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-header"><span className="kpi-label">Weighted value</span><ScaleIcon className="kpi-icon" /></div>
          <div className="kpi-value">€{Math.round(weightedValue || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="ct-section" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="ct-section-header">
          <span className="ct-section-title">Kanban board</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>Drag to move deals between stages</span>
        </div>
        <div style={{ padding: 'var(--space-5)', overflowX: 'auto' }}>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="pl-board">
              {visibleStages.map(stage => (
                <KanbanColumn key={stage.id} stage={stage} deals={pipelineView[stage.id] || []} onRemove={removeDeal} onSelect={handleSelectDeal} activeId={activeId} />
              ))}
            </div>
            <DragOverlay><DragOverlayCard deal={activeDeal} /></DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <DealDetailModal deal={selectedDeal} stages={STAGES} onSave={handleModalSave} onDelete={handleModalDelete} onClose={handleCloseModal} onFollowUp={handleFollowUp} />
      )}

      {/* Funnel chart */}
      <div className="ct-section">
        <div className="ct-section-header">
          <span className="ct-section-title">Conversion funnel</span>
        </div>
        <div style={{ padding: 'var(--space-5)' }}>
          <div dangerouslySetInnerHTML={{ __html: Charts.funnel(funnelData) }} />
        </div>
      </div>
    </div>
  )
}

export default Pipeline
