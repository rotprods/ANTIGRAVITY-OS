import { useCallback, useState } from 'react'
import { callSupabaseFunction } from '../lib/supabase'

// ─── Sheets ──────────────────────────────────────────────────────────────────

export function useSheetsSync() {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const exportCRM = useCallback(async (spreadsheetId = null) => {
        setBusy(true)
        setError(null)
        try {
            const result = await callSupabaseFunction('sheets-crm-sync', {
                body: { action: 'export', spreadsheetId },
            })
            return result
        } catch (err) {
            setError(err.message)
            throw err
        } finally {
            setBusy(false)
        }
    }, [])

    const listSpreadsheets = useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
            const result = await callSupabaseFunction('sheets-crm-sync', {
                body: { action: 'list' },
            })
            return result.files || []
        } catch (err) {
            setError(err.message)
            return []
        } finally {
            setBusy(false)
        }
    }, [])

    return { exportCRM, listSpreadsheets, busy, error }
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export function useCalendar() {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const createFollowUp = useCallback(async (dealId, opts = {}) => {
        setBusy(true)
        setError(null)
        try {
            const result = await callSupabaseFunction('calendar-followups', {
                body: { action: 'create_followup', dealId, ...opts },
            })
            return result
        } catch (err) {
            setError(err.message)
            throw err
        } finally {
            setBusy(false)
        }
    }, [])

    const listEvents = useCallback(async (timeMin, timeMax) => {
        setBusy(true)
        setError(null)
        try {
            const result = await callSupabaseFunction('calendar-followups', {
                body: {
                    action: 'list',
                    timeMin: timeMin || new Date().toISOString(),
                    timeMax: timeMax || new Date(Date.now() + 30 * 86400000).toISOString(),
                },
            })
            return result.events || []
        } catch (err) {
            setError(err.message)
            return []
        } finally {
            setBusy(false)
        }
    }, [])

    const createEvent = useCallback(async (event) => {
        setBusy(true)
        setError(null)
        try {
            const result = await callSupabaseFunction('calendar-followups', {
                body: { action: 'create_event', event },
            })
            return result.event
        } catch (err) {
            setError(err.message)
            throw err
        } finally {
            setBusy(false)
        }
    }, [])

    const deleteEvent = useCallback(async (eventId) => {
        setBusy(true)
        setError(null)
        try {
            await callSupabaseFunction('calendar-followups', {
                body: { action: 'delete_event', eventId },
            })
        } catch (err) {
            setError(err.message)
            throw err
        } finally {
            setBusy(false)
        }
    }, [])

    return { createFollowUp, listEvents, createEvent, deleteEvent, busy, error }
}
