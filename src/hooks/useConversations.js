// ═══════════════════════════════════════════════════
// OCULOPS — React Hook: useConversations
// Supabase-connected hook for messaging conversations + messages
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { callSupabaseFunction, supabase, insertRow, updateRow, subscribeDebouncedToTable } from '../lib/supabase'

const GOVERNED_MESSAGING_CHANNELS = new Set(['email', 'whatsapp'])

function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function extractControlPlaneDispatchResult(controlPlaneDispatch) {
    const controlPlaneData = asRecord(controlPlaneDispatch?.data)
    const dispatchResult = asRecord(controlPlaneData.dispatch_result)
    if (Object.keys(dispatchResult).length === 0) {
        return controlPlaneDispatch
    }

    return {
        ...dispatchResult,
        control_plane: {
            action: controlPlaneDispatch?.action || 'tool_dispatch',
            trace_id: controlPlaneDispatch?.trace_id || null,
            correlation_id: controlPlaneDispatch?.correlation_id || null,
        },
    }
}

export function useConversations() {
    const [conversations, setConversations] = useState([])
    const [activeConvo, setActiveConvo] = useState(null)
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadConversations = useCallback(async () => {
        setLoading(true)
        try {
            if (!supabase) {
                setConversations([])
                setLoading(false)
                return
            }

            const { data: { session } } = await supabase.auth.getSession()
            let query = supabase
                .from('conversations')
                .select(`
                    *,
                    contact:contacts(id, name, email, phone, linkedin_url, company_id),
                    channel:messaging_channels(id, name, type)
                `)

            if (session?.user?.id) query = query.or(`user_id.eq.${session.user.id},user_id.is.null`)
            else query = query.is('user_id', null)

            const { data, error: queryError } = await query
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })

            if (queryError) throw queryError
            setConversations(data || [])
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }, [])

    const loadMessages = useCallback(async (conversationId) => {
        if (!conversationId) return
        try {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
            setMessages(data || [])
        } catch (err) {
            setError(err.message)
        }
    }, [])

    useEffect(() => {
        loadConversations()
        const channel = subscribeDebouncedToTable('conversations', (payload) => {
            if (payload.eventType === 'DELETE') {
                setConversations(prev => prev.filter(c => c.id !== payload.old.id))
                return
            }

            loadConversations()
        })
        return () => channel?.unsubscribe()
    }, [loadConversations])

    // Subscribe to messages when active conversation changes
    useEffect(() => {
        if (!activeConvo) return
        loadMessages(activeConvo)
        const channel = subscribeDebouncedToTable('messages', (payload) => {
            if (payload.new?.conversation_id === activeConvo) {
                if (payload.eventType === 'INSERT') setMessages(prev => [...prev, payload.new])
                else if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
            }
        })
        return () => channel?.unsubscribe()
    }, [activeConvo, loadMessages])

    const sendMessage = async (conversationId, content, options = {}) => {
        const {
            direction = 'outbound',
            contentType = 'text',
            status = 'sent',
            metadata = null,
            mediaUrl = null,
            externalId = null,
        } = options

        const result = await insertRow('messages', {
            conversation_id: conversationId,
            content,
            direction,
            content_type: contentType,
            status,
            metadata,
            media_url: mediaUrl,
            external_id: externalId,
        })
        await updateRow('conversations', conversationId, {
            last_message_at: new Date().toISOString(),
            status: direction === 'outbound' ? 'pending' : 'open',
        })
        await loadConversations()
        return result
    }

    const dispatchMessage = async ({ messageId, conversationId, channel, subject, body, metadata = {} }) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const requestMetadata = {
                ...metadata,
                source: GOVERNED_MESSAGING_CHANNELS.has(channel) ? 'messaging_ui' : (metadata?.source || 'manual'),
                risk_class: GOVERNED_MESSAGING_CHANNELS.has(channel) ? 'high' : (metadata?.risk_class || 'medium'),
            }

            const payload = {
                message_id: messageId,
                conversation_id: conversationId,
                channel,
                subject,
                body,
                metadata: requestMetadata,
            }

            const data = GOVERNED_MESSAGING_CHANNELS.has(channel)
                ? extractControlPlaneDispatchResult(await callSupabaseFunction('control-plane', {
                    body: {
                        action: 'tool_dispatch',
                        user_id: session?.user?.id || null,
                        source_agent: 'outreach',
                        source: 'messaging_ui',
                        target_type: 'agent_action',
                        target_ref: 'messaging-dispatch',
                        risk_class: 'high',
                        tool_code_name: 'messaging-dispatch',
                        context: {
                            conversation_id: conversationId,
                            channel,
                            send_live: true,
                        },
                        payload,
                    },
                }))
                : await callSupabaseFunction('messaging-dispatch', { body: payload })

            await loadConversations()
            const dispatchMessageRecord = asRecord(data?.message)
            const dispatchResultRecord = asRecord(data?.result)
            const refreshedConversationId =
                conversationId
                || dispatchMessageRecord.conversation_id
                || dispatchResultRecord.conversation_id
                || null

            if (refreshedConversationId) {
                await loadMessages(refreshedConversationId)
            }

            return data
        } catch (err) {
            setError(err.message)
            return { error: err.message }
        }
    }

    const selectConversation = async (id) => {
        setActiveConvo(id)
        // Mark as read
        await updateRow('conversations', id, { unread_count: 0 })
        await loadConversations()
    }

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

    return {
        conversations, messages, activeConvo, loading, error,
        sendMessage, dispatchMessage, selectConversation, totalUnread,
        reload: loadConversations
    }
}
