import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePipelineStore = create(
  persist(
    (set) => ({
      view: 'kanban', // 'kanban' | 'table'
      stageFilter: 'all',
      selectedDeal: null,
      showClosedLost: false,
      sortBy: 'created_at', // 'created_at' | 'value' | 'probability'

      setView: (view) => set({ view }),
      setStageFilter: (stageFilter) => set({ stageFilter }),
      setSelectedDeal: (selectedDeal) => set({ selectedDeal }),
      toggleClosedLost: () => set((s) => ({ showClosedLost: !s.showClosedLost })),
      setSortBy: (sortBy) => set({ sortBy }),
    }),
    {
      name: 'ag-pipeline-ui',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return { view: 'kanban', stageFilter: 'all', selectedDeal: null, showClosedLost: false, sortBy: 'created_at', ...persisted }
        return persisted
      },
    }
  )
)
