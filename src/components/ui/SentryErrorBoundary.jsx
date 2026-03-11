// OCULOPS — Sentry Error Boundary
// Wraps app to catch and report React errors

import * as Sentry from '@sentry/react'

export function SentryErrorBoundary({ children }) {
    return (
        <Sentry.ErrorBoundary
            fallback={({ error, resetError }) => (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: '100vh', background: '#000', color: '#FFD400', fontFamily: 'monospace', gap: '16px', padding: '32px'
                }}>
                    <div style={{ fontSize: '48px' }}>SYSTEM FAILURE</div>
                    <div style={{ color: '#FF3333', fontSize: '12px', maxWidth: '600px', textAlign: 'center', lineHeight: '1.6' }}>
                        {error?.message || 'Unknown error'}
                    </div>
                    <button
                        onClick={resetError}
                        style={{ marginTop: '24px', padding: '12px 32px', background: '#FFD400', color: '#000', border: 'none', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.1em' }}
                    >
                        REBOOT SYSTEM
                    </button>
                </div>
            )}
            showDialog
        >
            {children}
        </Sentry.ErrorBoundary>
    )
}
