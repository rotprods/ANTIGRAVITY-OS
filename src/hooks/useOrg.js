import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOrgStore } from '../stores/useOrgStore'

export function useOrg() {
    const store = useOrgStore()
    const { organizations, currentOrg } = store

    // Initial fetch for organizations on auth change
    useEffect(() => {
        let mounted = true
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return
                if (event === 'SIGNED_IN') {
                    fetchOrganizations()
                } else if (event === 'SIGNED_OUT') {
                    store.setOrganizations([])
                    store.setCurrentOrg(null)
                    store.setLoading(false)
                }
            }
        )
        // Initial fetch if user is already logged in
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!mounted) return
            if (user) fetchOrganizations()
            else store.setLoading(false)
        }).catch(() => {
            if (mounted) store.setLoading(false)
        })

        // Safety timeout: never be stuck loading for more than 8 seconds
        const timeout = setTimeout(() => {
            if (mounted && store.loading) {
                console.warn('[useOrg] loading timeout — forcing loading=false')
                store.setLoading(false)
            }
        }, 8000)

        return () => {
            mounted = false
            clearTimeout(timeout)
            authListener.subscription.unsubscribe()
        }
    }, [])

    // Re-hydrate currentOrg and fetch members when org changes
    useEffect(() => {
        if (currentOrg && !currentOrg.name && organizations.length > 0) {
            const fullOrg = organizations.find(o => o.id === currentOrg.id)
            if (fullOrg) {
                store.setCurrentOrg(fullOrg)
            } else {
                // Persisted org doesn't exist anymore — pick the first available
                store.setCurrentOrg(organizations[0])
            }
        } else if (currentOrg?.id && currentOrg?.name) {
            fetchMembers(currentOrg.id)
        }
    }, [currentOrg?.id, organizations])


    const fetchOrganizations = useCallback(async () => {
        store.setLoading(true)
        try {
            const { data: orgs, error } = await supabase.from('organizations').select('*')

            if (error) {
                console.error('Error fetching organizations:', error)
                store.setOrganizations([])
            } else {
                store.setOrganizations(orgs || [])
                if ((orgs || []).length > 0 && (!store.currentOrg || !orgs.some(o => o.id === store.currentOrg.id))) {
                    store.setCurrentOrg(orgs[0])
                }
            }
        } catch (err) {
            console.error('Critical org fetch error:', err)
            store.setOrganizations([])
        }
        store.setLoading(false)
    }, [])

    const fetchMembers = useCallback(async (orgId) => {
        try {
            const { data, error } = await supabase
                .from('organization_members')
                .select(`
                    user_id,
                    roles ( name ),
                    user:user_id ( id, email, raw_user_meta_data )
                `)
                .eq('org_id', orgId)

            if (error) {
                console.error('Error fetching members:', error)
                store.setMembers([])
            } else {
                const members = (data || []).map(m => ({
                    id: m.user?.id,
                    email: m.user?.email,
                    full_name: m.user?.raw_user_meta_data?.full_name,
                    avatar_url: m.user?.raw_user_meta_data?.avatar_url,
                    role: m.roles?.name,
                })).filter(m => m.id)
                store.setMembers(members)
            }
        } catch (err) {
            console.error('Critical member fetch error:', err)
            store.setMembers([])
        }
    }, [])

    // ─── ACTIONS ────────────────────────────────────────────────

    const createOrganization = useCallback(async (name) => {
        store.setLoading(true)
        const { data: newOrg, error } = await supabase.rpc('create_new_organization', { org_name: name })

        if (error) {
            console.error('Error creating organization:', error)
            store.setLoading(false)
            throw error
        }

        store.addOrganization(newOrg)
        store.setCurrentOrg(newOrg)
        store.setLoading(false)
        return newOrg
    }, [])

    const switchOrganization = useCallback((org) => store.setCurrentOrg(org), [])

    // ─── INVITATION LOGIC ───────────────────────────────────────

    const fetchPendingInvites = useCallback(async (orgId) => {
        const { data, error } = await supabase
            .from('invitations')
            .select('*')
            .eq('org_id', orgId)
            .eq('status', 'pending')

        if (!error) store.setPendingInvites(data || [])
    }, [])

    const inviteMember = useCallback(async (email, roleName = 'member') => {
        if (!store.currentOrg) throw new Error('No active organization')

        const { data: roles } = await supabase.from('roles').select('id').eq('name', roleName).single()
        if (!roles) throw new Error('Role not found')

        const { data, error } = await supabase
            .from('invitations')
            .insert({
                org_id: store.currentOrg.id,
                email: email,
                role_id: roles.id
            })
            .select()
            .single()

        if (error) throw error
        store.setPendingInvites([...store.pendingInvites, data])
        return data
    }, [store.currentOrg, store.pendingInvites])

    return {
        ...store,
        fetchOrganizations, createOrganization, switchOrganization, fetchPendingInvites, inviteMember
    }
}