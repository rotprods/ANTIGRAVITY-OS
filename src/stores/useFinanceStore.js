import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useFinanceStore = create(
  persist(
    (set) => ({
      filter: 'all', // 'all' | 'revenue' | 'expense'
      period: 'all', // 'all' | 'this_month' | 'last_month' | 'this_year'
      view: 'table', // 'table' | 'chart'

      setFilter: (filter) => set({ filter }),
      setPeriod: (period) => set({ period }),
      setView: (view) => set({ view }),
    }),
    {
      name: 'ag-finance-ui',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return { filter: 'all', period: 'all', view: 'table', ...persisted }
        return persisted
      },
    }
  )
)
