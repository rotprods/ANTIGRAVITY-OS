import { useCallback, useEffect, useMemo, useState } from 'react'
import { callSupabaseFunction, subscribeDebouncedToTable, supabase } from '../lib/supabase'

export function useMessagingChannels() {
    const [channels, setChannels] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(null)
    const [error, setError] = useState(null)

    const loadChannels = useCallback(async () => {
        if (!supabase) {
            setChannels([])
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            let query = supabase
                .from('messaging_channels')
                .select('*')
                .order('type', { ascending: true })
                .order('is_default', { ascending: false })
                .order('updated_at', { ascending: false })

            if (session?.user?.id) query = query.or(`user_id.eq.${session.user.id},user_id.is.null`)
            else query = query.is('user_id', null)

            const { data, error: queryError } = await query
            if (queryError) throw queryError
            setChannels(data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadChannels()
        const channel = subscribeDebouncedToTable('messaging_channels', () => loadChannels())
        return () => channel?.unsubscribe()
    }, [loadChannels])

    useEffect(() => {
        if (typeof window === 'undefined') return undefined

        const handleMessage = (event) => {
            if (event?.data?.type === 'oculops:channel-connected') {
                loadChannels()
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [loadChannels])

    const callFunction = useCallback(async (endpoint, body) => {
        return callSupabaseFunction(endpoint, { body })
    }, [])

    const connectGmail = useCallback(async () => {
        setBusy('gmail')
        setError(null)

        try {
            const data = await callFunction('messaging-channel-oauth', { action: 'begin', channel: 'email' })
            if (data.auth_url) window.open(data.auth_url, '_blank', 'noopener,noreferrer')
            await loadChannels()
            return data
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setBusy(null)
        }
    }, [callFunction, loadChannels])

    const connectWhatsApp = useCallback(async () => {
        setBusy('whatsapp')
        setError(null)

        try {
            const data = await callFunction('messaging-channel-oauth', { action: 'bootstrap_whatsapp' })
            await loadChannels()
            return data
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setBusy(null)
        }
    }, [callFunction, loadChannels])

    const disconnectChannel = useCallback(async (channelId) => {
        setBusy(channelId)
        try {
            const data = await callFunction('messaging-channel-oauth', { action: 'disconnect', channel_id: channelId })
            await loadChannels()
            return data
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setBusy(null)
        }
    }, [callFunction, loadChannels])

    const syncGmail = useCallback(async (channelId) => {
        setBusy(`sync:${channelId}`)
        try {
            const data = await callFunction('gmail-inbound', { action: 'sync', channel_id: channelId })
            await loadChannels()
            return data
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        } finally {
            setBusy(null)
        }
    }, [callFunction, loadChannels])

    const byType = useMemo(() => channels.reduce((acc, channel) => {
        if (!acc[channel.type]) acc[channel.type] = channel
        return acc
    }, {}), [channels])

    return {
        channels,
        byType,
        loading,
        busy,
        error,
        connectGmail,
        connectWhatsApp,
        disconnectChannel,
        syncGmail,
        reload: loadChannels,
    }
}

export default useMessagingChannels
