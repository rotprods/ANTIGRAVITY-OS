// ═══════════════════════════════════════════════════
// OCULOPS — useGeoSearch Hook
// Calls google-maps-search and web-analyzer edge functions
// ═══════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { callSupabaseFunction } from '../lib/supabase'

function normalizePlace(place, index = 0) {
    const website = place.website || place.website_url || null
    const address = place.address || place.location || place.formatted_address || ''
    const name = place.name || place.business_name || `Target ${index + 1}`

    return {
        id: place.id || place.place_id || place.google_maps_id || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
        place_id: place.place_id || place.google_maps_id || null,
        name,
        address,
        city: place.city || null,
        lat: typeof place.lat === 'number' ? place.lat : typeof place.latitude === 'number' ? place.latitude : null,
        lng: typeof place.lng === 'number' ? place.lng : typeof place.longitude === 'number' ? place.longitude : null,
        category: place.category || place.primary_type || '',
        phone: place.phone || place.formatted_phone_number || null,
        website,
        has_website: place.has_website ?? Boolean(website),
        rating: place.rating || null,
        review_count: place.review_count ?? place.user_ratings_total ?? 0,
        source: place.source || 'google_maps',
        status: place.status || 'detected',
        maps_url: place.maps_url || place.url || null,
        business_status: place.business_status || null,
    }
}

export function useGeoSearch() {
    const [results, setResults] = useState([])
    const [scanning, setScanning] = useState(false)
    const [analyzing, setAnalyzing] = useState(null) // lead_id being analyzed
    const [qualifying, setQualifying] = useState(null)
    const [error, setError] = useState(null)

    // Search businesses via Google Maps
    const searchPlaces = useCallback(async (params = {}) => {
        setScanning(true)
        setError(null)
        try {
            const resolveOnly = Boolean(params.resolve_only || params.resolveOnly)
            const data = await callSupabaseFunction('google-maps-search', { body: params })
            const normalized = [...(data.places || []), ...(data.leads || []), ...(data.with_website || [])]
                .reduce((acc, place, index) => {
                    const normalizedPlace = normalizePlace(place, index)
                    if (!acc.some(item => item.id === normalizedPlace.id)) acc.push(normalizedPlace)
                    return acc
                }, [])
            if (!resolveOnly) setResults(normalized)
            return { ...data, places: normalized }
        } catch (err) {
            setError(err.message)
            return { places: [], error: err.message }
        } finally {
            setScanning(false)
        }
    }, [])

    // Analyze a website
    const analyzeWebsite = useCallback(async (website, leadId) => {
        setAnalyzing(leadId)
        try {
            return await callSupabaseFunction('web-analyzer', {
                body: { website, lead_id: leadId }
            })
        } catch (err) {
            return { error: err.message }
        } finally {
            setAnalyzing(null)
        }
    }, [])

    // AI qualify a lead
    const qualifyLead = useCallback(async (leadId) => {
        setQualifying(leadId)
        try {
            return await callSupabaseFunction('ai-qualifier', {
                body: { lead_id: leadId }
            })
        } catch (err) {
            return { error: err.message }
        } finally {
            setQualifying(null)
        }
    }, [])

    return {
        results, scanning, analyzing, qualifying, error,
        searchPlaces, analyzeWebsite, qualifyLead,
    }
}
