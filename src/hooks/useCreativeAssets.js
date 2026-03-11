import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeDebouncedToTable } from '../lib/supabase'

export function useCreativeAssets() {
    const [assets, setAssets] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('creative_assets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30)
        setAssets(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
        const channel = subscribeDebouncedToTable('creative_assets', load)
        return () => channel?.unsubscribe()
    }, [load])

    // Runs the full request → job → generate → asset persistence chain.
    // generatorFn must return { url } (already normalized by useGenerativeMedia).
    const persistGeneration = useCallback(async (prompt, type, generatorFn) => {
        const engine = type === 'video' ? 'veo3' : 'banana'

        // 1. creative_request
        const { data: request, error: reqErr } = await supabase
            .from('creative_requests')
            .insert({ title: prompt.slice(0, 100), format: type, platform: 'studio', prompt, status: 'processing' })
            .select()
            .single()
        if (reqErr) throw new Error(reqErr.message)

        // 2. creative_job
        const { data: job, error: jobErr } = await supabase
            .from('creative_jobs')
            .insert({
                request_id: request.id,
                engine,
                status: 'running',
                started_at: new Date().toISOString(),
                input_payload: { prompt }
            })
            .select()
            .single()
        if (jobErr) throw new Error(jobErr.message)

        try {
            // 3. Call the actual generator (edge function)
            const result = await generatorFn()
            const url = result?.url ?? null

            // 4. creative_asset
            const { data: asset, error: assetErr } = await supabase
                .from('creative_assets')
                .insert({
                    job_id: job.id,
                    request_id: request.id,
                    asset_type: type,
                    public_url: url,
                    prompt_used: prompt,
                    engine,
                    status: 'ready'
                })
                .select()
                .single()
            if (assetErr) throw new Error(assetErr.message)

            // 5. Mark job + request completed (fire-and-forget)
            const now = new Date().toISOString()
            await Promise.all([
                supabase.from('creative_jobs').update({ status: 'completed', completed_at: now }).eq('id', job.id),
                supabase.from('creative_requests').update({ status: 'completed' }).eq('id', request.id)
            ])

            return asset
        } catch (err) {
            // Mark job + request failed (fire-and-forget)
            await Promise.all([
                supabase.from('creative_jobs').update({ status: 'failed', error_message: err.message }).eq('id', job.id),
                supabase.from('creative_requests').update({ status: 'failed' }).eq('id', request.id)
            ])
            throw err
        }
    }, [])

    return { assets, loading, persistGeneration, reload: load }
}
