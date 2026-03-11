import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useKnowledgeStore = create(
  persist(
    (set) => ({
      entries: [],
      searchResults: [],
      isSearching: false,
      selectedEntry: null,

      // Actions
      setEntries: (entries) => set({ entries }),

      addEntry: (entry) => set((s) => ({
        entries: [entry, ...s.entries]
      })),

      updateEntry: (id, updates) => set((s) => ({
        entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        selectedEntry: s.selectedEntry?.id === id ? { ...s.selectedEntry, ...updates } : s.selectedEntry
      })),

      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      setSearchResults: (results) => set({ searchResults: results }),
      setIsSearching: (isSearching) => set({ isSearching }),
      setSelectedEntry: (entry) => set({ selectedEntry: entry }),
    }),
    { name: 'oculops-knowledge' }
  )
)