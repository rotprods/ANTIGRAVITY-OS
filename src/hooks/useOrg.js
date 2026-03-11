import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOrgStore } from '../stores/useOrgStore'

let orgBootstrapStarted = false
let orgBootstrapComplete = false
let orgFetchPromise = null

async function fetchOrganizationsInternal({ blocking = false } = {}) {
    const store = useOrgStore.getState()

    if (orgFetchPromise) return orgFetchPromise
    if (blocking) store.setLoading(true)

    orgFetchPromise = (async () => {
        try {
            const { data: orgs, error } = await supabase.from('organizations').select('*')

            if (error) {
                console.error('Error fetching organizations:', error)
                return []
            }

            const nextOrgs = orgs || []
            const latestStore = useOrgStore.getState()
            latestStore.setOrganizations(nextOrgs)

            if (nextOrgs.length === 0) {
                latestStore.setCurrentOrg(null)
            } else if (!latestStore.currentOrg || !nextOrgs.some(o => o.id === latestStore.currentOrg.id)) {
                latestStore.setCurrentOrg(nextOrgs[0])
            }

            return nextOrgs
        } catch (err) {
            console.error('Critical org fetch error:', err)
            return []
        } finally {
            orgBootstrapComplete = true
            useOrgStore.getState().setLoading(false)
            orgFetchPromise = null
        }
    })()

    return orgFetchPromise
}

function ensureOrgBootstrap() {
    if (orgBootstrapStarted) return
    orgBootstrapStarted = true

    const store = useOrgStore.getState()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        const latestStore = useOrgStore.getState()

        if (event === 'SIGNED_IN') {
            const needsFreshOrgResolution = !latestStore.currentOrg && latestStore.organizations.length === 0
            fetchOrganizationsInternal({ blocking: !orgBootstrapComplete || needsFreshOrgResolution })
        } else if (event === 'SIGNED_OUT') {
            latestStore.setOrganizations([])
            latestStore.setCurrentOrg(null)
            latestStore.setMembers([])
            latestStore.setPendingInvites([])
            latestStore.setLoading(false)
            orgBootstrapComplete = false
            orgBootstrapStarted = false
        }
        // Ignore TOKEN_REFRESHED, USER_UPDATED — they don't change org state
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) fetchOrganizationsInternal({ blocking: true })
        else {
            store.setLoading(false)
            orgBootstrapComplete = true
        }
    }).catch(() => {
        store.setLoading(false)
        orgBootstrapComplete = true
    })

    setTimeout(() => {
        const latestStore = useOrgStore.getState()
        if (latestStore.loading) {
            console.warn('[useOrg] loading timeout — forcing loading=false')
            latestStore.setLoading(false)
            orgBootstrapComplete = true
        }
    }, 8000)

    void authListener
}

export function useOrg() {
    const store = useOrgStore()
    const { organizations, currentOrg } = store

    useEffect(() => {
        ensureOrgBootstrap()
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
        return fetchOrganizationsInternal({ blocking: true })
    }, [])

    const fetchMembers = useCallback(async (orgId) => {
        try {
            const { data: membershipRows, error } = await supabase
                .from('organization_members')
                .select(`
                    user_id,
                    roles ( name )
                `)
                .eq('org_id', orgId)

            if (error) {
                console.error('Error fetching members:', error)
                store.setMembers([])
            } else {
                const userIds = [...new Set((membershipRows || []).map(member => member.user_id).filter(Boolean))]
                let profilesById = new Map()

                if (userIds.length > 0) {
                    const { data: profiles, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url')
                        .in('id', userIds)

                    if (profilesError) {
                        console.error('Error fetching org member profiles:', profilesError)
                    } else {
                        profilesById = new Map((profiles || []).map(profile => [profile.id, profile]))
                    }
                }

                const members = (membershipRows || []).map(member => {
                    const profile = profilesById.get(member.user_id)
                    return {
                        id: member.user_id,
                        email: profile?.email || null,
                        full_name: profile?.full_name || null,
                        avatar_url: profile?.avatar_url || null,
                        role: member.roles?.name,
                    }
                }).filter(member => member.id)
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
        try {
            // Try RPC first
            const { data: newOrg, error } = await supabase.rpc('create_new_organization', { org_name: name })

            if (!error && newOrg) {
                if (!store.organizations.some(org => org.id === newOrg.id)) {
                    store.addOrganization(newOrg)
                }
                store.setCurrentOrg(newOrg)
                store.setLoading(false)
                return newOrg
            }

            // Fallback: direct insert (no slug column in organizations table)
            console.warn('[useOrg] RPC failed, falling back to direct insert:', error?.message)

            const { data: inserted, error: insertErr } = await supabase
                .from('organizations')
                .insert({ name })
                .select()
                .single()

            if (insertErr) {
                console.error('Error creating organization:', insertErr)
                store.setLoading(false)
                throw insertErr
            }

            // Add creator as owner
            const { data: { user } } = await supabase.auth.getUser()
            if (user && inserted) {
                const { data: ownerRole } = await supabase.from('roles').select('id').eq('name', 'owner').single()
                if (ownerRole) {
                    await supabase.from('organization_members').insert({ org_id: inserted.id, user_id: user.id, role_id: ownerRole.id })
                }
            }

            if (!store.organizations.some(org => org.id === inserted.id)) {
                store.addOrganization(inserted)
            }
            store.setCurrentOrg(inserted)
            store.setLoading(false)
            return inserted
        } catch (err) {
            store.setLoading(false)
            throw err
        }
    }, [store])

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
