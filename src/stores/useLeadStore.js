import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useLeadStore = create(
  persist(
    (set) => ({
      filters: { status: 'all', source: 'all' },
      search: '',
      selected: [],
      view: 'table', // 'table' | 'cards'

      setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      setSearch: (search) => set({ search }),
      setView: (view) => set({ view }),
      toggleSelect: (id) => set((s) => ({
        selected: s.selected.includes(id)
          ? s.selected.filter((x) => x !== id)
          : [...s.selected, id],
      })),
      clearSelected: () => set({ selected: [] }),
      resetFilters: () => set({ filters: { status: 'all', source: 'all' }, search: '' }),
    }),
    {
      name: 'ag-leads-ui',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return { filters: { status: 'all', source: 'all' }, search: '', selected: [], view: 'table', ...persisted }
        return persisted
      },
    }
  )
)
