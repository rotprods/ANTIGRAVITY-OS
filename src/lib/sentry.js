// OCULOPS — Sentry Error Tracking
// Initialize in main.jsx BEFORE React renders

import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
    if (!SENTRY_DSN) {
        console.warn('[Sentry] No DSN configured — error tracking disabled')
        return
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        release: `oculops@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        ],
        tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        beforeSend(event) {
            // Don't send in dev mode
            if (import.meta.env.DEV) return null
            return event
        },
    })
}

export { Sentry }
