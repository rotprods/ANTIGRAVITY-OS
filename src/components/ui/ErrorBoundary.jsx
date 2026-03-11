// ═══════════════════════════════════════════════════
// OCULOPS — Error Boundary
// Catches render errors per-module, prevents full crash
// ═══════════════════════════════════════════════════

import { Component } from 'react'

export class ErrorBoundary extends Component {
    state = { hasError: false, error: null }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, info) {
        if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: 'var(--space-8)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    color: 'var(--color-text-2)',
                }}>
                    <span style={{ fontSize: '2rem' }}>⚠️</span>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                        {this.state.error?.message || 'Error inesperado en este módulo'}
                    </p>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        Reintentar
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}
