import { useState, useEffect } from 'react';

export function useReadiness() {
    const [bridgeStatus, setBridgeStatus] = useState('checking'); // checking, online, offline
    const [bridgeInfo, setBridgeInfo] = useState(null);

    useEffect(() => {
        let isSubscribed = true;
        let retryCount = 0;
        const MAX_RETRIES = 5;

        async function checkBridge() {
            try {
                // Call local dashboard API endpoint matching ControlTower's logic
                const res = await fetch('http://127.0.0.1:38791/health');
                
                if (!isSubscribed) return;

                if (!res.ok) {
                    throw new Error('Health probe failed');
                }
                
                const data = await res.json();
                
                if (data && data.status === 'ok') {
                    setBridgeStatus('online');
                    setBridgeInfo(data);
                    retryCount = 0;
                } else {
                    setBridgeStatus('offline');
                }
            } catch (err) {
                if (!isSubscribed) return;
                
                setBridgeStatus('offline');
                
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    setTimeout(checkBridge, delay);
                }
            }
        }

        checkBridge();
        const interval = setInterval(checkBridge, 60000);
        
        return () => {
            isSubscribed = false;
            clearInterval(interval);
        };
    }, []);

    return { bridgeStatus, bridgeInfo, isOnline: bridgeStatus === 'online' };
}
