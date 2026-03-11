import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSignalStore = create(
  persist(
    (set) => ({
      filter: 'all', // 'all' | 'unread' | 'high' | signal type
      search: '',
      readIds: [], // locally tracked read signal IDs

      setFilter: (filter) => set({ filter }),
      setSearch: (search) => set({ search }),
      markRead: (id) => set((s) => ({
        readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
      })),
      markAllRead: (ids) => set((s) => ({
        readIds: [...new Set([...s.readIds, ...ids])],
      })),
      resetRead: () => set({ readIds: [] }),
    }),
    {
      name: 'ag-signals-ui',
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) return { filter: 'all', search: '', readIds: [], ...persisted }
        return persisted
      },
    }
  )
)
