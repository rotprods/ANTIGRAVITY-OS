import { useState, useEffect } from 'react'
import { getRuntimeReadiness, loadRuntimeConfig } from '../lib/runtimeClient'

export function useReadiness() {
    const [bridgeStatus, setBridgeStatus] = useState('checking')
    const [bridgeInfo, setBridgeInfo] = useState(null)

    useEffect(() => {
        let isSubscribed = true
        let retryCount = 0
        const MAX_RETRIES = 5

        async function checkBridge() {
            try {
                const config = loadRuntimeConfig()
                const data = await getRuntimeReadiness(config)

                if (!isSubscribed) return

                if (data && typeof data === 'object' && !data.error) {
                    setBridgeStatus('online')
                    setBridgeInfo(data)
                    retryCount = 0
                } else {
                    setBridgeStatus('offline')
                }
            } catch {
                if (!isSubscribed) return

                setBridgeStatus('offline')

                if (retryCount < MAX_RETRIES) {
                    retryCount++
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
                    setTimeout(checkBridge, delay)
                }
            }
        }

        checkBridge()
        const interval = setInterval(checkBridge, 60000)

        return () => {
            isSubscribed = false
            clearInterval(interval)
        }
    }, [])

    return { bridgeStatus, bridgeInfo, isOnline: bridgeStatus === 'online' }
}
