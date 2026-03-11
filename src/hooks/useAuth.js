import { useEffect, useSyncExternalStore } from 'react'
import { fetchOne, getCurrentSession, onAuthStateChange } from '../lib/supabase'

const DEFAULT_SNAPSHOT = {
    session: null,
    user: null,
    profile: null,
    loading: true,
}

let authSnapshot = DEFAULT_SNAPSHOT
let authBootstrapped = false
let authRevision = 0
const listeners = new Set()

function emitChange() {
    listeners.forEach(listener => listener())
}

function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

function getSnapshot() {
    return authSnapshot
}

function setSnapshot(nextSnapshot) {
    authSnapshot = nextSnapshot
    emitChange()
}

async function syncAuthSnapshot(session) {
    const revision = ++authRevision
    const user = session?.user ?? null

    if (!user) {
        setSnapshot({
            session: null,
            user: null,
            profile: null,
            loading: false,
        })
        return
    }

    setSnapshot({
        session,
        user,
        profile: authSnapshot.profile,
        loading: true,
    })

    const profile = await fetchOne('profiles', user.id).catch(() => null)
    if (revision !== authRevision) return

    setSnapshot({
        session,
        user,
        profile,
        loading: false,
    })
}

function ensureAuthBootstrap() {
    if (authBootstrapped) return
    authBootstrapped = true

    getCurrentSession()
        .then(session => syncAuthSnapshot(session))
        .catch(() => {
            setSnapshot({
                session: null,
                user: null,
                profile: null,
                loading: false,
            })
        })

    const { data: { subscription } } = onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED') {
            setSnapshot({
                ...authSnapshot,
                session,
                user: session?.user ?? null,
            })
            return
        }

        void syncAuthSnapshot(session)
    })

    void subscription
}

export function useAuth() {
    useEffect(() => {
        ensureAuthBootstrap()
    }, [])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
