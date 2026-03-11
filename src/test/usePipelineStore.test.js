import { describe, it, expect, beforeEach } from 'vitest'
import { usePipelineStore } from '../stores/usePipelineStore'

describe('usePipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.setState({
      view: 'kanban',
      stageFilter: 'all',
      selectedDeal: null,
      showClosedLost: false,
      sortBy: 'created_at',
    })
  })

  it('defaults to kanban view', () => {
    expect(usePipelineStore.getState().view).toBe('kanban')
  })

  it('setView changes view', () => {
    usePipelineStore.getState().setView('table')
    expect(usePipelineStore.getState().view).toBe('table')
  })

  it('setStageFilter changes filter', () => {
    usePipelineStore.getState().setStageFilter('proposal')
    expect(usePipelineStore.getState().stageFilter).toBe('proposal')
  })

  it('setSelectedDeal stores deal object', () => {
    const deal = { id: '123', name: 'Test Deal', value: 5000 }
    usePipelineStore.getState().setSelectedDeal(deal)
    expect(usePipelineStore.getState().selectedDeal).toEqual(deal)
  })

  it('toggleClosedLost flips boolean', () => {
    expect(usePipelineStore.getState().showClosedLost).toBe(false)
    usePipelineStore.getState().toggleClosedLost()
    expect(usePipelineStore.getState().showClosedLost).toBe(true)
    usePipelineStore.getState().toggleClosedLost()
    expect(usePipelineStore.getState().showClosedLost).toBe(false)
  })

  it('setSortBy changes sort', () => {
    usePipelineStore.getState().setSortBy('value')
    expect(usePipelineStore.getState().sortBy).toBe('value')
  })
})
