import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useOrgStore = create(
    persist(
        (set, get) => ({
            organizations: [],
            currentOrg: null,
            members: [],
            pendingInvites: [],
            loading: true,

            // Actions
            setOrganizations: (organizations) => set({ organizations }),
            setCurrentOrg: (org) => set({ currentOrg: org }),
            setMembers: (members) => set({ members }),
            addOrganization: (org) => set((state) => ({
                organizations: [...state.organizations, org]
            })),
            setPendingInvites: (invites) => set({ pendingInvites: invites }),
            setLoading: (loading) => set({ loading }),
        }),
        {
            name: 'oculops-org-store',
            // Only persist the ID of the current org to avoid stale data.
            // The full object will be re-hydrated by the useOrg hook.
            partialize: (state) => ({
                currentOrg: state.currentOrg ? { id: state.currentOrg.id } : null,
            }),
        }
    )
)