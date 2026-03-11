import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore, uid, ceoScore } from '../stores/useAppStore'

describe('uid()', () => {
  it('returns a non-empty string', () => {
    const id = uid()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()))
    expect(ids.size).toBe(100)
  })
})

describe('ceoScore()', () => {
  it('returns a number >= 0', () => {
    const score = ceoScore({ impact: 80, velocity: 70, scalability: 85, confidence: 65, risk: 30, resourceCost: 40 })
    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('high impact + low risk = higher score than low impact + high risk', () => {
    const good = ceoScore({ impact: 90, velocity: 90, scalability: 90, confidence: 90, risk: 10, resourceCost: 10 })
    const bad = ceoScore({ impact: 10, velocity: 10, scalability: 10, confidence: 10, risk: 90, resourceCost: 90 })
    expect(good).toBeGreaterThan(bad)
  })

  it('accepts phase parameter', () => {
    const item = { impact: 70, velocity: 70, scalability: 70, confidence: 70, risk: 30, resourceCost: 40 }
    const early = ceoScore(item, '0-20k')
    const late = ceoScore(item, 'scale')
    expect(typeof early).toBe('number')
    expect(typeof late).toBe('number')
  })
})

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      data: useAppStore.getState().data,
      toasts: [],
      modal: { open: false, content: null },
    })
  })

  it('has default data with expected keys', () => {
    const { data } = useAppStore.getState()
    expect(data).toHaveProperty('meta')
    expect(data).toHaveProperty('simulation')
    expect(data).toHaveProperty('execution')
    expect(data).toHaveProperty('niches')
    expect(data).toHaveProperty('bets')
    expect(data.meta).toHaveProperty('targetMRR', 20000)
  })

  it('updateData modifies state immutably', () => {
    const { updateData } = useAppStore.getState()
    updateData(d => ({ ...d, meta: { ...d.meta, targetMRR: 50000 } }))
    expect(useAppStore.getState().data.meta.targetMRR).toBe(50000)
  })

  it('openModal / closeModal work', () => {
    const { openModal, closeModal } = useAppStore.getState()
    openModal('test-content')
    expect(useAppStore.getState().modal).toEqual({ open: true, content: 'test-content' })
    closeModal()
    expect(useAppStore.getState().modal).toEqual({ open: false, content: null })
  })

  it('toast adds and auto-removes', async () => {
    const { toast } = useAppStore.getState()
    toast('Test message', 'success')
    const toasts = useAppStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Test message')
    expect(toasts[0].type).toBe('success')
  })

  it('triggerFeedback deal_closed adds alert', () => {
    const { triggerFeedback } = useAppStore.getState()
    triggerFeedback('deal_closed', { name: 'Acme Deal', company: 'Acme Corp' })
    const alerts = useAppStore.getState().data.alerts
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[alerts.length - 1].description).toContain('Acme Deal')
  })

  it('triggerFeedback experiment_concluded adds knowledge', () => {
    const { triggerFeedback } = useAppStore.getState()
    triggerFeedback('experiment_concluded', { name: 'Email A/B', hypothesis: 'Short wins', result: 'success' })
    const knowledge = useAppStore.getState().data.knowledge
    expect(knowledge.length).toBeGreaterThan(0)
    expect(knowledge[0].title).toContain('Email A/B')
  })

  it('execution tasks default to 30 tasks', () => {
    const { data } = useAppStore.getState()
    expect(data.execution.tasks).toHaveLength(30)
    expect(data.execution.tasks[0].day).toBe(1)
    expect(data.execution.tasks[29].day).toBe(30)
  })
})
