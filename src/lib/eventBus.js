// ═══════════════════════════════════════════════════
// OCULOPS — Event Bus Helper
// Insert events into event_log → triggers pg_notify
// ═══════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Emit an event by inserting into the event_log table.
 * The DB trigger broadcasts it via pg_notify automatically.
 *
 * @param {string} eventType - e.g. 'agent.started', 'deal.stage_changed'
 * @param {object} payload - arbitrary JSON payload
 * @returns {Promise<object|null>} the inserted row or null on error
 */
export async function emitEvent(eventType, payload = {}) {
    if (!isSupabaseConfigured) return null

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
        .from('event_log')
        .insert({
            event_type: eventType,
            payload,
            user_id: user?.id || null,
        })
        .select()
        .single()

    if (error) {
        if (import.meta.env.DEV) console.error('emitEvent error:', error)
        return null
    }

    return data
}
