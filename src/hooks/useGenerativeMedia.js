import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useGenerativeMedia() {
    const [isGeneratingVFX, setIsGeneratingVFX] = useState(false)
    const [isGeneratingImage, setIsGeneratingImage] = useState(false)
    const [error, setError] = useState(null)

    const generateVideo = useCallback(async (prompt, options = {}) => {
        setIsGeneratingVFX(true)
        setError(null)
        try {
            const { data, error: fnError } = await supabase.functions.invoke('veo-generate', {
                body: { prompt, options }
            })

            if (fnError) throw fnError

            return data
        } catch (err) {
            if (import.meta.env.DEV) console.error('Failed to generate Veo3 Video:', err)
            setError(err.message)
            throw err
        } finally {
            setIsGeneratingVFX(false)
        }
    }, [])

    const generateImage = useCallback(async (prompt, modelInputs = {}) => {
        setIsGeneratingImage(true)
        setError(null)
        try {
            const { data, error: fnError } = await supabase.functions.invoke('banana-generate', {
                body: { prompt, modelInputs }
            })

            if (fnError) throw fnError

            return data
        } catch (err) {
            if (import.meta.env.DEV) console.error('Failed to generate Nano Banana Image:', err)
            setError(err.message)
            throw err
        } finally {
            setIsGeneratingImage(false)
        }
    }, [])

    return {
        generateVideo,
        generateImage,
        isGeneratingVFX,
        isGeneratingImage,
        error
    }
}
