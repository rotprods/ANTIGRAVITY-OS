import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useTaskStore = create(
  persist(
    (set) => ({
      filter: 'all', // 'all' | 'pending' | 'in_progress' | 'done'
      priority: 'all', // 'all' | 'high' | 'medium' | 'low'
      selected: [],
      groupBy: 'day', // 'day' | 'status' | 'priority'

      setFilter: (filter) => set({ filter }),
      setPriority: (priority) => set({ priority }),
      setGroupBy: (groupBy) => set({ groupBy }),
      toggleSelect: (id) => set((s) => ({
        selected: s.selected.includes(id)
          ? s.selected.filter((x) => x !== id)
          : [...s.selected, id],
      })),
      clearSelected: () => set({ selected: [] }),
    }),
    {
      name: 'ag-tasks-ui',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return { filter: 'all', priority: 'all', selected: [], groupBy: 'day', ...persisted }
        return persisted
      },
    }
  )
)
