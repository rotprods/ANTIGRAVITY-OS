// ═══════════════════════════════════════════════════
// OCULOPS — ModuleSkeleton
// War-room loading state replacing text spinners
// ═══════════════════════════════════════════════════

/**
 * @param {Object} props
 * @param {string} [props.title] - Optional module title to show during loading
 * @param {number} [props.rows=4] - Number of skeleton rows
 * @param {'table'|'cards'|'kpi'} [props.variant='table'] - Layout variant
 */
export default function ModuleSkeleton({ title, rows = 4, variant = 'table' }) {
    if (variant === 'kpi') {
        return (
            <div className="fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {title && <div className="skeleton" style={{ width: '200px', height: '20px' }} />}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--color-border)', border: '1px solid var(--color-border)' }}>
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                            <div className="skeleton" style={{ width: '50px', height: '22px' }} />
                        </div>
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ width: '100%', height: '40px' }} />
                ))}
            </div>
        )
    }

    if (variant === 'cards') {
        return (
            <div className="fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {title && <div className="skeleton" style={{ width: '200px', height: '20px' }} />}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-2)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="skeleton" style={{ width: '60%', height: '14px' }} />
                            <div className="skeleton" style={{ width: '100%', height: '10px' }} />
                            <div className="skeleton" style={{ width: '40%', height: '10px' }} />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // Default: table variant
    return (
        <div className="fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {title && <div className="skeleton" style={{ width: '200px', height: '20px', marginBottom: '8px' }} />}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: '60px', height: '12px' }} />
                    <div className="skeleton" style={{ flex: 1, height: '12px' }} />
                    <div className="skeleton" style={{ width: '80px', height: '12px' }} />
                </div>
            ))}
        </div>
    )
}
