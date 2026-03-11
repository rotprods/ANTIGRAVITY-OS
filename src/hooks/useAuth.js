// ═══════════════════════════════════════════════════
// OCULOPS — useAuth Hook
// Manages auth state, session, and user profile
// ═══════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { onAuthStateChange, getCurrentSession, fetchOne } from '../lib/supabase'

export function useAuth() {
    const [session, setSession] = useState(null)
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check initial session
        getCurrentSession().then(sess => {
            setSession(sess)
            setUser(sess?.user ?? null)
            if (sess?.user) {
                fetchOne('profiles', sess.user.id).then(p => setProfile(p))
            }
            setLoading(false)
        }).catch(() => {
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = onAuthStateChange((event, sess) => {
            setSession(sess)
            setUser(sess?.user ?? null)
            if (sess?.user) {
                fetchOne('profiles', sess.user.id).then(p => setProfile(p))
            } else {
                setProfile(null)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    return { session, user, profile, loading }
}
